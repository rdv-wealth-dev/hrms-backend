import mongoose from "mongoose";
import { BaseRepository } from "../../../shared/database/base.repository"
import { EmployeeDocument, EmployeeModel } from "../models/employee.model";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { EmployeeBankAccountDocument, EmployeeBankAccountModel, } from "../models/employee-bank-account.model";

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

    if (context.role !== "ORG_ADMIN" && context.role !== "SUPER_ADMIN" && context.branchIds && context.branchIds.length > 0) {
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

    const [rawList, totalRecords] = await Promise.all([
      EmployeeModel.find(tenantFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safe)
        .populate("departmentId", "name code parentId")
        .populate("departmentIds", "name code parentId")
        .populate("designationId", "name code level")
        .lean(),
      EmployeeModel.countDocuments(tenantFilter),
    ]);

    const data = rawList.map((emp: any) => ({
      ...emp,
      departmentIds: emp.departmentIds?.length ? emp.departmentIds : emp.departmentId ? [emp.departmentId] : [],
      workMode: emp.workMode || emp.customFields?.workMode || "OFFICE",
      grade: emp.grade || emp.customFields?.grade || "NA",
      subDepartment: emp.subDepartment || emp.customFields?.subDepartment || null,
    }));

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


  /**
   * Bulk insert employees in a single transaction or batch operation.
   */
  async bulkCreate(
    context: RequestContext,
    employees: any[]
  ): Promise<{ insertedCount: number; records: any[] }> {
    const insertedRecords = await EmployeeModel.insertMany(
      employees.map((emp) => ({
        ...emp,
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        createdAt: new Date(),
      }))
    );
    return {
      insertedCount: insertedRecords.length,
      records: insertedRecords as any[],
    };
  }

  /**
   * Fetch employees matching filters for export (Complete Master Data).
   */
  async findEmployeesForExport(
    context: RequestContext,
    filters: any
  ): Promise<any[]> {
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    };
    if (filters.departmentId) {
      query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
    }
    if (filters.branchId) {
      query.branchId = new mongoose.Types.ObjectId(filters.branchId);
    }
    if (filters.status) {
      query.status = filters.status;
    }

    const employees = await EmployeeModel.find(query)
      .populate("branchId", "name")
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .populate("teamId", "name")
      .populate("managerId", "firstName lastName employeeCode")
      .lean();

    const empIds = employees.map((e: any) => e._id);
    const bankAccounts = await EmployeeBankAccountModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: { $in: empIds },
      isPrimary: true,
    }).lean();

    const bankMap = new Map<string, any>();
    for (const b of bankAccounts) {
      bankMap.set(b.employeeId.toString(), b);
    }

    return employees.map((e: any) => ({
      ...e,
      primaryBankAccount: bankMap.get(e._id.toString()),
    }));
  }
}