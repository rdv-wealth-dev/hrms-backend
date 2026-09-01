import { OrganizationRepository } from "./organization.repository";
import { UpdateOrganizationInput, UpdateModulesInput, UpdateStatutoryInput, UpdateMandatoryDocsInput } from "./organization.dto";
import { RequestContext } from "../../shared/types/request-context.interface";
import { AppError } from "../../shared/errors/app.error";
import { parseEmployeeCountRange } from "./utils/team-size.util";

export class OrganizationService {
  private orgRepo = new OrganizationRepository();

  //Get my organization
  async getMyOrganization(context: RequestContext) {
    const org = await this.orgRepo.findById(context.tenantId);

    if (!org) {
      throw new AppError("Organization not found", 404);
    }

    return org;
  }

  //Update organization
  async updateOrganization(
    context: RequestContext,
    input:   UpdateOrganizationInput
  ) {
    const org = await this.orgRepo.findById(context.tenantId);

    if (!org) {
      throw new AppError("Organization not found", 404);
    }

    // Build update object — only update provided fields
    const updateData: Record<string, unknown> = {};

    if (input.companyName) updateData.companyName = input.companyName;
    if (input.legalName)   updateData.legalName   = input.legalName;
    if (input.industry)    updateData.industry     = input.industry;
    if (input.phone)       updateData.phone        = input.phone;
    if (input.gstin)       updateData.gstin        = input.gstin;
    if (input.pan)         updateData.pan          = input.pan;
    if (input.cin)         updateData.cin          = input.cin;
    if (input.tan)         updateData.tan          = input.tan;

    const providedRange = input.employeeCountRange || input.teamSize || input.companySize;
    if (providedRange) {
      const { normalizedRange, maxEmployees } = parseEmployeeCountRange(providedRange);
      updateData.employeeCountRange = normalizedRange;
      updateData.subscription = {
        ...org.subscription,
        maxEmployees,
      };
    }

    // Merge nested objects
    if (input.address) {
      updateData.address = {
        ...org.address,
        ...input.address,
      };
    }

    if (input.branding) {
      updateData.branding = {
        ...(org.branding ?? {}),
        ...input.branding,
      };
    }

    if (input.locale) {
      updateData.locale = {
        ...org.locale,
        ...input.locale,
      };
    }

    if (input.employeeCodeConfig) {
      updateData.employeeCodeConfig = {
        ...(org.employeeCodeConfig ?? { prefix: "EMP", digits: 2, separator: "", startSequenceNumber: 1 }),
        ...input.employeeCodeConfig,
      };
    }

    const updated = await this.orgRepo.updateById(
      context.tenantId,
      updateData
    );

    return updated;
  }

  // Update employee code prefix & sequence configuration
  async updateEmployeeCodeConfig(
    context: RequestContext,
    input: { prefix: string; digits?: number; separator?: string; startSequenceNumber?: number }
  ) {
    const org = await this.orgRepo.findById(context.tenantId);
    if (!org) {
      throw new AppError("Organization not found", 404);
    }

    const newConfig = {
      prefix: input.prefix.trim().toUpperCase(),
      digits: input.digits ?? org.employeeCodeConfig?.digits ?? 2,
      separator: input.separator ?? org.employeeCodeConfig?.separator ?? "",
      startSequenceNumber: input.startSequenceNumber ?? org.employeeCodeConfig?.startSequenceNumber ?? 1,
    };

    const updated = await this.orgRepo.updateById(context.tenantId, {
      employeeCodeConfig: newConfig,
    });

    return updated;
  }

  // Update modules
  async updateModules(
    context: RequestContext,
    input:   UpdateModulesInput
  ) {
    const org = await this.orgRepo.findById(context.tenantId);

    if (!org) {
      throw new AppError("Organization not found", 404);
    }

    const updatedModules = {
      ...org.modules,
      ...input,
    };

    const updated = await this.orgRepo.updateById(
      context.tenantId,
      { modules: updatedModules }
    );

    return updated;
  }

  // Update statutory
  async updateStatutory(
    context: RequestContext,
    input:   UpdateStatutoryInput
  ) {
    const org = await this.orgRepo.findById(context.tenantId);

    if (!org) {
      throw new AppError("Organization not found", 404);
    }

    const updatedStatutory = {
      ...org.statutory,
      ...input,
    };

    const updated = await this.orgRepo.updateById(
      context.tenantId,
      { statutory: updatedStatutory }
    );

    return updated;
  }

  // Update mandatory document types
  async updateMandatoryDocs(
    context: RequestContext,
    input:   UpdateMandatoryDocsInput
  ) {
    const org = await this.orgRepo.findById(context.tenantId);
    if (!org) {
      throw new AppError("Organization not found", 404);
    }

    const updated = await this.orgRepo.updateById(context.tenantId, {
      mandatoryDocumentTypes: input.mandatoryDocumentTypes,
    });

    return updated;
  }
}