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
import { CustomFieldService } from "../../custom-field/custom-field.service";
import {
  UNDERGRADUATE_CATALOG,
  POSTGRADUATE_CATALOG,
  DIPLOMA_CATALOG,
  DOCTORATE_CATALOG,
  SCHOOL_BOARD_OPTIONS,
  INDIAN_STATE_BOARDS,
  getEducationCatalogForLevel,
} from "../constants/education-catalog.constant";

export class OnboardingWizardService {
  private familyRepo = new EmployeeFamilyRepository();
  private empRepo = new EmployeeRepository();

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

    // Fetch effective custom fields (Org + Branch + Dept) for onboarding
    const customFieldService = new CustomFieldService();
    const effectiveCustomFields = await customFieldService.getEffectiveFieldsForEmployee(
      context.tenantId,
      refreshed?.branchId?.toString(),
      refreshed?.departmentId?.toString(),
      { forOnboarding: true }
    );

    // ── 1. Step 1 Data (Personal Details & HR Pre-Filled Info) ──
    const step1Data = {
      firstName: refreshed?.firstName,
      lastName: refreshed?.lastName,
      email: refreshed?.email,
      employeeCode: refreshed?.employeeCode,
      joiningDate: refreshed?.joiningDate,
      phone: refreshed?.phone,
      dateOfBirth: refreshed?.dateOfBirth,
      gender: refreshed?.gender,
      bloodGroup: refreshed?.bloodGroup,
      maritalStatus: refreshed?.maritalStatus,
      religion: refreshed?.religion,
      nationality: refreshed?.nationality,
      fatherName: refreshed?.fatherName,
      fatherPhone: refreshed?.fatherPhone,
      motherName: refreshed?.motherName,
      motherPhone: refreshed?.motherPhone,
      highestQualification: refreshed?.highestQualification,
      educationDetails: refreshed?.educationDetails,
      previousEmployerName: refreshed?.previousEmployerName,
      previousEmployerLastWorkingDate: refreshed?.previousEmployerLastWorkingDate,
      currentAddress: refreshed?.currentAddress,
      permanentAddress: refreshed?.permanentAddress,
      emergencyContact: refreshed?.emergencyContacts,
      pan: refreshed?.pan,
      aadhaar: refreshed?.aadhaar,
      passportNo: refreshed?.passportNo,
      departmentId: refreshed?.departmentId,
      designationId: refreshed?.designationId,
      branchId: refreshed?.branchId,
      customFields: refreshed?.customFields instanceof Map
        ? Object.fromEntries(refreshed.customFields)
        : (refreshed?.customFields || {}),
      customFieldDefinitions: effectiveCustomFields.map((f: any) => ({
        _id: f._id,
        fieldLabel: f.fieldLabel,
        fieldKey: f.fieldKey,
        fieldType: f.fieldType,
        uiComponent: f.uiComponent || "DROPDOWN",
        scope: f.scope,
        wizardStep: f.wizardStep || 1,
        section: f.section || "PERSONAL_DETAILS",
        options: (f.options || []).map((opt: any) =>
          typeof opt === "string" ? { label: opt, value: opt } : opt
        ),
        placeholder: f.placeholder,
        helperText: f.helperText,
        defaultValue: f.defaultValue,
        isRequired: f.isRequired,
        order: f.order,
      })),
    };

    // ── 2. Step 2 Data (Family Details) ──
    const familyDocs = await this.familyRepo.findAllForEmployee(context, employee._id.toString());
    const isFamilyStepCompleted = !!refreshed?.onboardingStepsCompleted?.familyDetails;
    const hasFamilyDocs = (familyDocs || []).length > 0;
    const step2Data = {
      isNotApplicable: isFamilyStepCompleted && !hasFamilyDocs,
      familyMembers: (familyDocs || []).map((m: any) => ({
        fullName: m.fullName,
        relationship: m.relationship,
        dateOfBirth: m.dateOfBirth,
        gender: m.gender,
        isDependent: m.isDependent,
        occupation: m.occupation,
        phone: m.phone,
        isNominee: m.isNominee,
      })),
    };

