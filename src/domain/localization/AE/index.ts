import { CountryPlugin } from "../country-plugin.interface";

export const UAEPlugin: CountryPlugin = {
  countryCode: "AE",
  statutoryFields: [
    {
      key: "EMIRATES_ID",
      label: "Emirates ID",
      required: true,
      validate: (val) => /^\d{3}-\d{4}-\d{7}-\d{1}$/.test(val) || "Emirates ID must be in format 784-XXXX-XXXXXXX-X",
      mask: (val) => `784-XXXX-${val.split("-")[2] || "XXXXXXX"}-X`,
    }
  ]
};
export const UAEModule = UAEPlugin;
