import { BaseRepository } from "../../repositories/base.repository";
import { EventDocument, EventModel } from "./event.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { FilterQuery } from "mongoose";

export class EventRepository extends BaseRepository<EventDocument> {
  constructor() {
    super(EventModel);
  }

  protected buildTenantFilter(
    context: RequestContext,
    filter: FilterQuery<EventDocument> = {}
  ): FilterQuery<EventDocument> {
    const tenantFilter: FilterQuery<EventDocument> = {
      ...filter,
      tenantId: context.tenantId,
      isDeleted: false,
    } as FilterQuery<EventDocument>;

    // ORG_ADMIN and HR_ADMIN see all events across all branches
    if (context.role === "ORG_ADMIN" || context.role === "HR_ADMIN") {
      return tenantFilter;
    }

    if (context.branchIds && context.branchIds.length > 0) {
      (tenantFilter as any).$or = [
        { branchId: { $exists: false } },
        { branchId: null },
        { branchId: { $in: context.branchIds } }
      ];
    }

    return tenantFilter;
  }
}
