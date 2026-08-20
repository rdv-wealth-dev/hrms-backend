import { PermissionModel } from "../../modules/permission/permission.model";
import { logger } from "../../config/logger.config";

export const ALL_PERMISSIONS = [
  // Employee
  { module: "employee", action: "read", resource: "employee.read", description: "View employee profiles" },
  { module: "employee", action: "create", resource: "employee.create", description: "Create employee profiles" },
  { module: "employee", action: "update", resource: "employee.update", description: "Update employee details" },
  { module: "employee", action: "delete", resource: "employee.delete", description: "Delete employee profiles" },

  // Attendance
  { module: "attendance", action: "read", resource: "attendance.read", description: "View attendance records" },
  { module: "attendance", action: "create", resource: "attendance.create", description: "Mark attendance / punch" },
  { module: "attendance", action: "update", resource: "attendance.update", description: "Edit attendance records" },
  { module: "attendance", action: "approve", resource: "attendance.approve", description: "Approve regularization requests" },

  // Leave
  { module: "leave", action: "read", resource: "leave.read", description: "View leave requests" },
  { module: "leave", action: "create", resource: "leave.create", description: "Apply for leave" },
  { module: "leave", action: "update", resource: "leave.update", description: "Edit leave requests" },
  { module: "leave", action: "approve", resource: "leave.approve", description: "Approve or reject leaves" },

  // Payroll
  { module: "payroll", action: "read", resource: "payroll.read", description: "View payroll records & payslips" },
  { module: "payroll", action: "create", resource: "payroll.create", description: "Create salary structures" },
  { module: "payroll", action: "run", resource: "payroll.run", description: "Run payroll processing" },
  { module: "payroll", action: "approve", resource: "payroll.approve", description: "Approve payroll runs" },

  // Branch
  { module: "branch", action: "read", resource: "branch.read", description: "View branches" },
  { module: "branch", action: "create", resource: "branch.create", description: "Create branches" },
  { module: "branch", action: "update", resource: "branch.update", description: "Update branch details" },

  // Department
  { module: "department", action: "read", resource: "department.read", description: "View departments" },
  { module: "department", action: "create", resource: "department.create", description: "Create departments" },
  { module: "department", action: "update", resource: "department.update", description: "Update departments" },

  // Designation
  { module: "designation", action: "read", resource: "designation.read", description: "View designations" },
  { module: "designation", action: "create", resource: "designation.create", description: "Create designations" },
  { module: "designation", action: "update", resource: "designation.update", description: "Update designations" },

  // Team
  { module: "team", action: "read", resource: "team.read", description: "View teams" },
  { module: "team", action: "create", resource: "team.create", description: "Create teams" },
  { module: "team", action: "update", resource: "team.update", description: "Update teams" },
  { module: "team", action: "delete", resource: "team.delete", description: "Delete teams" },

  // Org Tree Hierarchy
  { module: "org_tree", action: "read", resource: "orgtree.read", description: "View organization chart / positions" },
  { module: "org_tree", action: "create", resource: "orgtree.create", description: "Create hierarchy positions" },
  { module: "org_tree", action: "update", resource: "orgtree.update", description: "Update hierarchy positions" },

  // Role
  { module: "role", action: "read", resource: "role.read", description: "View roles and permissions" },
  { module: "role", action: "create", resource: "role.create", description: "Create custom roles" },
  { module: "role", action: "update", resource: "role.update", description: "Update roles" },

  // Report & Settings
  { module: "report", action: "read", resource: "report.read", description: "View reports & analytics" },
  { module: "settings", action: "read", resource: "settings.read", description: "View organization settings" },
  { module: "settings", action: "update", resource: "settings.update", description: "Update organization settings" },
];

export async function seedPermissions(): Promise<void> {
  try {
    const operations = ALL_PERMISSIONS.map((perm) => ({
      updateOne: {
        filter: { resource: perm.resource },
        update: { $setOnInsert: perm },
        upsert: true,
      },
    }));

    const result = await PermissionModel.bulkWrite(operations);

    logger.info({
      message: "Permissions seeded successfully",
      inserted: result.upsertedCount,
      existing: ALL_PERMISSIONS.length - result.upsertedCount,
    });
  } catch (error) {
    logger.error({ message: "Permission seeding failed", error });
    throw error;
  }
}