import mongoose from "mongoose";
import { getRawLogModel, IBiometricRawLog } from "../biometric.models";
import { EmployeeModel } from "../../employee/models/employee.model";
import { BranchModel } from "../../branch/branch.model";
import { UserModel } from "../../user/user.model";
import { RequestContext } from "../../../shared/types/request-context.interface";
import { AppError } from "../../../shared/errors/app.error";
import { BiometricLogQueryInput } from "../dto/biometric-log.dto";

export interface FormattedBiometricLog {
  sNo: number;
  employeeCode: string;
  employeeName: string;
  punchLog: string;
  punchDate: string;
  _id: string;
  punchTime: string;
  punchTimestamp?: Date;
  departmentName?: string;
  designationName?: string;
  avatarUrl?: string;
  branchId?: string;
  branchName?: string;
  modeofPunch: string;
  modeofAttn: string;
  deviceSerialno: string;
  deviceIp?: string;
  provider: string;
  receivedAt: Date;
  rawPayload: any;
}

export class BiometricLogService {
  /**
   * Helper to compute start & end date strings (YYYY-MM-DD) based on period
   */
  private resolveDateRange(query: BiometricLogQueryInput): { startDate: string; endDate: string } {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (query.period === "custom" && query.startDate && query.endDate) {
      return {
        startDate: query.startDate,
        endDate: query.endDate,
      };
    }

    if (query.period === "this_week") {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      const startStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
      return { startDate: startStr, endDate: todayStr };
    }

    if (query.period === "this_month") {
      const startStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      return { startDate: startStr, endDate: todayStr };
    }

    if (query.period === "last_month") {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const startStr = `${firstDayLastMonth.getFullYear()}-${pad(firstDayLastMonth.getMonth() + 1)}-01`;
      const endStr = `${lastDayLastMonth.getFullYear()}-${pad(lastDayLastMonth.getMonth() + 1)}-${pad(lastDayLastMonth.getDate())}`;
      return { startDate: startStr, endDate: endStr };
    }

    // Default: "today"
    return { startDate: todayStr, endDate: todayStr };
  }

  /**
   * List Biometric Punch Logs for Admin / HR
   */
  async listLogs(context: RequestContext, query: BiometricLogQueryInput) {
    const RawLogModel = getRawLogModel();
    const { startDate, endDate } = this.resolveDateRange(query);

    const page = query.page ?? query.pageNumber ?? 1;
    const limit = query.limit ?? query.pageSize ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      punchDate: { $gte: startDate, $lte: endDate },
    };

    // Role-based branch scoping:
    // ORG_ADMIN & SUPER_ADMIN have unrestricted access to ALL branches.
    // HR_ADMIN / BRANCH_ADMIN with assigned branchIds are strictly scoped to their assigned branch(es).
    const isMasterAdmin = ["ORG_ADMIN", "SUPER_ADMIN", "CEO"].includes(context.role);
    const userBranchIds = (context.branchIds || []).map((id) => id.toString());

