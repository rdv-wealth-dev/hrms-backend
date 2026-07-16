import mongoose from "mongoose";
import { EmployeeRepository } from "./employee.repository";
import { getNextEmployeeCode } from "./employee-counter.util";
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  UpdateEmployeeStatusInput,
  AddBankAccountInput,
  AddDocumentInput,
  ListEmployeesQuery,
  RequestUploadUrlInput,
  VerifyDocumentInput,
} from "./employee.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { buildPagedResponse } from "../../core/database/base.schema";
import crypto from "crypto";
import { UserModel } from "../user/user.model";
import { OrganizationModel } from "../organization/organization.model";
import { SalaryStructureService } from "../payroll/salary-structure.service";
import { emailService } from "../../service/email.service";
import { env } from "../../config/env";
import { s3Service } from "../../service/s3.service";

// Helper — mask account number showing only last 4 digits
function maskAccountNumber(acc: string): string {
  if (acc.length <= 4) return acc;
  return "X".repeat(acc.length - 4) + acc.slice(-4);
}

export class EmployeeService {
  private empRepo = new EmployeeRepository();
  private salaryStructureService = new SalaryStructureService();

  //Create employee
  async createEmployee(
    context: RequestContext,
    input: CreateEmployeeInput
  ) {
    // Check email uniqueness within tenant
    const existing = await this.empRepo.findByEmail(context, input.email);
    if (existing) {
      throw new AppError(
        `Employee with email "${input.email}" already exists`,
        409
      );
    }
    //Check if a user account already exists with this email in this tenant
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

    // Generate atomic employee code
    const employeeCode = await getNextEmployeeCode(context.tenantId);

    const employee = await this.empRepo.create(context, {
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: new mongoose.Types.ObjectId(input.branchId) as any,
      departmentId: new mongoose.Types.ObjectId(input.departmentId) as any,
      designationId: new mongoose.Types.ObjectId(input.designationId) as any,
      managerId: input.managerId
        ? new mongoose.Types.ObjectId(input.managerId) as any
        : undefined,
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
      employeeType: input.employeeType as any,
      status: "ACTIVE" as any,
      joiningDate: new Date(input.joiningDate),
      probationEndDate: input.probationEndDate
        ? new Date(input.probationEndDate)
        : undefined,
      currentAddress: input.currentAddress,
      permanentAddress: input.permanentAddress,
      emergencyContacts: input.emergencyContacts ?? [],
      isActive: true,
    });

    // Generate account activation token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // Create user account for this employee
    // Account will be inactive until employee activates it via email link
    const userAccount = new UserModel({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      email: input.email.toLowerCase(),
      passwordHash: null,
      firstName: input.firstName,
      lastName: input.lastName,
      role: "EMPLOYEE",
      isOrgAdmin: false,
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
          ctcAnnual:  input.salaryStructure.ctcAnnual,
          lineItems:  input.salaryStructure.lineItems,
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
        tenantId:      new mongoose.Types.ObjectId(context.tenantId) as any,
        branchId:      employee.branchId as any,
        employeeId:    employee._id as any,
        bankName:      input.bankAccount.bankName,
        accountNumber: input.bankAccount.accountNumber,
        ifscCode:      input.bankAccount.ifscCode,
        accountType:   input.bankAccount.accountType as any,
        isPrimary:     true,
        isActive:      true,
        createdBy:     new mongoose.Types.ObjectId(context.userId) as any,
        updatedBy:     new mongoose.Types.ObjectId(context.userId) as any,
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


  // Step 1 — HR/employee requests a pre-signed URL before uploading anything
  async requestDocumentUploadUrl(
    context: RequestContext,
    employeeId: string,
    input: RequestUploadUrlInput
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    const org = await OrganizationModel.findById(context.tenantId).select("slug");
    const slug = org?.slug ?? context.tenantId;

    const s3Key = s3Service.buildDocumentKey(slug, employeeId, input.documentType, input.fileName);
    const { uploadUrl, expiresIn } = await s3Service.getUploadUrl(s3Key, input.mimeType);

    return {
      uploadUrl,
      expiresIn,
      s3Key,            // client must send this back in step 2 after uploading
      documentType: input.documentType,
      fileName: input.fileName
    };
  }

  // Step 3 — get a fresh viewing URL for an already-uploaded document
  async getDocumentDownloadUrl(
    context: RequestContext,
    employeeId: string,
    docId: string
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    const documents = await this.empRepo.getDocuments(context, employeeId);
    const doc = documents.find(d => d._id.toString() === docId);
    if (!doc) throw new AppError("Document not found", 404);

    const downloadUrl = await s3Service.getDownloadUrl(doc.s3Key);
    return { downloadUrl, fileName: doc.fileName, expiresIn: 900 };

  }

  async requestMyUploadUrl(
    context: RequestContext, 
    input: RequestUploadUrlInput
  ) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.requestDocumentUploadUrl(context, employeeId, input);
  }

  async addMyDocument(
    context: RequestContext, 
    input: AddDocumentInput
  ) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.addDocument(context, employeeId, input);
  }

  async getMyDownloadUrl(
    context: RequestContext, docId: string
  ) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.getDocumentDownloadUrl(context, employeeId, docId);
  }

