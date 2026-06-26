import mongoose from "mongoose";
import { RoleModel } from "./role.model";
import { logger }    from "../../config/logger";

export const DEFAULT_ROLES = [
  {
    name:         "Super Admin",
    slug:         "SUPER_ADMIN",
    description:  "Full access to everything",
    isSystemRole: true,
    permissions: [
      "employee.read", "employee.create", "employee.update", "employee.delete",
      "attendance.read", "attendance.create", "attendance.update",
      "leave.read", "leave.create", "leave.update", "leave.approve",
      "payroll.read", "payroll.create", "payroll.run", "payroll.approve",
      "branch.read", "branch.create", "branch.update",
      "department.read", "department.create", "department.update",
      "designation.read", "designation.create", "designation.update",
      "role.read", "role.create", "role.update",
      "report.read", "settings.read", "settings.update",
    ],
  },
  {
    name:         "HR Admin",
    slug:         "HR_ADMIN",
    description:  "Manages employees, attendance, leave within their branch",
    isSystemRole: true,
    permissions: [
      "employee.read", "employee.create", "employee.update",
      "attendance.read", "attendance.create", "attendance.update",
      "leave.read", "leave.create", "leave.update", "leave.approve",
      "department.read", "designation.read", "report.read",
    ],
  },
  {
    name:         "Leadership",
    slug:         "LEADERSHIP",
    description:  "Read-only access across all branches",
    isSystemRole: true,
    permissions: [
      "employee.read", "attendance.read", "leave.read",
      "payroll.read", "branch.read", "department.read",
      "designation.read", "report.read",
    ],
  },
  {
    name:         "Manager",
    slug:         "MANAGER",
    description:  "Manages team attendance and leave approvals",
    isSystemRole: true,
    permissions: [
      "employee.read", "attendance.read",
      "leave.read", "leave.approve",
      "department.read", "designation.read", "report.read",
    ],
  },
  {
    name:         "Product Manager",
    slug:         "PRODUCT_MANAGER",
    description:  "Manages product team attendance and leave",
    isSystemRole: true,
    permissions: [
      "employee.read", "attendance.read",
      "leave.read", "leave.approve",
      "department.read", "designation.read",
    ],
  },
  {
    name:         "Employee",
    slug:         "EMPLOYEE",
    description:  "Access to own data only",
    isSystemRole: true,
    permissions: [
      "employee.read", "attendance.read", "attendance.create",
      "leave.read", "leave.create", "payroll.read",
    ],
  },
];

export async function seedDefaultRoles(
  tenantId: string,
  createdBy: string
): Promise<Map<string, string>> {
  const roleMap = new Map<string, string>();

  console.log("=== ROLE SEED START ===");
  console.log("tenantId received:", tenantId);
  console.log("tenantId type:", typeof tenantId);

  try {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    console.log("tenantObjectId created:", tenantObjectId.toString());

    for (const roleData of DEFAULT_ROLES) {
      console.log(`\nProcessing role: ${roleData.slug}`);

      try {
        // Check existing
        const existing = await RoleModel.findOne({
          tenantId:  tenantObjectId,
          slug:      roleData.slug,
          isDeleted: false,
        });

        if (existing) {
          console.log(`  → Already exists: ${existing._id}`);
          roleMap.set(existing.slug, existing._id.toString());
          continue;
        }

        // Build doc manually
        const roleDoc = {
          tenantId:     tenantObjectId,
          name:         roleData.name,
          slug:         roleData.slug,
          description:  roleData.description,
          isSystemRole: roleData.isSystemRole,
          permissions:  roleData.permissions,
          isActive:     true,
          isDeleted:    false,
          version:      1,
        };

        console.log(`  → Creating with doc:`, JSON.stringify({
          tenantId:     roleDoc.tenantId.toString(),
          slug:         roleDoc.slug,
          isSystemRole: roleDoc.isSystemRole,
          permCount:    roleDoc.permissions.length,
        }));

        const role = new RoleModel(roleDoc);

        // Check validation before save
        const validationError = role.validateSync();
        if (validationError) {
          console.error(`  → VALIDATION ERROR:`, validationError.message);
          continue;
        }

        const saved = await role.save();
        console.log(`  → SAVED successfully: ${saved._id}`);
        roleMap.set(saved.slug, saved._id.toString());

      } catch (roleError: any) {
        console.error(`  → ERROR saving ${roleData.slug}:`, roleError.message);
        console.error(`  → Full error:`, roleError);
      }
    }

    // Verify what was saved
    const savedRoles = await RoleModel.find({ tenantId: tenantObjectId })
      .select("slug isDeleted")
      .lean();

    console.log("\n=== VERIFICATION ===");
    console.log("Roles in DB for this tenant:", savedRoles.length);
    savedRoles.forEach(r => console.log(`  - ${(r as any).slug} (isDeleted: ${(r as any).isDeleted})`));
    console.log("roleMap size:", roleMap.size);
    console.log("=== ROLE SEED END ===\n");

  } catch (error: any) {
    console.error("=== ROLE SEED CRITICAL ERROR ===");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }

  return roleMap;
}