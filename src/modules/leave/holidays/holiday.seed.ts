import mongoose from "mongoose";
import Holidays from "date-holidays";
import { HolidayScope, HolidayType } from "./holiday.model";
import { logger } from "../../../config/logger";

/**
 * Seeds dynamic baseline country-level statutory holidays for a tenant.
 * Uses 'date-holidays' to fetch public holidays for the current year and the next year (2-year rolling window).
 * Normalizes dates to UTC midnight to avoid timezone offsets and uses updateOne for idempotent updates.
 */
export async function seedStatutoryNationalHolidays(
  tenantId:    string,
  countryCode: string = "IN",
  createdBy:   string = "system"
): Promise<void> {
  const cc = countryCode.toUpperCase();
  const tenantOId = new mongoose.Types.ObjectId(tenantId);
  const now       = new Date();
  const currentYear = new Date().getUTCFullYear();
  const yearsToSeed = 2;

  try {
    // 1. Initialize date-holidays for the country code
    const hd = new Holidays();
    
    // Check if the country code is supported by the library
    const countries = hd.getCountries();
    if (!countries[cc]) {
      logger.warn({
        message: "Country code not supported by date-holidays. Skipping statutory holiday seeding.",
        tenantId,
        countryCode: cc,
      });
      return;
    }

    hd.init(cc);

    const collection = mongoose.connection.collection("holidays");
    let inserted = 0;
    let skipped  = 0;

    // 2. Loop through a 2-year rolling window (current year + next year)
    for (let i = 0; i < yearsToSeed; i++) {
      const targetYear = currentYear + i;
      const yearHolidays = hd.getHolidays(targetYear);

      if (!yearHolidays) continue;

      for (const item of yearHolidays) {
        // ⚠️ Fix #1: Strictly filter for official statutory public holidays (skip observances, bank holidays, optional)
        if (item.type !== "public") {
          continue;
        }

        // ⚠️ Fix #2: Normalize Date to UTC Midnight (Y-M-D) to eliminate timezone shifts
        const dateStr = typeof item.date === "string" ? item.date : new Date(item.date).toISOString();
        const dateParts = dateStr.split(" ")[0].split("T")[0].split("-"); // E.g., "2026-12-25" -> ["2026", "12", "25"]
        const year      = parseInt(dateParts[0], 10);
        const month     = parseInt(dateParts[1], 10) - 1; // Javascript months are 0-indexed
        const day       = parseInt(dateParts[2], 10);

        const holidayDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

        const query = {
          tenantId:    tenantOId,
          scope:       HolidayScope.COUNTRY,
          countryCode: cc,
          date:        holidayDate,
          isDeleted:   false,
        };

        const doc = {
          tenantId:    tenantOId,
          name:        item.name,
          date:        holidayDate,
          type:        HolidayType.NATIONAL,
          scope:       HolidayScope.COUNTRY,
          isOptional:  false,
          description: `Statutory National Holiday for ${cc}`,
          branchId:    null,
          countryCode: cc,
          stateCode:   null,
          createdBy,
          updatedBy:   createdBy,
          isDeleted:   false,
          version:     1,
          createdAt:   now,
          updatedAt:   now,
        };

        // ⚠️ Fix #3: Idempotent upsert via MongoDB updateOne with $setOnInsert
        // This ensures the seeder never overwrites custom names or edits made by HR Admins
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
      yearsSeeded: yearsToSeed,
      inserted,
      skipped,
    });

  } catch (error: any) {
    logger.error({
      message: "Seeding statutory holidays failed",
      tenantId,
      error:   error.message,
    });
    throw error;
  }
}
