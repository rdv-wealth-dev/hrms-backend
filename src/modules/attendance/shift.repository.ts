import mongoose from "mongoose";
import { BaseRepository } from "../../repositories/base.repository";
import { ShiftDocument, ShiftModel } from "./shift.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class ShiftRepository extends BaseRepository<ShiftDocument>{
    constructor() {
        super(ShiftModel);
    }

    async findByCode(context: RequestContext, code: string): Promise<ShiftDocument | null> {
        return ShiftModel.findOne({
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            code: code.toUpperCase(),
            isDeleted: false,
        });
    }

    async findDefault(context: RequestContext): Promise<ShiftDocument | null>{
        return ShiftModel.findOne({
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            isDefault : true,
            isActive : true,
            isDeleted : true
        });
    }

}    