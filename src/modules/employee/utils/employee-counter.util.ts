import mongoose from "mongoose";
import { OrganizationModel } from "../../organization/organization.model";
import { EmployeeModel } from "../models/employee.model";
import { UserModel } from "../../user/user.model";

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
export async function findMaxExistingSequenceForPrefix(
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
 * Synchronizes the sequence counter for one or more prefixes with the highest
 * existing employee code numbers in the database.
 * Call this after bulk imports or when preserved employee codes are saved.
 */
export async function syncEmployeeCodeCounter(
  tenantId: string,
  prefixesOrCodes?: string | string[]
): Promise<void> {
  const org = await OrganizationModel.findById(tenantId).select("employeeCodeConfig").lean();
  const defaultPrefix = (org?.employeeCodeConfig?.prefix || "EMP").trim().toUpperCase();

  const prefixesToSync = new Set<string>([defaultPrefix]);

  if (prefixesOrCodes) {
    const list = Array.isArray(prefixesOrCodes) ? prefixesOrCodes : [prefixesOrCodes];
    for (const item of list) {
      if (!item) continue;
      const trimmed = String(item).trim().toUpperCase();
      // Extract alphabetic prefix (e.g. "RVG-EX" from "RVG-EX-001", "RVG" from "RVG001", "EMP" from "EMP-102")
      const match = trimmed.match(/^([A-Z]+(?:-[A-Z]+)*)[-_]?0*(\d+)$/i);
      if (match && match[1]) {
        prefixesToSync.add(match[1].toUpperCase());
      } else if (/^[A-Z]+(?:-[A-Z]+)*$/i.test(trimmed)) {
        prefixesToSync.add(trimmed);
      }
    }
  }

  for (const prefix of prefixesToSync) {
    const maxExisting = await findMaxExistingSequenceForPrefix(tenantId, prefix);
    if (maxExisting > 0) {
      const sequenceKey = `empCode_${prefix}`;
      await CounterModel.findOneAndUpdate(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          sequenceName: sequenceKey,
        },
        { $max: { seq: maxExisting } },
        { upsert: true }
      );
    }
  }
}

/**
 * Returns a batch of sequential unique employee codes for a tenant.
 * Atomically increments the sequence counter by `count` in a single DB operation.
 */
export async function getNextBatchEmployeeCodes(
  tenantId: string,
  count: number,
  overridePrefix?: string
): Promise<string[]> {
  if (count <= 0) return [];

  const org = await OrganizationModel.findById(tenantId).select("employeeCodeConfig").lean();

  const basePrefix = (org?.employeeCodeConfig?.prefix || "EMP").trim().replace(/[-_]+$/, "").toUpperCase();
  const prefix = (overridePrefix || basePrefix).trim().replace(/[-_]+$/, "").toUpperCase();
  const isExPrefix = prefix.endsWith("-EX") || prefix === "EX";
  const digits = isExPrefix ? 3 : (org?.employeeCodeConfig?.digits ?? (prefix === "EMP" ? 4 : 2));
  const separator = isExPrefix ? "-" : (org?.employeeCodeConfig?.separator ?? (prefix === "EMP" ? "-" : ""));
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
  } else {
    // Sync to max existing in DB if higher than counter
    const maxExisting = await findMaxExistingSequenceForPrefix(tenantId, prefix);
    if (maxExisting > existingCounter.seq) {
      await CounterModel.updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          sequenceName: sequenceKey,
        },
        { $max: { seq: maxExisting } }
      );
    }
  }

  // Atomically increment counter by count in a single update
  const counter = await CounterModel.findOneAndUpdate(
    {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      sequenceName: sequenceKey,
    },
    { $inc: { seq: count } },
    {
      new: true,
      upsert: true,
    }
  );

  const endSeq = counter?.seq ?? count;
  const startSeq = Math.max(1, endSeq - count + 1);

  const codes: string[] = [];
  for (let s = startSeq; s <= endSeq; s++) {
    const padded = s.toString().padStart(digits, "0");
    codes.push(`${prefix}${separator}${padded}`);
  }

  return codes;
}

/**
 * Returns the next employee code for a tenant atomically.
 * Format examples:
 * - New org with PUG (2 digits, no separator) -> PUG01, PUG02, ...
 * - Existing org with RVG (up to RVG011) -> RVG012, RVG013, ...
 * - Default EMP (4 digits, separator "-") -> EMP-0001, EMP-0002, ...
 * - Inactive archive code (e.g. RVG-EX) -> RVG-EX-001, RVG-EX-002, ...
 */
export async function getNextEmployeeCode(
  tenantId: string,
  overridePrefix?: string
): Promise<string> {
  const codes = await getNextBatchEmployeeCodes(tenantId, 1, overridePrefix);
  return codes[0];
}

