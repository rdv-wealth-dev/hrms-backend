const mongoose = require('mongoose');

const uri = "mongodb://sales_ninja_crm:7SgMJ4kemEIYEJp2@137.59.52.102:27017/hrms_dev?authSource=sales_ninja_crm";

async function main() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB!");

  const branches = await mongoose.connection.db.collection('branches').find({ isDeleted: false }).toArray();
  for (const b of branches) {
    console.log(`Branch Name: ${b.name}, ID: ${b._id}`);
    console.log("WorkPolicy:", JSON.stringify(b.workPolicy, null, 2));
  }

  const orgs = await mongoose.connection.db.collection('organizations').find({ isDeleted: false }).toArray();
  for (const o of orgs) {
    console.log(`Org Name: ${o.companyName}, ID: ${o._id}`);
    console.log("Locale:", JSON.stringify(o.locale, null, 2));
  }

  await mongoose.disconnect();
}

main().catch(console.error);
