import { CountryPlugin } from "../country-plugin.interface";
import { statutoryFields } from "./documents.config";
import { calculatePF, calculateESI } from "./payrollRules";
import { IN_SCHOOL_BOARDS, IN_STATE_BOARDS } from "./education.config";

export const IndiaPlugin: CountryPlugin = {
  countryCode: "IN",
  statutoryFields,
  schoolBoards: IN_SCHOOL_BOARDS,
  stateBoards: IN_STATE_BOARDS,
  calculatePF,
  calculateESI,
};

export const IndiaModule = IndiaPlugin;

export * from "./validators";
export * from "./rates.config";
export * from "./documents.config";
export * from "./payrollRules";
export * from "./education.config";

