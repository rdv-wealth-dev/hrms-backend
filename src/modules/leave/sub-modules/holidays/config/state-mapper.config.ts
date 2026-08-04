// src/modules/leave/holidays/config/state-mapper.config.ts

export const STATE_CODE_DICTIONARY: Record<string, Record<string, string>> = {
  IN: {
    // Standard ISO Codes and colloquial name mappings for India
    "KA": "KA",
    "KARNATAKA": "KA",
    "MH": "MH",
    "MAHARASHTRA": "MH",
    "DL": "DL",
    "DELHI": "DL",
    "NATIONAL CAPITAL TERRITORY OF DELHI": "DL",
    "NCT OF DELHI": "DL",
    "TN": "TN",
    "TAMIL NADU": "TN",
    "TAMILNADU": "TN",
    "TG": "TG",
    "TS": "TG", // Handles both legacy "TS" and standard "TG" (Telangana)
    "TELANGANA": "TG",
    "GJ": "GJ",
    "GUJARAT": "GJ",
    "UP": "UP",
    "UTTAR PRADESH": "UP",
    "WB": "WB",
    "WEST BENGAL": "WB",
  },
  US: {
    // Standard ISO Codes and colloquial name mappings for United States
    "CA": "CA",
    "CALIFORNIA": "CA",
    "NY": "NY",
    "NEW YORK": "NY",
    "TX": "TX",
    "TEXAS": "TX",
    "DC": "DC",
    "WASHINGTON DC": "DC",
    "WASHINGTON D.C.": "DC",
    "DISTRICT OF COLUMBIA": "DC",
  },
};
