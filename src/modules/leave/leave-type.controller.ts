import { Request, Response, NextFunction } from "express";
import { LeaveTypeService } from "./leave-type.service";
import { buildSuccessResponse } from "../../core/database/base.schema";

const leaveTypeService = new LeaveTypeService();

export class LeaveTypeController {

    async create(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await leaveTypeService.createLeaveType(req.context, req.body);
            res.status(201).json(buildSuccessResponse(result, "Leave type created successfully"));
        } catch (error) { next(error); }
    }

    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await leaveTypeService.listLeaveTypes(req.context);
            res.status(200).json(result);
        } catch (error) { next(error); }
    }

    async getById(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await leaveTypeService.getLeaveTypeById(req.context, req.params.id);
            res.status(200).json(buildSuccessResponse(result, "Leave type fetched successfully"));
        } catch (error) { next(error); }
    }

    async update(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await leaveTypeService.updateLeaveType(req.context, req.params.id, req.body);
            res.status(200).json(buildSuccessResponse(result, "Leave type updated successfully"));
        } catch (error) { next(error); }
    }

    async delete(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await leaveTypeService.deleteLeaveType(req.context, req.params.id);
            res.status(200).json(buildSuccessResponse(result, "Leave type deleted successfully"));
        } catch (error) { next(error); }
    }
}