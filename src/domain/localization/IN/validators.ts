// Indian Localization Statutory Validators & Document Format Registry
// File: src/domain/localization/IN/validators.ts

export const PAN_STATUS_MAP: Record<string, string> = {
  P: "Individual (Person)",
  C: "Company",
  H: "Hindu Undivided Family (HUF)",
  F: "Firm / Limited Liability Partnership",
  A: "Association of Persons (AOP)",
  T: "Trust",
  B: "Body of Individuals (BOI)",
  L: "Local Authority",
  J: "Artificial Juridical Person",
  G: "Government Agency",
  E: "Limited Liability Partnership",
};

// ── DOCUMENT REGISTRY SPECIFICATION ────────────────────────────────────────

export interface DocumentValidationRule {
  key: string;
  name: string;
  authority: string;
  length: number;
  pattern: RegExp;
  sample: string;
  description: string;
  validate: (val: string) => boolean;
  mask: (val: string) => string;
  format: (val: string) => string;
}

// ── 1. PAN SPECIFICATION (10 Chars: AAAAA9999A) ─────────────────────────────
const panRule: DocumentValidationRule = {
  key: "pan",
  name: "Permanent Account Number (PAN)",
  authority: "Income Tax Department (ITD)",
  length: 10,
  pattern: /^[A-Z]{3}[PCHFATBLJGE][A-Z][0-9]{4}[A-Z]$/,
  sample: "ABCPS1234D",
  description: "10 alphanumeric characters: 3 letters + 1 status char + 1 surname char + 4 digits + 1 check digit",
  validate: (pan: string): boolean => {
    if (!pan || typeof pan !== "string") return false;
    const clean = pan.trim().toUpperCase();
    return /^[A-Z]{3}[PCHFATBLJGE][A-Z][0-9]{4}[A-Z]$/.test(clean);
  },
  mask: (pan: string): string => {
    if (!pan) return pan;
    const clean = pan.trim().toUpperCase();
    if (clean.length < 4) return clean;
    return `${clean.substring(0, 4)}****${clean.substring(clean.length - 1)}`;
  },
  format: (pan: string): string => {
    return pan ? pan.trim().toUpperCase() : "";
  },
};

// ── 2. AADHAAR SPECIFICATION (12 Digits: 2-9 Start) ─────────────────────────
const aadhaarRule: DocumentValidationRule = {
  key: "aadhaar",
  name: "UIDAI Aadhaar Number",
  authority: "Unique Identification Authority of India (UIDAI)",
  length: 12,
  pattern: /^[2-9]\d{11}$/,
  sample: "9876 5432 1098",
  description: "12 numeric digits: Starts with 2-9, formatted in 4-4-4 spaced blocks",
  validate: (aadhaar: string): boolean => {
    if (!aadhaar || typeof aadhaar !== "string") return false;
    const clean = aadhaar.replace(/[\s-]/g, "").trim();
    return /^[2-9]\d{11}$/.test(clean);
  },
  mask: (aadhaar: string): string => {
    if (!aadhaar) return aadhaar;
    const clean = aadhaar.replace(/[\s-]/g, "").trim();
    if (clean.length < 4) return clean;
    return `**** **** ${clean.slice(-4)}`;
  },
  format: (aadhaar: string): string => {
    if (!aadhaar) return aadhaar;
    const clean = aadhaar.replace(/[\s-]/g, "").trim();
    if (clean.length === 12) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
    }
    return aadhaar;
  },
};

// ── 3. PASSPORT SPECIFICATION (8 Chars: 1 Letter + 7 Digits) ────────────────
const passportRule: DocumentValidationRule = {
  key: "passport",
  name: "Indian Passport",
  authority: "Ministry of External Affairs (MEA)",
  length: 8,
  pattern: /^[A-Z][0-9]{7}$/,
  sample: "Z1234567",
  description: "8 alphanumeric characters: 1 uppercase letter followed by 7 numeric digits",
  validate: (passport: string): boolean => {
    if (!passport || typeof passport !== "string") return false;
    const clean = passport.trim().toUpperCase();
    return /^[A-Z][0-9]{7}$/.test(clean);
  },
  mask: (passport: string): string => {
    if (!passport) return passport;
    const clean = passport.trim().toUpperCase();
    if (clean.length < 4) return clean;
    return `${clean.charAt(0)}****${clean.slice(-3)}`;
  },
  format: (passport: string): string => {
    return passport ? passport.trim().toUpperCase() : "";
  },
};

