import mongoose, { Schema, Document } from "mongoose";

export interface IBiometricRawLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  provider: string;
  employeeID?: string;
  deviceSerialno?: string;
  punchDate?: string;
  punchTime?: string;
  receivedAt: Date;
  payload: any;
}

const rawLogSchema = new Schema<IBiometricRawLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, index: true },
    provider: { type: String, required: true, index: true },
    employeeID: { type: String, index: true },
    deviceSerialno: { type: String },
    punchDate: { type: String },
    punchTime: { type: String },
    receivedAt: { type: Date, default: Date.now },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: "webhook_raw_biometrics" }
);

rawLogSchema.index(
  { branchId: 1, employeeID: 1, punchDate: 1, punchTime: 1 },
  { unique: true, sparse: true, name: "uniq_branch_employee_punch" }
);


export interface IBiometricPunch extends Document {
  employeeID: string;
  deviceID: string;
  deviceSerialno: string;
  punchDate: string;
  punchTime: string;
  punchTimestamp: Date;
  modeofPunch?: string;
  modeofAttn?: string;
  deviceIp?: string;
  organizationId: string;
  branchId: string;
}

const punchSchema = new Schema<IBiometricPunch>(
  {
    employeeID: { type: String, required: true, index: true },
    deviceID: { type: String, required: true },
    deviceSerialno: { type: String, required: true },
    punchDate: { type: String, required: true },
    punchTime: { type: String, required: true },
    punchTimestamp: { type: Date, required: true, index: true },
    modeofPunch: String,
    modeofAttn: String,
    deviceIp: String,
    organizationId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
  },
  { timestamps: true, collection: "biometric_punches" }
);

punchSchema.index(
  { deviceSerialno: 1, employeeID: 1, punchDate: 1, punchTime: 1 },
  { unique: true, name: "uniq_device_employee_punch" }
);

export function getRawLogModel() {
  return mongoose.models.RawLog || mongoose.model<IBiometricRawLog>("RawLog", rawLogSchema);
}

export function getPunchModel() {
  return mongoose.models.Punch || mongoose.model<IBiometricPunch>("Punch", punchSchema);
}
