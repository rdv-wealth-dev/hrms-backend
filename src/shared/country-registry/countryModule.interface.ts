export interface StatutoryFieldConfig {
  key: string;
  label: string;
  required: boolean;
  validate: (value: string) => boolean | string;
  mask: (value: string) => string;
}

export interface CountryModule {
  countryCode: string;
  statutoryFields: StatutoryFieldConfig[];
  calculatePF?: (wages: number, pfEnabled: boolean) => {
    employee: number;
    employerEPF: number;
    employerEPS: number;
    adminCharge: number;
    edliCharge: number;
    totalEmployer: number;
  };
  calculateESI?: (wages: number, esiEnabled: boolean) => {
    employee: number;
    employer: number;
  };
}
