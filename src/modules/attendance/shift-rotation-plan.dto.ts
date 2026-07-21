import { z } from "zod";
import { objectIdSchema, safeStringSchema } from "../../core/validators";
import { CycleDuration, DAY_NAMES } from "./shift-rotation-plan.model";

// ─── ROTATION SLOT 

const RotationSlotDto = z.object({
  order:   z.number().int().min(1).max(12),
  shiftId: objectIdSchema,
  offDays: z
    .array(z.enum([...DAY_NAMES] as [string, ...string[]]))
    .min(0)
    .max(3)
    .default([]),
});

// ─── BASE OBJECT (no refine, so .partial() works for updates)

const RotationPlanBase = z.object({
  name:          safeStringSchema(2, 200),
  description:   safeStringSchema(0, 500).optional(),
  cycleDuration: z.nativeEnum(CycleDuration).default(CycleDuration.WEEKLY),
  slots:         z.array(RotationSlotDto).min(2, "Plan must have at least 2 slots").max(12),
});

// ─── CREATE PLAN

export const CreateShiftRotationPlanDto = RotationPlanBase.refine(
  (data) => {
    const orders = data.slots.map((s) => s.order);
    return new Set(orders).size === orders.length;
  },
  { message: "Slot orders must be unique" }
);

export type CreateShiftRotationPlanInput = z.infer<typeof CreateShiftRotationPlanDto>;

// ─── UPDATE PLAN (.partial on base, no refine conflict)

export const UpdateShiftRotationPlanDto = RotationPlanBase.partial();
export type UpdateShiftRotationPlanInput = z.infer<typeof UpdateShiftRotationPlanDto>;

// ─── ASSIGN PLAN TO EMPLOYEES 

export const AssignRotationPlanDto = z.object({
  rotationPlanId:    objectIdSchema.nullable(),          // null = remove plan
  rotationStartDate: z.string().datetime().optional(),   // when slot-1 began; defaults to today
  employeeIds:       z.array(objectIdSchema).min(1, "At least one employee required"),
});

export type AssignRotationPlanInput = z.infer<typeof AssignRotationPlanDto>;