    if (!isMasterAdmin && userBranchIds.length > 0) {
      if (query.branchId) {
        if (!userBranchIds.includes(query.branchId)) {
          throw new AppError("Access denied: You do not have permission to view attendance logs for this branch location", 403);
        }
        filter.branchId = new mongoose.Types.ObjectId(query.branchId);
      } else {
        filter.branchId = { $in: userBranchIds.map((id) => new mongoose.Types.ObjectId(id)) };
      }
    } else if (query.branchId && mongoose.Types.ObjectId.isValid(query.branchId)) {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    if (query.provider) {
      filter.provider = query.provider.toLowerCase();
    }

    if (query.deviceSerialno) {
      filter.deviceSerialno = query.deviceSerialno.trim();
    }

    // Filter by specific employee code directly
    let targetEmployeeCodes: string[] = [];
    if (query.employeeCode) {
      targetEmployeeCodes.push(query.employeeCode.trim());
    }

    // If employeeId is passed as ObjectId
    if (query.employeeId && mongoose.Types.ObjectId.isValid(query.employeeId)) {
      const emp = await EmployeeModel.findOne({
        _id: new mongoose.Types.ObjectId(query.employeeId),
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
      }).select("employeeCode");
      if (emp?.employeeCode) {
        targetEmployeeCodes.push(emp.employeeCode);
      }
    }

    // If keyword search is provided, search matching employees
    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), "i");
      const matchedEmployees = await EmployeeModel.find({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        $or: [
          { employeeCode: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
        ],
      })
        .select("employeeCode")
        .lean();

      const matchedCodes = matchedEmployees.map((e) => e.employeeCode).filter(Boolean);
      if (matchedCodes.length > 0) {
        targetEmployeeCodes = Array.from(new Set([...targetEmployeeCodes, ...matchedCodes]));
      } else if (!query.employeeCode) {
        // Search term matched no employees
        filter.employeeID = query.search.trim();
      }
    }

    if (targetEmployeeCodes.length === 1) {
      filter.employeeID = targetEmployeeCodes[0];
    } else if (targetEmployeeCodes.length > 1) {
      filter.employeeID = { $in: targetEmployeeCodes };
    }

    if (query.modeofPunch) {
      filter["payload.modeofPunch"] = new RegExp(`^${query.modeofPunch}$`, "i");
    }

    // Fetch logs and total count in parallel
    const [rawLogs, totalRecords] = await Promise.all([
      RawLogModel.find(filter)
        .sort({ punchDate: -1, punchTime: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RawLogModel.countDocuments(filter),
    ]);

    // Gather distinct employee IDs and branch IDs for bulk enrichment
    const empCodesToFetch = Array.from(
      new Set(rawLogs.map((l: any) => l.employeeID).filter(Boolean))
    );
    const branchIdsToFetch = Array.from(
      new Set(rawLogs.map((l: any) => l.branchId?.toString()).filter(Boolean))
    );

    const regexList = empCodesToFetch.map((c) => new RegExp(`^${c.trim()}$`, "i"));

    const [employees, branches] = await Promise.all([
      EmployeeModel.find({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        $or: [
          { employeeCode: { $in: regexList } },
          { employeeCode: { $in: empCodesToFetch } },
        ],
      })
        .populate("departmentId", "name code")
        .populate("designationId", "name code")
        .select("employeeCode firstName lastName avatarUrl departmentId designationId branchId")
        .lean(),
      BranchModel.find({
        _id: { $in: branchIdsToFetch.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("_id name code")
        .lean(),
    ]);

    const empMap = new Map<string, any>();
    for (const emp of employees) {
      if (emp.employeeCode) {
        const cleanCode = emp.employeeCode.trim().toUpperCase();
        empMap.set(cleanCode, emp);
        // Also map without leading zeros or stripped numeric
        const numericMatch = cleanCode.match(/\d+$/);
        if (numericMatch) {
          empMap.set(numericMatch[0], emp);
          empMap.set(String(parseInt(numericMatch[0], 10)), emp);
        }
      }
    }

    const branchMap = new Map<string, any>();
    for (const b of branches) {
      branchMap.set(b._id.toString(), b);
    }

    // Format logs with human-friendly metadata
    const data: FormattedBiometricLog[] = rawLogs.map((log: any, index: number) => {
      const codeKey = (log.employeeID || "").toUpperCase();
      const emp = empMap.get(codeKey);
      const branch = log.branchId ? branchMap.get(log.branchId.toString()) : undefined;

      const payload = log.payload || {};
      const modeofPunch = payload.modeofPunch || payload.punchType || payload.VerifyMode || "Default";
      const modeofAttn = payload.modeofAttn || payload.inOutMode || "Default";
      const deviceIp = payload.ip || payload.deviceIp || undefined;

      const sNo = (page - 1) * limit + index + 1;
      const employeeName = emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : (log.employeeID || "Unknown");
      const punchLog = log.punchTime || "";

      return {
        sNo,
        employeeCode: log.employeeID || "",
        employeeName,
        punchLog,
        punchDate: log.punchDate || "",
        _id: log._id.toString(),
        punchTime: log.punchTime || "",
        departmentName: (emp?.departmentId as any)?.name || undefined,
        designationName: (emp?.designationId as any)?.name || undefined,
        avatarUrl: emp?.avatarUrl || undefined,
        branchId: log.branchId?.toString(),
        branchName: branch?.name || undefined,
        modeofPunch,
        modeofAttn,
        deviceSerialno: log.deviceSerialno || payload.deviceSerialno || payload.deviceID || "",
        deviceIp,
        provider: log.provider || "realtime",
        receivedAt: log.receivedAt || log.createdAt,
        rawPayload: payload,
      };
    });

    return {
      data,
      totalRecords,
      pageNumber: page,
      pageSize: limit,
      filterRange: { startDate, endDate, period: query.period },
    };
  }

  /**
   * List personal biometric punch logs for logged-in Employee
   */
  async getMyLogs(context: RequestContext, query: BiometricLogQueryInput) {
    const user = await UserModel.findById(context.userId);
    let employeeCode = "";

    if (user?.employeeId) {
      const emp = await EmployeeModel.findById(user.employeeId).select("employeeCode");
      employeeCode = emp?.employeeCode || "";
    }

    if (!employeeCode) {
      return {
        data: [],
        totalRecords: 0,
        pageNumber: 1,
        pageSize: 20,
        filterRange: this.resolveDateRange(query),
      };
    }

    // Delegate to listLogs with fixed employeeCode
    return this.listLogs(context, {
      ...query,
      employeeCode,
      search: undefined,
      employeeId: undefined,
    });
  }

  /**
   * Get Punch Activity Statistics (Summary)
   */
  async getSummary(context: RequestContext) {
    const RawLogModel = getRawLogModel();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const tenantOId = new mongoose.Types.ObjectId(context.tenantId);
    const isMasterAdmin = ["ORG_ADMIN", "SUPER_ADMIN", "CEO"].includes(context.role);
    const userBranchIds = (context.branchIds || []).map((id) => id.toString());

    const matchFilter: Record<string, any> = {
      tenantId: tenantOId,
      punchDate: todayStr,
    };

    if (!isMasterAdmin && userBranchIds.length > 0) {
      matchFilter.branchId = { $in: userBranchIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const [totalToday, distinctEmployeesToday, modeBreakdown] = await Promise.all([
      RawLogModel.countDocuments(matchFilter),
      RawLogModel.distinct("employeeID", matchFilter),
      RawLogModel.aggregate([
        { $match: matchFilter },
        { $group: { _id: "$payload.modeofPunch", count: { $sum: 1 } } },
      ]),
    ]);

    return {
      todayDate: todayStr,
      totalPunchesToday: totalToday,
      activeEmployeesPunchedToday: distinctEmployeesToday.length,
      modeBreakdown: modeBreakdown.map((m) => ({
        mode: m._id || "Default",
        count: m.count,
      })),
    };
  }
}
