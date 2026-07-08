import mongoose from "mongoose";
import { LeaveTypeRepository } from "./leave-type.repository";
import { CreateLeaveTypeInput, UpdateLeaveTypeInput } from "./leave.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { LeaveAccrualFrequency } from "./leave-type.model";

export class LeaveTypeService {
    private leaveTypeRepo = new LeaveTypeRepository();

    async createLeaveType(context: RequestContext, input: CreateLeaveTypeInput) {
        const existing = await this.leaveTypeRepo.findByCode(context, input.code);
        if (existing) {
            throw new AppError(`Leave type code "${input.code}" already exists`, 409);
        }

        const branchId = context.branchIds?.[0];
        if (!branchId) {
            throw new AppError("Branch context is required to create a leave type", 400);
        }

        return this.leaveTypeRepo.create(context, {
            ...input,
            tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
            branchId: new mongoose.Types.ObjectId(branchId) as any,
            branchOverrides: (input.branchOverrides || []).map(o => ({
                branchId: new mongoose.Types.ObjectId(o.branchId),
                annualQuota: o.annualQuota,
            })) as any,
            accrualFrequency: input.accrualFrequency as LeaveAccrualFrequency,
            isActive: true,
        });
    }

    async listLeaveTypes(context: RequestContext) {
        return this.leaveTypeRepo.findAll(
            context, { isActive: true }, { pageNumber: 1, pageSize: 50 }
        );
    }

    async getLeaveTypeById(context: RequestContext, id: string) {
        const type = await this.leaveTypeRepo.findById(context, id);
        if (!type) throw new AppError("Leave type not found", 404);
        return type;
    }

    async updateLeaveType(context: RequestContext, id: string, input: UpdateLeaveTypeInput) {
        const type = await this.leaveTypeRepo.findById(context, id);
        if (!type) throw new AppError("Leave type not found", 404);

        if (input.code && input.code !== type.code) {
            const existing = await this.leaveTypeRepo.findByCode(context, input.code);
            if (existing) throw new AppError(`Leave type code "${input.code}" already exists`, 409);
        }

        const updateData: Record<string, unknown> = { ...input };
        if (input.branchOverrides) {
            updateData.branchOverrides = input.branchOverrides.map(o => ({
                branchId: new mongoose.Types.ObjectId(o.branchId),
                annualQuota: o.annualQuota,
            }));
        }

        return this.leaveTypeRepo.updateById(context, id, updateData);
    }

    async deleteLeaveType(context: RequestContext, id: string) {
        const type = await this.leaveTypeRepo.findById(context, id);
        if (!type) throw new AppError("Leave type not found", 404);
        await this.leaveTypeRepo.softDeleteById(context, id);
        return { message: "Leave type deleted successfully" };
    }
}