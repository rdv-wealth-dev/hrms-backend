import mongoose from "mongoose";
import { AttendanceDocument, AttendanceModel } from "./attendance.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class AttendanceRepository {
    // Find today's (or given date's) record for an employee
    async findByEmployeeAndDate (
        context : RequestContext,
        employeeId : string,
        attendanceDate : Date
    ): Promise<AttendanceDocument | null>{
        return AttendanceModel.findOne({
            tenantId : new mongoose.Types.ObjectId(context.tenantId),
            employeeId : new mongoose.Types.ObjectId(employeeId),
            attendanceDate,
            isDeleted : false,
        });
    }

    async create(data: Partial<AttendanceDocument>): Promise<AttendanceDocument> {
        return new AttendanceModel(data).save();
    }

    async save(doc : AttendanceDocument): Promise<AttendanceDocument> {
        return doc.save()
    }

    async findById(context : RequestContext, id : string) : Promise<AttendanceDocument | null> {
        return AttendanceModel.findOne({
            _id:       new mongoose.Types.ObjectId(id),
            tenantId:  new mongoose.Types.ObjectId(context.tenantId),
            isDeleted: false,
        });
    }


    async findHistoryForEmployee(
    context:    RequestContext,
    employeeId: string,
    fromDate:   Date,
    toDate:     Date
  ): Promise<AttendanceDocument[]> {
    return AttendanceModel.find({
      tenantId:       new mongoose.Types.ObjectId(context.tenantId),
      employeeId:     new mongoose.Types.ObjectId(employeeId),
      attendanceDate: { $gte: fromDate, $lte: toDate },
      isDeleted:      false,
    }).sort({ attendanceDate: -1 });
  }

  //Admin report — filtered, paginated
  async findReport(
    context:  RequestContext,
    filters:  Record<string, unknown>,
    page:     number,
    pageSize: number
  ) {
    const query: Record<string, unknown> = {
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
      ...filters,
    };

    if (context.branchIds && context.branchIds.length > 0 && !filters.branchId) {
      query.branchId = {
        $in: context.branchIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const skip = (page - 1) * pageSize;
    const safe = Math.min(pageSize, 100);

    const [data, totalRecords] = await Promise.all([
      AttendanceModel.find(query)
        .sort({ attendanceDate: -1 })
        .skip(skip)
        .limit(safe)
        .populate("employeeId", "employeeCode firstName lastName")
        .lean(),
      AttendanceModel.countDocuments(query),
    ]);

    return { data, totalRecords, pageNumber: page, pageSize: safe };
  }

}