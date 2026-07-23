import mongoose from "mongoose";
import { EmployeeModel } from "./employee.model";
import { EmployeeFamilyRepository } from "./employee-family.repository";
import { EmployeeRepository } from "./employee.repository";
import { UserModel } from "../user/user.model";
import {
  OnboardingStep1Input,
  OnboardingStep2Input,
  OnboardingStep3Input,
} from "./onboarding-wizard.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { recalculateProfileCompletion } from "./profile-completion.util";

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
    return {
      onboardingStep:            employee.onboardingStep,
      onboardingComplete:        employee.onboardingComplete,
      onboardingStepsCompleted:  employee.onboardingStepsCompleted,
    };
  }

  // Step 1 — Personal Details 
  async submitStep1(context: RequestContext, input: OnboardingStep1Input) {
    const employee = await this.resolveOwnEmployee(context);
    this.assertStepAllowed(employee, 1);

    employee.dateOfBirth       = new Date(input.dateOfBirth);
    employee.gender            = input.gender as any;
    employee.bloodGroup        = input.bloodGroup as any;
    employee.maritalStatus     = input.maritalStatus as any;
    employee.phone             = input.phone;
    employee.currentAddress    = input.currentAddress;
    employee.emergencyContacts = input.emergencyContact as any;

    employee.onboardingStepsCompleted.personalDetails = true;
    if (employee.onboardingStep === 1) employee.onboardingStep = 2;

    await employee.save();
    return { message: "Personal details saved", nextStep: employee.onboardingStep };
  }

  // Step 2 — Family Details 
  async submitStep2(context: RequestContext, input: OnboardingStep2Input) {
    const employee = await this.resolveOwnEmployee(context);
    this.assertStepAllowed(employee, 2);

    await this.familyRepo.replaceAllForEmployee(
      context, employee._id.toString(), employee.branchId.toString(), input.familyMembers as any
    );

    employee.onboardingStepsCompleted.familyDetails = true;
    if (employee.onboardingStep === 2) employee.onboardingStep = 3;
    await employee.save();

    return { message: "Family details saved", nextStep: employee.onboardingStep };
  }

  // Step 3 — Bank Details 
  async submitStep3(context: RequestContext, input: OnboardingStep3Input) {
    const employee = await this.resolveOwnEmployee(context);
    this.assertStepAllowed(employee, 3);

    await this.empRepo.addBankAccount({
      tenantId:      employee.tenantId as any,
      branchId:      employee.branchId as any,
      employeeId:    employee._id as any,
      bankName:      input.bankName,
      accountNumber: input.accountNumber,
      ifscCode:      input.ifscCode,
      accountType:   input.accountType as any,
      isPrimary:     true,
      isActive:      true,
      createdBy:     new mongoose.Types.ObjectId(context.userId) as any,
      updatedBy:     new mongoose.Types.ObjectId(context.userId) as any,
    });

    employee.onboardingStepsCompleted.bankDetails = true;
    if (employee.onboardingStep === 3) employee.onboardingStep = 4;
    await employee.save();

    return { message: "Bank details saved", nextStep: employee.onboardingStep };
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
      throw new AppError("Please upload all required documents before proceeding", 400);
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