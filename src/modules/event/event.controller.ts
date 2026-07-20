import { Request, Response, NextFunction } from "express";
import { EventService } from "./event.service";
import { buildSuccessResponse } from "../../core/database/base.schema";

const eventService = new EventService();

export class EventController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pageNumber = req.query.pageNumber ? parseInt(req.query.pageNumber as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 100;
      
      const result = await eventService.listEvents(req.context, { pageNumber, pageSize });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await eventService.createEvent(req.context, req.body);
      res.status(201).json(
        buildSuccessResponse(result, "Event created successfully")
      );
    } catch (error) {
      next(error);
    }
  }
}
