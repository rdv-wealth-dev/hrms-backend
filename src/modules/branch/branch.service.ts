import mongoose from "mongoose";
import { BranchRepository } from "./branch.repository";
import { CreateBranchInput, UpdateBranchInput } from "./branch.dto";
import { AppError } from "../../shared/errors/app.error";
import { RequestContext } from "../../shared/types/request-context.interface";
import { OrganizationRepository } from "../organization/organization.repository";
import { geocodingService } from "../../shared/services/geocoding.service";
import { seedStatutoryNationalHolidays } from "../../database/seeds/holiday.seed";
import { seedLeaveTypes } from "../../database/seeds/leave-type.seed";
import { seedShifts } from "../../database/seeds/shift.seed";
import { seedDepartments } from "../../database/seeds/department.seed";
import { seedDesignations } from "../../database/seeds/designation.seed";


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

    const branch = await this.branchRepo.create({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      name: input.name,
      code: input.code,
      isHeadOffice: existingBranches.length === 0,
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
    await seedShifts(context.tenantId, branchId);

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

    const updated = await this.branchRepo.updateById(id, updateData);

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
    await seedShifts(context.tenantId, branchId);
    const deptMap = await seedDepartments(context.tenantId, branchId);
    await seedDesignations(context.tenantId, branchId, deptMap);

    return {
      message: "Branch master data (Leave Types, Shifts, Departments, Designations) seeded successfully",
      branchId,
      departmentsSeeded: deptMap.size,
    };
  }
}
