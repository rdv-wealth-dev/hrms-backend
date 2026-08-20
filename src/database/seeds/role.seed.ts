import mongoose from "mongoose";
import { logger } from "../../config/logger.config";

export const DEFAULT_ROLES = [
  {
    name: "Org Admin",
    slug: "ORG_ADMIN",
    description: "Full access to everything across the entire organization",
    isSystemRole: true,
    permissions: [
      "employee.read", "employee.create", "employee.update", "employee.delete",
      "attendance.read", "attendance.create", "attendance.update", "attendance.approve",
      "leave.read", "leave.create", "leave.update", "leave.approve",
      "payroll.read", "payroll.create", "payroll.run", "payroll.approve",
      "branch.read", "branch.create", "branch.update",
      "department.read", "department.create", "department.update",
      "designation.read", "designation.create", "designation.update",
      "team.read", "team.create", "team.update", "team.delete",
      "orgtree.read", "orgtree.create", "orgtree.update",
      "role.read", "role.create", "role.update",
      "report.read", "settings.read", "settings.update",
    ],
  },
  {
    name: "HR Admin",
    slug: "HR_ADMIN",
    description: "Full operational access — manages all HR functions across the organisation",
    isSystemRole: true,
    permissions: [
      "employee.read", "employee.create", "employee.update", "employee.delete",
      "attendance.read", "attendance.create", "attendance.update", "attendance.approve",
      "leave.read", "leave.create", "leave.update", "leave.approve",
      "payroll.read", "payroll.create", "payroll.run", "payroll.approve",
      "branch.read",
      "department.read", "department.create", "department.update",
      "designation.read", "designation.create", "designation.update",
      "team.read", "team.create", "team.update", "team.delete",
      "orgtree.read", "orgtree.create", "orgtree.update",
      "role.read", "role.create", "role.update",
      "report.read", "settings.read", "settings.update",
    ],
  },
  {
    name: "Branch Admin",
    slug: "BRANCH_ADMIN",
    description: "Full operational access within assigned branch(es) — scoped to assigned branches",
    isSystemRole: true,
    permissions: [
      "employee.read", "employee.create", "employee.update",
      "attendance.read", "attendance.create", "attendance.update", "attendance.approve",
      "leave.read", "leave.create", "leave.update", "leave.approve",
      "payroll.read",
      "branch.read",
      "department.read", "department.create", "department.update",
      "designation.read", "designation.create", "designation.update",
      "team.read", "team.create", "team.update", "team.delete",
      "report.read",
    ],
  },
  {
    name: "Leadership",
    slug: "LEADERSHIP",
    description: "Read-only access across all branches and departments",
    isSystemRole: true,
    permissions: [
      "employee.read", "attendance.read",
      "leave.read", "payroll.read",
      "branch.read", "department.read",
      "designation.read", "team.read", "orgtree.read", "report.read",
    ],
  },
  {
    name: "Chief Executive Officer",
    slug: "CEO",
    description: "Chief Executive Officer — strategic & executive oversight and approval authority across all branches",
    isSystemRole: true,
    permissions: [
      "employee.read", "employee.create", "employee.update",
      "attendance.read", "attendance.approve",
      "leave.read", "leave.approve",
      "payroll.read", "payroll.approve",
      "branch.read", "department.read", "designation.read", "team.read", "orgtree.read", "role.read",
      "report.read", "settings.read",
    ],
  },
  {
    name: "Chief Technology Officer",
    slug: "CTO",
    description: "Chief Technology Officer — executive authority over engineering teams, technical designations, and hierarchy",
    isSystemRole: true,
    permissions: [
      "employee.read",
      "attendance.read",
      "leave.read", "leave.approve",
      "department.read", "department.create", "department.update",
      "designation.read", "designation.create", "designation.update",
      "team.read", "team.create", "team.update",
      "orgtree.read", "report.read", "settings.read",
    ],
  },
  {
    name: "Chief Financial Officer",
    slug: "CFO",
    description: "Chief Financial Officer — full governance over payroll, compensation, and financial reports",
    isSystemRole: true,
    permissions: [
      "payroll.read", "payroll.create", "payroll.run", "payroll.approve",
      "employee.read", "attendance.read", "leave.read",
      "branch.read", "department.read", "designation.read",
      "report.read", "settings.read",
    ],
  },
  {
    name: "Manager",
    slug: "MANAGER",
    description: "Manages team attendance and leave approvals for direct reports",
    isSystemRole: true,
    permissions: [
      "employee.read",
      "attendance.read", "attendance.approve",
      "leave.read", "leave.approve",
      "department.read", "designation.read",
      "team.read", "team.update",
      "report.read",
    ],
  },
  {
    name: "Team Leader",
    slug: "TEAM_LEADER",
    description: "Leads a team — can view team members, track attendance, and approve leave",
    isSystemRole: true,
    permissions: [
      "employee.read",
      "attendance.read",
      "leave.read", "leave.approve",
      "team.read", "team.update",
      "report.read",
    ],
  },
  {
    name: "Employee",
    slug: "EMPLOYEE",
    description: "Self-service access to own data only (attendance punch, leave apply, view payslips)",
    isSystemRole: true,
    permissions: [
      "attendance.read", "attendance.create",
      "leave.read", "leave.create",
      "payroll.read",
      "team.read",
    ],
  },
];

export async function seedDefaultRoles(
  tenantId: string,
  _createdBy: string
): Promise<Map<string, string>> {
  const roleMap = new Map<string, string>();
  const tenantOId = new mongoose.Types.ObjectId(tenantId);
  const now = new Date();

  try {
    const collection = mongoose.connection.collection("roles");

    for (const roleData of DEFAULT_ROLES) {
      try {
        const doc = {
          tenantId: tenantOId,
          name: roleData.name,
          slug: roleData.slug,
          description: roleData.description,
          isSystemRole: roleData.isSystemRole,
          permissions: roleData.permissions,
          isActive: true,
          isDeleted: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };

        const result = await collection.insertOne(doc);
        roleMap.set(roleData.slug, result.insertedId.toString());
      } catch (err: any) {
        if (err.code === 11000) {
          // Already exists — update permissions to sync latest changes
          await collection.updateOne(
            { tenantId: tenantOId, slug: roleData.slug },
            { $set: { permissions: roleData.permissions, updatedAt: now } }
          );
          const existing = await collection.findOne({ tenantId: tenantOId, slug: roleData.slug });
          if (existing) {
            roleMap.set(roleData.slug, existing._id.toString());
          }
        } else {
          logger.error({ message: `Role seed failed for ${roleData.slug}`, error: err.message });
        }
      }
    }

    logger.info({
      message: "Default roles seeded successfully",
      tenantId,
      count: roleMap.size,
    });
  } catch (error: any) {
    logger.error({ message: "Role seed critical error", error: error.message });
    throw error;
  }

  return roleMap;
}