import { StatutoryFieldConfig } from "../country-plugin.interface";
import { INDIAN_DOCUMENT_REGISTRY } from "./validators";

// Dynamically generate statutoryFields from the central INDIAN_DOCUMENT_REGISTRY
export const statutoryFields: StatutoryFieldConfig[] = Object.values(INDIAN_DOCUMENT_REGISTRY).map((doc) => ({
  key: doc.key,
  label: doc.name,
  required: false,
  validate: (val: string): boolean | string => {
    return doc.validate(val) ? true : `Invalid ${doc.name} format (e.g. ${doc.sample})`;
  },
  mask: (val: string): string => doc.mask(val),
}));
