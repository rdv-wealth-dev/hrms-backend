import { Request, Response, NextFunction } from "express";
import { ShiftService } from "./shift.service";
import { buildSuccessResponse } from "../../core/database/base.schema";

const shiftService = new ShiftService();

export class ShiftController {

    async create(req: Request, res: Response, next : NextFunction) : Promise<void> {
        try {
            const result = await shiftService.createShift(req.context, req.body);
            res.status(201).json(
                buildSuccessResponse(result, "Shift created successfully")
            );
        } catch (error) {
            next(error);
        }
    }

    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await shiftService.listShifts(req.context);
            res.status(200).json(result);
        } catch (error) { 
            next(error); 
        }
    } 

  async getById(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await shiftService.getShiftById(req.context, req.params.id);
        res.status(200).json(
            buildSuccessResponse(result, "Shift fetched successfully")
        );
        } catch (error) { 
            next(error); 
        }
  }

   async update(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await shiftService.updateShift(req.context, req.params.id, req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Shift updated successfully")
    );
    } catch (error) { 
        next(error); 
    }
  }


  async delete(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await shiftService.deleteShift(req.context, req.params.id);
      res.status(200).json(
        buildSuccessResponse(result, "Shift deleted successfully")
    );
    } catch (error) { 
        next(error); 
    }
  }


}