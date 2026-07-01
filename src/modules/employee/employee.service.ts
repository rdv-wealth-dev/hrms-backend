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
} from "./employee.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { buildPagedResponse } from "../../core/database/base.schema";

// Helper — mask account number showing only last 4 digits
function maskAccountNumber(acc: string): string {
  if (acc.length <= 4) return acc;
  return "X".repeat(acc.length - 4) + acc.slice(-4);
}

export class EmployeeService {
  private empRepo = new EmployeeRepository();

  //Create employee
  async createEmployee(
    context: RequestContext,
    input:   CreateEmployeeInput
  ) {
    // Check email uniqueness within tenant
    const existing = await this.empRepo.findByEmail(context, input.email);
    if (existing) {
      throw new AppError(
        `Employee with email "${input.email}" already exists`,
        409
      );
    }

    // Generate atomic employee code
    const employeeCode = await getNextEmployeeCode(context.tenantId);

    const employee = await this.empRepo.create(context, {
      tenantId:      new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId:      new mongoose.Types.ObjectId(input.branchId)   as any,
      departmentId:  new mongoose.Types.ObjectId(input.departmentId)  as any,
      designationId: new mongoose.Types.ObjectId(input.designationId) as any,
      managerId:     input.managerId
        ? new mongoose.Types.ObjectId(input.managerId) as any
        : undefined,
      employeeCode,
      firstName:        input.firstName,
      lastName:         input.lastName,
      email:            input.email.toLowerCase(),
      phone:            input.phone,
      dateOfBirth:      input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      gender:           input.gender       as any,
      bloodGroup:       input.bloodGroup   as any,
      maritalStatus:    input.maritalStatus as any,
      nationality:      input.nationality,
      pan:              input.pan,
      aadhaar:          input.aadhaar,
      passportNo:       input.passportNo,
      employeeType:     input.employeeType as any,
      status:           "ACTIVE"           as any,
      joiningDate:      new Date(input.joiningDate),
      probationEndDate: input.probationEndDate
        ? new Date(input.probationEndDate)
        : undefined,
      currentAddress:   input.currentAddress,
      permanentAddress: input.permanentAddress,
      emergencyContacts:input.emergencyContacts ?? [],
      isActive:         true,
    });

    return employee;
  }

  //List employees
  async listEmployees(
    context: RequestContext,
    query:   ListEmployeesQuery
  ) {
    const filters: Record<string, unknown> = {};

    if (query.status)        filters.status        = query.status;
    if (query.departmentId)  filters.departmentId  = new mongoose.Types.ObjectId(query.departmentId);
    if (query.designationId) filters.designationId = new mongoose.Types.ObjectId(query.designationId);
    if (query.branchId)      filters.branchId      = new mongoose.Types.ObjectId(query.branchId);

    const result = await this.empRepo.search(
      context,
      query.search ?? "",
      filters,
      query.pageNumber ?? 1,
      query.pageSize   ?? 10
    );

    return buildPagedResponse({
      data:         result.data,
      pageNumber:   result.pageNumber,
      pageSize:     result.pageSize,
      totalRecords: result.totalRecords,
    });
  }

  //Get by ID
  async getEmployeeById(
    context: RequestContext,
    id:      string
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
    id:      string,
    input:   UpdateEmployeeInput
  ) {
    const employee = await this.empRepo.findById(context, id);
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    const updateData: Record<string, unknown> = { ...input };

    if (input.dateOfBirth)      updateData.dateOfBirth      = new Date(input.dateOfBirth);
    if (input.confirmationDate) updateData.confirmationDate = new Date(input.confirmationDate);
    if (input.probationEndDate) updateData.probationEndDate = new Date(input.probationEndDate);
    if (input.departmentId)     updateData.departmentId     = new mongoose.Types.ObjectId(input.departmentId);
    if (input.designationId)    updateData.designationId    = new mongoose.Types.ObjectId(input.designationId);
    if (input.managerId)        updateData.managerId        = new mongoose.Types.ObjectId(input.managerId);

    const updated = await this.empRepo.updateById(context, id, updateData);
    return updated;
  }

  //Update status
  async updateEmployeeStatus(
    context: RequestContext,
    id:      string,
    input:   UpdateEmployeeStatusInput
  ) {
    const employee = await this.empRepo.findById(context, id);
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    const updateData: Record<string, unknown> = {
      status:   input.status,
      isActive: input.status === "ACTIVE",
    };

    if (input.exitDate)   updateData.exitDate   = new Date(input.exitDate);
    if (input.exitReason) updateData.exitReason = input.exitReason;

    const updated = await this.empRepo.updateById(context, id, updateData);
    return updated;
  }

  //Delete employee
  async deleteEmployee(
    context: RequestContext,
    id:      string
  ) {
    const employee = await this.empRepo.findById(context, id);
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    await this.empRepo.softDeleteById(context, id);
    return { message: "Employee deleted successfully" };
  }

  //Bank accounts
  async addBankAccount(
    context:    RequestContext,
    employeeId: string,
    input:      AddBankAccountInput
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    // If isPrimary — unset all existing primary accounts first
    if (input.isPrimary) {
      await mongoose.model("EmployeeBankAccount").updateMany(
        {
          tenantId:   new mongoose.Types.ObjectId(context.tenantId),
          employeeId: new mongoose.Types.ObjectId(employeeId),
          isDeleted:  false,
        },
        { isPrimary: false }
      );
    }

    const account = await this.empRepo.addBankAccount({
      tenantId:      new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId:      employee.branchId as any,
      employeeId:    new mongoose.Types.ObjectId(employeeId) as any,
      bankName:      input.bankName,
      accountNumber: input.accountNumber,
      ifscCode:      input.ifscCode,
      accountType:   input.accountType as any,
      isPrimary:     input.isPrimary,
      isActive:      true,
      createdBy:     new mongoose.Types.ObjectId(context.userId) as any,
      updatedBy:     new mongoose.Types.ObjectId(context.userId) as any,
    });

    // Return with masked account number
    return {
      ...account.toObject(),
      accountNumber: maskAccountNumber(account.accountNumber),
    };
  }

  async getBankAccounts(
    context:    RequestContext,
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
    context:   RequestContext,
    employeeId:string,
    bankId:    string
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    await this.empRepo.deleteBankAccount(bankId);
    return { message: "Bank account removed successfully" };
  }

  // Documents
  async addDocument(
    context:    RequestContext,
    employeeId: string,
    input:      AddDocumentInput
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    const doc = await this.empRepo.addDocument({
      tenantId:     new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId:     employee.branchId as any,
      employeeId:   new mongoose.Types.ObjectId(employeeId) as any,
      documentType: input.documentType as any,
      fileName:     input.fileName,
      s3Key:        input.s3Key,
      mimeType:     input.mimeType,
      sizeBytes:    input.sizeBytes,
      uploadedBy:   new mongoose.Types.ObjectId(context.userId) as any,
      expiryDate:   input.expiryDate ? new Date(input.expiryDate) : undefined,
      isVerified:   false,
      createdBy:    new mongoose.Types.ObjectId(context.userId) as any,
      updatedBy:    new mongoose.Types.ObjectId(context.userId) as any,
    });

    return doc;
  }

  async getDocuments(
    context:    RequestContext,
    employeeId: string
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    return this.empRepo.getDocuments(context, employeeId);
  }

  async deleteDocument(
    context:    RequestContext,
    employeeId: string,
    docId:      string
  ) {
    const employee = await this.empRepo.findById(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    await this.empRepo.deleteDocument(docId);
    return { message: "Document removed successfully" };
  }
}