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
  // ── Legacy completion checks (used by service & middleware)
  const personalDetails = !!(employee.dateOfBirth || employee.gender || employee.phone);
  const address = !!(employee.currentAddress?.addressLine1);
  const emergencyContact = employee.emergencyContacts && employee.emergencyContacts.length > 0;

  // Auto-backfill city/state/zip if line1 exists
  if (employee.currentAddress?.addressLine1) {
    if (!employee.currentAddress.city) employee.currentAddress.city = "Indore";
    if (!employee.currentAddress.state) employee.currentAddress.state = "Madhya Pradesh";
    if (!employee.currentAddress.countryCode) employee.currentAddress.countryCode = "IN";
    if (!employee.currentAddress.zip) employee.currentAddress.zip = "452001";
  }
  if (employee.permanentAddress?.addressLine1) {
    if (!employee.permanentAddress.city) employee.permanentAddress.city = "Indore";
    if (!employee.permanentAddress.state) employee.permanentAddress.state = "Madhya Pradesh";
    if (!employee.permanentAddress.countryCode) employee.permanentAddress.countryCode = "IN";
    if (!employee.permanentAddress.zip) employee.permanentAddress.zip = "452001";
  }

  const bankCount = await EmployeeBankAccountModel.countDocuments({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    employeeId: new mongoose.Types.ObjectId(employeeId),
    isActive: true,
    isDeleted: false,
  });
  const bankDetails = bankCount > 0;

  // Family details check — marked true if flag is set, or if family members exist in DB
  let familyCount = await EmployeeFamilyModel.countDocuments({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    employeeId: new mongoose.Types.ObjectId(employeeId),
  });

  // Smart backfill: if employee doc has fatherName/motherName/spouseName but family members table is empty, auto-create!
  if (familyCount === 0 && (employee.fatherName || employee.motherName || (employee as any).spouseName)) {
    const toInsert = [];
    if (employee.fatherName) {
      toInsert.push({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        fullName: employee.fatherName,
        relationship: "FATHER",
        phone: employee.fatherPhone || undefined,
        isDependent: true,
        isNominee: false,
      });
    }
    if (employee.motherName) {
      toInsert.push({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        fullName: employee.motherName,
        relationship: "MOTHER",
        phone: employee.motherPhone || undefined,
        isDependent: true,
        isNominee: false,
      });
    }
    if ((employee as any).spouseName) {
      toInsert.push({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        fullName: (employee as any).spouseName,
        relationship: "SPOUSE",
        phone: (employee as any).spousePhone || undefined,
        isDependent: true,
        isNominee: true,
      });
    }
    if (toInsert.length > 0) {
      try {
        await EmployeeFamilyModel.insertMany(toInsert, { ordered: false });
        familyCount = toInsert.length;
      } catch {}
    }
  }

  const familyDetails = !!(employee.hasNoFamily || familyCount > 0);

  const org = await OrganizationModel.findById(tenantId).select("mandatoryDocumentTypes");
  const required = org?.mandatoryDocumentTypes ?? [];

  let mandatoryDocs = true;
  if (required.length > 0) {
    const uploadedTypes = await EmployeeDocumentModel.distinct("documentType", {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    }) as unknown as string[];

    // File upload in employee_documents is required for all mandatory document types
    mandatoryDocs = required.every((t: string) => uploadedTypes.includes(t));
  }

  // Preserve existing documents flag if already completed and no mandatory docs defined
  if (employee.onboardingStepsCompleted?.documents && !mandatoryDocs && required.length === 0) {
    mandatoryDocs = true;
  }

  const legacyComplete = personalDetails && address && emergencyContact && bankDetails && mandatoryDocs;
  // Once the 5-step wizard has been completed, that's the authoritative signal —
  // don't let the stricter legacy field-count check downgrade it back to incomplete.
  const isProfileComplete = !!(employee.onboardingComplete || legacyComplete);

  // Write legacy fields (service builds its response from these)
  employee.profileCompletion = { personalDetails, address, emergencyContact, bankDetails, mandatoryDocs };
  employee.isProfileComplete = isProfileComplete;

  // Preserve actual wizard progress and smartly upgrade steps based on filled data
  if (employee.onboardingComplete) {
    employee.onboardingStepsCompleted = {
      personalDetails: true,
      familyDetails: true,
      bankDetails: true,
      documents: true,
      reviewed: true,
    };
    employee.onboardingStep = 5;
  } else {
    if (!employee.onboardingStepsCompleted) {
      employee.onboardingStepsCompleted = {
        personalDetails: false,
        familyDetails: false,
        bankDetails: false,
        documents: false,
        reviewed: false,
      };
    }

    // Smart sync: automatically mark steps completed if requisite data is present
    if (personalDetails || (employee.phone && (employee.dateOfBirth || employee.gender || employee.currentAddress?.addressLine1))) {
      employee.onboardingStepsCompleted.personalDetails = true;
    }
    if (familyCount > 0 || employee.hasNoFamily) {
      employee.onboardingStepsCompleted.familyDetails = true;
    }
    if (bankDetails) {
      employee.onboardingStepsCompleted.bankDetails = true;
    }
    if (required.length > 0) {
      employee.onboardingStepsCompleted.documents = mandatoryDocs;
    }
  }

  await employee.save();
  return isProfileComplete;
}
