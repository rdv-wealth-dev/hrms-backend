import mongoose from "mongoose";
import { BaseRepository } from "../../repositories/base.repository";
import { RegularizationDocument, RegularizationModel } from "./regularization.model";

export class RegularizationRepository extends BaseRepository<RegularizationDocument> {
  constructor() {
    super(RegularizationModel);
  }

  async findPendingForBranch(context: import("../../core/interfaces/request-context.interface").RequestContext) {
    return this.findAll(
      context,
      { status: "PENDING" },
      { pageNumber: 1, pageSize: 100 },
      { sort: { createdAt: 1 } }
    );
  }
}