  // Server-side Direct upload for S3 and DB document storage
  async uploadDocumentDirectly(
    context: RequestContext,
    employeeId: string,
    file: Express.Multer.File,
    documentType: string
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    const org = await OrganizationModel.findById(context.tenantId).select("slug");
    const slug = org?.slug ?? context.tenantId;

    const s3Key = s3Service.buildDocumentKey(slug, employeeId, documentType, file.originalname);

    // Upload file buffer to S3 directly
    await s3Service.uploadObject(s3Key, file.buffer, file.mimetype);

    // Save metadata record
    const doc = await this.empRepo.addDocument({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: employee.branchId as any,
      employeeId: new mongoose.Types.ObjectId(employeeId) as any,
      documentType: documentType as any,
      fileName: file.originalname,
      s3Key: s3Key,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedBy: new mongoose.Types.ObjectId(context.userId) as any,
      isVerified: false,
      createdBy: new mongoose.Types.ObjectId(context.userId) as any,
      updatedBy: new mongoose.Types.ObjectId(context.userId) as any,
    });

    return doc;
  }

  async uploadMyDocumentDirectly(
    context: RequestContext,
    file: Express.Multer.File,
    documentType: string
  ) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.uploadDocumentDirectly(context, employeeId, file, documentType);
  }

  //Get by ID
  async getEmployeeById(
    context: RequestContext,
    id: string
  ) {
    const employee = await this.empRepo.findById(context, id, {
      populate: ["departmentId", "designationId"],
    });

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    return employee;
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

    if (input.dateOfBirth) updateData.dateOfBirth = new Date(input.dateOfBirth);
    if (input.confirmationDate) updateData.confirmationDate = new Date(input.confirmationDate);
    if (input.probationEndDate) updateData.probationEndDate = new Date(input.probationEndDate);
    if (input.departmentId) updateData.departmentId = new mongoose.Types.ObjectId(input.departmentId);
    if (input.designationId) updateData.designationId = new mongoose.Types.ObjectId(input.designationId);
    if (input.managerId) updateData.managerId = new mongoose.Types.ObjectId(input.managerId);

    const updated = await this.empRepo.updateById(context, id, updateData);
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
    }).select("employeeId");

    if (!user || !user.employeeId) {
      throw new AppError(
        "No employee record is linked to this account",
        404
      );
    }

    const employee = await this.empRepo.findById(
      context,
      user.employeeId.toString(),
      { populate: ["departmentId", "designationId"] }
    );

    if (!employee) {
      throw new AppError("Employee record not found", 404);
    }
    return employee;

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
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    // If isPrimary — unset all existing primary accounts first
    if (input.isPrimary) {
      await mongoose.model("EmployeeBankAccount").updateMany(
        {
          tenantId: new mongoose.Types.ObjectId(context.tenantId),
          employeeId: new mongoose.Types.ObjectId(employeeId),
          isDeleted: false,
        },
        { isPrimary: false }
      );
    }

    const account = await this.empRepo.addBankAccount({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: employee.branchId as any,
      employeeId: new mongoose.Types.ObjectId(employeeId) as any,
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
    return {
      ...account.toObject(),
      accountNumber: maskAccountNumber(account.accountNumber),
    };
  }

  async getBankAccounts(
    context: RequestContext,
    employeeId: string
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
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
    return { message: "Bank account removed successfully" };
  }

  // Documents
  async addDocument(
    context: RequestContext,
    employeeId: string,
    input: AddDocumentInput
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    const doc = await this.empRepo.addDocument({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: employee.branchId as any,
      employeeId: new mongoose.Types.ObjectId(employeeId) as any,
      documentType: input.documentType as any,
      fileName: input.fileName,
      s3Key: input.s3Key,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedBy: new mongoose.Types.ObjectId(context.userId) as any,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      isVerified: false,
      createdBy: new mongoose.Types.ObjectId(context.userId) as any,
      updatedBy: new mongoose.Types.ObjectId(context.userId) as any,
    });

    return doc;
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

  async getMyDocuments(context: RequestContext) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.getDocuments(context, employeeId);
  }

  async deleteMyDocument(context: RequestContext, docId: string) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.deleteDocument(context, employeeId, docId);
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

  async getDocuments(
    context: RequestContext,
    employeeId: string
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    return this.empRepo.getDocuments(context, employeeId);
  }

  async deleteDocument(
    context: RequestContext,
    employeeId: string,
    docId: string
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    await this.empRepo.deleteDocument(docId);
    return { message: "Document removed successfully" };
  }

  // documents 

  async getPendingDocuments(context: RequestContext) {
    return this.empRepo.getPendingDocuments(context);
  }

  async verifyDocument(context: RequestContext, docId: string, input: VerifyDocumentInput) {
    const doc = await this.empRepo.verifyDocument(docId, input.isVerified, context.userId);
    if (!doc) throw new AppError("Document not found", 404);
    return doc;
  }
}