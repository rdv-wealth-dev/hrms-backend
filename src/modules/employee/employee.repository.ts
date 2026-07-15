import mongoose from "mongoose";
import { BaseRepository } from "../../repositories/base.repository"
import { EmployeeDocument, EmployeeModel } from "./employee.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { EmployeeBankAccountDocument, EmployeeBankAccountModel, } from "./employee-bank-account.model";
import { EmployeeDocumentRecord, EmployeeDocumentModel, } from "./employee-document.model";

export class EmployeeRepository
  extends BaseRepository<EmployeeDocument> {
  constructor() {
    super(EmployeeModel);
  }

  //Find by email within tenant
  async findByEmail(
    context: RequestContext,
    email: string
  ): Promise<EmployeeDocument | null> {
    return EmployeeModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      email: email.toLowerCase(),
      isDeleted: false,
    });
  }

  //Search employees
  async search(
    context: RequestContext,
    keyword: string,
    filters: Record<string, unknown> = {},
    page: number = 1,
    pageSize: number = 10
  ) {
    const tenantFilter: Record<string, unknown> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
      ...filters,
    };

    if (context.branchIds && context.branchIds.length > 0) {
      tenantFilter.branchId = {
        $in: context.branchIds.map(
          (id) => new mongoose.Types.ObjectId(id)
        ),
      };
    }

    if (keyword) {
      const orConditions: Record<string, unknown>[] = [
        { firstName: { $regex: keyword, $options: "i" } },
        { lastName: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
        { employeeCode: { $regex: keyword, $options: "i" } },
      ];

      const parts = keyword.trim().split(/\s+/);
      if (parts.length > 1) {
        orConditions.push({
          firstName: { $regex: parts[0], $options: "i" },
          lastName: { $regex: parts.slice(1).join(" "), $options: "i" },
        });
        orConditions.push({
          lastName: { $regex: parts[0], $options: "i" },
          firstName: { $regex: parts.slice(1).join(" "), $options: "i" },
        });
      }

      (tenantFilter as any).$or = orConditions;
    }

    const skip = (page - 1) * pageSize;
    const safe = Math.min(pageSize, 100);

    const [data, totalRecords] = await Promise.all([
      EmployeeModel.find(tenantFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safe)
        .populate("departmentId", "name code")
        .populate("designationId", "name code")
        .lean(),
      EmployeeModel.countDocuments(tenantFilter),
    ]);

    return { data, totalRecords, pageNumber: page, pageSize: safe };
  }

  //Bank account methods
  async addBankAccount(
    data: Partial<EmployeeBankAccountDocument>
  ): Promise<EmployeeBankAccountDocument> {
    return new EmployeeBankAccountModel(data).save();
  }

  async getBankAccounts(
    context: RequestContext,
    employeeId: string
  ): Promise<EmployeeBankAccountDocument[]> {
    return EmployeeBankAccountModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    }).sort({ isPrimary: -1, createdAt: -1 });
  }

  async updateBankAccount(
    id: string,
    data: Partial<EmployeeBankAccountDocument>
  ): Promise<EmployeeBankAccountDocument | null> {
    return EmployeeBankAccountModel.findByIdAndUpdate(
      id,
      { ...data },
      { new: true }
    );
  }

  async deleteBankAccount(id: string): Promise<void> {
    await EmployeeBankAccountModel.findByIdAndUpdate(
      id,
      { isDeleted: true }
    );
  }

  //Document methods
  async addDocument(
    data: Partial<EmployeeDocumentRecord>
  ): Promise<EmployeeDocumentRecord> {
    return new EmployeeDocumentModel(data).save();
  }

  async getDocuments(
    context: RequestContext,
    employeeId: string
  ): Promise<EmployeeDocumentRecord[]> {
    return EmployeeDocumentModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    }).sort({ createdAt: -1 });
  }

  async deleteDocument(id: string): Promise<void> {
    await EmployeeDocumentModel.findByIdAndUpdate(
      id,
      { isDeleted: true }
    );
  }

  async getPendingDocuments(context: RequestContext) {
    return EmployeeDocumentModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isVerified: false,
      isDeleted: false,
    }).populate("employeeId", "employeeCode firstName lastName").sort({ createdAt: 1 });
  }

  async verifyDocument(id: string, isVerified: boolean, verifiedBy: string) {
    return EmployeeDocumentModel.findByIdAndUpdate(
      id,
      { isVerified, updatedBy: new mongoose.Types.ObjectId(verifiedBy) },
      { new: true }
    );
  }
}