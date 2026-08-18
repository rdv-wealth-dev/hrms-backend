import mongoose from "mongoose";
import { AttendanceDocument, AttendanceModel } from "../models/attendance.model";
import { RequestContext } from "../../../shared/types/request-context.interface";

export class AttendanceRepository {
  // Find today's (or given date's) record for an employee
  async findByEmployeeAndDate(
    context: RequestContext,
    employeeId: string,
    attendanceDate: Date
  ): Promise<AttendanceDocument | null> {
    return AttendanceModel.findOne({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      attendanceDate,
      isDeleted: false,
    });
  }

  async create(data: Partial<AttendanceDocument>): Promise<AttendanceDocument> {
    return new AttendanceModel(data).save();
  }

  async save(doc: AttendanceDocument): Promise<AttendanceDocument> {
    return doc.save()
  }

  async findById(context: RequestContext, id: string): Promise<AttendanceDocument | null> {
    return AttendanceModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });
  }


  async findHistoryForEmployee(
    context: RequestContext,
    employeeId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<AttendanceDocument[]> {
    return AttendanceModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      attendanceDate: { $gte: fromDate, $lte: toDate },
      isDeleted: false,
    })
      .sort({ attendanceDate: -1 })
      .populate("shiftId", "name code startTime endTime");
  }

  //Admin report — filtered, paginated
  async findReport(
    context: RequestContext,
    query: any
  ) {
    const tenantIdObj = new mongoose.Types.ObjectId(context.tenantId);

    // 1. Initial Match Stage (Matches tenantId, date range, status, and direct employeeId)
    const matchStage: any = {
      tenantId: tenantIdObj,
      isDeleted: false,
      attendanceDate: {
        $gte: new Date(query.fromDate),
        $lte: new Date(query.toDate),
      }
    };

    if (query.status) {
      matchStage.status = query.status;
    }

    if (query.employeeId) {
      matchStage.employeeId = new mongoose.Types.ObjectId(query.employeeId);
    }

    const pipeline: any[] = [
      { $match: matchStage }
    ];

    // 2. Lookup employee detail
    pipeline.push(
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "_id",
          as: "employeeDetail"
        }
      },
      { $unwind: "$employeeDetail" }
    );

    // 3. Lookup department details for the employee
    pipeline.push(
      {
        $lookup: {
          from: "departments",
          localField: "employeeDetail.departmentId",
          foreignField: "_id",
          as: "departmentDetail"
        }
      },
      {
        $unwind: {
          path: "$departmentDetail",
          preserveNullAndEmptyArrays: true
        }
      }
    );

    // 3b. Lookup shift details
    pipeline.push(
      {
        $lookup: {
          from: "shifts",
          localField: "shiftId",
          foreignField: "_id",
          as: "shiftDetail"
        }
      },
      {
        $unwind: {
          path: "$shiftDetail",
          preserveNullAndEmptyArrays: true
        }
      }
    );

    // 4. Match filters on the lookup details (branchId, departmentId, designationId, search)
    const filterMatch: any = {};

    if (query.branchId) {
      const branchIdObj = new mongoose.Types.ObjectId(query.branchId);
      filterMatch.$or = [
        { branchId: branchIdObj },
        { "employeeDetail.branchId": branchIdObj }
      ];
    } else if (context.branchIds && context.branchIds.length > 0) {
      const allowedIds = context.branchIds.map((id) => new mongoose.Types.ObjectId(id));
      filterMatch.$or = [
        { branchId: { $in: allowedIds } },
        { "employeeDetail.branchId": { $in: allowedIds } }
      ];
    }

    if (query.departmentId) {
      filterMatch["employeeDetail.departmentId"] = new mongoose.Types.ObjectId(query.departmentId);
    }

    if (query.designationId) {
      filterMatch["employeeDetail.designationId"] = new mongoose.Types.ObjectId(query.designationId);
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, "i");
      filterMatch.$or = [
        { "employeeDetail.firstName": searchRegex },
        { "employeeDetail.lastName": searchRegex },
        { "employeeDetail.employeeCode": searchRegex },
        { "employeeDetail.email": searchRegex }
      ];
    }

    if (Object.keys(filterMatch).length > 0) {
      pipeline.push({ $match: filterMatch });
    }

    // 5. Sort
    pipeline.push({ $sort: { attendanceDate: -1 } });

    // 6. Facet for pagination
    const page = query.pageNumber ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: pageSize }
        ]
      }
    });

    const result = await AttendanceModel.aggregate(pipeline);
    const totalRecords = result[0]?.metadata[0]?.total ?? 0;
    const data = result[0]?.data ?? [];

    // Format response data to match exactly original controller mapping structure
    const formattedData = data.map((record: any) => {
      const emp = record.employeeDetail;
      const dept = record.departmentDetail;

      const fullName = `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim();
      const populatedDept = dept ? { _id: dept._id, name: dept.name, code: dept.code } : null;

      const employeeIdObj = {
        _id: emp._id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        avatarUrl: emp.avatarUrl,
        departmentId: populatedDept
      };

      const shift = record.shiftDetail;
      const populatedShift = shift ? { _id: shift._id, name: shift.name, code: shift.code, startTime: shift.startTime, endTime: shift.endTime } : null;

      return {
        ...record,
        shiftId: populatedShift,
        employeeId: employeeIdObj,
        employee: {
          id: emp._id,
          employeeCode: emp.employeeCode,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          fullName,
          avatarUrl: emp.avatarUrl,
          department: populatedDept,
        },
      };
    });

    return {
      data: formattedData,
      totalRecords,
      pageNumber: page,
      pageSize,
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