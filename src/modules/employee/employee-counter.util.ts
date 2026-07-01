import mongoose from "mongoose";

// COUNTER SCHEMA
// Atomic per-tenant sequence counter using MongoDB findOneAndUpdate + $inc.
// This is the only correct way to generate sequential IDs in MongoDB —
// never count existing documents and add 1 (breaks under concurrency).

const CounterSchema = new mongoose.Schema(
  {
    tenantId:     { type: mongoose.Schema.Types.ObjectId, required: true },
    sequenceName: { type: String, required: true },
    seq:          { type: Number, default: 0 },
  },
  { collection: "counters" }
);

CounterSchema.index(
  { tenantId: 1, sequenceName: 1 },
  { unique: true }
);

const CounterModel = mongoose.model("Counter", CounterSchema);

// getNextEmployeeCode
// Returns the next employee code for a tenant atomically.
// Format: EMP-0001, EMP-0002, ... EMP-9999, EMP-10000
// Prefix is configurable per tenant in future.

export async function getNextEmployeeCode(
  tenantId: string,
  prefix:   string = "EMP"
): Promise<string> {
  const counter = await CounterModel.findOneAndUpdate(
    {
      tenantId:     new mongoose.Types.ObjectId(tenantId),
      sequenceName: "employeeCode",
    },
    { $inc: { seq: 1 } },
    {
      new:    true,   // return updated document
      upsert: true,   // create if doesn't exist yet
    }
  );

  const seq = counter!.seq;

  // Zero-pad to 4 digits minimum — EMP-0001, EMP-0042, EMP-1234
  const padded = seq.toString().padStart(4, "0");
  return `${prefix}-${padded}`;
}