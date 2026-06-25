import { BranchDocument, BranchModel } from "./branch.model";

export class BranchRepository {
  // Branch creation during registration has no context yet
  // So direct model access is used here for registration flow only

  //Create
  async create(
    data: Partial<BranchDocument>
  ): Promise<BranchDocument> {
    const branch = new BranchModel(data);
    return branch.save();
  }

  //Find head office
  async findHeadOffice(tenantId: string): Promise<BranchDocument | null> {
    return BranchModel.findOne({
      tenantId,
      isHeadOffice: true,
      isDeleted:    false,
    });
  }

  //Find by ID
  async findById(id: string): Promise<BranchDocument | null> {
    return BranchModel.findOne({
      _id:       id,
      isDeleted: false,
    });
  }

  //Find all by tenant
  async findAllByTenant(tenantId: string): Promise<BranchDocument[]> {
    return BranchModel.find({
      tenantId,
      isDeleted: false,
      isActive:  true,
    }).sort({ isHeadOffice: -1, createdAt: 1 });
  }

  // Check code exists within tenant
  async codeExists(
    tenantId: string,
    code:     string
  ): Promise<boolean> {
    const doc = await BranchModel
      .findOne({ tenantId, code, isDeleted: false })
      .select("_id")
      .lean();
    return doc !== null;
  }
}