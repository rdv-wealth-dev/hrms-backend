import { CountryPlugin } from "../../core/plugins/country-plugin.interface";
import { statutoryFields } from "./documents.config";
import { calculatePF, calculateESI } from "./payrollRules";

export const IndiaPlugin: CountryPlugin = {
  countryCode: "IN",
  statutoryFields,
  calculatePF,
  calculateESI,
};

export const IndiaModule = IndiaPlugin;

export * from "./validators";
export * from "./rates.config";
export * from "./documents.config";
export * from "./payrollRules";

