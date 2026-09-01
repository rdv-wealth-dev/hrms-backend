/**
 * Comprehensive, structured catalog of Degrees, Streams, and Specializations
 * categorized professionally for Undergraduate (UG) and Postgraduate (PG) education.
 */

export interface EducationStreamCategory {
  degree: string;
  specialization: string[];
}

export const UNDERGRADUATE_CATALOG: EducationStreamCategory[] = [
  {
    degree: "Engineering & Technology (B.Tech / B.E. / B.Sc Tech)",
    specialization: [
      "Computer Science and Engineering (CSE)",
      "Information Technology (IT)",
      "Electronics and Communication Engineering (ECE)",
      "Electrical Engineering (EE)",
      "Electrical and Electronics Engineering (EEE)",
      "Mechanical Engineering",
      "Civil Engineering",
      "Chemical Engineering",
      "Aerospace / Aeronautical Engineering",
      "Automobile Engineering",
      "Biomedical Engineering",
      "Biotechnology Engineering",
      "Industrial Engineering",
      "Production Engineering",
      "Mining Engineering",
      "Metallurgical Engineering",
      "Petroleum Engineering",
      "Textile Engineering",
      "Agricultural Engineering",
      "Marine Engineering",
      "Instrumentation Engineering",
      "Robotics Engineering",
      "Artificial Intelligence & Machine Learning",
      "Data Science Engineering",
      "Cyber Security Engineering",
      "Environmental Engineering",
      "Dairy Technology",
      "Food Technology",
      "Polymer Engineering",
      "Ceramic Engineering",
      "Structural Engineering",
      "Nanotechnology",
      "Other Engineering / Technology",
    ],
  },
  {
    degree: "Medical & Health Sciences",
    specialization: [
      "MBBS (Bachelor of Medicine and Bachelor of Surgery)",
      "BDS (Bachelor of Dental Surgery)",
      "BAMS (Bachelor of Ayurvedic Medicine and Surgery)",
      "BHMS (Bachelor of Homeopathic Medicine and Surgery)",
      "BUMS (Bachelor of Unani Medicine and Surgery)",
      "BSMS (Bachelor of Siddha Medicine and Surgery)",
      "BPT (Bachelor of Physiotherapy)",
      "BOT (Bachelor of Occupational Therapy)",
      "B.Sc Nursing",
      "B.Pharm (Bachelor of Pharmacy)",
      "BVSc & AH (Veterinary Science and Animal Husbandry)",
      "B.Sc Medical Laboratory Technology (MLT)",
      "B.Sc Radiology / Radiography",
      "B.Sc Optometry",
      "B.Sc Anesthesia Technology",
      "B.Sc Cardiac Care Technology",
      "B.Sc Dialysis Technology",
      "B.Sc Operation Theatre Technology",
      "BASLP (Audiology and Speech-Language Pathology)",
      "B.Sc Nutrition and Dietetics",
      "BNYS (Naturopathy and Yogic Sciences)",
      "Other Medical & Allied Health",
    ],
  },
  {
    degree: "Commerce, Business & Management",
    specialization: [
      "B.Com (Bachelor of Commerce) – General",
      "B.Com (Honours)",
      "B.Com in Accounting and Finance",
      "B.Com in Banking and Insurance",
      "B.Com in Taxation",
      "B.Com in E-Commerce",
      "B.Com in Computer Applications",
      "B.Com LLB (Integrated 5-Year)",
      "BBA (Bachelor of Business Administration)",
      "BBA LLB (Integrated 5-Year)",
      "BMS (Bachelor of Management Studies)",
      "BFIA (Bachelor of Finance and Investment Analysis)",
      "CA (Chartered Accountant - Intermediate/Final)",
      "CS (Company Secretary)",
      "CMA (Cost & Management Accountant)",
      "Other Commerce / Management",
    ],
  },
  {
    degree: "Arts, Humanities & Social Sciences",
    specialization: [
      "BA General",
      "BA (Honours) in English",
      "BA (Honours) in Hindi / Regional Languages",
      "BA (Honours) in History",
      "BA (Honours) in Political Science",
      "BA (Honours) in Sociology",
      "BA (Honours) in Psychology",
      "BA (Honours) in Economics",
      "BA (Honours) in Philosophy",
      "BA (Honours) in Geography",
      "BA (Honours) in Public Administration",
      "BA (Honours) in Journalism and Mass Communication",
      "BA (Honours) in Anthropology",
      "BA (Honours) in Archaeology",
      "BA (Honours) in Fine Arts",
      "BA (Honours) in Music",
      "BA (Honours) in Theatre / Drama",
      "BA (Honours) in Linguistics",
      "BA (Honours) in Sanskrit",
      "BA (Honours) in Foreign Languages",
      "BSW (Bachelor of Social Work)",
      "BFA (Bachelor of Fine Arts)",
      "BPA (Bachelor of Performing Arts)",
      "BJMC (Bachelor of Journalism and Mass Communication)",
      "BA LLB (Integrated Law 5-Year)",
      "Other Arts & Humanities",
    ],
  },
  {
    degree: "Science & Computer Applications",
    specialization: [
      "B.Sc General",
      "B.Sc (Honours) in Physics",
      "B.Sc (Honours) in Chemistry",
      "B.Sc (Honours) in Mathematics",
      "B.Sc (Honours) in Zoology",
      "B.Sc (Honours) in Botany",
      "B.Sc (Honours) in Biology",
      "B.Sc (Honours) in Biotechnology",
      "B.Sc (Honours) in Microbiology",
      "B.Sc (Honours) in Biochemistry",
      "B.Sc (Honours) in Computer Science",
      "B.Sc (Honours) in Statistics",
      "B.Sc (Honours) in Environmental Science",
      "B.Sc (Honours) in Genetics",
      "B.Sc (Honours) in Forensic Science",
      "B.Sc (Honours) in Geology",
      "B.Sc (Honours) in Home Science",
      "B.Sc (Honours) in Agriculture",
      "B.Sc (Honours) in Food Science and Technology",
      "B.Sc (Honours) in Nautical Science",
      "B.Sc (Honours) in Electronics",
      "B.Sc (IT) – Information Technology",
      "BCA (Bachelor of Computer Applications)",
      "B.Sc Horticulture",
      "B.Sc Forestry",
      "Other Science Degree",
    ],
  },
  {
    degree: "Law",
    specialization: [
      "LLB (3-Year Degree)",
      "BA LLB (5-Year Integrated)",
      "BBA LLB (5-Year Integrated)",
      "B.Com LLB (5-Year Integrated)",
      "B.Sc LLB (5-Year Integrated)",
      "BSW LLB (5-Year Integrated)",
      "Other Law Degree",
    ],
  },
  {
    degree: "Architecture, Planning & Design",
    specialization: [
      "B.Arch (Bachelor of Architecture)",
      "B.Planning (Bachelor of Planning)",
      "B.Des (Fashion Design)",
      "B.Des (Interior Design)",
      "B.Des (Product Design)",
      "B.Des (Communication / Graphic Design)",
      "B.Des (Textile Design)",
      "B.Des (Industrial Design)",
      "B.Des (Game Design)",
      "BFAD (Bachelor of Fashion and Apparel Design)",
      "Bachelor of Interior Design",
      "Other Architecture & Design",
    ],
  },
  {
    degree: "Education & Physical Education",
    specialization: [
      "B.Ed (Bachelor of Education)",
      "BA B.Ed / B.Sc B.Ed (Integrated 4-Year)",
      "BPEd (Bachelor of Physical Education)",
      "B.El.Ed (Bachelor of Elementary Education)",
      "Other Education Degree",
    ],
  },
  {
    degree: "Hospitality, Tourism & Aviation",
    specialization: [
      "BHM (Bachelor of Hotel Management)",
      "BHMCT (Hotel Management and Catering Technology)",
      "B.Sc in Hospitality and Hotel Administration",
      "BTTM (Bachelor of Tourism and Travel Management)",
      "B.Sc Aviation",
      "BBA in Aviation / Airline Management",
      "Other Hospitality / Tourism",
    ],
  },
  {
    degree: "Media, Animation & Mass Communication",
    specialization: [
      "BJMC (Journalism and Mass Communication)",
      "B.Sc in Animation and Multimedia",
      "BAMC (Bachelor of Animation and Multimedia Communication)",
      "B.Sc Visual Communication",
      "BA in Film Making / Direction",
      "Other Media & Communication",
    ],
  },
  {
    degree: "Vocational & Other Professional Courses",
    specialization: [
      "B.Voc (Bachelor of Vocation - IT / Retail / Healthcare)",
      "BLIS (Bachelor of Library and Information Science)",
      "BFD (Bachelor of Fashion Designing)",
      "BFT (Bachelor of Fashion Technology)",
      "Bachelor of Fisheries Science",
      "Other Undergraduate Degree",
    ],
  },
];

