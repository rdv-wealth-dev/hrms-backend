import mongoose from "mongoose";
import { BaseRepository } from "../../../../shared/database/base.repository";
import { CompOffDocument, CompOffModel } from "./comp-off.model";
import { RequestContext } from "../../../../shared/types/request-context.interface";

export class CompOffRepository extends BaseRepository<CompOffDocument> {
    constructor() {
        super(CompOffModel);
    }

    async findAvailableForEmployee(context: RequestContext, employeeId: string) {
        return CompOffModel.find({
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            employeeId: new mongoose.Types.ObjectId(employeeId),
            status: "AVAILABLE",
            expiryDate: { $gt: new Date() },
            isDeleted: false,
        }).sort({ workDate: 1 });
    }
}