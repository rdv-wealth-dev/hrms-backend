import mongoose from "mongoose";
import { BranchDocument, BranchModel } from "./branch.model";

export class BranchRepository {

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
      tenantId:     new mongoose.Types.ObjectId(tenantId),
      isHeadOffice: true,
      isDeleted:    false,
    });
  }

  //Find by ID
  async findById(id: string): Promise<BranchDocument | null> {
    return BranchModel.findOne({
      _id:       new mongoose.Types.ObjectId(id),
      isDeleted: false,
    });
  }

  //Find all by tenant
  async findAllByTenant(tenantId: string): Promise<BranchDocument[]> {
    return BranchModel.find({
      tenantId:  new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
      isActive:  true,
    }).sort({ isHeadOffice: -1, createdAt: 1 });
  }

  //Update by ID
  async updateById(
    id:   string,
    data: Partial<BranchDocument> | Record<string, unknown>
  ): Promise<BranchDocument | null> {
    return BranchModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), isDeleted: false },
      { ...data, updatedAt: new Date() },
      { new: true }
    );
  }

  //Soft delete
  async softDeleteById(id: string): Promise<void> {
    await BranchModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { isDeleted: true, updatedAt: new Date() }
    );
  }

  //Check code exists within tenant
  async codeExists(
    tenantId: string,
    code:     string
  ): Promise<boolean> {
    const doc = await BranchModel
      .findOne({
        tenantId:  new mongoose.Types.ObjectId(tenantId),
        code:      code.toUpperCase(),
        isDeleted: false,
      })
      .select("_id")
      .lean();
    return doc !== null;
  }
}