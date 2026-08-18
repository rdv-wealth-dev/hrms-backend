import { ratesConfig } from "./rates.config";

export function calculatePF(
  wagesForStatutory: number,
  pfEnabled: boolean,
  pfOnActuals: boolean = false
) {
  const zero = {
    employee: 0, employerEPF: 0, employerEPS: 0,
    adminCharge: 0, edliCharge: 0, totalEmployer: 0,
  };

  if (!pfEnabled || wagesForStatutory <= 0) return zero;

  const { pf } = ratesConfig;
  const pfBase = pfOnActuals ? wagesForStatutory : Math.min(wagesForStatutory, pf.wageCeiling);

  const employee = Math.round(pfBase * pf.employeeRate);
  const employerEPS = Math.min(Math.round(pfBase * pf.employerEpsRate), pf.epsCap);
  const employerEPF = employee - employerEPS;

  const adminCharge = Math.round(pfBase * pf.adminRate);
  const edliCharge = Math.round(Math.min(pfBase, pf.wageCeiling) * pf.edliRate);
  const totalEmployer = employerEPF + employerEPS + adminCharge + edliCharge;

  return { employee, employerEPF, employerEPS, adminCharge, edliCharge, totalEmployer };
}

export function calculateESI(
  grossMonthly: number,
  esiEnabled: boolean,
  bypassCeiling: boolean = false
) {
  const { esi } = ratesConfig;
  if (!esiEnabled || grossMonthly <= 0 || (!bypassCeiling && grossMonthly > esi.wageCeiling)) {
    return { employee: 0, employer: 0 };
  }
  return {
    employee: Math.round(grossMonthly * esi.employeeRate),
    employer: Math.round(grossMonthly * esi.employerRate),
  };
}
