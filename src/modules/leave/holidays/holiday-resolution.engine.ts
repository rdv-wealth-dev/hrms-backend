// src/modules/leave/holidays/holiday-resolution.engine.ts

import { invalidateCacheKey } from "../../../service/cache.service";
import { HolidayScope }       from "./holiday.model";
import { normalizeStateCode } from "./utils/state-code-mapper.util";

// ─── CACHE KEY HELPERS ───────────────────────────────────────────────────────

const CACHE_PREFIX = "holiday";

/**
 * LRU cache key for resolved branch holiday list.
 * Format: holiday:{tenantId}:{branchId}:{year}
 */
export function buildHolidayCacheKey(
  tenantId: string,
  branchId: string,
  year:     number
): string {
  return `${CACHE_PREFIX}:${tenantId}:${branchId}:${year}`;
}

/**
 * Invalidates the LRU cache entry for a specific branch + year.
 */
export function invalidateHolidayCache(
  tenantId: string,
  branchId: string,
  year:     number
): void {
  invalidateCacheKey(buildHolidayCacheKey(tenantId, branchId, year));
}

// ─── SCOPE INFERENCE ─────────────────────────────────────────────────────────

/**
 * Infers the effective HolidayScope for a document.
 * Handles legacy documents (no scope field) based on branchId presence.
 */
export function inferHolidayScope(h: any): HolidayScope {
  if (h.scope) return h.scope as HolidayScope;
  return h.branchId ? HolidayScope.BRANCH : HolidayScope.COUNTRY;
}

// ─── PRIORITY TABLE ──────────────────────────────────────────────────────────

const SCOPE_PRECEDENCE: Record<HolidayScope, number> = {
  [HolidayScope.GLOBAL]:  1,
  [HolidayScope.COUNTRY]: 2,
  [HolidayScope.STATE]:   3,
  [HolidayScope.BRANCH]:  4,
};

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ResolvedHoliday {
  _id:          string;
  name:         string;
  date:         Date;
  type:         string;
  scope:        HolidayScope;
  isOptional:   boolean;
  description?: string;
  branchId?:    string | null;
  countryCode?: string | null;
  stateCode?:   string | null;
}

// ─── MERGE ENGINE ────────────────────────────────────────────────────────────

/**
 * In-Memory Resolution Engine: Filters and resolves overlapping holiday calendars
 * based on location hierarchy precedence (BRANCH > STATE > COUNTRY > GLOBAL).
 */
export function mergeHolidayLayers(
  holidays:          any[],
  targetCountryCode: string,
  targetStateCode?:  string | null,
  targetBranchId?:   string | null
): ResolvedHoliday[] {
  const normalizedTargetState = normalizeStateCode(targetStateCode, targetCountryCode);
  const targetBranchStr       = targetBranchId ? targetBranchId.toString() : null;

  // 1. Filter relevant candidate documents
  const applicableHolidays = holidays.filter((h) => {
    const scope = inferHolidayScope(h);

    if (scope === HolidayScope.GLOBAL) return true;

    if (scope === HolidayScope.COUNTRY) {
      return h.countryCode?.toUpperCase() === targetCountryCode.toUpperCase();
    }

    if (scope === HolidayScope.STATE) {
      const hState = normalizeStateCode(h.stateCode, targetCountryCode);
      return (
        h.countryCode?.toUpperCase() === targetCountryCode.toUpperCase() &&
        hState === normalizedTargetState
      );
    }

    if (scope === HolidayScope.BRANCH) {
      return h.branchId && h.branchId.toString() === targetBranchStr;
    }

    return false;
  });

  // 2. Resolve conflicting dates based on Scope Precedence
  const resolvedMap = new Map<string, { holiday: any; precedence: number }>();

  for (const h of applicableHolidays) {
    const scope = inferHolidayScope(h);
    const precedence = SCOPE_PRECEDENCE[scope];
    const dateKey = new Date(h.date).toISOString().split("T")[0];

    const existing = resolvedMap.get(dateKey);
    if (!existing || precedence >= existing.precedence) {
      resolvedMap.set(dateKey, { holiday: h, precedence });
    }
  }

  // 3. Return resolved active holidays (mapped to match Mongoose schema property naming conventions)
  return Array.from(resolvedMap.values())
    .map(({ holiday }) => ({
      _id:         holiday._id.toString(),
      name:        holiday.name,
      date:        holiday.date,
      scope:       inferHolidayScope(holiday),
      isOptional:  !!holiday.isOptional,
      description: holiday.description,
      branchId:    holiday.branchId ? holiday.branchId.toString() : null,
      countryCode: holiday.countryCode || null,
      stateCode:   normalizeStateCode(holiday.stateCode, targetCountryCode),
      type:        holiday.type || "NATIONAL",
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