export const POSTGRADUATE_CATALOG: EducationStreamCategory[] = [
  {
    degree: "Engineering & Technology (M.Tech / M.E. / M.S.)",
    specialization: [
      "M.Tech / M.E. Computer Science and Engineering",
      "M.Tech / M.E. Information Technology",
      "M.Tech / M.E. Electronics and Communication Engineering",
      "M.Tech / M.E. Electrical Engineering",
      "M.Tech / M.E. Power Systems Engineering",
      "M.Tech / M.E. Mechanical Engineering",
      "M.Tech / M.E. Thermal Engineering",
      "M.Tech / M.E. Civil Engineering",
      "M.Tech / M.E. Structural Engineering",
      "M.Tech / M.E. Chemical Engineering",
      "M.Tech / M.E. Aerospace Engineering",
      "M.Tech / M.E. Biomedical Engineering",
      "M.Tech / M.E. Biotechnology",
      "M.Tech / M.E. Industrial Engineering",
      "M.Tech / M.E. Production Engineering",
      "M.Tech / M.E. Mining Engineering",
      "M.Tech / M.E. Metallurgical Engineering",
      "M.Tech / M.E. Petroleum Engineering",
      "M.Tech / M.E. Textile Engineering",
      "M.Tech / M.E. Agricultural Engineering",
      "M.Tech / M.E. Instrumentation Engineering",
      "M.Tech / M.E. Robotics and Automation",
      "M.Tech / M.E. Artificial Intelligence & Machine Learning",
      "M.Tech / M.E. Data Science",
      "M.Tech / M.E. Cyber Security",
      "M.Tech / M.E. Environmental Engineering",
      "M.Tech / M.E. VLSI Design",
      "M.Tech / M.E. Nanotechnology",
      "M.Tech / M.E. Software Engineering",
      "M.Tech / M.E. Embedded Systems",
      "M.S. (by Research - Engineering & Tech)",
      "MBA in Technology Management",
      "Other M.Tech / M.E. Specialization",
    ],
  },
  {
    degree: "Medical & Health Sciences (MD / MS / MDS / Super-Specialization)",
    specialization: [
      "MD (General Medicine)",
      "MD (Pediatrics)",
      "MD (Dermatology)",
      "MD (Psychiatry)",
      "MD (Radiology / Radiodiagnosis)",
      "MD (Anesthesiology)",
      "MD (Pathology)",
      "MD (Microbiology)",
      "MD (Biochemistry)",
      "MD (Community Medicine / PSM)",
      "MD (Forensic Medicine)",
      "MD (Pharmacology)",
      "MD (Physiology / Anatomy)",
      "MS (General Surgery)",
      "MS (Orthopedics)",
      "MS (ENT / Otorhinolaryngology)",
      "MS (Ophthalmology)",
      "MS (Obstetrics & Gynecology)",
      "MDS (Master of Dental Surgery)",
      "MD (Ayurveda)",
      "MD (Homeopathy)",
      "MD (Unani)",
      "MS / MD (Siddha)",
      "MPT (Master of Physiotherapy - Ortho / Neuro / Sports)",
      "M.Sc Nursing",
      "M.Pharm (Pharmaceutics / Pharmacology / Chemistry)",
      "MVSc (Master of Veterinary Science)",
      "M.Sc Medical Laboratory Technology",
      "M.Sc Radiology",
      "M.Sc Optometry",
      "M.Sc Nutrition and Dietetics",
      "MPH (Master of Public Health)",
      "DM (Super-Specialization: Cardiology / Neurology / Nephrology / Gastro / Endo)",
      "M.Ch (Super-Specialization Surgery: Neurosurgery / CTVS / Urology / Plastic)",
      "Other Postgraduate Medical / Health",
    ],
  },
  {
    degree: "Commerce, Management & Business (MBA / M.Com / PGDM)",
    specialization: [
      "MBA (Finance)",
      "MBA (Marketing)",
      "MBA (Human Resource Management / HR)",
      "MBA (Operations & Supply Chain)",
      "MBA (Information Technology / Systems)",
      "MBA (International Business)",
      "MBA (Business Analytics / Data Analytics)",
      "MBA (Healthcare / Hospital Management)",
      "MBA (Rural Management / Agribusiness)",
      "MBA (Entrepreneurship & Innovation)",
      "PGDM (Post Graduate Diploma in Management)",
      "M.Com General",
      "M.Com Accounting and Finance",
      "M.Com Banking and Insurance",
      "M.Com Business Administration",
      "M.Com Applied Economics",
      "MFC (Master of Finance and Control)",
      "MIB (Master of International Business)",
      "Executive MBA (EMBA)",
      "Other Post Graduate Management / Commerce",
    ],
  },
  {
    degree: "Arts, Humanities & Social Sciences (MA / MSW / MFA)",
    specialization: [
      "MA English",
      "MA Hindi / Regional Languages",
      "MA History",
      "MA Political Science",
      "MA Sociology",
      "MA Psychology / Clinical Psychology",
      "MA Economics",
      "MA Philosophy",
      "MA Geography",
      "MA Public Administration",
      "MA Journalism and Mass Communication",
      "MA Anthropology",
      "MA Archaeology",
      "MA Fine Arts",
      "MA Music",
      "MA Theatre / Drama",
      "MA Linguistics",
      "MA Sanskrit",
      "MA Foreign Languages",
      "MA Development Studies",
      "MA International Relations",
      "MA Women's Studies",
      "MA Human Rights",
      "MSW (Master of Social Work)",
      "MFA (Master of Fine Arts)",
      "MPA (Master of Performing Arts)",
      "MJMC (Master of Journalism and Mass Communication)",
      "Other MA / Humanities",
    ],
  },
  {
    degree: "Science, IT & Computer Applications (M.Sc / MCA / M.Sc IT)",
    specialization: [
      "M.Sc Physics",
      "M.Sc Chemistry",
      "M.Sc Mathematics",
      "M.Sc Zoology",
      "M.Sc Botany",
      "M.Sc Biology",
      "M.Sc Biotechnology",
      "M.Sc Microbiology",
      "M.Sc Biochemistry",
      "M.Sc Computer Science",
      "M.Sc Statistics",
      "M.Sc Environmental Science",
      "M.Sc Genetics",
      "M.Sc Forensic Science",
      "M.Sc Geology",
      "M.Sc Home Science",
      "M.Sc Agriculture",
      "M.Sc Food Science and Technology",
      "M.Sc Nautical Science",
      "M.Sc Electronics",
      "M.Sc Data Science / Artificial Intelligence",
      "M.Sc Actuarial Science",
      "M.Sc Applied Mathematics",
      "M.Sc Bioinformatics",
      "M.Sc Nanoscience",
      "M.Sc Astrophysics",
      "M.Sc Oceanography",
      "M.Sc Geoinformatics",
      "M.Sc (IT) – Information Technology",
      "MCA (Master of Computer Applications)",
      "M.Sc Horticulture",
      "M.Sc Forestry",
      "Other M.Sc Specialization",
    ],
  },
  {
    degree: "Law (LLM)",
    specialization: [
      "LLM (Constitutional Law)",
      "LLM (Criminal Law)",
      "LLM (Corporate & Commercial Law)",
      "LLM (International Law)",
      "LLM (Human Rights Law)",
      "LLM (Intellectual Property Rights - IPR)",
      "LLM (Environmental Law)",
      "LLM (Labour & Industrial Law)",
      "LLM (Cyber Law & Data Privacy)",
      "LLM (Taxation Law)",
      "Other LLM Specialization",
    ],
  },
  {
    degree: "Architecture, Planning & Design (M.Arch / M.Des / M.Planning)",
    specialization: [
      "M.Arch (Urban Design)",
      "M.Arch (Landscape Architecture)",
      "M.Arch (Building Engineering & Management)",
      "M.Arch (Sustainable / Environmental Architecture)",
      "M.Planning (Urban Planning)",
      "M.Planning (Regional Planning)",
      "M.Planning (Environmental Planning)",
      "M.Planning (Transport Planning)",
      "M.Planning (Housing)",
      "M.Des (Industrial Design)",
      "M.Des (Communication / Graphic Design)",
      "M.Des (Fashion & Textile Design)",
      "M.Des (UX / UI & Interaction Design)",
      "Master of Interior Design",
      "Other Post Graduate Design / Architecture",
    ],
  },
  {
    degree: "Education & Physical Education (M.Ed / MPEd)",
    specialization: [
      "M.Ed (Master of Education)",
      "MPEd (Master of Physical Education)",
      "M.El.Ed (Master of Elementary Education)",
      "Other Postgraduate Education",
    ],
  },
  {
    degree: "Hospitality, Tourism & Aviation (MHM / MTTM)",
    specialization: [
      "MHM (Master of Hotel Management)",
      "M.Sc Hospitality Administration",
      "MTTM (Master of Tourism and Travel Management)",
      "MBA in Aviation Management",
      "Other Hospitality / Tourism",
    ],
  },
  {
    degree: "Mass Communication, Media & Film (MJMC / MA Media)",
    specialization: [
      "MJMC (Master of Journalism and Mass Communication)",
      "M.Sc Animation and Multimedia",
      "MA Visual Communication",
      "MA Film Making / Direction / Production",
      "Master of Advertising and Public Relations (MAPR)",
      "Other Media / Journalism",
    ],
  },
  {
    degree: "Vocational & Library Science",
    specialization: [
      "M.Voc (Master of Vocation)",
      "MLIS (Master of Library and Information Science)",
      "M.Sc Fashion Designing / Technology",
      "Master of Fisheries Science",
      "Other Post Graduate Degree",
    ],
  },
];

