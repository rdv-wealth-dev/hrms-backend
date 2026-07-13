import mongoose from "mongoose";
import { BaseRepository } from "../../repositories/base.repository";
import { SalaryComponentDocument, SalaryComponentModel } from "./salary-component.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";


export class SalaryComponentRepository extends BaseRepository<SalaryComponentDocument> {
    constructor() {
        super(SalaryComponentModel);
    }

    async findByCode(context: RequestContext, code: string) {
        return SalaryComponentModel.findOne({
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            code : code.toUpperCase(),
            isDeleted : false,
        });
    }

    async findAllByCodes(context: RequestContext, codes : string[]) {
        return SalaryComponentModel.find({
            tenantId : new mongoose.Types.ObjectId(context.tenantId),
            code : { $in: codes.map(c => c.toUpperCase() )},
            isDeleted : false,
        });
    }
}