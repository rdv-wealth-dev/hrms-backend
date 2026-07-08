import { Request, Response, NextFunction } from "express";
import { HolidayService } from "./holiday.service";
import { CompOffService } from "./comp-off.service";
import { buildSuccessResponse } from "../../core/database/base.schema";

const holidayService = new HolidayService();
const compOffService  = new CompOffService();

export class HolidayController {

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await holidayService.createHoliday(req.context, req.body);
      res.status(201).json(buildSuccessResponse(result, "Holiday created successfully"));
    } catch (error) { next(error); }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const result = await holidayService.listHolidays(req.context, year);
      res.status(200).json(buildSuccessResponse(result, "Holidays fetched successfully"));
    } catch (error) { next(error); }
  }

  async getById(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await holidayService.getHolidayById(req.context, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Holiday fetched successfully"));
    } catch (error) { next(error); }
  }

  async update(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await holidayService.updateHoliday(req.context, req.params.id, req.body);
      res.status(200).json(buildSuccessResponse(result, "Holiday updated successfully"));
    } catch (error) { next(error); }
  }

  async delete(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await holidayService.deleteHoliday(req.context, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Holiday deleted successfully"));
    } catch (error) { next(error); }
  }

  // POST /api/v1/leave/comp-off  (HR credits an employee)
  async creditCompOff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await compOffService.creditCompOff(req.context, req.body);
      res.status(201).json(buildSuccessResponse(result, "Comp-off credited successfully"));
    } catch (error) { next(error); }
  }

  // GET /api/v1/leave/comp-off/me
  async getMyCompOffs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await compOffService.getMyCompOffs(req.context);
      res.status(200).json(buildSuccessResponse(result, "Comp-off balance fetched"));
    } catch (error) { next(error); }
  }
}