import mongoose      from "mongoose";
import { RoleModel } from "./role.model";
import { logger }    from "../../config/logger";

export const DEFAULT_ROLES = [
  {
    name:         "Super Admin",
    slug:         "SUPER_ADMIN",
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
    description:  "Manages employees, attendance, leave within their branch",
    isSystemRole: true,
    permissions: [
      "employee.read",   "employee.create",   "employee.update",
      "attendance.read", "attendance.create", "attendance.update",
      "leave.read",      "leave.create",      "leave.update",      "leave.approve",
      "department.read", "designation.read",  "report.read",
    ],
  },
  {
    name:         "Leadership",
    slug:         "LEADERSHIP",
    description:  "Read-only access across all branches",
    isSystemRole: true,
    permissions: [
      "employee.read",   "attendance.read",
      "leave.read",      "payroll.read",
      "branch.read",     "department.read",
      "designation.read","report.read",
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
      "employee.read",    "attendance.read",
      "attendance.create","leave.read",
      "leave.create",     "payroll.read",
    ],
  },
];

export async function seedDefaultRoles(
  tenantId:  string,
  createdBy: string
): Promise<Map<string, string>> {
  const roleMap = new Map<string, string>();

  console.log("\n============================");
  console.log("SEED ROLES CALLED");
  console.log("tenantId:", tenantId);
  console.log("============================\n");

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

  for (const roleData of DEFAULT_ROLES) {
    try {
      console.log(`Seeding role: ${roleData.slug}`);

      const existing = await RoleModel.findOne({
        tenantId:  tenantObjectId,
        slug:      roleData.slug,
        isDeleted: false,
      });

      if (existing) {
        console.log(`  → already exists: ${existing._id}`);
        roleMap.set(existing.slug, existing._id.toString());
        continue;
      }

      const saved = await RoleModel.create({
        tenantId:     tenantObjectId,
        name:         roleData.name,
        slug:         roleData.slug,
        description:  roleData.description,
        isSystemRole: roleData.isSystemRole,
        permissions:  roleData.permissions,
        isActive:     true,
        isDeleted:    false,
        version:      1,
      });

      console.log(`  → saved: ${saved._id}`);
      roleMap.set(saved.slug, saved._id.toString());

    } catch (err: any) {
      console.error(`  → ERROR on ${roleData.slug}:`, err.message);
    }
  }

  console.log("\n============================");
  console.log("SEED ROLES COMPLETE");
  console.log("roleMap size:", roleMap.size);
  console.log("============================\n");

  logger.info({ message: "Default roles seeded", tenantId, count: roleMap.size });

  return roleMap;
}