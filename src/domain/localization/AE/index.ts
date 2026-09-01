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
  ],
  schoolBoards: [
    { code: "MOE_UAE", name: "Ministry of Education UAE (MoE)", description: "UAE National Curriculum" },
    { code: "KHDA_DUBAI", name: "KHDA Approved Curriculum (Dubai)", description: "Knowledge and Human Development Authority" },
    { code: "ADEK_ABU_DHABI", name: "ADEK Approved Curriculum (Abu Dhabi)", description: "Abu Dhabi Department of Education and Knowledge" },
    { code: "CBSE_GULF", name: "CBSE (Gulf Sahodaya)", description: "Indian CBSE Curriculum in UAE" },
    { code: "BRITISH_CAIE_UAE", name: "British Curriculum (GCSE / A-Levels)", description: "Cambridge & Edexcel UK in UAE" },
    { code: "IB_UAE", name: "International Baccalaureate (IB)", description: "IB World School in UAE" },
    { code: "AMERICAN_CURRICULUM", name: "American High School Diploma (AdvancED/Cognia)", description: "US Curriculum in UAE" },
    { code: "OTHER", name: "Other", description: "Other Approved International Curriculum" },
  ],
};
export const UAEModule = UAEPlugin;