    // ── 3. Step 3 Data (Bank Details) ──
    const bank = await EmployeeBankAccountModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: employee._id,
      isActive: true,
      isDeleted: false,
    });
    const step3Data = bank
      ? {
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        ifscCode: bank.ifscCode,
        accountType: bank.accountType,
      }
      : {};

    // ── 4. Step 4 Data (Documents) ──
    const uploadedDocs = await EmployeeDocumentModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: employee._id,
      isDeleted: false,
    }).select("documentType fileName fileUrl isVerified createdAt").lean();

    const org = await OrganizationModel.findById(context.tenantId).select("mandatoryDocumentTypes");
    const requiredDocTypes = org?.mandatoryDocumentTypes ?? [];

    const step4Data = {
      mandatoryRequired: requiredDocTypes,
      uploadedCount: uploadedDocs.length,
      documents: uploadedDocs,
      isComplete: !!refreshed?.onboardingStepsCompleted?.documents,
    };

    // ── 5. Step 5 Data (Review & Final Submission) ──
    const stepsCompleted = refreshed!.onboardingStepsCompleted || {
      personalDetails: false,
      familyDetails: false,
      bankDetails: false,
      documents: false,
      reviewed: false,
    };

    const allStepsCompleted = !!(
      stepsCompleted.personalDetails &&
      stepsCompleted.familyDetails &&
      stepsCompleted.bankDetails &&
      stepsCompleted.documents
    );

    const missingSteps: { step: number; key: string; label: string }[] = [];
    if (!stepsCompleted.personalDetails) {
      missingSteps.push({ step: 1, key: "personalDetails", label: "Personal & Education Details (Step 1)" });
    }
    if (!stepsCompleted.familyDetails) {
      missingSteps.push({ step: 2, key: "familyDetails", label: "Family Details (Step 2)" });
    }
    if (!stepsCompleted.bankDetails) {
      missingSteps.push({ step: 3, key: "bankDetails", label: "Bank Account Details (Step 3)" });
    }
    if (!stepsCompleted.documents) {
      missingSteps.push({ step: 4, key: "documents", label: "Mandatory KYC Documents (Step 4)" });
    }

    const step5Data = {
      canAccessReview: allStepsCompleted,
      allStepsCompleted,
      missingSteps,
      canContinueToApp: true,
      continueToAppUrl: "/dashboard",
      review: allStepsCompleted
        ? {
            personalAndEducation: step1Data,
            family: step2Data,
            bank: step3Data,
            documents: step4Data,
          }
        : null,
    };

    // Navigation & active step state
    const currentStep = Math.min(Math.max(refreshed!.onboardingStep || 1, 1), 5);
    const navigation = {
      currentStep,
      prevStep: currentStep > 1 ? currentStep - 1 : null,
      nextStep: currentStep < 5 ? currentStep + 1 : null,
      canGoPrev: currentStep > 1,
      canGoNext: currentStep < (allStepsCompleted ? 5 : 4),
      canSkipCurrentStep: currentStep < 5,
      canAccessStep5: allStepsCompleted,
      continueToAppUrl: "/dashboard",
    };

    return {
      onboardingStep: refreshed!.onboardingStep,
      onboardingComplete: refreshed!.onboardingComplete,
      onboardingStepsCompleted: refreshed!.onboardingStepsCompleted,
      navigation,
      educationCatalog: {
        UNDER_GRADUATE: UNDERGRADUATE_CATALOG,
        POST_GRADUATE: POSTGRADUATE_CATALOG,
        DIPLOMA: DIPLOMA_CATALOG,
        DOCTORATE: DOCTORATE_CATALOG,
        boardOptions: SCHOOL_BOARD_OPTIONS,
        stateBoards: INDIAN_STATE_BOARDS,
      },
      step1Data,
      step2Data,
      step3Data,
      step4Data,
      step5Data,
    };
  }

  // Skip a specific wizard step to fill later
  async skipStep(context: RequestContext, stepToSkip?: number) {
    const employee = await this.resolveOwnEmployee(context);
    const current = stepToSkip || employee.onboardingStep || 1;

    if (current >= 5) {
      throw new AppError("Step 5 (Final Review) cannot be skipped. Complete all steps to finish onboarding.", 400);
    }

    if (current === 2) {
      employee.onboardingStepsCompleted.familyDetails = true;
    } else if (current === 4) {
      employee.onboardingStepsCompleted.documents = true;
    }

    const nextStep = Math.min(current + 1, 4);
    employee.onboardingStep = nextStep;
    await employee.save();

    await recalculateProfileCompletion(context.tenantId, employee._id.toString());

    return {
      message: `Step ${current} skipped. You can complete it later.`,
      currentStep: nextStep,
      nextStep,
      continueToAppUrl: "/dashboard",
    };
  }

  // Navigate to a specific wizard step (Previous / Next)
  async navigateStep(context: RequestContext, targetStep: number) {
    const employee = await this.resolveOwnEmployee(context);

    if (targetStep < 1 || targetStep > 5) {
      throw new AppError("Invalid wizard step. Must be between 1 and 5.", 400);
    }

    if (targetStep === 5) {
      const steps = employee.onboardingStepsCompleted;
      const allDone = !!(steps?.personalDetails && steps?.familyDetails && steps?.bankDetails && steps?.documents);
      if (!allDone) {
        throw new AppError(
          "Cannot access Step 5 (Final Review). Please complete all previous 4 steps first.",
          403
        );
      }
    }

    employee.onboardingStep = targetStep;
    await employee.save();

    return {
      message: `Navigated to step ${targetStep}`,
      currentStep: targetStep,
      prevStep: targetStep > 1 ? targetStep - 1 : null,
      nextStep: targetStep < 5 ? targetStep + 1 : null,
    };
  }

  // Education options lookup helper for dynamic dropdowns
  // Optional `search` param filters specializations and degrees by keyword (case-insensitive)
  getEducationOptions(qualificationLevel?: string, countryCode?: string, search?: string) {
    const catalog = getEducationCatalogForLevel(qualificationLevel, countryCode);

    if (!search || search.trim().length < 2) {
      return catalog;
    }

    const q = search.trim().toLowerCase();

    // Filter degrees — keep only degrees that match the query or have at least one matching specialization
    const filteredDegrees = catalog.degrees
      .map((deg) => {
        const degreeMatches = deg.degree.toLowerCase().includes(q);
        const matchedSpecs = deg.specialization.filter((spec) => spec.toLowerCase().includes(q));

        return {
          degree: deg.degree,
          specialization: degreeMatches ? deg.specialization : matchedSpecs,
        };
      })
      .filter((deg) => deg.specialization.length > 0);

    const allSpecializations = filteredDegrees.flatMap((deg) => deg.specialization);

    return {
      ...catalog,
      degrees: filteredDegrees,
      allSpecializations,
      searchQuery: search.trim(),
      totalMatches: allSpecializations.length,
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
    const religion = input.religion ?? employee.religion;
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

    // Validate DOB vs Year of Passing for education details (must be >= 15 years from birth year)
    if (input.educationDetails && Array.isArray(input.educationDetails) && dateOfBirth) {
      const dobYear = new Date(dateOfBirth).getFullYear();
      for (const edu of input.educationDetails) {
        if (edu.yearOfPassing) {
          const ageAtPassing = edu.yearOfPassing - dobYear;
          if (ageAtPassing < 15) {
            throw new AppError(
              `Year of passing (${edu.yearOfPassing}) for "${edu.degree || edu.qualificationLevel}" is invalid. Minimum age at passing must be at least 15 years from your birth year (${dobYear}).`,
              400,
              ErrorCode.VALIDATION_FAILED
            );
          }
        }
      }
    }

    // Apply values to employee model
    employee.dateOfBirth = dateOfBirth;
    employee.gender = gender as any;
    employee.bloodGroup = bloodGroup as any;
    employee.maritalStatus = maritalStatus as any;
    if (religion !== undefined) employee.religion = religion as any;
    employee.phone = phone;
    employee.currentAddress = currentAddress as any;
    employee.emergencyContacts = emergencyContacts as any;

    // Save optional document numbers, parents & previous employment details
    if (input.pan !== undefined) employee.pan = input.pan;
    if (input.aadhaar !== undefined) employee.aadhaar = input.aadhaar;
    if (input.passportNo !== undefined) employee.passportNo = input.passportNo;
    if (input.fatherName !== undefined) employee.fatherName = input.fatherName;
    if (input.fatherPhone !== undefined) employee.fatherPhone = input.fatherPhone;
    if (input.motherName !== undefined) employee.motherName = input.motherName;
    if (input.motherPhone !== undefined) employee.motherPhone = input.motherPhone;
    if (input.highestQualification !== undefined) employee.highestQualification = input.highestQualification as any;
    if (input.educationDetails !== undefined) employee.educationDetails = input.educationDetails as any;
    if (input.previousEmployerName !== undefined) employee.previousEmployerName = input.previousEmployerName;
    if (input.previousEmployerLastWorkingDate !== undefined) {
      employee.previousEmployerLastWorkingDate = input.previousEmployerLastWorkingDate
        ? new Date(input.previousEmployerLastWorkingDate)
        : undefined;
    }
    if (input.customFields !== undefined) {
      if (!employee.customFields || !(employee.customFields instanceof Map)) {
        employee.customFields = new Map() as any;
      }
      for (const [key, val] of Object.entries(input.customFields)) {
        (employee.customFields as Map<string, any>).set(key, val);
      }
    }

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

    const isNa = !!(input.isNotApplicable || input.isNa || input.hasNoFamily);

    if (isNa) {
      // Clear family members if explicitly marked Not Applicable
      await this.familyRepo.replaceAllForEmployee(
        context, employee._id.toString(), employee.branchId.toString(), []
      );
    } else {
      if (!input.familyMembers || input.familyMembers.length === 0) {
        throw new AppError(
          "Please add at least one family member or check 'Not Applicable' (NA) to proceed.",
          400,
          ErrorCode.VALIDATION_FAILED
        );
      }
      await this.familyRepo.replaceAllForEmployee(
        context, employee._id.toString(), employee.branchId.toString(), input.familyMembers as any
      );
    }

    employee.onboardingStepsCompleted.familyDetails = true;
    await employee.save();

    // Recalculate wizard step dynamically
    await recalculateProfileCompletion(context.tenantId, employee._id.toString());
    const refreshed = await EmployeeModel.findById(employee._id);

    const message = isNa
      ? "Family details marked as Not Applicable"
      : "Family details saved successfully";

    return { message, nextStep: refreshed!.onboardingStep };
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
      tenantId: employee.tenantId as any,
      branchId: employee.branchId as any,
      employeeId: employee._id as any,
      bankName: bankName,
      accountNumber: accountNumber,
      ifscCode: ifscCode,
      accountType: accountType as any,
      isPrimary: true,
      isActive: true,
      createdBy: new mongoose.Types.ObjectId(context.userId) as any,
      updatedBy: new mongoose.Types.ObjectId(context.userId) as any,
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
          const hasIt = uploadedTypes.includes("PAN") || !!refreshed!.pan;
          if (!hasIt) {
            missing.push(isIndia ? `${label} Upload or Valid PAN Number` : `${label} Document`);
          }
        } else if (t === "AADHAAR") {
          const hasIt = uploadedTypes.includes("AADHAAR") || !!refreshed!.aadhaar;
          if (!hasIt) {
            missing.push(isIndia ? `${label} Upload or Aadhaar Number` : `${label} Document`);
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
    const missing: string[] = [];
    if (!steps?.personalDetails) missing.push("Personal & Education Details (Step 1)");
    if (!steps?.familyDetails) missing.push("Family Details (Step 2)");
    if (!steps?.bankDetails) missing.push("Bank Details (Step 3)");
    if (!steps?.documents) missing.push("Mandatory Documents (Step 4)");

    if (missing.length > 0) {
      throw new AppError(
        `Cannot submit final onboarding. The following steps are incomplete: ${missing.join(", ")}. Please complete all 4 steps to submit.`,
        400,
        ErrorCode.VALIDATION_FAILED
      );
    }

    employee.onboardingStepsCompleted.reviewed = true;
    employee.onboardingComplete = true;
    employee.isProfileComplete = true; // ties into the existing dashboard gate

    await employee.save();
    return {
      message: "Onboarding complete! Welcome to the team.",
      onboardingComplete: true,
      isProfileComplete: true,
    };
  }
}

export const onboardingWizardService = new OnboardingWizardService();