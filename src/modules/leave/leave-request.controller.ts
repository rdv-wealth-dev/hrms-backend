import { Request, Response, NextFunction } from "express";
import { LeaveRequestService } from "./leave-request.service";
import { LeaveBalanceService } from "./leave-balance.service";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { LeaveReportQueryDto } from "./leave.dto";
import { AppError } from "../../core/errors/app.error";
import { UserModel } from "../user/user.model";

const leaveReqService = new LeaveRequestService();
const balanceService = new LeaveBalanceService();

export class LeaveRequestController {

  // POST /api/v1/leave/requests
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await leaveReqService.createRequest(req.context, req.body);
      res.status(201).json(buildSuccessResponse(result, "Leave request submitted successfully"));
    } catch (error) { next(error); }
  }

  // GET /api/v1/leave/requests/me
  async getMyRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.pageNumber as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const result = await leaveReqService.getMyRequests(req.context, page, pageSize);
      res.status(200).json(result);
    } catch (error) { next(error); }
  }

  // GET /api/v1/leave/balances/me?year=2026
  async getMyBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UserModel.findOne({ _id: req.context.userId }).select("employeeId");
      if (!user?.employeeId) {
        throw new AppError("No employee record is linked to this account", 404);
      }
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const result = await balanceService.getMyBalances(req.context, user.employeeId.toString(), year);
      res.status(200).json(buildSuccessResponse(result, "Leave balances fetched"));
    } catch (error) { next(error); }
  }

  // PATCH /api/v1/leave/requests/:id/cancel
  async cancel(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await leaveReqService.cancelRequest(req.context, req.params.id, req.body);
      res.status(200).json(buildSuccessResponse(result, "Leave request cancelled"));
    } catch (error) { next(error); }
  }

  // GET /api/v1/leave/requests/pending
  async getPending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.pageNumber as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const result = await leaveReqService.getPendingForRole(req.context, req.context.role, page, pageSize);
      res.status(200).json(result);
    } catch (error) { next(error); }
  }

  // PATCH /api/v1/leave/requests/:id/review
  async review(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await leaveReqService.review(req.context, req.params.id, req.body);
      res.status(200).json(buildSuccessResponse(result, "Leave request reviewed"));
    } catch (error) { next(error); }
  }

  // GET /api/v1/leave/report
  async getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = LeaveReportQueryDto.parse(req.query);
      const filters: Record<string, unknown> = {};

      if (query.fromDate && query.toDate) {
        filters.fromDate = { $gte: new Date(query.fromDate) };
        filters.toDate = { $lte: new Date(query.toDate) };
      }
      if (query.employeeId) filters.employeeId = query.employeeId;
      if (query.leaveTypeId) filters.leaveTypeId = query.leaveTypeId;
      if (query.status) filters.status = query.status;

      const result = await leaveReqService.getReport(
        req.context, filters, query.pageNumber ?? 1, query.pageSize ?? 20
      );
      res.status(200).json(result);
    } catch (error) { next(error); }
  }
}