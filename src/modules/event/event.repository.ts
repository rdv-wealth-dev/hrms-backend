import { BaseRepository } from "../../repositories/base.repository";
import { EventDocument, EventModel } from "./event.model";

export class EventRepository extends BaseRepository<EventDocument> {
  constructor() {
    super(EventModel);
  }
}
