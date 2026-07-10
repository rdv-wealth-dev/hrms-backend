import mongoose from "mongoose";
import { BaseRepository } from "../../repositories/base.repository";
import { RegularizationDocument, RegularizationModel } from "./regularization.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class RegularizationRepository extends BaseRepository<RegularizationDocument> {
  constructor() {
    super(RegularizationModel);
  }

  // Returns ALL pending requests across all branches — approvers
  // (HR Admin, Org Admin) need to see everything, not just their
  // assigned branches. The base findAll() filters by branchIds,
  // which would hide requests from branches the HR Admin isn't
  // assigned to.
  async findPendingForBranch(context: RequestContext) {
    return RegularizationModel.find({
      tenantId:  new mongoose.Types.ObjectId(context.tenantId),
      status:    "PENDING",
      isDeleted: false,
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();
  }
}