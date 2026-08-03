import mongoose from "mongoose";
import { HolidayRepository } from "../holidays/holiday.repository";
import { CreateHolidayInput, UpdateHolidayInput } from "../leave.dto";
import { AppError } from "../../../core/errors/app.error";
import { RequestContext } from "../../../core/interfaces/request-context.interface";
import { HolidayScope } from "../holidays/holiday.model";
import { OrganizationModel } from "../../organization/organization.model";
import { BranchModel } from "../../branch/branch.model";

import {
  mergeHolidayLayers,
  buildHolidayCacheKey,
  invalidateHolidayCache,
  ResolvedHoliday,
} from "./holiday-resolution.engine";
import { normalizeStateCode } from "./utils/state-code-mapper.util";
import { getOrSetCache, clearLookupCache } from "../../../service/cache.service";

export class HolidayService {
  private holidayRepo = new HolidayRepository();

  async createHoliday(context: RequestContext, input: CreateHolidayInput) {
    const normalizedDate = new Date(input.date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const scope = (input.scope ?? HolidayScope.BRANCH) as HolidayScope;
    const normalizedState = normalizeStateCode(input.stateCode);

    // Scope-aware conflict check:
    // Each scope has its own uniqueness domain — a COUNTRY-scope IN holiday and
    // a COUNTRY-scope US holiday on the same date are NOT duplicates.
    const conflict = await this.holidayRepo.findDuplicate(
      context.tenantId,
      normalizedDate,
      scope,
      undefined,
      input.countryCode,
      normalizedState,
      input.branchId
    );

    if (conflict) {
      throw new AppError(
        `A ${scope}-scope holiday ("${conflict.name}") already exists on this date`,
        409
      );
    }

    const created = await this.holidayRepo.create(context, {
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      name: input.name,
      date: normalizedDate,
      type: input.type as any,
      scope: scope as any,
      isOptional: input.isOptional,
      description: input.description,
      branchId: input.branchId
        ? new mongoose.Types.ObjectId(input.branchId) as any
        : undefined,
      countryCode: input.countryCode?.toUpperCase(),
      stateCode: normalizedState ?? undefined,
    });

    // Cache invalidation strategy:
    // BRANCH scope → invalidate only that branch's cached result (surgical).
    // COUNTRY/STATE/GLOBAL scope → affects every branch in the tenant —
    // clear the entire lookup cache to prevent stale reads across all branches.
    if (scope === HolidayScope.BRANCH && input.branchId) {
      invalidateHolidayCache(context.tenantId, input.branchId, normalizedDate.getFullYear());
    } else {
      clearLookupCache();
    }

    return created;
  }

  async listHolidays(context: RequestContext, year: number) {
    return this.holidayRepo.findForYear(context, year);
  }

  async getHolidayById(context: RequestContext, id: string) {
    const holiday = await this.holidayRepo.findById(context, id);
    if (!holiday) throw new AppError("Holiday not found", 404);
    return holiday;
  }

  async updateHoliday(context: RequestContext, id: string, input: UpdateHolidayInput) {
    const holiday = await this.holidayRepo.findById(context, id);
    if (!holiday) throw new AppError("Holiday not found", 404);

    const checkDate = input.date ? new Date(input.date) : holiday.date;
    checkDate.setUTCHours(0, 0, 0, 0);

    const checkScope = (input.scope ?? holiday.scope ?? HolidayScope.BRANCH) as HolidayScope;
    const checkCountryCode = input.countryCode ?? holiday.countryCode;
    const checkStateCode = normalizeStateCode(input.stateCode ?? holiday.stateCode);
    const checkBranchId = input.branchId ?? holiday.branchId?.toString();

    // Scope-aware conflict check — exclude self
    const conflict = await this.holidayRepo.findDuplicate(
      context.tenantId,
      checkDate,
      checkScope,
      id,
      checkCountryCode,
      checkStateCode,
      checkBranchId
    );

    if (conflict) {
      throw new AppError(
        `A ${checkScope}-scope holiday ("${conflict.name}") already exists on this date`,
        409
      );
    }

    const updateData: Record<string, unknown> = { ...input };
    if (input.date) updateData.date = checkDate;
    if (input.branchId) updateData.branchId = new mongoose.Types.ObjectId(input.branchId);
    if (input.stateCode) updateData.stateCode = normalizeStateCode(input.stateCode);
    if (input.countryCode) updateData.countryCode = input.countryCode.toUpperCase();

    const updated = await this.holidayRepo.updateById(context, id, updateData);

    // Cache invalidation
    if (checkScope === HolidayScope.BRANCH && checkBranchId) {
      invalidateHolidayCache(context.tenantId, checkBranchId, checkDate.getFullYear());
    } else {
      clearLookupCache();
    }

    return updated;
  }

  async deleteHoliday(context: RequestContext, id: string) {
    const holiday = await this.holidayRepo.findById(context, id);
    if (!holiday) throw new AppError("Holiday not found", 404);

    const scope = (holiday.scope ?? HolidayScope.BRANCH) as HolidayScope;

    // Cache invalidation before delete
    if (scope === HolidayScope.BRANCH && holiday.branchId) {
      invalidateHolidayCache(
        context.tenantId,
        holiday.branchId.toString(),
        new Date(holiday.date).getFullYear()
      );
    } else {
      clearLookupCache();
    }

    await this.holidayRepo.softDeleteById(context, id);
    return { message: "Holiday deleted successfully" };
  }

  // Resolves the final merged holiday list for a specific branch + year.
  // Walks GLOBAL → COUNTRY → STATE → BRANCH and returns the highest-priority
  // entry per date. Result is LRU-cached per tenantId + branchId + year (30 min TTL).
  async resolveHolidaysForBranch(
    context: RequestContext,
    branchId: string,
    year: number
  ): Promise<ResolvedHoliday[]> {
    const cacheKey = buildHolidayCacheKey(context.tenantId, branchId, year);

    return getOrSetCache(cacheKey, async () => {
      // Load org locale for countryCode
      const org = await OrganizationModel.findById(context.tenantId).select("locale");
      const countryCode = (org?.locale as any)?.countryCode ?? "IN";

      // Load branch address for stateCode (free-text — normalizeStateCode handles conversion)
      const branch = await BranchModel.findById(branchId).select("address");
      const stateCode = (branch?.address as any)?.state ?? null;

      // Fetch across all 4 scope levels (bypasses BaseRepository branch filter)
      const raw = await this.holidayRepo.findHolidaysForResolution(
        context.tenantId,
        year,
        countryCode,
        stateCode,
        branchId
      );

      // Merge by date — higher SCOPE_PRIORITY wins on same date
      return mergeHolidayLayers(raw as any, countryCode, stateCode, branchId);
    });
  }
}
