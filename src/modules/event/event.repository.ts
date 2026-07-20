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
    return {
      ...filter,
      tenantId: context.tenantId,
      isDeleted: false,
    } as FilterQuery<EventDocument>;
  }
}
