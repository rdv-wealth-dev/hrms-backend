import { z } from "zod";
import { objectIdSchema } from "../../core/validators/common.validator";

export const AssignShiftDto = z.object({
    employeeIds: z.array(objectIdSchema).min(1, "Select at least one employee"),
    shiftId: objectIdSchema,
});

export type AssignShiftInput = z.infer<typeof AssignShiftDto>;

export const AssignWeeklyOffDto = z.object({
    employeeIds: z.array(objectIdSchema).min(1),
    weeklyOffDays: z.array(z.string()).min(1),          // e.g. ["Saturday", "Sunday"]
})

export type AssignWeeklyOffInput = z.infer<typeof AssignWeeklyOffDto>;