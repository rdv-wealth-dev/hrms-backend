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

  // Force registration
  const branchModelName = BranchModel.modelName;
  const userModelName = UserModel.modelName;
  console.log(`Loaded models: ${branchModelName}, ${userModelName}`);

  await mongoose.connect(uri, { dbName });
  console.log("Connected to MongoDB.");

  // Find user by name
  const user = await UserModel.findOne({
    $or: [
      { firstName: /Raju/i },
      { lastName: /Rastogi/i },
      { email: /raju/i }
    ]
  }).populate("branchIds");

  if (!user) {
    console.log("User 'Raju Rastogi' not found in database.");
  } else {
    console.log("User Found:");
    console.log(`- ID: ${user._id}`);
    console.log(`- Name: ${user.firstName} ${user.lastName}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Role: ${user.role}`);
    console.log(`- TenantId: ${user.tenantId}`);
    console.log(`- Assigned Branches:`);
    if (user.branchIds && user.branchIds.length > 0) {
      user.branchIds.forEach((b: any) => {
        console.log(`  * [${b.code}] ${b.name} (ID: ${b._id})`);
      });
    } else {
      console.log("  * None");
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
