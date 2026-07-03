import { BaseRepository } from "../../repositories/base.repository";
import { RegularizationDocument, RegularizationModel } from "./regularization.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class RegularizationRepository extends BaseRepository<RegularizationDocument> {
  constructor() {
    super(RegularizationModel);
  }

  async findPendingForBranch(context: RequestContext) {
    return this.findAll(
      context,
      { status: "PENDING" },
      { pageNumber: 1, pageSize: 100 },
      { sort: { createdAt: 1 } }
    );
  }
}