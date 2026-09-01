import mongoose from "mongoose";
import { EmployeeRepository } from "../repositories/employee.repository";
import { getNextEmployeeCode } from "../utils/employee-counter.util";
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  UpdateEmployeeStatusInput,
  AddBankAccountInput,
  ListEmployeesQuery,
  CalendarEventsQuery,
  CalendarEvent,
  CropAvatarInput,
  EligibleManagersQuery,
} from "../dto/employee.dto";

import { DepartmentModel } from "../../department/department.model";
import { DesignationModel } from "../../designation/designation.model";

import { EmployeeModel } from "../models/employee.model";
import { TeamModel, TeamMemberModel } from "../../team/team.model";
import { EmployeeDocumentModel } from "../../employee-document/employee-document.model";
import { AppError, ValidationFailedError } from "../../../shared/errors/app.error";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { buildPagedResponse } from "../../../shared/database/base.schema";
import { parseEmployeeCountRange } from "../../organization/utils/team-size.util";
import crypto from "crypto";
import { UserModel } from "../../user/user.model";
import { OrganizationModel } from "../../organization/organization.model";
import { SalaryStructureService } from "../../payroll/services/salary-structure.service";
import { emailService } from "../../../shared/services/email.service";
import { env } from "../../../config/env.config";
import { BranchRepository } from "../../branch/branch.repository";
import { BranchModel } from "../../branch/branch.model";
import { s3Service } from "../../../shared/services/storage.service";
import { recalculateProfileCompletion } from "../utils/profile-completion.util";
import { ShiftRepository } from "../../attendance/repositories/shift.repository";
import { parseImportFile, buildExportBuffer } from "../utils/employee.utils";
import { v4 as uuidv4 } from "uuid";
import { validatePAN, validateAadhaar } from "../../../domain/localization/IN/validators";
import { ImportSessionModel } from "../models/import-session.model";
import { ExportSessionModel } from "../models/export-session.model";

// Helper — mask account number showing only last 4 digits
function maskAccountNumber(acc: string): string {
  if (acc.length <= 4) return acc;
  return "X".repeat(acc.length - 4) + acc.slice(-4);
}

// Helper — mask PAN number
function maskPan(pan: string): string {
  if (!pan || pan.length < 4) return pan;
  return pan.substring(0, 4) + "****" + pan.substring(pan.length - 1);
}

// Helper — mask Aadhaar number
function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length < 4) return aadhaar;
  return "****" + aadhaar.substring(aadhaar.length - 4);
}

export class EmployeeService {
  private empRepo = new EmployeeRepository();
  private salaryStructureService = new SalaryStructureService();
  private shiftRepository = new ShiftRepository();

