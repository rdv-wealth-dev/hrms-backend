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

        const accrualFrequency = input.accrualFrequency as LeaveAccrualFrequency;
        const cycles = getCyclesPerYear(accrualFrequency);
        const accrualAmountPerCycle = cycles > 0 ? Number((input.annualQuota / cycles).toFixed(4)) : 0;

        return this.leaveTypeRepo.create(context, {
            ...input,
            tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
            branchId: new mongoose.Types.ObjectId(branchId) as any,
            branchOverrides: (input.branchOverrides || []).map(o => ({
                branchId: new mongoose.Types.ObjectId(o.branchId),
                annualQuota: o.annualQuota,
            })) as any,
            accrualFrequency,
            accrualAmountPerCycle,
            isActive: true,
        });
    }

    async listLeaveTypes(context: RequestContext) {
        // Leave types are org-level master data — NOT branch-scoped.
        return this.leaveTypeRepo.findAll(
            { ...context, branchIds: [] }, { isActive: true, effectiveTo: null }, { pageNumber: 1, pageSize: 50 }
        );
    }

    async getLeaveTypeById(context: RequestContext, id: string) {
        const type = await this.leaveTypeRepo.findById(context, id);
        if (!type) throw new AppError("Leave type not found", 404);
        return type;
    }

    async deleteLeaveType(context: RequestContext, id: string) {
        const type = await this.leaveTypeRepo.findById(context, id);
        if (!type) throw new AppError("Leave type not found", 404);
        await this.leaveTypeRepo.softDeleteById(context, id);
        return { message: "Leave type deleted successfully" };
    }


    async updateLeaveType(context: RequestContext, id: string, input: UpdateLeaveTypeInput) {
        const current = await this.leaveTypeRepo.findById(context, id);
        if (!current) throw new AppError("Leave type not found", 404);

        if (input.code && input.code !== current.code) {
            const existing = await this.leaveTypeRepo.findByCode(context, input.code);
            if (existing) throw new AppError(`Leave type code "${input.code}" already exists`, 409);
        }

        // Close out the current version — it stops being active from today
        const now = new Date();
        current.effectiveTo = now;
        await this.leaveTypeRepo.save(current as any);

        // Create the new version with merged fields, pointing back at what it replaces
        const merged = {
            ...current.toObject(),
            ...input,
            _id: undefined,
            effectiveFrom: now,
            effectiveTo: null,
            supersedes: current._id,
            createdAt: undefined,
            updatedAt: undefined,
        };

        if (input.branchOverrides) {
            merged.branchOverrides = input.branchOverrides.map(o => ({
                branchId: new mongoose.Types.ObjectId(o.branchId),
                annualQuota: o.annualQuota,
            }));
        }

        // Recalculate accrualAmountPerCycle based on merged/updated quota and frequency
        const finalQuota = merged.annualQuota;
        const finalFreq = merged.accrualFrequency as LeaveAccrualFrequency;
        const cycles = getCyclesPerYear(finalFreq);
        const accrualAmountPerCycle = cycles > 0 ? Number((finalQuota / cycles).toFixed(4)) : 0;
        merged.accrualAmountPerCycle = accrualAmountPerCycle;

        return this.leaveTypeRepo.create(context, merged as any);
    }
}

function getCyclesPerYear(freq: LeaveAccrualFrequency): number {
    switch (freq) {
        case LeaveAccrualFrequency.MONTHLY:      return 12;
        case LeaveAccrualFrequency.QUARTERLY:    return 4;
        case LeaveAccrualFrequency.HALF_YEARLY:  return 2;
        case LeaveAccrualFrequency.YEARLY:       return 1;
        case LeaveAccrualFrequency.WEEKLY:       return 52;
        case LeaveAccrualFrequency.BI_WEEKLY:    return 26;
        case LeaveAccrualFrequency.SEMI_MONTHLY: return 24;
        case LeaveAccrualFrequency.DAILY:        return 365;
        case LeaveAccrualFrequency.HOURLY:       return 2080;
        case LeaveAccrualFrequency.ON_JOINING:   return 1;
        case LeaveAccrualFrequency.MANUAL:       return 0;
        case LeaveAccrualFrequency.NONE:         return 0;
        default:                                 return 0;
    }
}