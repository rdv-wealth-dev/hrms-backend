import mongoose from "mongoose";
import { BranchRepository } from "./branch.repository";
import { CreateBranchInput, UpdateBranchInput } from "./branch.dto";
import { AppError } from "../../core/errors/app.error";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { OrganizationRepository } from "../organization/organization.repository";
import { geocodingService } from "../../service/geocoding.service";

export class BranchService {
  private branchRepo = new BranchRepository();
  private orgRepo    = new OrganizationRepository();

  //Create branch
  async createBranch(
    context: RequestContext,
    input:   CreateBranchInput
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
      tenantId:      new mongoose.Types.ObjectId(context.tenantId) as any,
      name:          input.name,
      code:          input.code,
      isHeadOffice:  false,
      isActive:      true,
      parentBranchId: input.parentBranchId
        ? new mongoose.Types.ObjectId(input.parentBranchId) as any
        : undefined,
      address:    input.address,
      contact:    input.contact,
      geo:        resolvedGeo,
      workPolicy: input.workPolicy,
      statutory:  input.statutory,
    });

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
    id:      string
  ) {
    const branch = await this.branchRepo.findById(id);

    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    // Verify branch belongs to this tenant
    if (branch.tenantId.toString() !== context.tenantId) {
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
    id:      string,
    input:   UpdateBranchInput
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

    if (input.name)       updateData.name       = input.name;
    if (input.code)       updateData.code       = input.code;
    if (input.address)    updateData.address    = { ...branch.address, ...input.address };
    if (input.contact)    updateData.contact    = { ...branch.contact, ...input.contact };
    if (input.workPolicy) updateData.workPolicy = { ...branch.workPolicy, ...input.workPolicy };
    if (input.statutory)  updateData.statutory  = { ...branch.statutory,  ...input.statutory };

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
    return updated;
  }

  //Delete branch
  async deleteBranch(
    context: RequestContext,
    id:      string
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
}