  //Create employee
  async createEmployee(
    context: RequestContext,
    input: CreateEmployeeInput
  ) {
    // 1. Check organization employee limit / team size range cap
    const org = await OrganizationModel.findById(context.tenantId);
    if (!org) throw new AppError("Organization not found", 404);

    const { maxEmployees: parsedMax } = parseEmployeeCountRange(org.employeeCountRange);
    const maxEmployees = Math.max(parsedMax, org.subscription?.maxEmployees || 10);

    const currentCount = await EmployeeModel.countDocuments({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (currentCount >= maxEmployees) {
      throw new AppError(
        `User limit reached for your workspace tier (Team size range: ${org.employeeCountRange || "1-10"}, Max allowed: ${maxEmployees} users). You cannot add user/employee #${currentCount + 1}. Please upgrade your workspace tier.`,
        403
      );
    }

    // 2. Strict Branch Exclusivity Check:
    // Ensure an ACTIVE employee with this email/identity does NOT already belong to any branch in this organization
    const activeExisting = await EmployeeModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      $or: [
        { email: input.email.toLowerCase() },
        ...(input.pan ? [{ pan: input.pan.trim().toUpperCase() }] : []),
        ...(input.aadhaar ? [{ aadhaar: input.aadhaar.replace(/[\s-]/g, "").trim() }] : []),
      ],
      isActive: true,
      isDeleted: false,
    }).populate("branchId", "name code");

    if (activeExisting) {
      const existingBranchName = (activeExisting.branchId as any)?.name || "another branch";
      throw new AppError(
        `Strict Branch Exclusivity Rule: This employee is already actively assigned to branch "${existingBranchName}". An employee cannot belong to multiple branches simultaneously until they are marked INACTIVE, TERMINATED, or TRANSFERRED.`,
        409
      );
    }

    // 3. Check email uniqueness within tenant
    const existing = await this.empRepo.findByEmail(context, input.email);
    if (existing) {
      throw new AppError(
        `Employee with email "${input.email}" already exists`,
        409
      );
    }
    // Check if a user account already exists with this email in this tenant
    const existingUser = await UserModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      email: input.email.toLowerCase(),
      isDeleted: false,
    });
    if (existingUser) {
      throw new AppError(
        `A user account with email "${input.email}" already exists`,
        409
      );
    }

    if (input.pan) {
      const cleanPan = input.pan.trim().toUpperCase();
      if (!validatePAN(cleanPan)) {
        throw new AppError("Invalid PAN format. Must be 10 alphanumeric characters (e.g. ABCPS1234D).", 400);
      }
    }

    if (input.aadhaar) {
      const cleanAadhaar = input.aadhaar.replace(/[\s-]/g, "").trim();
      if (!validateAadhaar(cleanAadhaar)) {
        throw new AppError("Invalid Aadhaar format. Must be exactly 12 digits and start with 2–9.", 400);
      }
    }

    // Generate atomic employee code
    const employeeCode = await getNextEmployeeCode(context.tenantId);

    let resolvedShiftId = input.shiftId;
    if (!resolvedShiftId) {
      const defaultShift = await this.shiftRepository.findDefault(context);
      if (defaultShift) resolvedShiftId = defaultShift._id.toString();
    }

    let branchId = input.branchId;
    if (branchId) {
      const branchDoc = await BranchModel.findOne({
        _id: new mongoose.Types.ObjectId(branchId),
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isActive: true,
        isDeleted: false,
      });
      if (!branchDoc) {
        throw new AppError("Specified branch does not exist or is inactive in this organization.", 400);
      }
    } else {
      const branchRepo = new BranchRepository();
      const headOffice = await branchRepo.findHeadOffice(context.tenantId);
      if (!headOffice) {
        throw new AppError(
          "No head office branch found for organization. Please complete onboarding first.",
          400
        );
      }
      branchId = headOffice._id.toString();
    }

    let resolvedTeamId: mongoose.Types.ObjectId | undefined;
    if (input.teamId) {
      const teamDoc = await TeamModel.findOne({
        _id: new mongoose.Types.ObjectId(input.teamId),
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isActive: true,
        isDeleted: false,
      });
      if (!teamDoc) {
        throw new AppError("Selected team does not exist or is inactive", 400);
      }
      resolvedTeamId = teamDoc._id;
    }

    const employee = await this.empRepo.create(context, {
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: new mongoose.Types.ObjectId(branchId) as any,
      departmentId: new mongoose.Types.ObjectId(input.departmentId) as any,
      designationId: new mongoose.Types.ObjectId(input.designationId) as any,
      teamId: resolvedTeamId as any,
      shiftId: resolvedShiftId ? new mongoose.Types.ObjectId(resolvedShiftId) as any : undefined,
      managerId: input.managerId
        ? new mongoose.Types.ObjectId(input.managerId) as any
        : undefined,
      secondaryManagerIds: input.secondaryManagerIds && input.secondaryManagerIds.length > 0
        ? input.secondaryManagerIds.map((mId) => new mongoose.Types.ObjectId(mId)) as any
        : [],
      employeeCode,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      gender: input.gender as any,
      bloodGroup: input.bloodGroup as any,
      maritalStatus: input.maritalStatus as any,
      nationality: input.nationality,
      pan: input.pan,
      aadhaar: input.aadhaar,
      passportNo: input.passportNo,
      drivingLicense: input.drivingLicense,
      voterId: input.voterId,
      employeeType: input.employeeType as any,
      status: "ACTIVE" as any,
      joiningDate: new Date(input.joiningDate),
      probationEndDate: input.probationEndDate
        ? new Date(input.probationEndDate)
        : undefined,
      currentAddress: input.currentAddress,
      permanentAddress: input.permanentAddress,
      emergencyContacts: input.emergencyContacts ?? [],
      pfOnActuals: input.pfOnActuals,
      isActive: true,
    });

    // If a team was assigned during onboarding, automatically register in TeamMemberModel
    if (resolvedTeamId) {
      await TeamMemberModel.create({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        teamId: resolvedTeamId,
        employeeId: employee._id,
        roleInTeam: "MEMBER",
        isPrimary: true,
        allocationPercentage: 100,
        joinedAt: new Date(),
        isActive: true,
        isDeleted: false,
      });
    }

    // Recalculate profile completion after employee creation
    // so isProfileComplete is accurate if all required fields were provided
    await recalculateProfileCompletion(context.tenantId, employee._id.toString());

    // Generate account activation token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // Create user account for this employee with selected role (default: EMPLOYEE)
    const assignedRole = input.role ? input.role.toUpperCase() : "EMPLOYEE";
    const C_SUITE_ROLES = ["ORG_ADMIN", "SUPER_ADMIN", "CEO", "CTO", "CFO", "COO", "CHRO", "LEADERSHIP"];
    const isMasterAdmin = ["ORG_ADMIN", "SUPER_ADMIN"].includes(context.role);
    if (!isMasterAdmin && C_SUITE_ROLES.includes(assignedRole)) {
      throw new AppError("Access denied: Only Org Admin can assign C-Suite or Executive roles", 403);
    }

    const userAccount = new UserModel({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      email: input.email.toLowerCase(),
      passwordHash: null,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role: assignedRole,
      isOrgAdmin: assignedRole === "ORG_ADMIN" || assignedRole === "SUPER_ADMIN",
      isActive: false,
      isEmailVerified: false,
      branchIds: [new mongoose.Types.ObjectId(input.branchId)],
      employeeId: employee._id,


      accountActivationToken: hashedToken,
      accountActivationExpires: new Date(
        Date.now() + 72 * 60 * 60 * 1000 // 72 hours
      )
    });

    await userAccount.save();

    // send welcome email with activation link
    const activationUrl =
      `${env.frontendUrl}/activate-account?token=${rawToken}`;

    await emailService.sendEmail(
      input.email,
      `${input.firstName} ${input.lastName}`,
      `Welcome to ${context.tenantId} HRMS — Activate your account`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
        <h2>Welcome to the team, ${input.firstName}!</h2>

        <p>Your HRMS account has been created by your HR team.</p>

        <table style="background:#f5f5f5; padding:16px; border-radius:8px; width:100%;">
          <tr>
            <td><strong>Employee ID</strong></td>
            <td>${employeeCode}</td>
          </tr>
          <tr>
            <td><strong>Email</strong></td>
            <td>${input.email}</td>
          </tr>
          <tr>
            <td><strong>Joining Date</strong></td>
            <td>${input.joiningDate}</td>
          </tr>
        </table>

        <p style="margin-top:24px;">
          Click the button below to set your password and activate your account.
          This link expires in <strong>72 hours</strong>.
        </p>

        <a href="${activationUrl}"
           style="display:inline-block; padding:12px 28px; background:#2886CE;
                  color:white; text-decoration:none; border-radius:4px;
                  font-weight:bold; margin-top:8px;">
          Activate My Account
        </a>

        <p style="margin-top:32px; color:#888; font-size:12px;">
          If you were not expecting this email, please contact your HR team.
          This link will expire on
          ${new Date(Date.now() + 72 * 60 * 60 * 1000).toLocaleDateString()}.
        </p>
      </div>
    `
    );

    let salaryStructure = null;
    if (input.salaryStructure) {
      try {
        salaryStructure = await this.salaryStructureService.createOrRevise(context, {
          employeeId: employee._id.toString(),
          ctcAnnual: input.salaryStructure.ctcAnnual,
          lineItems: input.salaryStructure.lineItems,
        });
      } catch (err) {
        // Don't fail the whole onboarding if salary setup has an issue (e.g. 50%
        // wage rule violation) — employee record + login still get created,
        // HR fixes salary separately. Log this properly in production.
      }
    }

    let bankAccount = null;
    if (input.bankAccount) {
      const acc = await this.empRepo.addBankAccount({
        tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
        branchId: employee.branchId as any,
        employeeId: employee._id as any,
        bankName: input.bankAccount.bankName,
        accountNumber: input.bankAccount.accountNumber,
        ifscCode: input.bankAccount.ifscCode,
        accountType: input.bankAccount.accountType as any,
        isPrimary: true,
        isActive: true,
        createdBy: new mongoose.Types.ObjectId(context.userId) as any,
        updatedBy: new mongoose.Types.ObjectId(context.userId) as any,
      });
      bankAccount = { ...acc.toObject(), accountNumber: undefined }; // mask fully in onboarding response
    }

    return {
      employee: {
        id: employee._id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        status: employee.status,
        joiningDate: employee.joiningDate,
      },
      userAccount: {
        id: userAccount._id,
        email: userAccount.email,
        role: userAccount.role,
        isActive: userAccount.isActive,
        message: "Activation email sent to employee's email address",
      },
      salaryStructure: salaryStructure ? {
        ctcAnnual: salaryStructure.ctcAnnual,
        grossMonthly: salaryStructure.grossMonthly,
      } : null,
      bankAccountAdded: !!bankAccount,
    };
  }

  //List employees
  async listEmployees(
    context: RequestContext,
    query: ListEmployeesQuery
  ) {
    const filters: Record<string, unknown> = {};

    if (query.status) filters.status = query.status;
    if (query.departmentId) filters.departmentId = new mongoose.Types.ObjectId(query.departmentId);
    if (query.designationId) filters.designationId = new mongoose.Types.ObjectId(query.designationId);
    if (query.branchId) filters.branchId = new mongoose.Types.ObjectId(query.branchId);

    if (query.joiningPeriod) {
      const now = new Date();
      let startDate: Date | null = null;

      if (query.joiningPeriod === "this_month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month
      } else if (query.joiningPeriod === "last_3_months") {
        startDate = new Date();
        startDate.setMonth(now.getMonth() - 3);
      } else if (query.joiningPeriod === "last_6_months") {
        startDate = new Date();
        startDate.setMonth(now.getMonth() - 6);
      } else if (query.joiningPeriod === "last_year") {
        startDate = new Date();
        startDate.setFullYear(now.getFullYear() - 1);
      }

      if (startDate) {
        filters.joiningDate = { $gte: startDate };
      }
    }

    const result = await this.empRepo.search(
      context,
      query.search ?? "",
      filters,
      query.pageNumber ?? 1,
      query.pageSize ?? 10
    );

    return buildPagedResponse({
      data: result.data,
      pageNumber: result.pageNumber,
      pageSize: result.pageSize,
      totalRecords: result.totalRecords,
    });
  }



  async uploadAvatar(
    context: RequestContext,
    employeeId: string,
    file: Express.Multer.File,
    cropParams: CropAvatarInput
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new AppError("Only JPEG, PNG, and WebP images are allowed for profile pictures.", 400);
    }

    if (file.size > 3 * 1024 * 1024) {
      throw new AppError("Profile picture size must not exceed 3MB.", 400);
    }

    const org = await OrganizationModel.findById(context.tenantId).select("slug");
    const slug = org?.slug ?? context.tenantId;

    const s3Key = s3Service.buildAvatarKey(slug, employeeId, file.mimetype === "image/png" ? "png" : "jpg");

    const avatarUrl = await s3Service.uploadPublicAvatar(s3Key, file.buffer, file.mimetype);

    employee.avatarUrl = avatarUrl;
    await employee.save();

    await UserModel.updateOne(
      { tenantId: new mongoose.Types.ObjectId(context.tenantId), employeeId: new mongoose.Types.ObjectId(employeeId) },
      { avatar: avatarUrl }
    );

    await recalculateProfileCompletion(context.tenantId, employeeId);

    return { avatarUrl };
  }

  async uploadMyAvatar(
    context: RequestContext,
    file: Express.Multer.File,
    cropParams: CropAvatarInput
  ) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.uploadAvatar(context, employeeId, file, cropParams);
  }


  //Get by ID
  async getEmployeeById(
    context: RequestContext,
    id: string
  ) {
    let employee: any = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      employee = await this.empRepo.findById(context, id, {
        populate: ["departmentId", "designationId", "teamId", "managerId", "secondaryManagerIds", "branchId", "shiftId"],
      });
    }

    if (!employee) {
      employee = await EmployeeModel.findOne({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        employeeCode: id.trim(),
        isDeleted: false,
      }).populate(["departmentId", "designationId", "teamId", "managerId", "secondaryManagerIds", "branchId", "shiftId"]);
    }

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    const userDoc = await UserModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      $or: [
        { employeeId: employee._id },
        { email: employee.email?.toLowerCase() },
      ],
    }).select("role isOrgAdmin");

    const empObj = employee.toObject ? employee.toObject() : employee;
    empObj.role = userDoc?.role || "EMPLOYEE";
    empObj.isOrgAdmin = userDoc?.isOrgAdmin || false;

    return empObj;
  }


  //Get complete employee profile (for HR/Admin)
  async getCompleteEmployeeProfile(
    context: RequestContext,
    id: string
  ) {
    // Get basic employee data with populated references
    const employee = await this.empRepo.findById(context, id, {
      populate: ["departmentId", "designationId", "teamId", "managerId", "secondaryManagerIds", "branchId", "shiftId"],
    });

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    // Get documents
    const documents = await EmployeeDocumentModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(id),
      isDeleted: false,
    }).sort({ createdAt: -1 });

    // Get bank accounts (with masked account numbers)
    const bankAccountsRaw = await this.empRepo.getBankAccounts(context, id);
    const bankAccounts = bankAccountsRaw.map((acc) => ({
      ...acc.toObject(),
      accountNumber: maskAccountNumber(acc.accountNumber),
    }));

    // Get organization requirements
    const org = await OrganizationModel.findById(context.tenantId)
      .select("mandatoryDocumentTypes");
    const mandatoryDocumentTypes = org?.mandatoryDocumentTypes ?? [];

    // Calculate missing documents
    const isIndia = (employee.countryCode || "IN").toUpperCase() === "IN";
    const uploadedDocTypes = documents.map(doc => doc.documentType) as string[];
    const missingDocuments = mandatoryDocumentTypes.filter(type => {
      if (type === "PAN") {
        return isIndia
          ? (!employee.pan && !uploadedDocTypes.includes("PAN"))
          : !uploadedDocTypes.includes("PAN");
      }
      if (type === "AADHAAR") {
        return isIndia
          ? (!employee.aadhaar && !uploadedDocTypes.includes("AADHAAR"))
          : !uploadedDocTypes.includes("AADHAAR");
      }
      if (type === "PASSPORT") return !employee.passportNo && !uploadedDocTypes.includes("PASSPORT");
      return !uploadedDocTypes.includes(type);
    });

    // Document labels for frontend
    const documentLabels = {
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

    // Enhanced profile completion
    const profileCompletion = employee.profileCompletion;
    const completedSections = [
      profileCompletion.personalDetails,
      profileCompletion.address,
      profileCompletion.emergencyContact,
      profileCompletion.bankDetails,
      profileCompletion.mandatoryDocs
    ].filter(Boolean).length;

    const overallScore = Math.round((completedSections / 5) * 100);

    // Summary calculations
    const verifiedDocuments = documents.filter(doc => doc.isVerified).length;
    const pendingVerification = documents.filter(doc => !doc.isVerified).length;
    const primaryBank = bankAccounts.find(acc => acc.isPrimary);

    return {
      employee: {
        id: employee._id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        dateOfBirth: employee.dateOfBirth,
        gender: employee.gender,
        bloodGroup: employee.bloodGroup,
        maritalStatus: employee.maritalStatus,
        nationality: employee.nationality,
        pan: employee.pan ? maskPan(employee.pan) : null,
        aadhaar: employee.aadhaar ? maskAadhaar(employee.aadhaar) : null,
        passportNo: employee.passportNo,
        departmentId: employee.departmentId,
        designationId: employee.designationId,
        teamId: employee.teamId,
        managerId: employee.managerId,
        secondaryManagerIds: employee.secondaryManagerIds,
        role: (await UserModel.findOne({ tenantId: new mongoose.Types.ObjectId(context.tenantId), $or: [{ employeeId: employee._id }, { email: employee.email?.toLowerCase() }] }).select("role"))?.role || "EMPLOYEE",
        branchId: employee.branchId,
        shiftId: employee.shiftId,
        employeeType: employee.employeeType,
        status: employee.status,
        joiningDate: employee.joiningDate,
        confirmationDate: employee.confirmationDate,
        probationEndDate: employee.probationEndDate,
        exitDate: employee.exitDate,
        exitReason: employee.exitReason,
        currentAddress: employee.currentAddress,
        permanentAddress: employee.permanentAddress,
        emergencyContacts: employee.emergencyContacts,
        avatarUrl: employee.avatarUrl,
        pfOnActuals: employee.pfOnActuals,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt
      },
      profileCompletion: {
        personalDetails: profileCompletion.personalDetails,
        address: profileCompletion.address,
        emergencyContact: profileCompletion.emergencyContact,
        bankDetails: profileCompletion.bankDetails,
        mandatoryDocs: profileCompletion.mandatoryDocs,
        overallScore,
        completedSections,
        totalSections: 5
      },
      isProfileComplete: employee.isProfileComplete,
      documents: documents.map(doc => ({
        id: doc._id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        uploadedAt: doc.createdAt,
        isVerified: doc.isVerified,
        verifiedAt: doc.updatedAt,
        expiryDate: doc.expiryDate,
        canDownload: true
      })),
      bankAccounts: bankAccounts.map(acc => ({
        id: acc._id,
        bankName: acc.bankName,
        accountNumber: acc.accountNumber, // already masked
        ifscCode: acc.ifscCode,
        accountType: acc.accountType,
        isPrimary: acc.isPrimary,
        isActive: acc.isActive,
        addedAt: acc.createdAt
      })),
      organizationRequirements: {
        mandatoryDocumentTypes,
        missingDocuments,
        documentLabels
      },
      summary: {
        totalDocuments: documents.length,
        verifiedDocuments,
        pendingVerification,
        totalBankAccounts: bankAccounts.length,
        primaryBankSet: !!primaryBank,
        profileCompletionDate: employee.isProfileComplete ? employee.updatedAt : null,
        lastUpdated: employee.updatedAt
      }
    };
  }

  //Update employee
  async updateEmployee(
    context: RequestContext,
    id: string,
    input: UpdateEmployeeInput
  ) {
    const employee = await this.empRepo.findById(context, id);
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    const updateData: Record<string, unknown> = { ...input };

    if (input.pan) {
      const cleanPan = input.pan.trim().toUpperCase();
      if (!validatePAN(cleanPan)) {
        throw new AppError("Invalid PAN format. Must be 10 alphanumeric characters (e.g. ABCPS1234D).", 400);
      }
      updateData.pan = cleanPan;
    }

    if (input.aadhaar) {
      const cleanAadhaar = input.aadhaar.replace(/[\s-]/g, "").trim();
      if (!validateAadhaar(cleanAadhaar)) {
        throw new AppError("Invalid Aadhaar format. Must be exactly 12 digits and start with 2–9.", 400);
      }
      updateData.aadhaar = cleanAadhaar;
    }

    if (input.dateOfBirth) updateData.dateOfBirth = new Date(input.dateOfBirth);
    if (input.confirmationDate) updateData.confirmationDate = new Date(input.confirmationDate);
    if (input.probationEndDate) updateData.probationEndDate = new Date(input.probationEndDate);
    if (input.departmentId) updateData.departmentId = new mongoose.Types.ObjectId(input.departmentId);
    if (input.designationId) updateData.designationId = new mongoose.Types.ObjectId(input.designationId);
    if (input.branchId) {
      const targetBranch = await BranchModel.findOne({
        _id: new mongoose.Types.ObjectId(input.branchId),
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isActive: true,
        isDeleted: false,
      });
      if (!targetBranch) {
        throw new AppError("Selected target branch does not exist or is inactive", 400);
      }
      updateData.branchId = targetBranch._id;
    }
    if (input.managerId) {
      if (input.managerId === id) {
        throw new AppError("An employee cannot be assigned as their own reporting manager", 400);
      }
      const mgr = await EmployeeModel.findOne({
        _id: new mongoose.Types.ObjectId(input.managerId),
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isActive: true,
        isDeleted: false,
      }).select("_id managerId");
      if (!mgr) {
        throw new AppError("Selected reporting manager does not exist or is inactive", 400);
      }
      // Check direct circular reporting loop (e.g. A reports to B, B cannot report to A)
      if (mgr.managerId && mgr.managerId.toString() === id) {
        throw new AppError("Circular manager assignment detected: Manager currently reports to this employee", 400);
      }
      updateData.managerId = new mongoose.Types.ObjectId(input.managerId);
    }

    if (input.secondaryManagerIds !== undefined) {
      if (Array.isArray(input.secondaryManagerIds) && input.secondaryManagerIds.length > 0) {
        if (input.secondaryManagerIds.includes(id)) {
          throw new AppError("An employee cannot be assigned as their own secondary reporting manager", 400);
        }
        const validSecondaryManagers = await EmployeeModel.find({
          _id: { $in: input.secondaryManagerIds.map((mId) => new mongoose.Types.ObjectId(mId)) },
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          isActive: true,
          isDeleted: false,
        }).select("_id");

        if (validSecondaryManagers.length !== input.secondaryManagerIds.length) {
          throw new AppError("One or more selected secondary managers do not exist or are inactive", 400);
        }
        updateData.secondaryManagerIds = input.secondaryManagerIds.map((mId) => new mongoose.Types.ObjectId(mId));
      } else {
        updateData.secondaryManagerIds = [];
      }
    }

    if (input.teamId !== undefined) {
      if (input.teamId) {
        const teamDoc = await TeamModel.findOne({
          _id: new mongoose.Types.ObjectId(input.teamId),
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          isActive: true,
          isDeleted: false,
        });
        if (!teamDoc) {
          throw new AppError("Selected team does not exist or is inactive", 400);
        }
        updateData.teamId = teamDoc._id;

        // Upsert team membership
        await TeamMemberModel.findOneAndUpdate(
          {
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            employeeId: new mongoose.Types.ObjectId(id),
          },
          {
            teamId: teamDoc._id,
            roleInTeam: "MEMBER",
            isPrimary: true,
            allocationPercentage: 100,
            isActive: true,
            isDeleted: false,
          },
          { upsert: true, new: true }
        );
      } else {
        updateData.teamId = null;
        await TeamMemberModel.updateMany(
          {
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            employeeId: new mongoose.Types.ObjectId(id),
          },
          { isActive: false, isDeleted: true }
        );
      }
    }

    if (input.role) {
      const newRole = input.role.toUpperCase();
      const C_SUITE_ROLES = ["ORG_ADMIN", "SUPER_ADMIN", "CEO", "CTO", "CFO", "COO", "CHRO", "LEADERSHIP"];
      const isMasterAdmin = ["ORG_ADMIN", "SUPER_ADMIN"].includes(context.role);
      if (!isMasterAdmin && C_SUITE_ROLES.includes(newRole)) {
        throw new AppError("Access denied: Only Org Admin can assign C-Suite or Executive roles", 403);
      }
      await UserModel.updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          $or: [
            { employeeId: new mongoose.Types.ObjectId(id) },
            { email: (employee as any).email.toLowerCase() },
          ],
        },
        {
          role: newRole,
          isOrgAdmin: newRole === "ORG_ADMIN" || newRole === "SUPER_ADMIN",
        }
      );
    }

    await this.empRepo.updateById(context, id, updateData);
    await recalculateProfileCompletion(context.tenantId, id);
    const updated = await this.getEmployeeById(context, id);
    return updated;
  }

  //Update status
  async updateEmployeeStatus(
    context: RequestContext,
    id: string,
    input: UpdateEmployeeStatusInput
  ) {
    const employee = await this.empRepo.findById(context, id);
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    const updateData: Record<string, unknown> = {
      status: input.status,
      isActive: input.status === "ACTIVE",
    };

    if (input.exitDate) updateData.exitDate = new Date(input.exitDate);
    if (input.exitReason) updateData.exitReason = input.exitReason;

    const updated = await this.empRepo.updateById(context, id, updateData);
    return updated;
  }

  async getMyProfile(context: RequestContext) {
    const user = await UserModel.findOne({
      _id: new mongoose.Types.ObjectId(context.userId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    }).select("employeeId email firstName lastName role");

    let employeeId = user?.employeeId?.toString();

    if (!employeeId && user) {
      const emp = await EmployeeModel.findOne({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        $or: [
          { userId: user._id },
          { email: user.email },
        ],
        isDeleted: false,
      });

      if (emp) {
        employeeId = emp._id.toString();
        await UserModel.updateOne({ _id: user._id }, { employeeId: emp._id });
      }
    }

    if (!employeeId) {
      if (context.role === "ORG_ADMIN" || context.role === "SUPER_ADMIN") {
        const firstEmp = await EmployeeModel.findOne({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          isDeleted: false,
        }).populate(["departmentId", "designationId"]);

        if (firstEmp) {
          return firstEmp;
        }
      }

      throw new AppError(
        "No employee record is linked to this account",
        404
      );
    }

    const employee = await this.empRepo.findById(
      context,
      employeeId,
      { populate: ["departmentId", "designationId"] }
    );

    if (!employee) {
      throw new AppError("Employee record not found", 404);
    }
    return employee;
  }


  // Self-service — employee updates only their own profile fields
  async updateMyProfile(
    context: RequestContext,
    input: UpdateEmployeeInput
  ) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.updateEmployee(context, employeeId, input);
  }

  //Delete employee
  async deleteEmployee(
    context: RequestContext,
    id: string
  ) {
    const employee = await this.empRepo.findById(context, id);
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    await this.empRepo.updateById(context, id, {
      isDeleted: true,
      isActive: false,
      status: "INACTIVE",
    } as any);

    await UserModel.findOneAndUpdate(
      { employeeId: employee._id },
      { isActive: false }
    );

    return { message: "Employee deleted successfully" };
  }

  //Bank accounts
  async addBankAccount(
    context: RequestContext,
    employeeId: string,
    input: AddBankAccountInput
  ) {
    let employee = mongoose.Types.ObjectId.isValid(employeeId)
      ? await this.empRepo.findById(context, employeeId)
      : null;
    if (!employee) {
      employee = await EmployeeModel.findOne({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        employeeCode: employeeId.trim(),
        isDeleted: false,
      });
    }
    if (!employee) throw new AppError("Employee not found", 404);
    const resolvedEmployeeId = employee._id.toString();

    // If isPrimary — unset all existing primary accounts first
    if (input.isPrimary) {
      await mongoose.model("EmployeeBankAccount").updateMany(
        {
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          employeeId: new mongoose.Types.ObjectId(resolvedEmployeeId),
          isDeleted: false,
        },
        { isPrimary: false }
      );
    }

    const account = await this.empRepo.addBankAccount({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: employee.branchId as any,
      employeeId: new mongoose.Types.ObjectId(resolvedEmployeeId) as any,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      ifscCode: input.ifscCode,
      accountType: input.accountType as any,
      isPrimary: input.isPrimary,
      isActive: true,
      createdBy: new mongoose.Types.ObjectId(context.userId) as any,
      updatedBy: new mongoose.Types.ObjectId(context.userId) as any,
    });

    // Return with masked account number
    await recalculateProfileCompletion(context.tenantId, resolvedEmployeeId);
    return {
      ...account.toObject(),
      accountNumber: maskAccountNumber(account.accountNumber),
    };
  }

  async getBankAccounts(
    context: RequestContext,
    employeeId: string
  ) {
    let employee = mongoose.Types.ObjectId.isValid(employeeId)
      ? await this.empRepo.findById(context, employeeId)
      : null;
    if (!employee) {
      employee = await EmployeeModel.findOne({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        employeeCode: employeeId.trim(),
        isDeleted: false,
      });
    }
    if (!employee) throw new AppError("Employee not found", 404);


    const accounts = await this.empRepo.getBankAccounts(context, employeeId);

    // Mask all account numbers before returning
    return accounts.map((acc) => ({
      ...acc.toObject(),
      accountNumber: maskAccountNumber(acc.accountNumber),
    }));
  }

  async deleteBankAccount(
    context: RequestContext,
    employeeId: string,
    bankId: string
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    await this.empRepo.deleteBankAccount(bankId);
    await recalculateProfileCompletion(context.tenantId, employeeId);
    return { message: "Bank account removed successfully" };
  }


  async getMyBankAccounts(context: RequestContext) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.getBankAccounts(context, employeeId);
  }

  async addMyBankAccount(context: RequestContext, input: AddBankAccountInput) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.addBankAccount(context, employeeId, input);
  }

  async deleteMyBankAccount(context: RequestContext, bankId: string) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.deleteBankAccount(context, employeeId, bankId);
  }


  // Shared resolver — same logic as getMyProfile's inline lookup, extracted
  private async resolveOwnEmployeeIdForSelfService(context: RequestContext): Promise<string> {
    const user = await UserModel.findOne({
      _id: new mongoose.Types.ObjectId(context.userId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    }).select("employeeId");

    if (!user?.employeeId) {
      throw new AppError("No employee record is linked to this account", 404);
    }
    return user.employeeId.toString();
  }


  // documents 

  async getCalendarEvents(
    context: RequestContext,
    input: CalendarEventsQuery
  ): Promise<CalendarEvent[]> {
    const now = new Date();

    // — resolve date range from period —
    function startOfDay(d: Date): Date {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    function endOfDay(d: Date): Date {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    }
    function isLeapYear(y: number): boolean {
      return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    }

    let fromDate: Date;
    let toDate: Date;

    switch (input.period) {
      case "TODAY":
        fromDate = startOfDay(now);
        toDate = endOfDay(now);
        break;
      case "THIS_WEEK": {
        const dayOfWeek = now.getDay();
        const monOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now);
        monday.setDate(now.getDate() + monOffset);
        fromDate = startOfDay(monday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        toDate = endOfDay(sunday);
        break;
      }
      case "THIS_MONTH":
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case "PAST_WEEK":
        fromDate = new Date(now);
        fromDate.setDate(now.getDate() - 7);
        fromDate = startOfDay(fromDate);
        toDate = endOfDay(now);
        break;
      case "PAST_MONTH":
        fromDate = new Date(now);
        fromDate.setDate(now.getDate() - 30);
        fromDate = startOfDay(fromDate);
        toDate = endOfDay(now);
        break;
      default:
        throw new AppError("Invalid period", 400);
    }

    // Build employee filter
    const empFilter: Record<string, unknown> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
      status: { $in: ["ACTIVE", "ON_LEAVE"] },
    };
    if (input.branchId) {
      empFilter.branchId = new mongoose.Types.ObjectId(input.branchId);
    }

    const employees = await EmployeeModel.find(empFilter)
      .select("firstName lastName employeeCode dateOfBirth joiningDate branchId")
      .lean();

    const events: CalendarEvent[] = [];

    for (const emp of employees) {
      const empId = (emp as any)._id.toString();

      // Helper: compute event date for a given year (handles Feb 29)
      const getEventInYear = (base: Date, year: number): Date => {
        const m = base.getMonth();
        const d = base.getDate();
        if (m === 1 && d === 29 && !isLeapYear(year)) {
          return new Date(year, 1, 28);
        }
        return new Date(year, m, d);
      };

      // Birthday
      if ((emp as any).dateOfBirth) {
        const dob = new Date((emp as any).dateOfBirth);
        const fromYear = fromDate.getFullYear();
        const toYear = toDate.getFullYear();
        for (let y = fromYear; y <= toYear; y++) {
          const eventDate = getEventInYear(dob, y);
          if (eventDate >= fromDate && eventDate <= toDate) {
            events.push({
              type: "BIRTHDAY",
              title: `${(emp as any).firstName} ${(emp as any).lastName}'s Birthday`,
              date: eventDate,
              employeeId: empId,
              employeeCode: (emp as any).employeeCode,
              branchId: (emp as any).branchId?.toString(),
            });
            break; // one birthday per employee per range
          }
        }
      }

      // Work anniversary
      if ((emp as any).joiningDate) {
        const jd = new Date((emp as any).joiningDate);
        const fromYear = fromDate.getFullYear();
        const toYear = toDate.getFullYear();
        for (let y = fromYear; y <= toYear; y++) {
          const years = y - jd.getFullYear();
          if (years < 1) continue;
          const eventDate = getEventInYear(jd, y);
          if (eventDate >= fromDate && eventDate <= toDate) {
            events.push({
              type: "ANNIVERSARY",
              title: `${(emp as any).firstName} ${(emp as any).lastName} - ${years} Year Work Anniversary`,
              date: eventDate,
              employeeId: empId,
              employeeCode: (emp as any).employeeCode,
              branchId: (emp as any).branchId?.toString(),
              years,
            });
            break;
          }
        }
      }
    }

    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    return events;
  }


  /**
   * Import Employees: Parses file -> Validates records -> Calls Repository
   */
  async importEmployees(context: RequestContext, file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new AppError("Import file buffer is missing", 400);
    }

    const fileType = file.originalname.endsWith(".xlsx") ? "xlsx" : "csv";
    const parsedData = await parseImportFile(context, file.buffer, fileType);

    if (!parsedData.validRecords.length) {
      throw ValidationFailedError(
        "No valid employee records found in file",
        parsedData.errors
      );
    }

    // Bulk insert employee records
    const dbResult = await this.empRepo.bulkCreate(context, parsedData.validRecords);

    // For each inserted employee — create user account + send activation email
    // Done after bulkCreate so we have the _id for each record
    for (const emp of dbResult.records) {
      try {
        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

        const userAccount = new UserModel({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          email: emp.email.toLowerCase(),
          passwordHash: null,
          firstName: emp.firstName,
          lastName: emp.lastName,
          role: "EMPLOYEE",
          isOrgAdmin: false,
          isActive: false,
          isEmailVerified: false,
          branchIds: [emp.branchId],
          employeeId: emp._id,
          accountActivationToken: hashedToken,
          accountActivationExpires: new Date(Date.now() + 72 * 60 * 60 * 1000),
        });

        await userAccount.save();

        // Send activation email — fire and forget, don't block import
        const activationUrl = `${env.frontendUrl}/activate-account?token=${rawToken}`;
        emailService.sendEmail(
          emp.email,
          `${emp.firstName} ${emp.lastName}`,
          `Welcome to HRMS — Activate your account`,
          `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <h2>Welcome to the team, ${emp.firstName}!</h2>
            <p>Your HRMS account has been created. Click below to set your password.</p>
            <a href="${activationUrl}"
               style="display:inline-block; padding:12px 28px; background:#2886CE;
                      color:white; text-decoration:none; border-radius:4px; font-weight:bold;">
              Activate My Account
            </a>
            <p style="color:#888; font-size:12px; margin-top:24px;">
              This link expires in 72 hours.
            </p>
          </div>
          `
        ).catch(() => { }); // never fail the import because of email

      } catch (userError) {
        // User account creation failure must not fail the whole import
        // Employee record exists — HR can manually trigger activation later
        console.error(`Failed to create user account for ${emp.email}:`, userError);
      }

      // Recalculate profile completion async
      recalculateProfileCompletion(context.tenantId, emp._id.toString()).catch(() => { });
    }

    return {
      totalProcessed: parsedData.totalRows,
      insertedCount: dbResult.insertedCount,
      failedCount: parsedData.errors.length,
      errors: parsedData.errors,
      warnings: parsedData.warnings,   // ← ADD
      created: parsedData.created,    // ← ADD
    };
  }

  /**
   * Export Employees: Fetches from Repository -> Formats file -> Returns Payload
   */
  async exportEmployees(
    context: RequestContext,
    format: "csv" | "xlsx",
    filters: any
  ) {
    // 1. Query records via Repository
    const employees = await this.empRepo.findEmployeesForExport(
      context,
      filters
    );

    if (!employees.length) {
      throw new AppError("No employees found matching export criteria", 404);
    }

    // 2. Transform DB records into requested export format buffer
    const fileBuffer = await buildExportBuffer(employees, format);
    const mimeType = format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv";

    const fileName = `employees_export_${Date.now()}.${format}`;

    // Log the export in ExportSession audit
    const auditRecord = new ExportSessionModel({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      userId: new mongoose.Types.ObjectId(context.userId),
      filters: filters || {},
      fieldsIncluded: ["firstName", "lastName", "email", "phone", "branchName", "departmentName", "designationName", "joiningDate", "employeeType", "gender", "dateOfBirth", "pan", "aadhaar", "countryCode"],
      fileName,
      createdBy: new mongoose.Types.ObjectId(context.userId),
      updatedBy: new mongoose.Types.ObjectId(context.userId),
    });
    await auditRecord.save();

    // 3. Return CSR-compliant data object
    return {
      fileName,
      mimeType,
      fileData: fileBuffer.toString("base64"),
      totalRecords: employees.length,
    };
  }

  async validateImport(context: RequestContext, file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new AppError("Import file buffer is missing", 400);
    }

    const sessionId = uuidv4();

    // Create session in 'validating' state
    const session = new ImportSessionModel({
      sessionId,
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      status: 'validating',
      fileName: file.originalname,
      rows: [],
      createdBy: new mongoose.Types.ObjectId(context.userId),
      updatedBy: new mongoose.Types.ObjectId(context.userId),
    });

    await session.save();

    // Enqueue the background processing job
    const { addImportJob } = require("./import-queue");
    await addImportJob({
      sessionId,
      context,
      fileBufferBase64: file.buffer.toString("base64"),
      fileName: file.originalname,
    });

    return {
      sessionId,
      fileName: file.originalname,
      status: session.status,
    };
  }

  async processValidation(context: RequestContext, sessionId: string, buffer: Buffer, fileName: string) {
    const fileType = fileName.endsWith(".xlsx") ? "xlsx" : "csv";
    const parsedData = await parseImportFile(context, buffer, fileType);

    // Determine row statuses and actions
    const sessionRows = parsedData.validRecords.map((rec, i) => {
      const rowNumber = i + 2; // row 1 is header
      const rowErrors = parsedData.errors.filter(e => e.rowNumber === rowNumber);
      const rowWarnings = parsedData.warnings.filter(e => e.rowNumber === rowNumber);

      let status: 'valid' | 'warning' | 'error' = 'valid';
      let action: 'create' | 'update' | 'skip' = 'create';
      const messages: string[] = [];

      if (rowErrors.length > 0) {
        status = 'error';
        action = 'skip';
        messages.push(...rowErrors.map(e => e.reason));
      } else if (rowWarnings.length > 0) {
        status = 'warning';
        action = 'create';
        messages.push(...rowWarnings.map(e => e.reason));
      }

      return {
        rowNumber,
        rawData: rec,
        mappedData: rec,
        status,
        action,
        messages,
      };
    });

    // Handle rows that had errors during initial parsing
    const invalidRowErrors = parsedData.errors.filter(e => !parsedData.validRecords.some((_, i) => (i + 2) === e.rowNumber));
    for (const err of invalidRowErrors) {
      sessionRows.push({
        rowNumber: err.rowNumber,
        rawData: {},
        mappedData: {},
        status: 'error',
        action: 'skip',
        messages: [err.reason],
      });
    }

    sessionRows.sort((a, b) => a.rowNumber - b.rowNumber);

    const hasErrors = sessionRows.some(r => r.status === 'error');

    await ImportSessionModel.updateOne(
      { sessionId },
      {
        $set: {
          status: hasErrors ? 'failed' : 'ready',
          rows: sessionRows,
        }
      }
    );
  }

  async getImportPreview(context: RequestContext, sessionId: string, pageNumber: number = 1, pageSize: number = 20) {
    const session = await ImportSessionModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      sessionId,
    }).lean();

    if (!session) {
      throw new AppError("Import session not found", 404);
    }

    const startIndex = (pageNumber - 1) * pageSize;
    const paginatedRows = session.rows.slice(startIndex, startIndex + pageSize);

    return {
      sessionId: session.sessionId,
      fileName: session.fileName,
      status: session.status,
      totalRows: session.rows.length,
      pageNumber,
      pageSize,
      rows: paginatedRows,
    };
  }

  async commitImport(context: RequestContext, sessionId: string) {
    const session = await ImportSessionModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      sessionId,
    });

    if (!session) {
      throw new AppError("Import session not found", 404);
    }

    if (session.status === 'committed') {
      throw new AppError("Import session has already been committed", 400);
    }

    if (session.status === 'failed') {
      throw new AppError("Cannot commit an import session that has validation errors", 400);
    }

    const validRows = session.rows.filter(r => r.status !== 'error' && r.action === 'create');
    const validRecords = validRows.map(r => r.rawData);

    if (!validRecords.length) {
      throw new AppError("No valid employee records to commit", 400);
    }

    const org = await OrganizationModel.findById(context.tenantId);
    if (!org) throw new AppError("Organization not found", 404);

    const { maxEmployees: parsedBulkMax } = parseEmployeeCountRange(org.employeeCountRange);
    const maxEmployees = Math.max(parsedBulkMax, org.subscription?.maxEmployees || 10);

    const currentCount = await EmployeeModel.countDocuments({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });

    if (currentCount + validRecords.length > maxEmployees) {
      throw new AppError(
        `Bulk import exceeds your workspace team size limit (Range: ${org.employeeCountRange || "1-10"}, Current: ${currentCount}, Trying to add: ${validRecords.length}, Max allowed: ${maxEmployees} users). Please upgrade your workspace tier.`,
        403
      );
    }

    const dbResult = await this.empRepo.bulkCreate(context, validRecords);

    // Create user accounts + send welcome emails
    for (const emp of dbResult.records) {
      try {
        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

        const userAccount = new UserModel({
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          email: emp.email.toLowerCase(),
          passwordHash: null,
          firstName: emp.firstName,
          lastName: emp.lastName,
          role: "EMPLOYEE",
          isOrgAdmin: false,
          isActive: false,
          isEmailVerified: false,
          branchIds: [emp.branchId],
          employeeId: emp._id,
          accountActivationToken: hashedToken,
          accountActivationExpires: new Date(Date.now() + 72 * 60 * 60 * 1000),
        });

        await userAccount.save();

        const activationUrl = `${env.frontendUrl}/activate-account?token=${rawToken}`;
        emailService.sendEmail(
          emp.email,
          `${emp.firstName} ${emp.lastName}`,
          `Welcome to HRMS — Activate your account`,
          `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <h2>Welcome to the team, ${emp.firstName}!</h2>
            <p>Your HRMS account has been created. Click below to set your password.</p>
            <a href="${activationUrl}"
               style="display:inline-block; padding:12px 28px; background:#2886CE;
                      color:white; text-decoration:none; border-radius:4px; font-weight:bold;">
              Activate My Account
            </a>
            <p style="color:#888; font-size:12px; margin-top:24px;">
              This link expires in 72 hours.
            </p>
          </div>
          `
        ).catch(() => { });

      } catch (userError) {
        console.error(`Failed to create user account for ${emp.email}:`, userError);
      }

      // Recalculate profile completion async
      recalculateProfileCompletion(context.tenantId, emp._id.toString()).catch(() => { });
    }

    session.status = 'committed';
    await session.save();

    return {
      sessionId: session.sessionId,
      status: session.status,
      totalRows: session.rows.length,
      insertedCount: dbResult.insertedCount,
    };
  }

  async getImportExportHistory(context: RequestContext) {
    const tenantIdObj = new mongoose.Types.ObjectId(context.tenantId);

    const imports = await ImportSessionModel.find({ tenantId: tenantIdObj })
      .select("sessionId fileName status rows createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const exports = await ExportSessionModel.find({ tenantId: tenantIdObj })
      .sort({ createdAt: -1 })
      .lean();

    const importHistory = imports.map(imp => ({
      type: "import",
      id: imp.sessionId,
      fileName: imp.fileName,
      status: imp.status,
      totalRows: imp.rows.length,
      successCount: imp.rows.filter(r => r.status === 'valid').length,
      warningCount: imp.rows.filter(r => r.status === 'warning').length,
      errorCount: imp.rows.filter(r => r.status === 'error').length,
      timestamp: imp.createdAt,
    }));

    const exportHistory = exports.map(exp => ({
      type: "export",
      id: exp._id,
      fileName: exp.fileName,
      filters: exp.filters,
      fieldsCount: exp.fieldsIncluded.length,
      timestamp: exp.createdAt,
    }));

    return [...importHistory, ...exportHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // ── Eligible Managers Query for Dynamic Department & Seniority Selection ──
  async getEligibleManagers(context: RequestContext, query: EligibleManagersQuery) {
    const tenantIdObj = new mongoose.Types.ObjectId(context.tenantId);

    const matchFilter: any = {
      tenantId: tenantIdObj,
      isActive: true,
      isDeleted: false,
    };

    if (query.branchId) {
      matchFilter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    if (query.departmentId) {
      matchFilter.departmentId = new mongoose.Types.ObjectId(query.departmentId);
    }

    if (query.excludeEmployeeId) {
      matchFilter._id = { $ne: new mongoose.Types.ObjectId(query.excludeEmployeeId) };
    }

    // Determine target seniority level
    let targetMinLevel = query.minLevel;
    if (!targetMinLevel && query.designationId) {
      const candidateDesignation = await DesignationModel.findById(query.designationId).select("level").lean();
      if (candidateDesignation && typeof candidateDesignation.level === "number") {
        targetMinLevel = candidateDesignation.level;
      }
    }

    // Load department details to identify the default Department Head
    let departmentDoc = null;
    if (query.departmentId) {
      departmentDoc = await DepartmentModel.findOne({
        _id: new mongoose.Types.ObjectId(query.departmentId),
        tenantId: tenantIdObj,
        isDeleted: false,
      }).populate("headId", "_id firstName lastName employeeCode designationId").lean();
    }

    // Fetch potential manager candidates
    const employees = await EmployeeModel.find(matchFilter)
      .populate("designationId", "name code level")
      .populate("departmentId", "name code headId")
      .select("_id employeeCode firstName lastName email avatarUrl branchId departmentId designationId isDepartmentHead")
      .sort({ "designationId.level": -1, firstName: 1 })
      .lean();

    let filteredEmployees = employees;
    if (targetMinLevel !== undefined && targetMinLevel > 1) {
      const levelFiltered = employees.filter((emp: any) => {
        const desigLevel = emp.designationId?.level ?? 1;
        const isHead = departmentDoc?.headId && (departmentDoc.headId as any)._id?.toString() === emp._id.toString();
        return desigLevel >= targetMinLevel || isHead;
      });
      if (levelFiltered.length > 0) {
        filteredEmployees = levelFiltered;
      }
    }

    if (query.search) {
      const term = query.search.toLowerCase();
      filteredEmployees = filteredEmployees.filter((emp: any) =>
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(term) ||
        emp.employeeCode.toLowerCase().includes(term)
      );
    }

    let defaultManagerId: string | null = null;
    if (departmentDoc?.headId) {
      defaultManagerId = (departmentDoc.headId as any)._id?.toString() ?? null;
    } else if (filteredEmployees.length > 0) {
      defaultManagerId = (filteredEmployees[0] as any)._id.toString();
    }

    const managerList = filteredEmployees.map((emp: any) => ({
      _id: emp._id.toString(),
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      fullName: `${emp.firstName} ${emp.lastName}`.trim(),
      email: emp.email,
      avatarUrl: emp.avatarUrl || null,
      branchId: emp.branchId?.toString(),
      departmentId: emp.departmentId?._id?.toString() || query.departmentId,
      departmentName: emp.departmentId?.name || departmentDoc?.name || "Department",
      designationId: emp.designationId?._id?.toString(),
      designationTitle: emp.designationId?.name || "Member",
      level: emp.designationId?.level ?? 1,
      isDepartmentHead: departmentDoc?.headId && (departmentDoc.headId as any)._id?.toString() === emp._id.toString(),
    }));

    return {
      department: departmentDoc ? {
        _id: departmentDoc._id.toString(),
        name: departmentDoc.name,
        code: departmentDoc.code,
        head: departmentDoc.headId ? {
          _id: (departmentDoc.headId as any)._id.toString(),
          fullName: `${(departmentDoc.headId as any).firstName} ${(departmentDoc.headId as any).lastName}`.trim(),
          employeeCode: (departmentDoc.headId as any).employeeCode,
        } : null,
      } : null,
      defaultManagerId,
      totalEligible: managerList.length,
      managers: managerList,
    };
  }
}