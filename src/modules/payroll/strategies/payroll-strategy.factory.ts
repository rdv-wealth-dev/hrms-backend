import { ICountryPayrollStrategy } from "./country-payroll.interface";
import { AppError } from "../../../shared/errors/app.error";

export class PayrollStrategyFactory {
  private static strategies = new Map<string, ICountryPayrollStrategy>();

  static register(strategy: ICountryPayrollStrategy): void {
    PayrollStrategyFactory.strategies.set(strategy.countryCode.toUpperCase(), strategy);
  }

  static getStrategy(countryCode: string = "IN"): ICountryPayrollStrategy {
    const code = (countryCode || "IN").toUpperCase();
    const strategy = PayrollStrategyFactory.strategies.get(code);

    if (!strategy) {
      // Graceful fallback to India strategy or throw descriptive exception
      const fallback = PayrollStrategyFactory.strategies.get("IN");
      if (fallback) return fallback;
      throw new AppError(
        `Payroll strategy for country "${countryCode}" is not registered in the system.`,
        500
      );
    }

    return strategy;
  }

  static isCountrySupported(countryCode: string): boolean {
    return PayrollStrategyFactory.strategies.has((countryCode || "").toUpperCase());
  }

  static getRegisteredCountries(): string[] {
    return Array.from(PayrollStrategyFactory.strategies.keys());
  }
}
