const PF_EMPLOYEE_RATE     = 0.12;
const PF_EMPLOYER_EPF_RATE = 0.0367;
const PF_EPS_RATE          = 0.0833;
const PF_ADMIN_RATE        = 0.005;
const PF_EDLI_RATE         = 0.005;
const PF_WAGE_CEILING      = 15000;
const EPS_CAP              = 1250;

const ESI_EMPLOYEE_RATE = 0.0075;
const ESI_EMPLOYER_RATE = 0.0325;
const ESI_WAGE_CEILING  = 21000;

export function calculatePF(
  wagesForStatutory: number,
  pfEnabled:         boolean
) {
  const zero = {
    employee: 0, employerEPF: 0, employerEPS: 0,
    adminCharge: 0, edliCharge: 0, totalEmployer: 0,
  };

  if (!pfEnabled || wagesForStatutory <= 0) return zero;

  const pfBase      = Math.min(wagesForStatutory, PF_WAGE_CEILING);
  const employee    = Math.round(pfBase * PF_EMPLOYEE_RATE);
  const employerEPF = Math.round(pfBase * PF_EMPLOYER_EPF_RATE);
  const employerEPS = Math.min(Math.round(pfBase * PF_EPS_RATE), EPS_CAP);
  const adminCharge = Math.round(pfBase * PF_ADMIN_RATE);
  const edliCharge  = Math.round(pfBase * PF_EDLI_RATE);
  const totalEmployer = employerEPF + employerEPS + adminCharge + edliCharge;

  return { employee, employerEPF, employerEPS, adminCharge, edliCharge, totalEmployer };
}

export function calculateESI(
  grossMonthly: number,
  esiEnabled:   boolean
) {
  if (!esiEnabled || grossMonthly <= 0 || grossMonthly > ESI_WAGE_CEILING) {
    return { employee: 0, employer: 0 };
  }
  return {
    employee: Math.round(grossMonthly * ESI_EMPLOYEE_RATE),
    employer: Math.round(grossMonthly * ESI_EMPLOYER_RATE),
  };
}
