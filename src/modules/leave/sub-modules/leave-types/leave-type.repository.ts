import mongoose from "mongoose";
import { BaseRepository } from "../../../../shared/database/base.repository";
import { LeaveTypeDocument, LeaveTypeModel } from "./leave-type.model";
import { RequestContext } from "../../../../shared/types/request-context.interface";

export class LeaveTypeRepository extends BaseRepository<LeaveTypeDocument> {
    constructor() {
        super(LeaveTypeModel);

    }

    async findByCode(context: RequestContext, code: string): Promise<LeaveTypeDocument | null> {
        return LeaveTypeModel.findOne({
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            code: code.toUpperCase(),
            effectiveTo: null,     // only match the currently active version
            isDeleted: false,
        })
    }

    async save(doc: LeaveTypeDocument): Promise<LeaveTypeDocument> {
        return doc.save();
    }
}