export const DIPLOMA_CATALOG: EducationStreamCategory[] = [
  {
    degree: "Engineering & Polytechnic Diplomas",
    specialization: [
      "Diploma in Computer Science & Engineering",
      "Diploma in Information Technology",
      "Diploma in Electronics & Communication",
      "Diploma in Electrical Engineering",
      "Diploma in Mechanical Engineering",
      "Diploma in Civil Engineering",
      "Diploma in Automobile Engineering",
      "Diploma in Chemical Engineering",
      "Diploma in Mining / Metallurgical Engineering",
      "Other Polytechnic Diploma",
    ],
  },
  {
    degree: "Paramedical & Allied Health Diplomas",
    specialization: [
      "Diploma in General Nursing & Midwifery (GNM)",
      "Diploma in Pharmacy (D.Pharm)",
      "Diploma in Medical Laboratory Technology (DMLT)",
      "Diploma in Radiography / X-Ray Technology",
      "Diploma in Operation Theatre Technology (DOTT)",
      "Diploma in Ophthalmic Technology",
      "Other Paramedical Diploma",
    ],
  },
  {
    degree: "Management, Design & Other Diplomas",
    specialization: [
      "Diploma in Digital Marketing",
      "Diploma in Graphic Design / UI-UX",
      "Diploma in Fashion Designing",
      "Diploma in Hotel Management",
      "Diploma in Business Administration",
      "Diploma in Financial Accounting",
      "Other Professional Diploma",
    ],
  },
];

