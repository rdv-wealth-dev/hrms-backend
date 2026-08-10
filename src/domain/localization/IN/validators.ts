// Indian Localization Statutory Validators (PAN, Aadhaar, Passport)

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

// ── PAN VALIDATION 

export function validatePAN(pan: string): boolean {
  if (!pan || typeof pan !== "string") return false;
  const cleanPan = pan.trim().toUpperCase();
  const panRegex = /^[A-Z]{3}[PCHFATBLJGE][A-Z][0-9]{4}[A-Z]$/;
  return panRegex.test(cleanPan);
}

export function maskPAN(pan: string): string {
  if (!pan || pan.length < 4) return pan;
  const clean = pan.trim().toUpperCase();
  return clean.substring(0, 4) + "****" + clean.substring(clean.length - 1);
}

// ── AADHAAR VALIDATION 

/**
 * Validates 12-digit Indian Aadhaar number:
 * - Exactly 12 numeric digits
 * - Starts with 2-9 (never 0 or 1)
 */
export function validateAadhaar(aadhaar: string): boolean {
  if (!aadhaar || typeof aadhaar !== "string") return false;
  const clean = aadhaar.replace(/[\s-]/g, "").trim();
  return /^[2-9]\d{11}$/.test(clean);
}

export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar) return aadhaar;
  const clean = aadhaar.replace(/[\s-]/g, "").trim();
  if (clean.length < 4) return clean;
  return `**** **** ${clean.slice(-4)}`;
}

export function formatAadhaar(aadhaar: string): string {
  if (!aadhaar) return aadhaar;
  const clean = aadhaar.replace(/[\s-]/g, "").trim();
  if (clean.length === 12) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
  }
  return aadhaar;
}

// ── PASSPORT VALIDATION 

/**
 * Validates Indian Passport number:
 * - Exactly 8 alphanumeric characters
 * - 1 uppercase letter followed by 7 numeric digits (e.g. Z1234567)
 */
export function validatePassport(passport: string): boolean {
  if (!passport || typeof passport !== "string") return false;
  const clean = passport.trim().toUpperCase();
  return /^[A-Z][0-9]{7}$/.test(clean);
}

export function maskPassport(passport: string): string {
  if (!passport) return passport;
  const clean = passport.trim().toUpperCase();
  if (clean.length < 4) return clean;
  return `${clean.charAt(0)}****${clean.slice(-3)}`;
}
