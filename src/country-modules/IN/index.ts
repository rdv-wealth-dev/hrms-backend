import { CountryModule } from "../../shared/country-registry/countryModule.interface";
import { statutoryFields } from "./statutoryFields";
import { calculatePF, calculateESI } from "./payrollRules";

export const IndiaModule: CountryModule = {
  countryCode: "IN",
  statutoryFields,
  calculatePF,
  calculateESI,
};
export * from "./validators";