export const DOCTORATE_CATALOG: EducationStreamCategory[] = [
  {
    degree: "Doctorate & Post-Doctoral Programs",
    specialization: [
      "Ph.D. in Engineering & Technology",
      "Ph.D. in Computer Science / Artificial Intelligence",
      "Ph.D. in Management / Business Administration",
      "Ph.D. in Commerce / Economics",
      "Ph.D. in Science (Physics / Chemistry / Math / Bio)",
      "Ph.D. in Arts & Humanities",
      "Ph.D. in Law",
      "Ph.D. in Medical & Health Sciences",
      "Post-Doctoral Fellowship (PDF)",
      "Other Doctorate / Ph.D.",
    ],
  },
];

import {
  SchoolBoardOption,
  StateBoardOption,
} from "../../../domain/localization/country-plugin.interface";
import {
  IN_SCHOOL_BOARDS,
  IN_STATE_BOARDS,
} from "../../../domain/localization/IN/education.config";
import { CountryRegistry } from "../../../domain/localization/country.registry";

export { SchoolBoardOption, StateBoardOption, IN_SCHOOL_BOARDS, IN_STATE_BOARDS };
export const SCHOOL_BOARD_OPTIONS = IN_SCHOOL_BOARDS;
export const INDIAN_STATE_BOARDS = IN_STATE_BOARDS;

