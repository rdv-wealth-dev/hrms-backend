import mongoose from "mongoose";
import { BaseRepository } from "../../repositories/base.repository";
import { LeaveTypeDocument, LeaveTypeModel } from "./leave-type.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class LeaveTypeRepository extends BaseRepository<LeaveTypeDocument> {
    constructor() {
        super(LeaveTypeModel);

    }

    async findByCode(context : RequestContext, code : string) : Promise<LeaveTypeDocument | null> {
        return LeaveTypeModel.findOne({
            tenantId : new mongoose.Types.ObjectId(context.tenantId),
            code : code.toUpperCase(),
            isDeleted : false,
        })
    }
}