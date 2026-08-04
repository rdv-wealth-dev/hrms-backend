import { CountryPlugin } from "../../core/plugins/country-plugin.interface";

export const USAPlugin: CountryPlugin = {
  countryCode: "US",
  statutoryFields: [
    {
      key: "SSN",
      label: "Social Security Number",
      required: true,
      validate: (val) => /^\d{3}-\d{2}-\d{4}$/.test(val) || "SSN must be in format XXX-XX-XXXX",
      mask: (val) => `XXX-XX-${val.slice(-4)}`,
    }
  ]
};
export const USAModule = USAPlugin;
