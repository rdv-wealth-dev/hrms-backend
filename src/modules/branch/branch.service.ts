import mongoose from "mongoose";
import { BranchRepository } from "./branch.repository";
import { BranchModel } from "./branch.model";
import { CreateBranchInput, UpdateBranchInput } from "./branch.dto";
import { AppError } from "../../shared/errors/app.error";
import { RequestContext } from "../../shared/types/request-context.interface";
import { OrganizationRepository } from "../organization/organization.repository";
import { geocodingService } from "../../shared/services/geocoding.service";
import { seedStatutoryNationalHolidays } from "../../database/seeds/holiday.seed";
import { seedLeaveTypes } from "../../database/seeds/leave-type.seed";
import { seedShifts, BranchWorkPolicyOverride } from "../../database/seeds/shift.seed";
import { seedDepartments } from "../../database/seeds/department.seed";
import { seedDesignations } from "../../database/seeds/designation.seed";
import { DepartmentService } from "../department/department.service";
import { DesignationService } from "../designation/designation.service";
import { ShiftModel, ShiftDocument } from "../attendance/models/shift.model";


/** Parse "HH:MM" into total minutes since midnight. */
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Add `offset` minutes to an "HH:MM" string and return a new "HH:MM" string (wraps at 24h). */
function addMinutes(hhmm: string, offset: number): string {
  const total = (timeToMinutes(hhmm) + offset + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Compute effective working minutes between startTime and endTime.
 * Handles overnight shifts (e.g. 22:00 → 07:00).
 */
function computeShiftMinutes(start: string, end: string): number {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return e > s ? e - s : 1440 - s + e;
}

export class BranchService {
  private branchRepo = new BranchRepository();
  private orgRepo = new OrganizationRepository();

  //Create branch
  async createBranch(
    context: RequestContext,
    input: CreateBranchInput
  ) {
    // Check subscription branch limit
    const org = await this.orgRepo.findById(context.tenantId);
    if (!org) throw new AppError("Organization not found", 404);

    const existingBranches = await this.branchRepo.findAllByTenant(
      context.tenantId
    );

    if (existingBranches.length >= org.subscription.maxBranches) {
      throw new AppError(
        `Branch limit reached. Your plan allows ${org.subscription.maxBranches} branch(es). Please upgrade.`,
        403
      );
    }

    // Check code uniqueness within tenant
    const codeExists = await this.branchRepo.codeExists(
      context.tenantId,
      input.code
    );
    if (codeExists) {
      throw new AppError(
        `Branch code "${input.code}" already exists`,
        409
      );
    }

    // Auto-geocode: if address is provided but lat/lng are missing, fetch from Nominatim
    let resolvedGeo = input.geo ?? {};
    const hasManualCoords = resolvedGeo.lat != null && resolvedGeo.lng != null;

    if (!hasManualCoords && input.address) {
      const coords = await geocodingService.geocode(input.address);
      if (coords) {
        resolvedGeo = { ...resolvedGeo, lat: coords.lat, lng: coords.lng };
        console.info(`[BranchService] Auto-geocoded "${input.name}": lat=${coords.lat}, lng=${coords.lng}`);
      }
    }

    const shouldBeHeadOffice = input.isHeadOffice === true || input.isHeadquarters === true || existingBranches.length === 0;
    if (shouldBeHeadOffice && existingBranches.length > 0) {
      await BranchModel.updateMany(
        { tenantId: new mongoose.Types.ObjectId(context.tenantId) },
        { $set: { isHeadOffice: false, isHeadquarters: false } }
      );
    }

    const branch = await this.branchRepo.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      name: input.name,
      code: input.code,
      isHeadOffice: shouldBeHeadOffice,
      isHeadquarters: shouldBeHeadOffice,
      isActive: true,
      parentBranchId: input.parentBranchId
        ? new mongoose.Types.ObjectId(input.parentBranchId) as any
        : undefined,
      address: input.address,
      contact: input.contact,
      geo: resolvedGeo,
      workPolicy: input.workPolicy,
      statutory: input.statutory,
    });

    // Auto-seed baseline national statutory holidays for this country (if provided)
    if (input.address?.countryCode) {
      seedStatutoryNationalHolidays(
        context.tenantId,
        input.address.countryCode,
        input.address.state ?? null,
        context.userId
      ).catch((err) => {
        console.error(`[BranchService] Auto-seeding failed for country "${input.address?.countryCode}":`, err.message);
      });
    }

    const branchId = branch._id.toString();
    await seedLeaveTypes(context.tenantId, branchId);

    // Pass the branch's work policy so the General Shift is seeded with the
    // admin-provided start/end times and working hours instead of hardcoded defaults.
    const workPolicyOverride: BranchWorkPolicyOverride = {
      shiftStartTime:    input.workPolicy?.shiftStartTime,
      shiftEndTime:      input.workPolicy?.shiftEndTime,
      workingHoursPerDay: input.workPolicy?.workingHoursPerDay,
    };
    await seedShifts(context.tenantId, branchId, workPolicyOverride);

    // Ensure branch default shift is synchronized and linked
    const defaultShiftId = await this.syncBranchDefaultShift(
      context.tenantId,
      branchId,
      input.workPolicy
    );
    if (defaultShiftId) {
      branch.defaultShiftId = defaultShiftId;
    }

    return branch;
  }

  // List all branches
  async listBranches(context: RequestContext) {
    const branches = await this.branchRepo.findAllByTenant(
      context.tenantId
    );
    return branches;
  }

  //Get branch by ID
  async getBranchById(
    context: RequestContext,
    id: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid branch ID format", 400);
    }

    let branch = await this.branchRepo.findById(id);

    // Graceful fallback: If ID passed is the Tenant/Organization ID, resolve the tenant's primary/head office branch
    if (!branch && id === context.tenantId.toString()) {
      branch = await this.branchRepo.findHeadOffice(context.tenantId);
      if (!branch) {
        const branches = await this.branchRepo.findAllByTenant(context.tenantId);
        if (branches.length > 0) {
          branch = branches[0];
        }
      }
    }

    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    // Verify branch belongs to this tenant
    if (branch.tenantId.toString() !== context.tenantId.toString()) {
      throw new AppError("Branch not found", 404);
    }

    return branch;
  }


  //Get head office
  async getHeadOffice(context: RequestContext) {
    const branch = await this.branchRepo.findHeadOffice(
      context.tenantId
    );

    if (!branch) {
      throw new AppError("Head office not found", 404);
    }

    return branch;
  }

  //Update branch
  async updateBranch(
    context: RequestContext,
    id: string,
    input: UpdateBranchInput
  ) {
    const branch = await this.branchRepo.findById(id);

    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    if (branch.tenantId.toString() !== context.tenantId) {
      throw new AppError("Branch not found", 404);
    }

    // Prevent changing code if already in use by another branch
    if (input.code && input.code !== branch.code) {
      const codeExists = await this.branchRepo.codeExists(
        context.tenantId,
        input.code
      );
      if (codeExists) {
        throw new AppError(
          `Branch code "${input.code}" already exists`,
          409
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (input.name) updateData.name = input.name;
    if (input.code) updateData.code = input.code;
    if (input.address) updateData.address = { ...branch.address, ...input.address };
    if (input.contact) updateData.contact = { ...branch.contact, ...input.contact };
    if (input.workPolicy) updateData.workPolicy = { ...branch.workPolicy, ...input.workPolicy };
    if (input.statutory) updateData.statutory = { ...branch.statutory, ...input.statutory };

    if (input.isHeadOffice === true || input.isHeadquarters === true) {
      // Transfer head office status: unset any existing head office on other branches
      await BranchModel.updateMany(
        { tenantId: new mongoose.Types.ObjectId(context.tenantId), _id: { $ne: branch._id } },
        { $set: { isHeadOffice: false, isHeadquarters: false } }
      );
      updateData.isHeadOffice = true;
      updateData.isHeadquarters = true;
    }

    // Merge geo input first, then auto-geocode if address changed but no manual coords given
    let mergedGeo = { ...branch.geo, ...input.geo };
    const hasManualCoords = input.geo?.lat != null && input.geo?.lng != null;

    if (!hasManualCoords && input.address) {
      const mergedAddress = { ...branch.address, ...input.address };
      const coords = await geocodingService.geocode(mergedAddress);
      if (coords) {
        mergedGeo = { ...mergedGeo, lat: coords.lat, lng: coords.lng };
        console.info(`[BranchService] Re-geocoded branch "${branch.name}": lat=${coords.lat}, lng=${coords.lng}`);
      }
    }

    if (input.geo || input.address) updateData.geo = mergedGeo;

    if (input.defaultShiftId && mongoose.Types.ObjectId.isValid(input.defaultShiftId)) {
      updateData.defaultShiftId = new mongoose.Types.ObjectId(input.defaultShiftId);
    }

    const updated = await this.branchRepo.updateById(id, updateData);

    // Automatically sync / create / update default shift for this branch when timing changes or defaultShiftId is missing
    const defaultShiftId = await this.syncBranchDefaultShift(
      context.tenantId,
      id,
      input.workPolicy
    );

    if (updated && defaultShiftId) {
      updated.defaultShiftId = defaultShiftId;
    }

    // Auto-seed if the country code was newly added or modified on update
    if (
      input.address?.countryCode &&
      input.address.countryCode.toUpperCase() !== branch.address?.countryCode?.toUpperCase()
    ) {
      seedStatutoryNationalHolidays(
        context.tenantId,
        input.address.countryCode,
        input.address.state ?? null,
        context.userId
      ).catch((err) => {
        console.error(`[BranchService] Auto-seeding failed on update for country "${input.address?.countryCode}":`, err.message);
      });
    }

    return updated;
  }

  //Delete branch
  async deleteBranch(
    context: RequestContext,
    id: string
  ) {
    const branch = await this.branchRepo.findById(id);

    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    if (branch.tenantId.toString() !== context.tenantId) {
      throw new AppError("Branch not found", 404);
    }

    // Cannot delete head office
    if (branch.isHeadOffice) {
      throw new AppError("Cannot delete Head Office branch", 400);
    }

    await this.branchRepo.softDeleteById(id);
    return { message: "Branch deleted successfully" };
  }

  // Seed leave types, shifts, departments, and designations for an existing branch
  async seedBranchData(context: RequestContext, id: string) {
    let branch = await this.branchRepo.findById(id);
    if (!branch && id === context.tenantId.toString()) {
      branch = await this.branchRepo.findHeadOffice(context.tenantId);
    }
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }
    if (branch.tenantId.toString() !== context.tenantId.toString()) {
      throw new AppError("Branch not found", 404);
    }

    const branchId = branch._id.toString();
    await seedLeaveTypes(context.tenantId, branchId);

    // Re-use the branch's stored workPolicy so the General Shift reflects
    // this branch's actual hours even when seeding is triggered manually.
    const workPolicyOverride: BranchWorkPolicyOverride = {
      shiftStartTime:    branch.workPolicy?.shiftStartTime,
      shiftEndTime:      branch.workPolicy?.shiftEndTime,
      workingHoursPerDay: branch.workPolicy?.workingHoursPerDay,
    };
    await seedShifts(context.tenantId, branchId, workPolicyOverride);
    await this.syncBranchDefaultShift(context.tenantId, branchId, branch.workPolicy);
    const deptMap = await seedDepartments(context.tenantId, branchId);
    await seedDesignations(context.tenantId, branchId, deptMap);

    return {
      message: "Branch master data (Leave Types, Shifts, Departments, Designations) seeded successfully",
      branchId,
      departmentsSeeded: deptMap.size,
    };
  }

  /**
   * Syncs the branch-level default shift with the branch's work policy.
   * - If a default shift exists for this branch (via defaultShiftId or branchId),
   *   its startTime, endTime, and working hours thresholds are updated.
   * - If no default shift exists, a new shift is created and assigned as the branch default.
   * - Ensures branch.defaultShiftId is set in the database.
   */
  async syncBranchDefaultShift(
    tenantId: string,
    branchId: string,
    workPolicyOverride?: {
      shiftStartTime?: string;
      shiftEndTime?: string;
      workingHoursPerDay?: number;
    }
  ): Promise<mongoose.Types.ObjectId | null> {
    const branch = await BranchModel.findOne({
      _id: new mongoose.Types.ObjectId(branchId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    });
    if (!branch) return null;

    const policy = {
      shiftStartTime: workPolicyOverride?.shiftStartTime ?? branch.workPolicy?.shiftStartTime,
      shiftEndTime: workPolicyOverride?.shiftEndTime ?? branch.workPolicy?.shiftEndTime,
      workingHoursPerDay: workPolicyOverride?.workingHoursPerDay ?? branch.workPolicy?.workingHoursPerDay,
    };

    const startTime = policy.shiftStartTime && /^([01]\d|2[0-3]):([0-5]\d)$/.test(policy.shiftStartTime)
      ? policy.shiftStartTime
      : "09:00";
    const endTime = policy.shiftEndTime && /^([01]\d|2[0-3]):([0-5]\d)$/.test(policy.shiftEndTime)
      ? policy.shiftEndTime
      : "18:00";

    let fullDayMinutes = 480;
    if (policy.workingHoursPerDay && policy.workingHoursPerDay > 0) {
      fullDayMinutes = Math.round(policy.workingHoursPerDay * 60);
    } else {
      const raw = computeShiftMinutes(startTime, endTime);
      fullDayMinutes = raw > 60 ? raw - 60 : raw;
    }
    const halfDayThresholdMinutes = Math.round(fullDayMinutes / 2);

    const allowedCheckInFromTime = addMinutes(startTime, -60);
    const checkInWindowStart = addMinutes(startTime, -60);
    const checkInWindowEnd = startTime;
    const earlyLeaveStartTime = endTime;

    let shift: ShiftDocument | null = null;

    // 1. Try branch.defaultShiftId
    if (branch.defaultShiftId) {
      shift = await ShiftModel.findOne({
        _id: branch.defaultShiftId,
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      });
    }

    // 2. Try finding existing shift created for this branch
    if (!shift) {
      shift = await ShiftModel.findOne({
        branchId: branch._id,
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      });
    }

    if (shift) {
      shift.startTime = startTime;
      shift.endTime = endTime;
      shift.allowedCheckInFromTime = allowedCheckInFromTime;
      shift.checkInWindowStart = checkInWindowStart;
      shift.checkInWindowEnd = checkInWindowEnd;
      shift.earlyLeaveStartTime = earlyLeaveStartTime;
      shift.fullDayMinutes = fullDayMinutes;
      shift.halfDayThresholdMinutes = halfDayThresholdMinutes;
      shift.isActive = true;
      await shift.save();

      if (!branch.defaultShiftId || branch.defaultShiftId.toString() !== shift._id.toString()) {
        await BranchModel.updateOne(
          { _id: branch._id },
          { $set: { defaultShiftId: shift._id } }
        );
        branch.defaultShiftId = shift._id;
      }
      return shift._id as mongoose.Types.ObjectId;
    }

    // 3. Create new default shift for this branch
    const codeConflict = await ShiftModel.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      code: "GEN",
      isDeleted: false,
    });

    let shiftCode = "GEN";
    if (codeConflict) {
      shiftCode = `GEN_${branch.code.toUpperCase()}`;
      const branchCodeConflict = await ShiftModel.findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        code: shiftCode,
        isDeleted: false,
      });
      if (branchCodeConflict) {
        shiftCode = `GEN_${branch.code.toUpperCase()}_${Date.now().toString().slice(-4)}`;
      }
    }

    const hasTenantDefault = await ShiftModel.exists({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDefault: true,
      isDeleted: false,
    });

    const isDefault = !hasTenantDefault || branch.isHeadOffice;
    if (isDefault && branch.isHeadOffice) {
      await ShiftModel.updateMany(
        { tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: { isDefault: false } }
      );
    }

    const newShift = await ShiftModel.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      branchId: branch._id,
      name: branch.isHeadOffice ? "General Shift" : `${branch.name} - General Shift`,
      code: shiftCode,
      startTime,
      endTime,
      allowedCheckInFromTime,
      checkInWindowStart,
      checkInWindowEnd,
      earlyLeaveStartTime,
      gracePeriodMinutes: 15,
      graceLimitPerMonth: 3,
      halfDayThresholdMinutes,
      fullDayMinutes,
      breakDurationMinutes: 60,
      isDefault: isDefault ? true : false,
      isActive: true,
      isDeleted: false,
      version: 1,
    });

    await BranchModel.updateOne(
      { _id: branch._id },
      { $set: { defaultShiftId: newShift._id } }
    );
    branch.defaultShiftId = newShift._id;

    return newShift._id as mongoose.Types.ObjectId;
  }

  // Delete all departments and child designations of a branch
  async deleteBranchDepartments(context: RequestContext, id: string, options: { force?: boolean } = {}) {
    let branch = await this.branchRepo.findById(id);
    if (!branch && id === context.tenantId.toString()) {
      branch = await this.branchRepo.findHeadOffice(context.tenantId);
    }
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }
    if (branch.tenantId.toString() !== context.tenantId.toString()) {
      throw new AppError("Branch not found", 404);
    }

    const deptService = new DepartmentService();
    return deptService.deleteDepartmentsByBranch(context, branch._id.toString(), options);
  }

  // Delete all designations of a branch
  async deleteBranchDesignations(context: RequestContext, id: string, options: { force?: boolean } = {}) {
    let branch = await this.branchRepo.findById(id);
    if (!branch && id === context.tenantId.toString()) {
      branch = await this.branchRepo.findHeadOffice(context.tenantId);
    }
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }
    if (branch.tenantId.toString() !== context.tenantId.toString()) {
      throw new AppError("Branch not found", 404);
    }

    const desgService = new DesignationService();
    return desgService.deleteDesignationsByBranch(context, branch._id.toString(), options);
  }
}
