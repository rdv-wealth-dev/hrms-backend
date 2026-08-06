import { Request, Response, NextFunction } from "express";
import { AttendanceService } from "../services/attendance.service";
import { buildSuccessResponse } from "../../../shared/database/base.schema";
import { AttendanceReportQueryDto } from "../dto/attendance.dto";
import { PunchSource } from "../models/attendance.model";
import { AppError } from "../../../shared/errors/app.error";

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
            const fromQuery = req.query.fromDate as string;
            const toQuery = req.query.toDate as string;

            // Default to current month if parameters are missing
            const fromDate = fromQuery ? new Date(fromQuery) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            const toDate = toQuery ? new Date(toQuery) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                throw new AppError("Invalid fromDate or toDate query parameter format", 400);
            }

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
            const result = await attService.getReport(req.context, query);
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