import mongoose from "mongoose";
import { AttendanceModel } from "./attendance.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

// Answers "how many days did this employee work this month" — the single
// most common HR question, currently unanswerable from raw record lists.
export class AttendanceSummaryService {

  async getMonthlySummary(
    context:    RequestContext,
    employeeId: string,
    year:       number,
    month:      number   // 1-12
  ) {
    const fromDate = new Date(year, month - 1, 1);
    const toDate   = new Date(year, month, 0, 23, 59, 59);

    const records = await AttendanceModel.find({
      tenantId:       new mongoose.Types.ObjectId(context.tenantId),
      employeeId:     new mongoose.Types.ObjectId(employeeId),
      attendanceDate: { $gte: fromDate, $lte: toDate },
      isDeleted:      false,
    });

    const summary = {
      totalDays:      records.length,
      present:        0,
      late:           0,
      halfDay:        0,
      absent:         0,
      onLeave:        0,
      holiday:        0,
      weekOff:        0,
      totalWorkedMinutes: 0,
      regularizedDays: 0,
    };

    for (const r of records) {
      summary.totalWorkedMinutes += r.workedMinutes;
      if (r.isRegularized) summary.regularizedDays++;

      switch (r.status) {
        case "PRESENT":  summary.present++; break;
        case "LATE":     summary.late++; break;
        case "HALF_DAY": summary.halfDay++; break;
        case "ABSENT":   summary.absent++; break;
        case "ON_LEAVE": summary.onLeave++; break;
        case "HOLIDAY":  summary.holiday++; break;
        case "WEEK_OFF": summary.weekOff++; break;
      }
    }

    return {
      ...summary,
      totalWorkedHours: Math.round((summary.totalWorkedMinutes / 60) * 10) / 10,
      attendancePercentage: summary.totalDays > 0
        ? Math.round(((summary.present + summary.late + summary.halfDay * 0.5) / (summary.totalDays - summary.weekOff - summary.holiday)) * 1000) / 10
        : 0,
    };
  }
}