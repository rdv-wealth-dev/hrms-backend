import { BaseRepository } from "../../repositories/base.repository";
import { RoleDocument, RoleModel } from "./role.model";
import { RequestContext }         from "../../core/interfaces/request-context.interface";

export class RoleRepository extends BaseRepository<RoleDocument> {
  constructor() {
    super(RoleModel);
  }

  // Find by slug within tenant
  async findBySlug(
    context: RequestContext,
    slug:    string
  ): Promise<RoleDocument | null> {
    return this.findOne(context, { slug: slug.toUpperCase() });
  }

  // Find all system roles
  async findSystemRoles(
    context: RequestContext
  ): Promise<RoleDocument[]> {
    const result = await this.findAll(
      context,
      { isSystemRole: true },
      { pageNumber: 1, pageSize: 100 }
    );
    return result.data;
  }

  // Get permissions for a role slug
  // Used on login to load permissions dynamically
  async getPermissionsBySlug(
    tenantId: string,
    slug:     string
  ): Promise<string[]> {
    const role = await RoleModel.findOne({
      tenantId,
      slug:      slug.toUpperCase(),
      isActive:  true,
      isDeleted: false,
    }).select("permissions");

    return role?.permissions ?? [];
  }
}