/**
 * Returns structured catalog for the given qualification level along with country-specific school board options.
 */
export function getEducationCatalogForLevel(qualificationLevel?: string, countryCode?: string): {
  qualificationLevel: string;
  countryCode: string;
  degrees: EducationStreamCategory[];
  allSpecializations: string[];
  boardOptions: SchoolBoardOption[];
  stateBoards: StateBoardOption[];
} {
  const normalized = (qualificationLevel || "").toUpperCase().trim();
  const normalizedCountry = (countryCode || "IN").toUpperCase().trim();

  let degrees: EducationStreamCategory[];

  if (normalized === "UNDER_GRADUATE" || normalized === "GRADUATE" || normalized === "BACHELORS" || normalized === "UG") {
    degrees = UNDERGRADUATE_CATALOG;
  } else if (normalized === "POST_GRADUATE" || normalized === "MASTERS" || normalized === "PG") {
    degrees = POSTGRADUATE_CATALOG;
  } else if (normalized === "DIPLOMA") {
    degrees = DIPLOMA_CATALOG;
  } else if (normalized === "DOCTORATE" || normalized === "PHD") {
    degrees = DOCTORATE_CATALOG;
  } else {
    // Default: combine both UG and PG with group tags
    degrees = [
      ...UNDERGRADUATE_CATALOG,
      ...POSTGRADUATE_CATALOG,
    ];
  }

  const allSpecializations = degrees.flatMap((deg) => deg.specialization);

  // Dynamically resolve country plugin for school boards & state options
  let plugin;
  try {
    plugin = CountryRegistry.resolve(normalizedCountry);
  } catch {
    plugin = CountryRegistry.resolve("IN");
  }

  return {
    qualificationLevel: normalized || "ALL",
    countryCode: normalizedCountry,
    degrees,
    allSpecializations,
    boardOptions: plugin?.schoolBoards || IN_SCHOOL_BOARDS,
    stateBoards: plugin?.stateBoards || IN_STATE_BOARDS,
  };
}
