import { OrganizationDocument, OrganizationModel } from "./organization.model";

export class OrganizationRepository {
  // Organization has no tenantId — it IS the tenant
  // So it does not extend BaseRepository
  // All methods query directly on OrganizationModel

  //Create
  async create(
    data: Partial<OrganizationDocument>
  ): Promise<OrganizationDocument> {
    const org = new OrganizationModel(data);
    return org.save();
  }

  //Find by ID
  async findById(id: string): Promise<OrganizationDocument | null> {
    return OrganizationModel.findOne({
      _id:       id,
      isDeleted: false,
    });
  }

  //Find by slug 
  async findBySlug(slug: string): Promise<OrganizationDocument | null> {
    return OrganizationModel.findOne({ slug, isDeleted: false });
  }

  //Check slug exists
  async slugExists(slug: string): Promise<boolean> {
    const doc = await OrganizationModel.findOne({ slug }).select("_id").lean();
    return doc !== null;
  }

  //Update
  async updateById(
    id:   string,
    data: Partial<OrganizationDocument>
  ): Promise<OrganizationDocument | null> {
    return OrganizationModel.findByIdAndUpdate(
      id,
      { ...data },
      { new: true }
    );
  }
}