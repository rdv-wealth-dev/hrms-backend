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
        .populate({
          path: "employeeId",
          select: "employeeCode firstName lastName email departmentId",
          populate: {
            path: "departmentId",
            select: "name code"
          }
        })
        .lean(),
      AttendanceModel.countDocuments(query),
    ]);

    // Filter out attendance records with invalid/deleted employees and format response
    const formattedData = data
      .filter((record: any) => record.employeeId) // Remove records with null/invalid employeeId
      .map((record: any) => ({
        ...record,
        employee: record.employeeId ? {
          id: record.employeeId._id,
          employeeCode: record.employeeId.employeeCode,
          firstName: record.employeeId.firstName,
          lastName: record.employeeId.lastName,
          email: record.employeeId.email,
          fullName: `${record.employeeId.firstName} ${record.employeeId.lastName}`,
          department: record.employeeId.departmentId
        } : null
      }));

    return { 
      data: formattedData, 
      totalRecords, 
      pageNumber: page, 
      pageSize: safe 
    };
  }

  // Utility method to find attendance records with invalid employee references
  async findOrphanedAttendanceRecords(context: RequestContext) {
    // First, find all attendance records
    const allAttendance = await AttendanceModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    }).select('employeeId attendanceDate').lean();

    // Get all valid employee IDs
    const EmployeeModel = mongoose.model('Employee');
    const validEmployeeIds = await EmployeeModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    }).select('_id').lean();

    const validIdSet = new Set(validEmployeeIds.map((emp: any) => emp._id.toString()));

    // Find orphaned records
    const orphanedRecords = allAttendance.filter((att: any) => 
      !att.employeeId || !validIdSet.has(att.employeeId.toString())
    );

    return {
      totalAttendanceRecords: allAttendance.length,
      validRecords: allAttendance.length - orphanedRecords.length,
      orphanedRecords: orphanedRecords.length,
      orphanedData: orphanedRecords
    };
  }

  // Method to delete orphaned attendance records
  async deleteOrphanedAttendanceRecords(context: RequestContext) {
    const orphanedData = await this.findOrphanedAttendanceRecords(context);
    
    if (orphanedData.orphanedRecords > 0) {
      const orphanedIds = orphanedData.orphanedData.map((record: any) => record._id);
      
      const result = await AttendanceModel.updateMany(
        { _id: { $in: orphanedIds } },
        { isDeleted: true, deletedAt: new Date() }
      );

      return {
        message: `Marked ${result.modifiedCount} orphaned attendance records as deleted`,
        deletedCount: result.modifiedCount,
        orphanedData: orphanedData
      };
    }

    return {
      message: 'No orphaned attendance records found',
      deletedCount: 0,
      orphanedData: orphanedData
    };
  }

}