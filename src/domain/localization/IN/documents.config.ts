import { StatutoryFieldConfig } from "../country-plugin.interface";
import { validatePAN, validateAadhaar, maskPAN, maskAadhaar } from "./validators";

export const statutoryFields: StatutoryFieldConfig[] = [
  {
    key: "pan",
    label: "PAN",
    required: false,
    validate: (val) => validatePAN(val) || "Invalid PAN format",
    mask: maskPAN,
  },
  {
    key: "aadhaar",
    label: "Aadhaar",
    required: false,
    validate: (val) => validateAadhaar(val) || "Aadhaar must be 12 digits",
    mask: maskAadhaar,
  },
];
