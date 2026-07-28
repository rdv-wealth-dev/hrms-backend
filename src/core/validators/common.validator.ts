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

// Indian PAN
export const panSchema = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format")
  .toUpperCase();

// Indian Aadhaar
export const aadhaarSchema = z
  .string()
  .regex(/^\d{12}$/, "Aadhaar must be 12 digits");

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