import { CountryPlugin } from "../country-plugin.interface";

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
  ],
  schoolBoards: [
    { code: "US_HIGH_SCHOOL", name: "US High School Diploma", description: "Standard US High School Diploma" },
    { code: "GED", name: "GED (General Educational Development)", description: "High School Equivalency" },
    { code: "AP_PROGRAM", name: "Advanced Placement (AP) Honors", description: "College Board AP Program" },
    { code: "IB", name: "International Baccalaureate (IB)", description: "IB Diploma Programme" },
    { code: "STATE_BOARD", name: "State Department of Education", requiresStateSelection: true, description: "Select State District" },
    { code: "OTHER", name: "Other", description: "Other Accredited US/International Board" },
  ],
  stateBoards: [
    { state: "California", boardName: "California Department of Education", boardCode: "CA_DOE" },
    { state: "New York", boardName: "New York State Education Department (NYSED)", boardCode: "NY_SED" },
    { state: "Texas", boardName: "Texas Education Agency (TEA)", boardCode: "TX_TEA" },
    { state: "Florida", boardName: "Florida Department of Education (FLDOE)", boardCode: "FL_DOE" },
    { state: "Illinois", boardName: "Illinois State Board of Education (ISBE)", boardCode: "IL_ISBE" },
    { state: "Other US State", boardName: "Other US State Board", boardCode: "OTHER_US_STATE" },
  ],
};
export const USAModule = USAPlugin;
