import { Request, Response, NextFunction } from "express";
import { AttendanceService } from "./attendance.service";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { AttendanceReportQueryDto } from "./attendance.dto";
import { PunchSource } from "./attendance.model";

const attService = new AttendanceService();

export class AttendanceController {
    // POST /api/v1/attendance/me/punch/web
    async punchWeb(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        return this.punch(req, res, next, PunchSource.WEB);
    }

    // POST /api/v1/attendance/me/punch/mobile
    async punchMobile(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        return this.punch(req, res, next, PunchSource.MOBILE);
    }

    // POST /api/v1/attendance/me/punch
    // Self-service — source determined by which route hit this (web vs mobile)
    async punch(
        req: Request,
        res: Response,
        next: NextFunction,
        source: PunchSource
    ): Promise<void> {
        try {
            const result = await attService.punch(
                req.context,
                req.body,
                source,
                req.ip,
                req.headers["user-agent"] as string
            );
            res.status(200).json(
                buildSuccessResponse(result, "Punch recorded successfully")
            );
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/attendance/me/today
    async getMyToday(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const result = await attService.getMyToday(req.context);
            res.status(200).json(
                buildSuccessResponse(result, "Today's attendance fetched")
            );
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/attendance/me/history?fromDate=&toDate=
    async getMyHistory(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const fromDate = new Date(req.query.fromDate as string);
            const toDate = new Date(req.query.toDate as string);

            const result = await attService.getMyHistory(req.context, fromDate, toDate);
            res.status(200).json(
                buildSuccessResponse(result, "Attendance history fetched")
            );
        } catch (error) {
            next(error);
        }
    }

    // POST /api/v1/attendance/manual  (HR only)
    async manualEntry(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const result = await attService.manualEntry(req.context, req.body);
            res.status(200).json(
                buildSuccessResponse(result, "Attendance recorded manually")
            );
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/attendance/report  (HR/Manager)
    async getReport(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const query = AttendanceReportQueryDto.parse(req.query);
            const filters: Record<string, unknown> = {
                attendanceDate: {
                    $gte: new Date(query.fromDate),
                    $lte: new Date(query.toDate),
                },
            };
            if (query.employeeId) filters.employeeId = query.employeeId;
            if (query.branchId) filters.branchId = query.branchId;
            if (query.status) filters.status = query.status;

            const result = await attService.getReport(
                req.context, filters, query.pageNumber ?? 1, query.pageSize ?? 20
            );
            res.status(200).json(
                buildSuccessResponse(result, "Attendance report fetched")
            );
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/attendance/orphaned-records/check  (HR/Admin utility)
    async checkOrphanedRecords(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const result = await attService.checkOrphanedRecords(req.context);
            res.status(200).json(
                buildSuccessResponse(result, "Orphaned attendance records check completed")
            );
        } catch (error) {
            next(error);
        }
    }

    // POST /api/v1/attendance/orphaned-records/clean  (HR/Admin utility)
    async cleanOrphanedRecords(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const result = await attService.cleanOrphanedRecords(req.context);
            res.status(200).json(
                buildSuccessResponse(result, "Orphaned attendance records cleanup completed")
            );
        } catch (error) {
            next(error);
        }
    }
}