// ── 4. DRIVING LICENSE SPECIFICATION (15 Chars: SS-RR-YYYYNNNNNNN) ───────────
const drivingLicenseRule: DocumentValidationRule = {
  key: "drivingLicense",
  name: "Indian Driving License (DL)",
  authority: "Ministry of Road Transport & Highways (Parivahan)",
  length: 15,
  pattern: /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/,
  sample: "MH-02-20180001234",
  description: "15 alphanumeric characters: State (2 letters) + RTO (2 digits) + Year (4 digits) + Serial (7 digits)",
  validate: (dl: string): boolean => {
    if (!dl || typeof dl !== "string") return false;
    const clean = dl.replace(/[\s-]/g, "").trim().toUpperCase();
    return /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/.test(clean);
  },
  mask: (dl: string): string => {
    if (!dl) return dl;
    const clean = dl.replace(/[\s-]/g, "").trim().toUpperCase();
    if (clean.length < 8) return clean;
    return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
  },
  format: (dl: string): string => {
    if (!dl) return dl;
    const clean = dl.replace(/[\s-]/g, "").trim().toUpperCase();
    if (clean.length === 15) {
      return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 8)}${clean.slice(8, 15)}`;
    }
    return dl;
  },
};

// ── 5. VOTER ID (EPIC) SPECIFICATION (10 Chars: AAA1234567) ─────────────────
const voterIdRule: DocumentValidationRule = {
  key: "voterId",
  name: "Electors Photo Identity Card (Voter ID / EPIC)",
  authority: "Election Commission of India (ECI)",
  length: 10,
  pattern: /^[A-Z]{3}[0-9]{7}$/,
  sample: "ABC1234567",
  description: "10 alphanumeric characters: 3 uppercase letters (Constituency Code) + 7 numeric digits",
  validate: (voterId: string): boolean => {
    if (!voterId || typeof voterId !== "string") return false;
    const clean = voterId.replace(/[\s-]/g, "").trim().toUpperCase();
    return /^[A-Z]{3}[0-9]{7}$/.test(clean);
  },
  mask: (voterId: string): string => {
    if (!voterId) return voterId;
    const clean = voterId.replace(/[\s-]/g, "").trim().toUpperCase();
    if (clean.length < 6) return clean;
    return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
  },
  format: (voterId: string): string => {
    return voterId ? voterId.replace(/[\s-]/g, "").trim().toUpperCase() : "";
  },
};

// ── MASTER CENTRALIZED DOCUMENT REGISTRY ────────────────────────────────────

export const INDIAN_DOCUMENT_REGISTRY: Record<string, DocumentValidationRule> = {
  pan: panRule,
  aadhaar: aadhaarRule,
  passport: passportRule,
  drivingLicense: drivingLicenseRule,
  voterId: voterIdRule,
};

// ── DYNAMIC DOCUMENT ENGINE UTILITIES ──────────────────────────────────────

/**
 * Validates any Indian statutory document dynamically by key.
 */
export function validateDocument(key: string, value: string): boolean {
  const rule = INDIAN_DOCUMENT_REGISTRY[key];
  return rule ? rule.validate(value) : false;
}

/**
 * Masks any Indian statutory document dynamically by key.
 */
export function maskDocument(key: string, value: string): string {
  const rule = INDIAN_DOCUMENT_REGISTRY[key];
  return rule ? rule.mask(value) : value;
}

/**
 * Formats any Indian statutory document dynamically by key.
 */
export function formatDocument(key: string, value: string): string {
  const rule = INDIAN_DOCUMENT_REGISTRY[key];
  return rule ? rule.format(value) : value;
}

/**
 * Retrieves the complete validation metadata rule for a document type.
 */
export function getDocumentRule(key: string): DocumentValidationRule | undefined {
  return INDIAN_DOCUMENT_REGISTRY[key];
}

// ── DIRECT EXPORTS (Convenience Wrappers) ───────────────────────────────────

export const validatePAN = panRule.validate;
export const maskPAN = panRule.mask;
export const formatPAN = panRule.format;

export const validateAadhaar = aadhaarRule.validate;
export const maskAadhaar = aadhaarRule.mask;
export const formatAadhaar = aadhaarRule.format;

export const validatePassport = passportRule.validate;
export const maskPassport = passportRule.mask;
export const formatPassport = passportRule.format;

export const validateDrivingLicense = drivingLicenseRule.validate;
export const maskDrivingLicense = drivingLicenseRule.mask;
export const formatDrivingLicense = drivingLicenseRule.format;

export const validateVoterId = voterIdRule.validate;
export const maskVoterId = voterIdRule.mask;
export const formatVoterId = voterIdRule.format;
