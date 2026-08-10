import { PayrollStrategyFactory } from "./payroll-strategy.factory";
import { IndiaPayrollStrategy } from "./countries/india.strategy";
import { UnitedStatesPayrollStrategy } from "./countries/united-states.strategy";
import { UnitedKingdomPayrollStrategy } from "./countries/united-kingdom.strategy";
import { UnitedArabEmiratesPayrollStrategy } from "./countries/united-arab-emirates.strategy";

// Auto-register all global country strategies
export function registerAllPayrollStrategies(): void {
  PayrollStrategyFactory.register(new IndiaPayrollStrategy());
  PayrollStrategyFactory.register(new UnitedStatesPayrollStrategy());
  PayrollStrategyFactory.register(new UnitedKingdomPayrollStrategy());
  PayrollStrategyFactory.register(new UnitedArabEmiratesPayrollStrategy());
}

// Immediate registration on module import
registerAllPayrollStrategies();

export * from "./country-payroll.interface";
export * from "./payroll-strategy.factory";
export * from "./countries/india.strategy";
export * from "./countries/united-states.strategy";
export * from "./countries/united-kingdom.strategy";
export * from "./countries/united-arab-emirates.strategy";
