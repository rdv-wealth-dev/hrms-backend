import mongoose from "mongoose";
import { EmployeeModel } from "../models/employee.model";
import { EmployeeFamilyRepository } from "../repositories/employee-family.repository";
import { EmployeeRepository } from "../repositories/employee.repository";
import { UserModel } from "../../user/user.model";
import {
  OnboardingStep1Input,
  OnboardingStep2Input,
  OnboardingStep3Input,
} from "../dto/onboarding-wizard.dto";
import { AppError } from "../../../shared/errors/app.error";
import { ErrorCode } from "../../../shared/errors/error-codes";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { recalculateProfileCompletion } from "../utils/profile-completion.util";
import { OrganizationModel } from "../../organization/organization.model";
import { EmployeeDocumentModel } from "../../employee-document/employee-document.model";
import { EmployeeBankAccountModel } from "../models/employee-bank-account.model";

export class OnboardingWizardService {
  private familyRepo = new EmployeeFamilyRepository();
  private empRepo    = new EmployeeRepository();

  private async resolveOwnEmployee(context: RequestContext) {
    const user = await UserModel.findOne({
      _id: new mongoose.Types.ObjectId(context.userId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    }).select("employeeId");
    if (!user?.employeeId) throw new AppError("No employee record is linked to this account", 404);

    const employee = await EmployeeModel.findById(user.employeeId);
    if (!employee) throw new AppError("Employee record not found", 404);
    return employee;
  }

  // Guards every step — you cannot skip ahead. Re-doing an already-completed
  // step is allowed (e.g. correcting a typo in step 1 after already on step 3).
  private assertStepAllowed(employee: any, requestedStep: number) {
    if (employee.onboardingComplete) {
      throw new AppError("Onboarding is already complete", 400);
    }
    if (requestedStep > employee.onboardingStep) {
      throw new AppError(
        `You must complete step ${employee.onboardingStep} before accessing step ${requestedStep}`,
        403
      );
    }
  }

  // Get current wizard state — frontend calls this to know where to render 
  async getStatus(context: RequestContext) {
    const employee = await this.resolveOwnEmployee(context);
    
    // Sync onboardingStep and stepsCompleted based on current DB state (in case HR updated details)
    await recalculateProfileCompletion(context.tenantId, employee._id.toString());
    const refreshed = await EmployeeModel.findById(employee._id);

    return {
      onboardingStep:            refreshed!.onboardingStep,
      onboardingComplete:        refreshed!.onboardingComplete,
      onboardingStepsCompleted:  refreshed!.onboardingStepsCompleted,
    };
  }

  // Step 1 — Personal Details 
  async submitStep1(context: RequestContext, input: OnboardingStep1Input) {
    const employee = await this.resolveOwnEmployee(context);
    this.assertStepAllowed(employee, 1);

    // Merge inputs with existing values on the employee record (e.g. from HR create employee step)
    const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : employee.dateOfBirth;
    const gender = input.gender ?? employee.gender;
    const bloodGroup = input.bloodGroup ?? employee.bloodGroup;
    const maritalStatus = input.maritalStatus ?? employee.maritalStatus;
    const phone = input.phone ?? employee.phone;
    const currentAddress = input.currentAddress ?? employee.currentAddress;
    const emergencyContacts = input.emergencyContact ?? employee.emergencyContacts;

    // Validate that required fields are complete after merge
    if (!dateOfBirth) throw new AppError("Date of birth is required", 400, ErrorCode.VALIDATION_FAILED);
    if (!gender) throw new AppError("Gender is required", 400, ErrorCode.VALIDATION_FAILED);
    if (!maritalStatus) throw new AppError("Marital status is required", 400, ErrorCode.VALIDATION_FAILED);
    if (!phone) throw new AppError("Phone number is required", 400, ErrorCode.VALIDATION_FAILED);
    if (!currentAddress || !currentAddress.addressLine1 || !currentAddress.city || !currentAddress.state || !currentAddress.countryCode || !currentAddress.zip) {
      throw new AppError("Current address details (addressLine1, city, state, countryCode, zip) are required", 400, ErrorCode.VALIDATION_FAILED);
    }
    if (!emergencyContacts || emergencyContacts.length === 0) {
      throw new AppError("At least one emergency contact is required", 400, ErrorCode.VALIDATION_FAILED);
    }

    // Apply values to employee model
    employee.dateOfBirth       = dateOfBirth;
    employee.gender            = gender as any;
    employee.bloodGroup        = bloodGroup as any;
    employee.maritalStatus     = maritalStatus as any;
    employee.phone             = phone;
    employee.currentAddress    = currentAddress as any;
    employee.emergencyContacts = emergencyContacts as any;

    // Save optional document numbers (e.g. PAN, Aadhaar, Passport)
    if (input.pan !== undefined) employee.pan = input.pan;
    if (input.aadhaar !== undefined) employee.aadhaar = input.aadhaar;
    if (input.passportNo !== undefined) employee.passportNo = input.passportNo;

    employee.onboardingStepsCompleted.personalDetails = true;
    await employee.save();

    // Recalculate wizard step dynamically based on completed sections
    await recalculateProfileCompletion(context.tenantId, employee._id.toString());
    const refreshed = await EmployeeModel.findById(employee._id);

    return { message: "Personal details saved", nextStep: refreshed!.onboardingStep };
  }

  // Step 2 — Family Details 
  async submitStep2(context: RequestContext, input: OnboardingStep2Input) {
    const employee = await this.resolveOwnEmployee(context);
    this.assertStepAllowed(employee, 2);

    await this.familyRepo.replaceAllForEmployee(
      context, employee._id.toString(), employee.branchId.toString(), input.familyMembers as any
    );

    employee.onboardingStepsCompleted.familyDetails = true;
    await employee.save();

    // Recalculate wizard step dynamically
    await recalculateProfileCompletion(context.tenantId, employee._id.toString());
    const refreshed = await EmployeeModel.findById(employee._id);

    return { message: "Family details saved", nextStep: refreshed!.onboardingStep };
  }

  // Step 3 — Bank Details 
  async submitStep3(context: RequestContext, input: OnboardingStep3Input) {
    const employee = await this.resolveOwnEmployee(context);
    this.assertStepAllowed(employee, 3);

    // If inputs are missing, check if there's already a bank account populated by HR
    const hasExistingBank = employee.onboardingStepsCompleted.bankDetails || (await EmployeeBankAccountModel.countDocuments({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: employee._id,
      isActive: true,
      isDeleted: false,
    })) > 0;

    const bankName = input.bankName;
    const accountNumber = input.accountNumber;
    const ifscCode = input.ifscCode;
    const accountType = input.accountType ?? "SALARY";

    if (!bankName || !accountNumber || !ifscCode) {
      if (hasExistingBank) {
        // Safe to skip/accept since bank account exists
        employee.onboardingStepsCompleted.bankDetails = true;
        await employee.save();
        await recalculateProfileCompletion(context.tenantId, employee._id.toString());
        const refreshed = await EmployeeModel.findById(employee._id);
        return { message: "Bank details verified", nextStep: refreshed!.onboardingStep };
      }
      throw new AppError("Bank name, account number, and IFSC code are required", 400, ErrorCode.VALIDATION_FAILED);
    }

    await this.empRepo.addBankAccount({
      tenantId:      employee.tenantId as any,
      branchId:      employee.branchId as any,
      employeeId:    employee._id as any,
      bankName:      bankName,
      accountNumber: accountNumber,
      ifscCode:      ifscCode,
      accountType:   accountType as any,
      isPrimary:     true,
      isActive:      true,
      createdBy:     new mongoose.Types.ObjectId(context.userId) as any,
      updatedBy:     new mongoose.Types.ObjectId(context.userId) as any,
    });

    employee.onboardingStepsCompleted.bankDetails = true;
    await employee.save();

    // Recalculate wizard step dynamically
    await recalculateProfileCompletion(context.tenantId, employee._id.toString());
    const refreshed = await EmployeeModel.findById(employee._id);

    return { message: "Bank details saved", nextStep: refreshed!.onboardingStep };
  }

  // Step 4 — Documents (checked, not submitted — uses existing upload routes) 
  // Called after the employee has uploaded via the existing /me/documents flow.
  // This just validates the mandatory set is met and advances the wizard.
  async confirmStep4(context: RequestContext) {
    const employee = await this.resolveOwnEmployee(context);
    this.assertStepAllowed(employee, 4);

    // Reuses the existing mandatory-docs check from the profile completion gate
    await recalculateProfileCompletion(context.tenantId, employee._id.toString());
    const refreshed = await EmployeeModel.findById(employee._id);

    if (!refreshed!.profileCompletion.mandatoryDocs) {
      // Find missing documents dynamically to show in the error message
      const org = await OrganizationModel.findById(context.tenantId).select("mandatoryDocumentTypes");
      const required = org?.mandatoryDocumentTypes ?? [];

      const uploadedTypes = await EmployeeDocumentModel.distinct("documentType", {
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        employeeId: employee._id,
        isDeleted: false,
      }) as unknown as string[];

      const documentLabels: Record<string, string> = {
        PAN: "PAN Card",
        AADHAAR: "Aadhaar Card", 
        PASSPORT: "Passport",
        DRIVING_LICENSE: "Driving License",
        OFFER_LETTER: "Offer Letter",
        RESUME: "Resume/CV",
        DEGREE: "Degree Certificate",
        EXPERIENCE: "Experience Certificate",
        OTHER: "Other Document"
      };

      const isIndia = (refreshed!.countryCode || "IN").toUpperCase() === "IN";
      const missing: string[] = [];
      required.forEach((t: string) => {
        const label = documentLabels[t] || t;
        if (t === "PAN") {
          const hasIt = isIndia 
            ? (!!refreshed!.pan || uploadedTypes.includes("PAN"))
            : uploadedTypes.includes("PAN");
          if (!hasIt) {
            missing.push(isIndia ? `${label} Number or Document` : `${label} Document`);
          }
        } else if (t === "AADHAAR") {
          const hasIt = isIndia 
            ? (!!refreshed!.aadhaar || uploadedTypes.includes("AADHAAR"))
            : uploadedTypes.includes("AADHAAR");
          if (!hasIt) {
            missing.push(isIndia ? `${label} Number or Document` : `${label} Document`);
          }
        } else if (t === "PASSPORT") {
          const hasIt = !!refreshed!.passportNo || uploadedTypes.includes("PASSPORT");
          if (!hasIt) {
            missing.push(`${label} Number or Document`);
          }
        } else if (t !== "PAN" && t !== "AADHAAR" && t !== "PASSPORT") {
          if (!uploadedTypes.includes(t)) {
            missing.push(`${label} Document`);
          }
        }
      });

      if (missing.length > 0) {
        throw new AppError(
          `Please fill all required document details. Missing: ${missing.join(", ")}`,
          400,
          ErrorCode.VALIDATION_FAILED
        );
      }

      throw new AppError("Please upload all required documents before proceeding", 400, ErrorCode.VALIDATION_FAILED);
    }

    refreshed!.onboardingStepsCompleted.documents = true;
    if (refreshed!.onboardingStep === 4) refreshed!.onboardingStep = 5;
    await refreshed!.save();

    return { message: "Documents confirmed", nextStep: refreshed!.onboardingStep };
  }

  // Step 5 — Review & Submit — final lock 
  async submitStep5(context: RequestContext) {
    const employee = await this.resolveOwnEmployee(context);
    this.assertStepAllowed(employee, 5);

    const steps = employee.onboardingStepsCompleted;
    if (!steps.personalDetails || !steps.familyDetails || !steps.bankDetails || !steps.documents) {
      throw new AppError("All previous steps must be completed before final submission", 400);
    }

    employee.onboardingStepsCompleted.reviewed = true;
    employee.onboardingComplete = true;
    employee.isProfileComplete  = true; // ties into the existing dashboard gate

    await employee.save();
    return { message: "Onboarding complete! Welcome to the team." };
  }
}

export const onboardingWizardService = new OnboardingWizardService();