import mongoose from "mongoose";
import { EmployeeModel } from "./employee.model";
import { EmployeeDocumentModel } from "./employee-document.model";
import { EmployeeBankAccountModel } from "./employee-bank-account.model";
import { OrganizationModel } from "../organization/organization.model";

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

  const org = await OrganizationModel.findById(tenantId).select("mandatoryDocumentTypes");
  const required = org?.mandatoryDocumentTypes ?? [];

  let mandatoryDocs = true;
  if (required.length > 0) {
    const uploadedTypes = await EmployeeDocumentModel.distinct("documentType", {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    }) as unknown as string[];
    mandatoryDocs = required.every((t: string) => uploadedTypes.includes(t));
  }

  const isProfileComplete = personalDetails && address && emergencyContact && bankDetails && mandatoryDocs;

  // Write legacy fields (service builds its response from these)
  employee.profileCompletion = { personalDetails, address, emergencyContact, bankDetails, mandatoryDocs };
  employee.isProfileComplete = isProfileComplete;

  //Onboarding step flags (keep in sync with legacy)
  employee.onboardingStepsCompleted = {
    personalDetails,
    familyDetails: employee.onboardingStepsCompleted?.familyDetails ?? false, // set by family endpoint
    bankDetails,
    documents: mandatoryDocs,
    reviewed: employee.onboardingStepsCompleted?.reviewed ?? false,       // set by HR
  };

  await employee.save();
  return isProfileComplete;
}
