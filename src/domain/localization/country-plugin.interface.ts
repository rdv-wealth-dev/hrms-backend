export interface StatutoryFieldConfig {
  key: string;
  label: string;
  required: boolean;
  validate: (value: string) => boolean | string;
  mask: (value: string) => string;
}

export interface SchoolBoardOption {
  code: string;
  name: string;
  requiresStateSelection?: boolean;
  description?: string;
}

export interface StateBoardOption {
  state: string;
  boardName: string;
  boardCode: string;
}

export interface CountryPlugin {
  countryCode: string;
  statutoryFields: StatutoryFieldConfig[];
  schoolBoards?: SchoolBoardOption[];
  stateBoards?: StateBoardOption[];
  calculatePF?: (wages: number, pfEnabled: boolean, pfOnActuals?: boolean) => {
    employee: number;
    employerEPF: number;
    employerEPS: number;
    adminCharge: number;
    edliCharge: number;
    totalEmployer: number;
  };
  calculateESI?: (wages: number, esiEnabled: boolean, bypassCeiling?: boolean) => {
    employee: number;
    employer: number;
  };
}
