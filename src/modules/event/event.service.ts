import mongoose from "mongoose";
import { RequestContext } from "../../core/interfaces/request-context.interface";
import { EventRepository } from "./event.repository";
import { CreateEventInput } from "./event.dto";

export class EventService {
  private eventRepo = new EventRepository();

  async createEvent(context: RequestContext, input: CreateEventInput) {
    const event = await this.eventRepo.create(context, {
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: input.branchId ? new mongoose.Types.ObjectId(input.branchId) as any : undefined,
      title: input.title,
      description: input.description ?? "",
      date: new Date(input.date),
      createdBy: new mongoose.Types.ObjectId(context.userId) as any,
    });
    return event;
  }

  async listEvents(context: RequestContext, pagination = { pageNumber: 1, pageSize: 100 }) {
    // List all non-deleted events scoped to the organization
    return this.eventRepo.findAll(
      context,
      { isDeleted: false },
      pagination,
      { sort: { date: 1 } }
    );
  }
}
