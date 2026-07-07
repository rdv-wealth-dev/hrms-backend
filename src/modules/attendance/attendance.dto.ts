import { z } from "zod";
import { objectIdSchema, safeStringSchema, dateSchema } from "../../core/validators";

// ─── PUNCH ────────────────────────────────────────────────────────────────────

export const PunchDto = z.object({
    type: z.enum(["CHECK_IN", "BREAK_OUT", "BREAK_IN", "CHECK_OUT"]),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
});
export type PunchInput = z.infer<typeof PunchDto>;

// ─── MANUAL ATTENDANCE ────────────────────────────────────────────────────────

export const ManualAttendanceDto = z.object({
    employeeId     : objectIdSchema,
    attendanceDate : dateSchema,
    checkIn        : z.string().datetime().optional(),
    checkOut       : z.string().datetime().optional(),
    status         : z.enum(["PRESENT","LATE","HALF_DAY","ABSENT","ON_LEAVE","HOLIDAY","WEEK_OFF"]).optional(),
    notes          : safeStringSchema(0,500).optional(),
})
export type ManualAttendanceInput = z.infer<typeof ManualAttendanceDto>;

// ─── REGULARIZATION ───────────────────────────────────────────────────────────

export const CreateRegularizationDto = z.object({
    attendanceId      : objectIdSchema,
    requestedCheckIn  : z.string().datetime().optional(),
    requestedCheckOut : z.string().datetime().optional(),
    reason            : safeStringSchema(10, 500),
}).refine(
    (data) => data.requestedCheckIn || data.requestedCheckOut,
    { message : "At least one of requestedCheckIn or requestedCheckOut is required"}
);
export type CreateRegularizationInput = z.infer<typeof CreateRegularizationDto>;

export const ReviewRegularizationDto  = z.object({
    status         : z.enum(["APPROVED", "REJECTED"]),
    reviewComments : safeStringSchema(0, 500).optional()
});
export type ReviewRegularizationInput = z.infer<typeof ReviewRegularizationDto>;

// ─── SHIFT ────────────────────────────────────────────────────────────────────

export const CreateShiftDto = z.object({
    name                    : safeStringSchema(2, 100),
    code                    : z.string().trim().toUpperCase().min(2).max(20),
    startTime               : z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM 24h format"),
    endTime                 : z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM 24h format"),
    gracePeriodMinutes      : z.number().min(0).max(120).optional().default(15),
    graceLimitPerMonth      : z.number().min(0).optional().default(0),
    halfDayThresholdMinutes : z.number().min(0).optional().default(240),
    fullDayMinutes          : z.number().min(0).optional().default(480),
    breakDurationMinutes    : z.number().min(0).optional().default(60),
    isDefault               : z.boolean().optional().default(false),
});
export type CreateShiftInput = z.infer<typeof CreateShiftDto>;
export const UpdateShiftDto = CreateShiftDto.partial();
export type UpdateShiftInput = z.infer<typeof UpdateShiftDto>;

// ─── ATTENDANCE REPORT QUERY ──────────────────────────────────────────────────

export const AttendanceReportQueryDto = z.object({
  fromDate    : dateSchema,
  toDate      : dateSchema,
  employeeId  : objectIdSchema.optional(),
  branchId    : objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  status      : z.enum(["PRESENT","LATE","HALF_DAY","ABSENT","ON_LEAVE","HOLIDAY","WEEK_OFF"]).optional(),
  pageNumber  : z.string().optional().transform(v => v ? parseInt(v) : 1),
  pageSize    : z.string().optional().transform(v => v ? parseInt(v) : 20),
});
export type AttendanceReportQuery = z.infer<typeof AttendanceReportQueryDto>;