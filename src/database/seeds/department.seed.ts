import mongoose from "mongoose";

interface DepartmentSeed {
  name: string;
  code: string;
  description: string;
}

const DEFAULT_DEPARTMENTS: DepartmentSeed[] = [
  {
    name: "Software Engineering",
    code: "ENG",
    description: "Building, maintaining, and scaling core software products and applications.",
  },
  {
    name: "Quality Assurance",
    code: "QA",
    description: "Ensuring software reliability, bug-free releases, and test automation.",
  },
  {
    name: "Cloud & Infrastructure",
    code: "DEVOPS",
    description: "Managing servers, cloud hosting, CI/CD pipelines, and network uptime.",
  },
  {
    name: "Cybersecurity",
    code: "SEC",
    description: "Protecting data, monitoring threats, managing access controls, and compliance.",
  },
  {
    name: "Data & Analytics",
    code: "DATA",
    description: "Database administration, business intelligence, data pipelines, and AI/ML.",
  },
  {
    name: "Product Management",
    code: "PM",
    description: "Defining product roadmaps, feature specifications, and managing project lifecycles.",
  },
  {
    name: "IT Support",
    code: "ITSUP",
    description: "Managing internal systems, employee hardware, network setups, and IT ticketing.",
  },
  {
    name: "Design",
    code: "UIX",
    description: "Wireframing, interface design, user research, and customer experience.",
  },
  {
    name: "Human Resources",
    code: "HR",
    description: "Talent acquisition, employee relations, payroll, and compliance.",
  },
  {
    name: "Finance & Accounts",
    code: "FIN",
    description: "Financial planning, budgeting, invoicing, and statutory compliance.",
  },
  {
    name: "Administration",
    code: "ADMIN",
    description: "Office management, facilities, vendor coordination, and general administration.",
  },
];

export async function seedDepartments(
  tenantId: string,
  branchId: string
): Promise<Map<string, string>> {
  const deptMap = new Map<string, string>();
  const tenantOId = new mongoose.Types.ObjectId(tenantId);
  const branchOId = new mongoose.Types.ObjectId(branchId);
  const now = new Date();

  const collection = mongoose.connection.collection("departments");

  for (const dept of DEFAULT_DEPARTMENTS) {
    const doc = {
      tenantId: tenantOId,
      branchId: branchOId,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      headId: null,
      parentId: null,
      isActive: true,
      isDeleted: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await collection.insertOne(doc);
      deptMap.set(dept.code, result.insertedId.toString());
    } catch (err: any) {
      if (err.code === 11000) {
        const existing = await collection.findOne({
          tenantId: tenantOId,
          branchId: branchOId,
          code: dept.code,
        });
        if (existing) {
          deptMap.set(dept.code, existing._id.toString());
        }
      }
    }
  }

  return deptMap;
}
