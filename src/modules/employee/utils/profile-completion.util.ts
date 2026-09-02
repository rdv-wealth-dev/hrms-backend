import mongoose from "mongoose";
import { EmployeeModel } from "../models/employee.model";
import { EmployeeDocumentModel } from "../../employee-document/employee-document.model";
import { EmployeeBankAccountModel } from "../models/employee-bank-account.model";
import { EmployeeFamilyModel } from "../models/employee-family.model";
import { OrganizationModel } from "../../organization/organization.model";

// Recalculates and persists the profile completion flags for one employee.
// Called after any relevant update — bank account added, document uploaded,
// profile fields updated — so isProfileComplete is always current, not
// computed on-demand on every request.
export async function recalculateProfileCompletion(
  tenantId: string,
  employeeId: string
): Promise<boolean> {
  const employee = await EmployeeModel.findById(employeeId);
  if (!employee) return false;

  // ── Legacy completion checks (used by service & middleware)
  const personalDetails = !!(employee.dateOfBirth && employee.gender && employee.phone);
  const address = !!(employee.currentAddress?.addressLine1 && employee.currentAddress?.city);
  const emergencyContact = employee.emergencyContacts.length > 0;

  const bankCount = await EmployeeBankAccountModel.countDocuments({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    employeeId: new mongoose.Types.ObjectId(employeeId),
    isActive: true,
    isDeleted: false,
  });
  const bankDetails = bankCount > 0;

  // Family details check — marked true if flag is set, or if family members exist in DB
  const familyCount = await EmployeeFamilyModel.countDocuments({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    employeeId: new mongoose.Types.ObjectId(employeeId),
  });
  const familyDetails = !!(employee.onboardingStepsCompleted?.familyDetails || familyCount > 0);

  const org = await OrganizationModel.findById(tenantId).select("mandatoryDocumentTypes");
  const required = org?.mandatoryDocumentTypes ?? [];

  let mandatoryDocs = true;
  if (required.length > 0) {
    const uploadedTypes = await EmployeeDocumentModel.distinct("documentType", {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    }) as unknown as string[];

    // Document is satisfied if either the document file is uploaded OR the text number is provided
    mandatoryDocs = required.every((t: string) => {
      if (t === "PAN") {
        return uploadedTypes.includes("PAN") || !!employee.pan;
      }
      if (t === "AADHAAR") {
        return uploadedTypes.includes("AADHAAR") || !!employee.aadhaar;
      }
      if (t === "PASSPORT") {
        return uploadedTypes.includes("PASSPORT") || !!employee.passportNo;
      }
      return uploadedTypes.includes(t);
    });
  }

  // Preserve existing documents flag if already completed
  if (employee.onboardingStepsCompleted?.documents && !mandatoryDocs && required.length === 0) {
    mandatoryDocs = true;
  }

  const isProfileComplete = personalDetails && address && emergencyContact && bankDetails && mandatoryDocs;

  // Write legacy fields (service builds its response from these)
  employee.profileCompletion = { personalDetails, address, emergencyContact, bankDetails, mandatoryDocs };
  employee.isProfileComplete = isProfileComplete;

  // Onboarding step flags (keep in sync with legacy)
  employee.onboardingStepsCompleted = {
    personalDetails,
    familyDetails,
    bankDetails,
    documents: mandatoryDocs,
    reviewed: employee.onboardingStepsCompleted?.reviewed ?? false, // set by HR
  };

  // Auto-resolve onboarding step based on first incomplete step
  if (!employee.onboardingComplete) {
    const steps = employee.onboardingStepsCompleted;
    if (!steps.personalDetails) {
      employee.onboardingStep = 1;
    } else if (!steps.familyDetails) {
      employee.onboardingStep = 2;
    } else if (!steps.bankDetails) {
      employee.onboardingStep = 3;
    } else if (!steps.documents) {
      employee.onboardingStep = 4;
    } else {
      employee.onboardingStep = 5;
    }
  }

  await employee.save();
  return isProfileComplete;
}
