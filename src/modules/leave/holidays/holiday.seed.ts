import mongoose from "mongoose";
import { HolidayScope, HolidayType } from "./holiday.model";
import { logger } from "../../../config/logger";

/**
 * Seeds fixed statutory national holidays for a tenant.
 * Currently supports India ('IN') and can be extended to other countries.
 * Uses atomic updateOne upserts for safe idempotency without duplicate key errors.
 */
export async function seedStatutoryNationalHolidays(
  tenantId:    string,
  countryCode: string = "IN",
  createdBy:   string = "system"
): Promise<void> {
  const cc = countryCode.toUpperCase();
  if (cc !== "IN") return;

  const year      = new Date().getFullYear();
  const tenantOId = new mongoose.Types.ObjectId(tenantId);
  const now       = new Date();

  // Fixed statutory national holidays only (Floating holidays are managed via UI)
  const fixedNationalDefaults = [
    { name: "New Year's Day",   month: 0,  day: 1 },
    { name: "Republic Day",     month: 0,  day: 26 },
    { name: "Independence Day", month: 7,  day: 15 },
    { name: "Gandhi Jayanti",   month: 9,  day: 2 },
    { name: "Christmas Day",    month: 11, day: 25 },
  ];

  try {
    const collection = mongoose.connection.collection("holidays");
    let inserted = 0;
    let skipped  = 0;

    for (const item of fixedNationalDefaults) {
      const holidayDate = new Date(Date.UTC(year, item.month, item.day, 0, 0, 0, 0));

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
        createdBy:   createdBy,
        updatedBy:   createdBy,
        isDeleted:   false,
        version:     1,
        createdAt:   now,
        updatedAt:   now,
      };

      // Idempotent upsert avoiding E11000 reliance
      const result = await collection.updateOne(
        query,
        { $setOnInsert: doc },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        inserted++;
      } else {
        skipped  = skipped + 1;
      }
    }

    logger.info({
      message: "Seeded national holidays",
      tenantId,
      countryCode: cc,
      inserted,
      skipped,
    });

  } catch (error: any) {
    logger.error({
      message: "Seeding national holidays failed",
      tenantId,
      error:   error.message,
    });
    throw error;
  }
}
