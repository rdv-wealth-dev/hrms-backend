import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { HolidayService } from "../holidays/holiday.service";
import { CompOffService } from "../comp-off/comp-off.service";
import { buildSuccessResponse } from "../../../core/database/base.schema";
import { AppError } from "../../../core/errors/app.error";
import { OrganizationModel } from "../../organization/organization.model";
import { seedStatutoryNationalHolidays } from "./holiday.seed";
import { clearLookupCache } from "../../../service/cache.service";

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

  // GET /api/v1/leave/holidays/resolve?branchId=<id>&year=2026
  // Returns the fully merged, priority-resolved holiday list for the given branch.
  // Mounted before requireCompleteProfile in leave.routes.ts.
  async resolveForBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchId, year } = req.query;

      if (!branchId || typeof branchId !== "string") {
        throw new AppError("branchId query param is required", 400);
      }

      if (!Types.ObjectId.isValid(branchId)) {
        throw new AppError("Invalid branchId format", 400);
      }

      const yearNum = year ? parseInt(year as string, 10) : new Date().getFullYear();
      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        throw new AppError("Invalid year parameter", 400);
      }

      const result = await holidayService.resolveHolidaysForBranch(req.context, branchId, yearNum);
      res.status(200).json(buildSuccessResponse(result, "Resolved holidays fetched successfully"));
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

  // POST /api/v1/leave/holidays/seed-default
  // Seeds standard statutory national holidays for the org's registered country.
  // Country code is ALWAYS derived from the organization's registered locale —
  // it cannot be passed manually to prevent seeding unrelated countries.
  async seedDefaults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Always derive countryCode from org locale — never from query params
      const org = await OrganizationModel.findById(req.context.tenantId).select("locale");
      const countryCode = (org?.locale as any)?.countryCode;

      if (!countryCode) {
        throw new AppError(
          "Organization has no country code configured. Please set a country code in your Organization settings first.",
          400
        );
      }

      // stateCode can still be provided to seed state-level holidays, but we
      // no longer accept countryCode from the request.
      const stateCode = req.query.stateCode as string | undefined;

      await seedStatutoryNationalHolidays(req.context.tenantId, countryCode, stateCode, req.context.userId);
      clearLookupCache();

      const regionMsg = stateCode
        ? `${countryCode.toUpperCase()}-${stateCode.toUpperCase()}`
        : countryCode.toUpperCase();

      res.status(200).json(buildSuccessResponse(null, `Statutory holidays for ${regionMsg} seeded successfully`));
    } catch (error) { next(error); }
  }
}