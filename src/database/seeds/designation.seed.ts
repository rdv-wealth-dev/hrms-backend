import mongoose from "mongoose";

interface DesignationSeed {
  name: string;
  code: string;
  departmentCode: string;
  level: number;
  description: string;
}

const DEFAULT_DESIGNATIONS: DesignationSeed[] = [
  // ─── Software Engineering ───────────────────────────────────────────
  { name: "Junior Software Engineer", code: "JSE", departmentCode: "ENG", level: 1, description: "Entry-level software developer focused on learning and implementation under guidance." },
  { name: "Software Engineer", code: "SE", departmentCode: "ENG", level: 2, description: "Mid-level developer building features independently." },
  { name: "Senior Software Engineer", code: "SSE", departmentCode: "ENG", level: 3, description: "Senior developer handling complex modules and mentoring juniors." },
  { name: "Lead Engineer", code: "LE", departmentCode: "ENG", level: 4, description: "Technical lead owning architecture decisions for a team." },
  { name: "Staff Engineer", code: "STE", departmentCode: "ENG", level: 5, description: "Cross-team technical authority driving engineering best practices." },
  { name: "Principal Engineer", code: "PE", departmentCode: "ENG", level: 6, description: "Organization-wide technical strategy and system architecture." },
  { name: "Engineering Manager", code: "EM", departmentCode: "ENG", level: 4, description: "People manager leading a team of engineers." },
  { name: "Senior Engineering Manager", code: "SEM", departmentCode: "ENG", level: 5, description: "Senior people leader managing multiple engineering teams." },
  { name: "Director of Engineering", code: "DOE", departmentCode: "ENG", level: 6, description: "Executive leadership over the engineering function." },
  { name: "VP of Engineering", code: "VPE", departmentCode: "ENG", level: 7, description: "VP-level leadership defining engineering vision and strategy." },
  { name: "Chief Technology Officer", code: "CTO", departmentCode: "ENG", level: 8, description: "C-level executive responsible for all technology decisions." },

  // ─── Quality Assurance ─────────────────────────────────────────────
  { name: "Junior QA Engineer", code: "JQA", departmentCode: "QA", level: 1, description: "Entry-level tester executing manual test cases." },
  { name: "QA Engineer", code: "QA", departmentCode: "QA", level: 2, description: "Mid-level quality assurance engineer." },
  { name: "Senior QA Engineer", code: "SQA", departmentCode: "QA", level: 3, description: "Senior QA owning test strategy and automation." },
  { name: "SDET", code: "SDET", departmentCode: "QA", level: 3, description: "Software Development Engineer in Test — builds test frameworks." },
  { name: "QA Lead", code: "QAL", departmentCode: "QA", level: 4, description: "QA team lead managing testing efforts." },
  { name: "QA Manager", code: "QAM", departmentCode: "QA", level: 5, description: "Manager overseeing the QA function." },

  // ─── Cloud & Infrastructure / DevOps ───────────────────────────────
  { name: "Junior DevOps Engineer", code: "JDO", departmentCode: "DEVOPS", level: 1, description: "Entry-level infrastructure engineer." },
  { name: "DevOps Engineer", code: "DO", departmentCode: "DEVOPS", level: 2, description: "Managing CI/CD, cloud resources, and deployments." },
  { name: "Senior DevOps Engineer", code: "SDO", departmentCode: "DEVOPS", level: 3, description: "Senior engineer owning production reliability." },
  { name: "Site Reliability Engineer", code: "SRE", departmentCode: "DEVOPS", level: 3, description: "SRE ensuring system uptime and performance." },
  { name: "Cloud Architect", code: "CA", departmentCode: "DEVOPS", level: 5, description: "Architect designing cloud infrastructure and strategy." },
  { name: "DevOps Manager", code: "DOM", departmentCode: "DEVOPS", level: 5, description: "Manager leading the infrastructure team." },

  // ─── Cybersecurity ─────────────────────────────────────────────────
  { name: "Security Analyst", code: "SA", departmentCode: "SEC", level: 2, description: "Monitoring threats and managing access controls." },
  { name: "Senior Security Engineer", code: "SSE", departmentCode: "SEC", level: 3, description: "Senior engineer handling security architecture." },
  { name: "SOC Analyst", code: "SOC", departmentCode: "SEC", level: 2, description: "Security Operations Center analyst monitoring incidents." },
  { name: "Penetration Tester", code: "PT", departmentCode: "SEC", level: 3, description: "Ethical hacker performing security assessments." },
  { name: "CISO", code: "CISO", departmentCode: "SEC", level: 8, description: "Chief Information Security Officer — executive security leadership." },

  // ─── Data & Analytics ──────────────────────────────────────────────
  { name: "Junior Data Analyst", code: "JDA", departmentCode: "DATA", level: 1, description: "Entry-level data analyst." },
  { name: "Data Analyst", code: "DA", departmentCode: "DATA", level: 2, description: "Mid-level analyst building reports and dashboards." },
  { name: "Data Engineer", code: "DE", departmentCode: "DATA", level: 3, description: "Engineer building data pipelines and infrastructure." },
  { name: "Data Scientist", code: "DS", departmentCode: "DATA", level: 3, description: "Scientist applying ML and statistical models." },
  { name: "ML Engineer", code: "ML", departmentCode: "DATA", level: 3, description: "Machine learning engineer building and deploying models." },
  { name: "BI Developer", code: "BI", departmentCode: "DATA", level: 2, description: "Business intelligence developer." },
  { name: "Database Administrator", code: "DBA", departmentCode: "DATA", level: 3, description: "Managing and optimizing database systems." },
  { name: "Data Engineering Manager", code: "DEM", departmentCode: "DATA", level: 5, description: "Manager leading the data team." },

  // ─── Product Management ────────────────────────────────────────────
  { name: "Associate Product Manager", code: "APM", departmentCode: "PM", level: 1, description: "Entry-level product manager." },
  { name: "Product Manager", code: "PM", departmentCode: "PM", level: 3, description: "Product manager owning the roadmap and feature delivery." },
  { name: "Senior Product Manager", code: "SPM", departmentCode: "PM", level: 4, description: "Senior PM handling complex product lines." },
  { name: "Director of Product", code: "DOP", departmentCode: "PM", level: 6, description: "Executive overseeing the product organization." },
  { name: "Scrum Master", code: "SM", departmentCode: "PM", level: 2, description: "Agile coach facilitating sprints and ceremonies." },
  { name: "Project Manager", code: "PJM", departmentCode: "PM", level: 3, description: "Managing project timelines, resources, and delivery." },
  { name: "Program Manager", code: "PGM", departmentCode: "PM", level: 4, description: "Managing cross-functional programs and initiatives." },

  { name: "IT Helpdesk Technician", code: "HT1", departmentCode: "ITSUP", level: 1, description: "Tier 1 support handling basic IT tickets." },
  { name: "IT Support Engineer", code: "ITSE", departmentCode: "ITSUP", level: 2, description: "Tier 2 support handling complex issues." },
  { name: "Senior IT Support Engineer", code: "SIT", departmentCode: "ITSUP", level: 3, description: "Tier 3 support and IT infrastructure management." },
  { name: "IT Infrastructure Manager", code: "ITIM", departmentCode: "ITSUP", level: 4, description: "Manager overseeing IT operations and infrastructure." },

  // ─── Design ────────────────────────────────────────────────────────
  { name: "Junior UI/UX Designer", code: "JUX", departmentCode: "UIX", level: 1, description: "Entry-level designer." },
  { name: "UI/UX Designer", code: "UX", departmentCode: "UIX", level: 2, description: "Mid-level designer creating interfaces and prototypes." },
  { name: "Senior UI/UX Designer", code: "SUX", departmentCode: "UIX", level: 3, description: "Senior designer owning product design systems." },
  { name: "UX Researcher", code: "UXR", departmentCode: "UIX", level: 3, description: "Researcher conducting user studies and usability tests." },
  { name: "Design Lead", code: "DL", departmentCode: "UIX", level: 4, description: "Lead designer managing the design team." },

  // ─── Human Resources ───────────────────────────────────────────────
  { name: "HR Executive", code: "HRE", departmentCode: "HR", level: 1, description: "Entry-level HR generalist." },
  { name: "HR Generalist", code: "HRG", departmentCode: "HR", level: 2, description: "Mid-level HR handling employee lifecycle." },
  { name: "Senior HR Generalist", code: "SHR", departmentCode: "HR", level: 3, description: "Senior HR business partner." },
  { name: "HR Manager", code: "HRM", departmentCode: "HR", level: 4, description: "Manager leading the HR function." },
  { name: "HR Director", code: "HRD", departmentCode: "HR", level: 6, description: "Executive leading HR strategy." },
  { name: "Talent Acquisition Specialist", code: "TA", departmentCode: "HR", level: 2, description: "Recruiter focused on sourcing and hiring." },

  // ─── Finance & Accounts ────────────────────────────────────────────
  { name: "Accounts Executive", code: "ACE", departmentCode: "FIN", level: 1, description: "Entry-level accounts assistant." },
  { name: "Accountant", code: "ACC", departmentCode: "FIN", level: 2, description: "Managing day-to-day accounting and bookkeeping." },
  { name: "Senior Accountant", code: "SACC", departmentCode: "FIN", level: 3, description: "Senior accountant handling financial reporting." },
  { name: "Finance Manager", code: "FM", departmentCode: "FIN", level: 4, description: "Manager overseeing financial operations." },
  { name: "Chief Financial Officer", code: "CFO", departmentCode: "FIN", level: 8, description: "C-level executive responsible for financial strategy." },

  // ─── Administration ────────────────────────────────────────────────
  { name: "Administrative Executive", code: "ADME", departmentCode: "ADMIN", level: 1, description: "Entry-level administrator." },
  { name: "Office Manager", code: "OM", departmentCode: "ADMIN", level: 3, description: "Manager overseeing office operations and facilities." },
  { name: "Administration Manager", code: "ADMM", departmentCode: "ADMIN", level: 4, description: "Manager handling administration and vendor coordination." },
];

export async function seedDesignations(
  tenantId: string,
  branchId: string,
  departmentMap: Map<string, string>
): Promise<Map<string, string>> {
  const desigMap = new Map<string, string>();
  const tenantOId = new mongoose.Types.ObjectId(tenantId);
  const branchOId = new mongoose.Types.ObjectId(branchId);
  const now = new Date();

  const collection = mongoose.connection.collection("designations");

  for (const desig of DEFAULT_DESIGNATIONS) {
    const deptId = departmentMap.get(desig.departmentCode);
    if (!deptId) continue;

    const doc = {
      tenantId: tenantOId,
      branchId: branchOId,
      departmentId: new mongoose.Types.ObjectId(deptId),
      name: desig.name,
      code: desig.code,
      description: desig.description,
      level: desig.level,
      isActive: true,
      isDeleted: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await collection.insertOne(doc);
      desigMap.set(desig.code, result.insertedId.toString());
    } catch (err: any) {
      if (err.code === 11000) {
        const existing = await collection.findOne({
          tenantId: tenantOId,
          branchId: branchOId,
          code: desig.code,
        });
        if (existing) {
          desigMap.set(desig.code, existing._id.toString());
        }
      }
    }
  }

  return desigMap;
}
