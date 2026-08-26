import mongoose from "mongoose";
import { OrganizationModel } from "../../organization/organization.model";
import { EmployeeModel } from "../models/employee.model";

// COUNTER SCHEMA
// Atomic per-tenant sequence counter using MongoDB findOneAndUpdate + $inc.
// This is the only correct way to generate sequential IDs in MongoDB —
// never count existing documents and add 1 (breaks under concurrency).

const CounterSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sequenceName: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: "counters" }
);

CounterSchema.index(
  { tenantId: 1, sequenceName: 1 },
  { unique: true }
);

export const CounterModel = mongoose.model("Counter", CounterSchema);

/**
 * Extracts the highest numeric suffix from existing employee codes matching a prefix.
 * e.g. If DB contains "RVG011", "RVG009", "RVG10", returns 11.
 */
async function findMaxExistingSequenceForPrefix(
  tenantId: string,
  prefix: string
): Promise<number> {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escapedPrefix}[-_]?0*(\\d+)$`, "i");

  const employees = await EmployeeModel.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    employeeCode: { $regex: new RegExp(`^${escapedPrefix}`, "i") },
  })
    .select("employeeCode")
    .lean();

  let maxSeq = 0;
  for (const emp of employees) {
    if (!emp.employeeCode) continue;
    const match = emp.employeeCode.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  return maxSeq;
}

/**
 * Returns the next employee code for a tenant atomically.
 * Format examples:
 * - New org with PUG (2 digits, no separator) -> PUG01, PUG02, ...
 * - Existing org with RVG (up to RVG011) -> RVG012, RVG013, ...
 * - Default EMP (4 digits, separator "-") -> EMP-0001, EMP-0002, ...
 */
export async function getNextEmployeeCode(
  tenantId: string,
  overridePrefix?: string
): Promise<string> {
  const org = await OrganizationModel.findById(tenantId).select("employeeCodeConfig").lean();

  const prefix = (overridePrefix || org?.employeeCodeConfig?.prefix || "EMP").trim().toUpperCase();
  const digits = org?.employeeCodeConfig?.digits ?? (prefix === "EMP" ? 4 : 2);
  const separator = org?.employeeCodeConfig?.separator ?? (prefix === "EMP" ? "-" : "");
  const startSeqNumber = org?.employeeCodeConfig?.startSequenceNumber ?? 1;

  const sequenceKey = `empCode_${prefix}`;

  // Check if counter document already exists for this tenant & prefix
  let existingCounter = await CounterModel.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    sequenceName: sequenceKey,
  });

  if (!existingCounter) {
    // Detect existing employees in database matching this prefix
    const maxExisting = await findMaxExistingSequenceForPrefix(tenantId, prefix);
    const initialSeq = Math.max(maxExisting, startSeqNumber - 1);

    await CounterModel.updateOne(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        sequenceName: sequenceKey,
      },
      { $setOnInsert: { seq: initialSeq } },
      { upsert: true }
    );
  }

  // Atomically increment counter
  let attempts = 0;
  while (attempts < 10) {
    attempts++;
    const counter = await CounterModel.findOneAndUpdate(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        sequenceName: sequenceKey,
      },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
      }
    );

    const seq = counter!.seq;
    const padded = seq.toString().padStart(digits, "0");
    const candidateCode = `${prefix}${separator}${padded}`;

    // Ensure uniqueness in EmployeeModel
    const codeExists = await EmployeeModel.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      employeeCode: candidateCode,
    })
      .select("_id")
      .lean();

    if (!codeExists) {
      return candidateCode;
    }
  }

  // Fallback if loop exceeded
  const fallbackSeq = Date.now().toString().slice(-4);
  return `${prefix}${separator}${fallbackSeq}`;
}