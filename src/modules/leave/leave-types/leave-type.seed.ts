import mongoose from "mongoose";
import { LeaveAccrualFrequency } from "./leave-type.model";

interface LeaveTypeSeed {
  name: string;
  code: string;
  description: string;
  isPaid: boolean;
  annualQuota: number;
  accrualFrequency: LeaveAccrualFrequency;
  maxConsecutiveDays: number;
  advanceNoticeDays: number;
  requiresApproval: boolean;
  approvalLevels: number;
  allowNegativeBalance: boolean;
  probationEligible: boolean;
  applySandwichPolicy: boolean;
  maxCarryForwardDays: number;
}

const DEFAULT_LEAVE_TYPES: LeaveTypeSeed[] = [
  {
    name: "Casual Leave",
    code: "CL",
    description: "Planned short-term time off for personal matters or rest (1–3 days).",
    isPaid: true,
    annualQuota: 12,
    accrualFrequency: LeaveAccrualFrequency.MONTHLY,
    maxConsecutiveDays: 3,
    advanceNoticeDays: 1,
    requiresApproval: true,
    approvalLevels: 1,
    allowNegativeBalance: false,
    probationEligible: false,
    applySandwichPolicy: false,
    maxCarryForwardDays: 0,
  },
  {
    name: "Sick Leave",
    code: "SL",
    description: "Unplanned time off for health issues or illness.",
    isPaid: true,
    annualQuota: 12,
    accrualFrequency: LeaveAccrualFrequency.MONTHLY,
    maxConsecutiveDays: 3,
    advanceNoticeDays: 0,
    requiresApproval: false,
    approvalLevels: 1,
    allowNegativeBalance: false,
    probationEligible: true,
    applySandwichPolicy: false,
    maxCarryForwardDays: 0,
  },
  {
    name: "Annual Leave",
    code: "AL",
    description: "Long planned vacations — accrues monthly and can roll over to the next year.",
    isPaid: true,
    annualQuota: 18,
    accrualFrequency: LeaveAccrualFrequency.MONTHLY,
    maxConsecutiveDays: 15,
    advanceNoticeDays: 7,
    requiresApproval: true,
    approvalLevels: 1,
    allowNegativeBalance: false,
    probationEligible: false,
    applySandwichPolicy: true,
    maxCarryForwardDays: 6,
  },
  {
    name: "Maternity Leave",
    code: "ML",
    description: "Paid leave for biological or adoptive mothers (26 weeks as per Indian law).",
    isPaid: true,
    annualQuota: 182,
    accrualFrequency: LeaveAccrualFrequency.ON_JOINING,
    maxConsecutiveDays: 182,
    advanceNoticeDays: 30,
    requiresApproval: true,
    approvalLevels: 2,
    allowNegativeBalance: false,
    probationEligible: true,
    applySandwichPolicy: false,
    maxCarryForwardDays: 0,
  },
  {
    name: "Paternity Leave",
    code: "PAT",
    description: "Paid leave for new fathers (2 weeks as per Indian law).",
    isPaid: true,
    annualQuota: 14,
    accrualFrequency: LeaveAccrualFrequency.ON_JOINING,
    maxConsecutiveDays: 14,
    advanceNoticeDays: 7,
    requiresApproval: true,
    approvalLevels: 1,
    allowNegativeBalance: false,
    probationEligible: true,
    applySandwichPolicy: false,
    maxCarryForwardDays: 0,
  },
  {
    name: "Bereavement Leave",
    code: "BL",
    description: "Paid leave granted upon the death of an immediate family member.",
    isPaid: true,
    annualQuota: 5,
    accrualFrequency: LeaveAccrualFrequency.NONE,
    maxConsecutiveDays: 5,
    advanceNoticeDays: 0,
    requiresApproval: true,
    approvalLevels: 1,
    allowNegativeBalance: false,
    probationEligible: true,
    applySandwichPolicy: false,
    maxCarryForwardDays: 0,
  },
  {
    name: "Compensatory Off",
    code: "COMP_OFF",
    description: "Credit granted for working on a weekend, holiday, or extra hours.",
    isPaid: true,
    annualQuota: 0,
    accrualFrequency: LeaveAccrualFrequency.MANUAL,
    maxConsecutiveDays: 0,
    advanceNoticeDays: 0,
    requiresApproval: false,
    approvalLevels: 1,
    allowNegativeBalance: false,
    probationEligible: true,
    applySandwichPolicy: false,
    maxCarryForwardDays: 90,
  },
  {
    name: "Marriage Leave",
    code: "MAR",
    description: "Special paid leave granted once during employment for the employee's own marriage.",
    isPaid: true,
    annualQuota: 5,
    accrualFrequency: LeaveAccrualFrequency.ON_JOINING,
    maxConsecutiveDays: 5,
    advanceNoticeDays: 7,
    requiresApproval: true,
    approvalLevels: 1,
    allowNegativeBalance: false,
    probationEligible: false,
    applySandwichPolicy: false,
    maxCarryForwardDays: 0,
  },
  {
    name: "Loss of Pay",
    code: "LOP",
    description: "Unpaid leave taken when all paid leave balances are exhausted.",
    isPaid: false,
    annualQuota: 0,
    accrualFrequency: LeaveAccrualFrequency.NONE,
    maxConsecutiveDays: 60,
    advanceNoticeDays: 0,
    requiresApproval: true,
    approvalLevels: 2,
    allowNegativeBalance: true,
    probationEligible: true,
    applySandwichPolicy: false,
    maxCarryForwardDays: 0,
  },
];

