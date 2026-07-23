import mongoose from "mongoose";
import { EmployeeFamilyMemberDocument, EmployeeFamilyModel } from "./employee-family.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class EmployeeFamilyRepository {

    async replaceAllForEmployee(
        context: RequestContext,
        employeeId: string,
        branchId: string,
        members: Partial<EmployeeFamilyMemberDocument>[]
    ) {
        // Wizard step 2 is a full replace, not an append — re-submitting the
        // step should reflect exactly what's in the form, not accumulate duplicates
        await EmployeeFamilyModel.deleteMany({
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            employeeId: new mongoose.Types.ObjectId(employeeId),
        });

        if (members.length === 0) return [];

        const docs = members.map((m) => ({
            ...m,
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            branchId: new mongoose.Types.ObjectId(branchId),
            employeeId: new mongoose.Types.ObjectId(employeeId),
        }));

        return EmployeeFamilyModel.insertMany(docs);

    }

    async findAllForEmployee(context: RequestContext, employeeId: string) {
        return EmployeeFamilyModel.find({
            tenantId: new mongoose.Types.ObjectId(context.tenantId),
            employeeId: new mongoose.Types.ObjectId(employeeId),
            isDeleted: false,
        });
    }
}