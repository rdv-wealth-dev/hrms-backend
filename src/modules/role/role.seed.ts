import { RoleModel } from "./role.model";

// DEFAULT ROLES PER ORGANIZATION
// Created automatically when a company registers

export const DEFAULT_ROLES = [
  {
    name:         "Super Admin",
    slug:         "SUPER_ADMIN",
    description:  "Full access to everything — created on registration",
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
      "department.read", "designation.read",
      "report.read",
    ],
  },
  {
    name:         "Leadership",
    slug:         "LEADERSHIP",
    description:  "Read-only access across all branches",
    isSystemRole: true,
    permissions: [
      "employee.read",
      "attendance.read",
      "leave.read",
      "payroll.read",
      "branch.read",
      "department.read",
      "designation.read",
      "report.read",
    ],
  },
  {
    name:         "Manager",
    slug:         "MANAGER",
    description:  "Manages team attendance and leave approvals",
    isSystemRole: true,
    permissions: [
      "employee.read",
      "attendance.read",
      "leave.read",      "leave.approve",
      "department.read",
      "designation.read",
      "report.read",
    ],
  },
  {
    name:         "Product Manager",
    slug:         "PRODUCT_MANAGER",
    description:  "Manages product team attendance and leave",
    isSystemRole: true,
    permissions: [
      "employee.read",
      "attendance.read",
      "leave.read",      "leave.approve",
      "department.read",
      "designation.read",
    ],
  },
  {
    name:         "Employee",
    slug:         "EMPLOYEE",
    description:  "Access to own data only",
    isSystemRole: true,
    permissions: [
      "employee.read",    // own profile only — enforced in service
      "attendance.read",  // own records only
      "attendance.create",// check in / check out
      "leave.read",       // own leave only
      "leave.create",     // apply for leave
      "payroll.read",     // own payslip only
    ],
  },
];

// SEED DEFAULT ROLES FOR A NEW TENANT
// Called during organization registration

export async function seedDefaultRoles(
  tenantId: string,
  createdBy: string
): Promise<Map<string, string>> {
  // Map of slug → roleId — returned to service for user assignment
  const roleMap = new Map<string, string>();

  for (const roleData of DEFAULT_ROLES) {
    const existing = await RoleModel.findOne({
      tenantId,
      slug: roleData.slug,
    });

    if (!existing) {
      const role = await new RoleModel({
        tenantId,
        ...roleData,
        createdBy,
        updatedBy: createdBy,
      }).save();

      roleMap.set(role.slug, role._id.toString());
    } else {
      roleMap.set(existing.slug, existing._id.toString());
    }
  }

  return roleMap;
}