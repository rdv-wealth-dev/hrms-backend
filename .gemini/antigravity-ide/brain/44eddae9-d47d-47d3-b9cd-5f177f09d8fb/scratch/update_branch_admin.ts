import mongoose from "mongoose";
import dotenv from "dotenv";
import { UserModel } from "C:/Users/REDVision/Desktop/HRMs/src/modules/user/user.model";
import { BranchModel } from "C:/Users/REDVision/Desktop/HRMs/src/modules/branch/branch.model";

dotenv.config();

async function run() {
  const uri = process.env.MONGO_DB_URI;
  const dbName = process.env.MONGO_DB_NAME || "hrms_dev";
  if (!uri) {
    console.error("MONGO_DB_URI not found in env variables!");
    return;
  }

  await mongoose.connect(uri, { dbName });
  console.log("Connected to MongoDB.");

  // 1. Find Gurugram Branch
  const gurugram = await BranchModel.findOne({
    name: /Gurugram Branch/i,
    isDeleted: false
  });

  if (!gurugram) {
    console.log("Gurugram Branch not found in the database. Please create it first via POST /api/v1/branches.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found Gurugram Branch. ID: ${gurugram._id}`);

  // 2. Find Raju Rastogi
  const raju = await UserModel.findOne({
    $or: [
      { firstName: /Raju/i },
      { lastName: /Rastogi/i },
      { email: /raju/i }
    ]
  });

  if (!raju) {
    console.log("User 'Raju Rastogi' not found in database.");
  } else {
    // 3. Update branchIds
    raju.branchIds = [gurugram._id];
    raju.role = "BRANCH_ADMIN";
    await raju.save();

    console.log(`Successfully updated Raju Rastogi:`);
    console.log(`- Role: ${raju.role}`);
    console.log(`- Assigned Branch: [${gurugram.code}] ${gurugram.name} (ID: ${gurugram._id})`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