export async function seedLeaveTypes(
  tenantId: string,
  branchId: string
): Promise<Map<string, string>> {
  const typeMap = new Map<string, string>();
  const tenantOId = new mongoose.Types.ObjectId(tenantId);
  const branchOId = new mongoose.Types.ObjectId(branchId);
  const now = new Date();

  const collection = mongoose.connection.collection("leave_types");

  for (const lt of DEFAULT_LEAVE_TYPES) {
    const cycles = getCyclesPerYear(lt.accrualFrequency);
    const accrualAmountPerCycle = cycles > 0
      ? Number((lt.annualQuota / cycles).toFixed(4))
      : 0;

    const doc = {
      tenantId: tenantOId,
      branchId: branchOId,
      name: lt.name,
      code: lt.code,
      description: lt.description,
      isPaid: lt.isPaid,
      annualQuota: lt.annualQuota,
      branchOverrides: [],
      accrualFrequency: lt.accrualFrequency,
      accrualAmountPerCycle,
      maxCarryForwardDays: lt.maxCarryForwardDays,
      maxConsecutiveDays: lt.maxConsecutiveDays,
      advanceNoticeDays: lt.advanceNoticeDays,
      minAdvanceNoticeDays: 0,
      requiresApproval: lt.requiresApproval,
      approvalLevels: lt.approvalLevels,
      allowNegativeBalance: lt.allowNegativeBalance,
      probationEligible: lt.probationEligible,
      applySandwichPolicy: lt.applySandwichPolicy,
      isActive: true,
      effectiveFrom: now,
      effectiveTo: null,
      supersedes: null,
      isDeleted: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await collection.insertOne(doc);
      typeMap.set(lt.code, result.insertedId.toString());
    } catch (err: any) {
      if (err.code === 11000) {
        const existing = await collection.findOne({ tenantId: tenantOId, code: lt.code });
        if (existing) {
          typeMap.set(lt.code, existing._id.toString());
        }
      }
    }
  }

  return typeMap;
}

function getCyclesPerYear(frequency: LeaveAccrualFrequency): number {
  switch (frequency) {
    case LeaveAccrualFrequency.DAILY: return 365;
    case LeaveAccrualFrequency.WEEKLY: return 52;
    case LeaveAccrualFrequency.BI_WEEKLY: return 26;
    case LeaveAccrualFrequency.SEMI_MONTHLY: return 24;
    case LeaveAccrualFrequency.MONTHLY: return 12;
    case LeaveAccrualFrequency.QUARTERLY: return 4;
    case LeaveAccrualFrequency.HALF_YEARLY: return 2;
    case LeaveAccrualFrequency.YEARLY:
    case LeaveAccrualFrequency.ON_JOINING:
    case LeaveAccrualFrequency.MANUAL:
    case LeaveAccrualFrequency.NONE:
    default: return 0;
  }
}
