import mongoose      from "mongoose";
import { RoleModel } from "./role.model";
import { logger }    from "../../config/logger";

export const DEFAULT_ROLES = [
  {
    name:         "Org Admin",
    slug:         "ORG_ADMIN",
    description:  "Full access to everything",
    isSystemRole: true,
    permissions: [
      "employee.read",    "employee.create",    "employee.update",    "employee.delete",
      "attendance.read",  "attendance.create",  "attendance.update",
      "leave.read",       "leave.create",       "leave.update",       "leave.approve",
      "payroll.read",     "payroll.create",     "payroll.run",        "payroll.approve",
      "branch.read",      "branch.create",      "branch.update",
      "department.read",  "department.create",  "department.update",
      "designation.read", "designation.create", "designation.update",
      "role.read",        "role.create",        "role.update",
      "report.read",      "settings.read",      "settings.update",
    ],
  },
  {
    name:         "HR Admin",
    slug:         "HR_ADMIN",
    description:  "Full operational access — manages all HR functions across the organisation",
    isSystemRole: true,
    permissions: [
      "employee.read",    "employee.create",    "employee.update",    "employee.delete",
      "attendance.read",  "attendance.create",  "attendance.update",
      "leave.read",       "leave.create",       "leave.update",       "leave.approve",
      "payroll.read",     "payroll.create",     "payroll.run",        "payroll.approve",
      "branch.read",      "branch.create",      "branch.update",
      "department.read",  "department.create",  "department.update",
      "designation.read", "designation.create", "designation.update",
      "role.read",        "role.create",        "role.update",
      "report.read",      "settings.read",      "settings.update",
    ],
  },
  {
    name:         "Leadership",
    slug:         "LEADERSHIP",
    description:  "Read-only access across all branches",
    isSystemRole: true,
    permissions: [
      "employee.read",    "attendance.read",
      "leave.read",       "payroll.read",
      "branch.read",      "department.read",
      "designation.read", "report.read",
    ],
  },
  {
    name:         "Manager",
    slug:         "MANAGER",
    description:  "Manages team attendance and leave approvals",
    isSystemRole: true,
    permissions: [
      "employee.read",   "attendance.read",
      "leave.read",      "leave.approve",
      "department.read", "designation.read",
      "report.read",
    ],
  },
  {
    name:         "Product Manager",
    slug:         "PRODUCT_MANAGER",
    description:  "Manages product team attendance and leave",
    isSystemRole: true,
    permissions: [
      "employee.read",   "attendance.read",
      "leave.read",      "leave.approve",
      "department.read", "designation.read",
    ],
  },
  {
    name:         "Employee",
    slug:         "EMPLOYEE",
    description:  "Access to own data only",
    isSystemRole: true,
    permissions: [
     "attendance.read",
      "attendance.create","leave.read",
      "leave.create",     "payroll.read",
    ],
  },
];

export async function seedDefaultRoles(
  tenantId:  string,
  createdBy: string
): Promise<Map<string, string>> {
  const roleMap    = new Map<string, string>();
  const tenantOId  = new mongoose.Types.ObjectId(tenantId);
  const now        = new Date();

  console.log("\n============================");
  console.log("SEED ROLES CALLED — tenantId:", tenantId);
  console.log("============================");

  try {
    // Use raw MongoDB driver — bypasses all Mongoose hooks and validation
    const collection = mongoose.connection.collection("roles");

    for (const roleData of DEFAULT_ROLES) {
      try {
        const doc = {
          tenantId:     tenantOId,
          name:         roleData.name,
          slug:         roleData.slug,
          description:  roleData.description,
          isSystemRole: roleData.isSystemRole,
          permissions:  roleData.permissions,
          isActive:     true,
          isDeleted:    false,
          version:      1,
          createdAt:    now,
          updatedAt:    now,
        };

        // insertOne — skip if duplicate (unique index on tenantId+slug)
        const result = await collection.insertOne(doc);
        console.log(`✅ ${roleData.slug} inserted:`, result.insertedId.toString());
        roleMap.set(roleData.slug, result.insertedId.toString());

      } catch (err: any) {
        if (err.code === 11000) {
          // Duplicate — already exists, find and add to map
          console.log(`⚠️  ${roleData.slug} already exists — skipping`);
          const existing = await collection.findOne({ tenantId: tenantOId, slug: roleData.slug });
          if (existing) {
            roleMap.set(roleData.slug, existing._id.toString());
          }
        } else {
          console.error(`❌ ${roleData.slug} failed:`, err.message);
        }
      }
    }

    console.log("\n============================");
    console.log("SEED COMPLETE — roles created:", roleMap.size);
    console.log("============================\n");

    logger.info({
      message:  "Default roles seeded",
      tenantId,
      count:    roleMap.size,
    });

  } catch (error: any) {
    console.error("SEED CRITICAL ERROR:", error.message);
    throw error;
  }

  return roleMap;
}