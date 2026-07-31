import { CountryModule } from "../../shared/country-registry/countryModule.interface";
import { statutoryFields } from "./documents.config";
import { calculatePF, calculateESI } from "./payrollRules";

export const IndiaModule: CountryModule = {
  countryCode: "IN",
  statutoryFields,
  calculatePF,
  calculateESI,
};
export * from "./validators";
export * from "./rates.config";
export * from "./documents.config";
export * from "./payrollRules";