/**
 * Re-sequences employee codes for existing employees according to the organization's
 * configured employeeCodeConfig (or provided override).
 * Order of sequence:
 * 1. Org Admin employee receives the first code (startSequenceNumber, e.g. 1)
 * 2. First added employee receives the next counter (startSequenceNumber + 1, e.g. 2)
 * 3. Second added employee receives next counter (startSequenceNumber + 2, e.g. 3)
 * ...and so on in series.
 *
 * Updates CounterModel atomically so future employees continue smoothly from the next number.
 * Uses a two-phase update to prevent MongoDB unique index collisions.
 */
export async function resequenceExistingEmployeeCodes(
  tenantId: string,
  customConfig?: {
    prefix?: string;
    digits?: number;
    separator?: string;
    startSequenceNumber?: number;
  }
): Promise<{
  updatedCount: number;
  prefix: string;
  employees: Array<{ id: string; name: string; oldCode: string; newCode: string }>;
}> {
  const tenantOId = new mongoose.Types.ObjectId(tenantId);
  const org = await OrganizationModel.findById(tenantId).select("employeeCodeConfig").lean();

  const basePrefix = (customConfig?.prefix || org?.employeeCodeConfig?.prefix || "EMP")
    .trim()
    .replace(/[-_]+$/, "")
    .toUpperCase();
  const prefix = basePrefix;
  const digits = customConfig?.digits ?? org?.employeeCodeConfig?.digits ?? (prefix === "EMP" ? 4 : 2);
  const separator = customConfig?.separator ?? org?.employeeCodeConfig?.separator ?? (prefix === "EMP" ? "-" : "");
  const startSequenceNumber = customConfig?.startSequenceNumber ?? org?.employeeCodeConfig?.startSequenceNumber ?? 1;

  // 1. Identify Org Admin user(s) for this tenant
  const adminUsers = await UserModel.find({
    tenantId: tenantOId,
    $or: [{ isOrgAdmin: true }, { role: "ORG_ADMIN" }, { role: "SUPER_ADMIN" }],
    isDeleted: false,
  }).sort({ createdAt: 1 });

  const adminEmpIdSet = new Set<string>();
  const adminEmailSet = new Set<string>();

  for (const u of adminUsers) {
    if (u.employeeId) adminEmpIdSet.add(u.employeeId.toString());
    if (u.email) adminEmailSet.add(u.email.toLowerCase().trim());
  }

  // 2. Fetch all non-deleted employees for this tenant
  let allEmployees = await EmployeeModel.find({
    tenantId: tenantOId,
    isDeleted: false,
  }).sort({ createdAt: 1 });

  // Identify the Org Admin employee (linked via adminUser.employeeId or adminUser.email)
  let orgAdminEmployee = allEmployees.find(
    (e) => adminEmpIdSet.has(e._id.toString()) || adminEmailSet.has(e.email?.toLowerCase().trim())
  );

  if (!allEmployees.length) {
    return { updatedCount: 0, prefix, employees: [] };
  }

  // 3. Separate Org Admin employee and other employees
  // If orgAdminEmployee was found, put it 1st; otherwise fallback to earliest created employee as #1
  const targetOrgAdmin = orgAdminEmployee || allEmployees[0];
  const otherEmployees = allEmployees.filter(
    (e) => e._id.toString() !== targetOrgAdmin._id.toString()
  );

  // Other employees are sorted strictly by createdAt (the order they were added)
  otherEmployees.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const orderedEmployees = [targetOrgAdmin, ...otherEmployees];

  // 4. Phase 1: Set temporary codes to avoid unique index collisions
  for (const emp of orderedEmployees) {
    await EmployeeModel.updateOne(
      { _id: emp._id },
      { $set: { employeeCode: `__TMP_${emp._id.toString()}_${Date.now()}` } }
    );
  }

  // 5. Phase 2: Assign clean sequential codes according to configured format
  const updatedList: Array<{ id: string; name: string; oldCode: string; newCode: string }> = [];

  for (let i = 0; i < orderedEmployees.length; i++) {
    const emp = orderedEmployees[i];
    const seq = startSequenceNumber + i;
    const padded = seq.toString().padStart(digits, "0");
    const newCode = `${prefix}${separator}${padded}`;

    await EmployeeModel.updateOne(
      { _id: emp._id },
      { $set: { employeeCode: newCode } }
    );

    updatedList.push({
      id: emp._id.toString(),
      name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
      oldCode: emp.employeeCode,
      newCode,
    });
  }

  // 6. Reset CounterModel sequence to the highest sequence assigned
  const maxSeq = startSequenceNumber + orderedEmployees.length - 1;
  const sequenceKey = `empCode_${prefix}`;

  await CounterModel.findOneAndUpdate(
    {
      tenantId: tenantOId,
      sequenceName: sequenceKey,
    },
    { $set: { seq: Math.max(maxSeq, startSequenceNumber - 1) } },
    { upsert: true }
  );

  return {
    updatedCount: updatedList.length,
    prefix,
    employees: updatedList,
  };
}