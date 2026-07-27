import mongoose from "mongoose";

interface ShiftSeed {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  graceLimitPerMonth: number;
  halfDayThresholdMinutes: number;
  fullDayMinutes: number;
  breakDurationMinutes: number;
  isDefault: boolean;
}

const DEFAULT_SHIFTS: ShiftSeed[] = [
  {
    name: "General Shift",
    code: "GEN",
    startTime: "09:00",
    endTime: "18:00",
    gracePeriodMinutes: 15,
    graceLimitPerMonth: 3,
    halfDayThresholdMinutes: 240,
    fullDayMinutes: 480,
    breakDurationMinutes: 60,
    isDefault: true,
  },
  {
    name: "Flexible Shift",
    code: "FLEX",
    startTime: "11:00",
    endTime: "20:00",
    gracePeriodMinutes: 15,
    graceLimitPerMonth: 5,
    halfDayThresholdMinutes: 240,
    fullDayMinutes: 480,
    breakDurationMinutes: 60,
    isDefault: false,
  },
  {
    name: "Morning Shift",
    code: "EARLY",
    startTime: "06:00",
    endTime: "15:00",
    gracePeriodMinutes: 10,
    graceLimitPerMonth: 3,
    halfDayThresholdMinutes: 240,
    fullDayMinutes: 480,
    breakDurationMinutes: 30,
    isDefault: false,
  },
  {
    name: "Afternoon Shift",
    code: "LATE",
    startTime: "14:00",
    endTime: "23:00",
    gracePeriodMinutes: 10,
    graceLimitPerMonth: 3,
    halfDayThresholdMinutes: 240,
    fullDayMinutes: 480,
    breakDurationMinutes: 45,
    isDefault: false,
  },
  {
    name: "Night Shift",
    code: "NIGHT",
    startTime: "22:00",
    endTime: "07:00",
    gracePeriodMinutes: 10,
    graceLimitPerMonth: 3,
    halfDayThresholdMinutes: 240,
    fullDayMinutes: 480,
    breakDurationMinutes: 60,
    isDefault: false,
  },
];

export async function seedShifts(
  tenantId: string,
  branchId: string
): Promise<Map<string, string>> {
  const shiftMap = new Map<string, string>();
  const tenantOId = new mongoose.Types.ObjectId(tenantId);
  const branchOId = new mongoose.Types.ObjectId(branchId);
  const now = new Date();

  const collection = mongoose.connection.collection("shifts");

  for (const shift of DEFAULT_SHIFTS) {
    const doc = {
      tenantId: tenantOId,
      branchId: branchOId,
      name: shift.name,
      code: shift.code,
      startTime: shift.startTime,
      endTime: shift.endTime,
      gracePeriodMinutes: shift.gracePeriodMinutes,
      graceLimitPerMonth: shift.graceLimitPerMonth,
      halfDayThresholdMinutes: shift.halfDayThresholdMinutes,
      fullDayMinutes: shift.fullDayMinutes,
      breakDurationMinutes: shift.breakDurationMinutes,
      isDefault: shift.isDefault,
      isActive: true,
      isDeleted: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await collection.insertOne(doc);
      shiftMap.set(shift.code, result.insertedId.toString());
    } catch (err: any) {
      if (err.code === 11000) {
        const existing = await collection.findOne({ tenantId: tenantOId, code: shift.code });
        if (existing) {
          shiftMap.set(shift.code, existing._id.toString());
        }
      }
    }
  }

  return shiftMap;
}
