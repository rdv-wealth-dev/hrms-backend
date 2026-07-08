import mongoose from "mongoose";
import { BaseRepository } from "../../repositories/base.repository";
import { HolidayDocument, HolidayModel } from "./holiday.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class HolidayRepository extends BaseRepository<HolidayDocument> {
    constructor() {
        super(HolidayModel);
    }

    async findForYear(context: RequestContext, year: number) {
        const from = new Date(year, 0, 1);
        const to = new Date(year, 11, 31, 23, 59, 59);

        const query: Record<string, unknown> = {
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            date: { $gte: from, $lte: to },
            isDeleted: false,
        };

        return HolidayModel.find(query).sort({ date: 1 });

    }

}