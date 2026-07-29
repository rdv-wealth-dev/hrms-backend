import mongoose from "mongoose";
import { BaseRepository }     from "../../../repositories/base.repository";
import { HolidayDocument, HolidayModel, HolidayScope } from "../holidays/holiday.model";
import { RequestContext }     from "../../../core/interfaces/request-context.interface";
import { normalizeStateCode } from "./utils/state-code-mapper.util";

export class HolidayRepository extends BaseRepository<HolidayDocument> {
    constructor() {
        super(HolidayModel);
    }

    // Fetches all holidays for a tenant for a given year.
    // Used for the HR admin list view — shows all scopes.
    async findForYear(context: RequestContext, year: number) {
        const from = new Date(year, 0, 1);
        const to   = new Date(year, 11, 31, 23, 59, 59);

        return HolidayModel.find({
            tenantId:  new mongoose.Types.ObjectId(context.tenantId),
            date:      { $gte: from, $lte: to },
            isDeleted: false,
        }).sort({ date: 1 });
    }

    // Fetches holidays across all 4 scope levels for the resolution engine.
    //
    // WHY this bypasses BaseRepository.buildTenantFilter():
    // The base filter automatically adds { branchId: { $in: context.branchIds } }
    // for branch-scoped users (e.g. BRANCH_ADMIN). GLOBAL, COUNTRY, and STATE scope
    // holidays have no branchId set (branchId = undefined/null), so they would be
    // silently hidden by that filter. This method constructs a direct $or query
    // that correctly includes all applicable holiday scopes for resolution.
    //
    // Legacy document support: includes { scope: { $exists: false } } fallback
    // to catch documents created before the scope field existed.
    async findHolidaysForResolution(
        tenantId:    string,
        year:        number,
        countryCode: string,
        stateCode:   string | null,
        branchId:    string
    ) {
        const startOfYear     = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
        const endOfYear       = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
        const tenantOId       = new mongoose.Types.ObjectId(tenantId);
        const branchOId       = new mongoose.Types.ObjectId(branchId);
        const normalizedState = normalizeStateCode(stateCode);
        const cc              = countryCode.toUpperCase();

        const orClauses: any[] = [
            // Explicit scope matches
            { scope: HolidayScope.GLOBAL },
            { scope: HolidayScope.COUNTRY, countryCode: cc },
            { scope: HolidayScope.BRANCH,  branchId: branchOId },

            // Legacy fallback — documents saved before scope field was introduced
            { scope: { $exists: false }, branchId: null },
            { scope: { $exists: false }, branchId: branchOId },
        ];

        // STATE scope only added when a normalized state code is available
        if (normalizedState) {
            orClauses.push({
                scope:       HolidayScope.STATE,
                countryCode: cc,
                stateCode:   normalizedState,
            });
        }

        return HolidayModel.find({
            tenantId:  tenantOId,
            date:      { $gte: startOfYear, $lte: endOfYear },
            isDeleted: false,
            $or:       orClauses,
        }).lean();
    }

    // Scope-aware duplicate detection. Used by createHoliday and updateHoliday
    // to prevent two holidays on the same date within the same scope domain.
    // Each scope has a distinct uniqueness domain:
    //   COUNTRY → tenantId + date + countryCode
    //   STATE   → tenantId + date + countryCode + stateCode
    //   BRANCH  → tenantId + date + branchId
    //   GLOBAL  → tenantId + date
    async findDuplicate(
        tenantId:     string,
        date:         Date,
        scope:        HolidayScope,
        excludeId?:   string,
        countryCode?: string | null,
        stateCode?:   string | null,
        branchId?:    string | null
    ): Promise<HolidayDocument | null> {
        const query: Record<string, unknown> = {
            tenantId:  new mongoose.Types.ObjectId(tenantId),
            date,
            scope,
            isDeleted: false,
        };

        // Exclude self when checking on update
        if (excludeId) {
            query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
        }

        if (scope === HolidayScope.COUNTRY) {
            query.countryCode = countryCode?.toUpperCase();
        } else if (scope === HolidayScope.STATE) {
            query.countryCode = countryCode?.toUpperCase();
            query.stateCode   = normalizeStateCode(stateCode);
        } else if (scope === HolidayScope.BRANCH && branchId) {
            query.branchId = new mongoose.Types.ObjectId(branchId);
        }

        return HolidayModel.findOne(query);
    }
}