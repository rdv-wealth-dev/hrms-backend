import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

//MongoDB ObjectId
export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid ID format");

//Pagination
export const paginationSchema = z.object({
  pageNumber: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().min(1, "Page number must be at least 1")),

  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(
      z.number()
        .min(1, "Page size must be at least 1")
        .max(100, "Page size cannot exceed 100")   // LPDOS guard
    ),
});

//ID param
export const idParamSchema = z.object({
  id: objectIdSchema,
});

// Phone number — subscriber portion only (no country code prefix)
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone is required")
  .regex(/^\d+$/, "Phone must contain only digits");

// Validate phone against country code using libphonenumber-js
// Requires countryCode when phone is provided
export function withPhoneValidation<T extends z.ZodObject<any>>(schema: T) {
  return schema.refine(
    (data: any) => {
      if (!data.phone) return true;
      if (!data.countryCode) return false;
      return isValidPhoneNumber(data.phone, data.countryCode);
    },
    { message: "Invalid phone number for the selected country", path: ["phone"] }
  );
}

const BLOCKED_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "live.com", "icloud.com", "me.com", "aol.com",
  "protonmail.com", "zoho.com", "ymail.com",
  "rediffmail.com", "inbox.com", "mail.com",
]);

// Email 
export const emailSchema = z
  .string()
  .email("Invalid email address")
  .toLowerCase()
  .trim()
  .refine(
    (email) => {
      const domain = email.split("@")[1];
      return !BLOCKED_EMAIL_DOMAINS.has(domain);
    },
    "Please use your work email address. Personal email providers are not allowed."
  );

// Unrestricted email — for internal use (employee invite, etc.)
export const anyEmailSchema = z
  .string()
  .email("Invalid email address")
  .toLowerCase()
  .trim();

//Password 
// Min 8 chars · at least one uppercase · one lowercase · one number · one special char
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// Date string
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

// Optional Date string: normalizes empty string "", whitespace, or null to undefined
export const optionalDateSchema = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    if (typeof val === "string" && val.trim() === "") return undefined;
    return val;
  },
  dateSchema.optional()
);

// Indian PAN (Permanent Account Number - AAAAA9999A)
// Characters 1-3 : Random alphabetic series from AAA to ZZZ ([A-Z]{3})
// Character 4    : Status of PAN holder ([PCHFATBLJGE]: P=Individual, C=Company, H=HUF, F=Firm, A=AOP, T=Trust, B=BOI, L=Local Authority, J=Artificial Juridical Person, G=Govt)
// Character 5    : First letter of cardholder's surname/last name or entity name ([A-Z])
// Characters 6-9 : Sequential numeric series from 0001 to 9999 ([0-9]{4})
// Character 10   : Alphabetic check digit ([A-Z])
export const panRegex = /^[A-Z]{3}[PCHFATBLJGE][A-Z][0-9]{4}[A-Z]$/;
export const individualPanRegex = /^[A-Z]{3}[P][A-Z][0-9]{4}[A-Z]$/;

export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    panRegex,
    "Invalid PAN format. Must be 10 characters (AAAAA9999A) with valid taxpayer status code (P, C, H, F, A, T, B, L, J, G) as 4th character."
  );

export const individualPanSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    individualPanRegex,
    "Invalid Individual PAN format. 4th character must be 'P' for Individual employees."
  );

// Indian Aadhaar (UIDAI 12-digit number, starts with 2-9)
export const aadhaarRegex = /^[2-9]\d{11}$/;

export const aadhaarSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[\s-]/g, ""))
  .refine(
    (val) => aadhaarRegex.test(val),
    "Invalid Aadhaar format: Must be exactly 12 numeric digits and cannot start with 0 or 1."
  );

// Indian Passport (8 characters: 1 uppercase letter + 7 numeric digits e.g. Z1234567)
export const passportRegex = /^[A-Z][0-9]{7}$/;

export const passportSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    passportRegex,
    "Invalid Indian Passport format. Must be exactly 8 characters: 1 capital letter followed by 7 numeric digits (e.g. Z1234567)."
  );

// Indian Driving License (15 alphanumeric characters: SS-RR-YYYYNNNNNNN e.g. MH0220180001234)
export const drivingLicenseRegex = /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/;

export const drivingLicenseSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((val) => val.replace(/[\s-]/g, ""))
  .refine(
    (val) => drivingLicenseRegex.test(val),
    "Invalid Indian Driving License format. Must be 15 characters: State (2 letters) + RTO (2 digits) + Year (4 digits) + Serial (7 digits) e.g. MH-02-20180001234."
  );

// Indian Voter ID / EPIC (10 alphanumeric characters: AAA1234567 e.g. ABC1234567)
export const voterIdRegex = /^[A-Z]{3}[0-9]{7}$/;

export const voterIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((val) => val.replace(/[\s-]/g, ""))
  .refine(
    (val) => voterIdRegex.test(val),
    "Invalid Indian Voter ID (EPIC) format. Must be 10 alphanumeric characters: 3 letters followed by 7 numeric digits (e.g. ABC1234567)."
  );

// Indian GSTIN
export const gstinSchema = z
  .string()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    "Invalid GSTIN format"
  )
  .toUpperCase();

// Indian IFSC
export const ifscSchema = z
  .string()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code")
  .toUpperCase();

// Indian PIN code
export const pinCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "PIN code must be 6 digits");

// Safe string — prevents NoSQL injection + XSS
// Strips MongoDB operators and script tags from string inputs
export const safeStringSchema = (
  min = 1,
  max = 200
) =>
  z
    .string()
    .min(min, `Must be at least ${min} character`)
    .max(max, `Must not exceed ${max} characters`)
    .trim()
    .refine(
      (val) => !val.includes("$") && !val.includes("{"),
      "Invalid characters detected"   // blocks $where, $gt etc.
    );

// URL
export const urlSchema = z
  .string()
  .url("Invalid URL format")
  .optional();

//Country code
export const countryCodeSchema = z
  .string()
  .length(2, "Country code must be 2 characters")
  .toUpperCase();

// Currency code
export const currencyCodeSchema = z
  .string()
  .length(3, "Currency code must be 3 characters")
  .toUpperCase();

// Address schema — reused across org, branch, employee
export const addressSchema = z.object({
  addressLine1: safeStringSchema(1, 200).optional(),
  addressLine2: safeStringSchema(1, 200).optional(),
  landmark: safeStringSchema(1, 100).optional(),
  city: safeStringSchema(1, 100).optional(),
  state: safeStringSchema(1, 100).optional(),
  countryCode: countryCodeSchema.optional(),
  zip: pinCodeSchema.optional(),
});

// Workspace slug — subdomain safe
export const workspaceSlugSchema = z
  .string()
  .min(3, "Workspace URL must be at least 3 characters")
  .max(63, "Workspace URL cannot exceed 63 characters")
  .toLowerCase()
  .trim()
  .regex(
    /^[a-z0-9]+$/,
    "Workspace URL can only contain lowercase letters and numbers"
  )
  .refine(
    (slug) => !RESERVED_SLUGS.has(slug),
    "This workspace name is reserved. Please choose another."
  );

// Reserved slugs — no company can claim these
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "www", "mail", "smtp", "ftp",
  "support", "help", "billing", "status", "staging",
  "dev", "test", "demo", "sandbox", "localhost",
  "login", "signup", "register", "auth", "oauth",
  "static", "assets", "cdn", "media", "uploads",
  "health", "ping", "metrics", "monitor",
]);

// Type exports — use in services + repositories
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type AddressInput = z.infer<typeof addressSchema>;