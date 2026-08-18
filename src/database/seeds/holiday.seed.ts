import mongoose from "mongoose";
import Holidays from "date-holidays";
import { HolidayScope, HolidayType } from "../../modules/leave/sub-modules/holidays/holiday.model";
import { normalizeStateCode } from "../../modules/leave/sub-modules/holidays/utils/state-code-mapper.util";
import { logger } from "../../config/logger.config";

/**
 * Seeds dynamic baseline country-level and state-level statutory holidays for a tenant.
 * Uses 'date-holidays' to fetch public holidays for the current year and the next year (2-year rolling window).
 * If a stateCode is provided, it seeds both country-wide and state-specific statutory holidays.
 */
export async function seedStatutoryNationalHolidays(
  tenantId: string,
  countryCode: string = "IN",
  stateCode?: string | null | undefined,
  createdBy: string = "system"
): Promise<void> {
  const cc = countryCode.toUpperCase();
  const tenantOId = new mongoose.Types.ObjectId(tenantId);
  const now = new Date();
  const currentYear = new Date().getUTCFullYear();
  const yearsToSeed = 2;

  // Normalize state code (e.g. "Karnataka" -> "KA", "Zurich" -> "ZH")
  const normalizedState = normalizeStateCode(stateCode, cc);

  try {
    // 1. Initialize date-holidays with optional state/canton code
    const hd = new Holidays();

    // Check if country is supported
    const countries = hd.getCountries();
    if (!countries[cc]) {
      logger.warn({
        message: "Country code not supported by date-holidays. Skipping statutory holiday seeding.",
        tenantId,
        countryCode: cc,
      });
      return;
    }

    // Try to initialize with state if provided, fall back to country-only
    try {
      if (normalizedState) {
        hd.init(cc, normalizedState.toLowerCase());
      } else {
        hd.init(cc);
      }
    } catch (e) {
      // Fallback if state code is not recognized by the library
      hd.init(cc);
    }

    const collection = mongoose.connection.collection("holidays");
    let inserted = 0;
    let skipped = 0;

    // 2. Loop through a 2-year rolling window
    for (let i = 0; i < yearsToSeed; i++) {
      const targetYear = currentYear + i;
      const yearHolidays = hd.getHolidays(targetYear);

      if (!yearHolidays) continue;

      for (const item of yearHolidays) {
        // Strictly filter for official statutory public holidays
        if (item.type !== "public") {
          continue;
        }

        // Normalize Date to UTC Midnight (Y-M-D) to eliminate timezone shifts
        const dateStr = typeof item.date === "string" ? item.date : new Date(item.date).toISOString();
        const dateParts = dateStr.split(" ")[0].split("T")[0].split("-");
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);

        const holidayDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

        // Determine if this is a state-specific holiday or national holiday.
        // In date-holidays, state-specific holidays returned when initialized with (country, state)
        // have an 'item.state' property set to the state code.
        const isStateHoliday = !!(item as any).state;
        const resolvedScope = isStateHoliday ? HolidayScope.STATE : HolidayScope.COUNTRY;
        const resolvedState = isStateHoliday ? normalizedState : null;

        const query = {
          tenantId: tenantOId,
          scope: resolvedScope,
          countryCode: cc,
          stateCode: resolvedState,
          date: holidayDate,
          isDeleted: false,
        };

        const doc = {
          tenantId: tenantOId,
          name: item.name,
          date: holidayDate,
          type: HolidayType.NATIONAL,
          scope: resolvedScope,
          isOptional: false,
          description: isStateHoliday
            ? `Statutory State Holiday for ${cc}-${normalizedState}`
            : `Statutory National Holiday for ${cc}`,
          branchId: null,
          countryCode: cc,
          stateCode: resolvedState,
          createdBy,
          updatedBy: createdBy,
          isDeleted: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };

        // Idempotent upsert via MongoDB updateOne with $setOnInsert
        const result = await collection.updateOne(
          query,
          { $setOnInsert: doc },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          inserted++;
        } else {
          skipped++;
        }
      }
    }

    logger.info({
      message: "Seeded statutory holidays using date-holidays",
      tenantId,
      countryCode: cc,
      stateCode: normalizedState,
      yearsSeeded: yearsToSeed,
      inserted,
      skipped,
    });

  } catch (error: any) {
    logger.error({
      message: "Seeding statutory holidays failed",
      tenantId,
      error: error.message,
    });
    throw error;
  }
}
