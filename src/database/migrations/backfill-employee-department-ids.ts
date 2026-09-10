import mongoose from "mongoose";
import dotenv from "dotenv";
import { EmployeeModel } from "../../modules/employee/models/employee.model";

dotenv.config();

async function backfillEmployeeDepartmentIds() {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    throw new Error("MONGODB_URI or DATABASE_URL is required");
  }

  await mongoose.connect(mongoUri);

  const employees = await EmployeeModel.find({
    isDeleted: false,
    $or: [
      { departmentIds: { $exists: false } },
      { departmentIds: { $size: 0 } },
    ],
  }).select("_id departmentId");

  let updatedCount = 0;

  for (const employee of employees) {
    if (!employee.departmentId) continue;

    await EmployeeModel.updateOne(
      { _id: employee._id },
      { $set: { departmentIds: [employee.departmentId] } }
    );
    updatedCount += 1;
  }

  console.log(`Backfilled departmentIds for ${updatedCount} employee(s).`);
  await mongoose.disconnect();
}

backfillEmployeeDepartmentIds().catch((error) => {
  console.error("Failed to backfill employee departmentIds:", error);
  process.exit(1);
});
