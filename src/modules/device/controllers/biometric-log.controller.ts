import { Request, Response, NextFunction } from "express";
import { BiometricLogService } from "../services/biometric-log.service";
import { BiometricLogQueryDto } from "../dto/biometric-log.dto";
import { buildSuccessResponse } from "../../../shared/database/base.schema";

const logService = new BiometricLogService();

export class BiometricLogController {
  // GET /api/v1/device/logs (Admin / HR)
  async listLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = BiometricLogQueryDto.parse(req.query);
      const result = await logService.listLogs(req.context!, query);
      res.status(200).json(buildSuccessResponse(result, "Biometric logs retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }

  // GET /api/v1/device/logs/me (Employee Self-Service)
  async getMyLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = BiometricLogQueryDto.parse(req.query);
      const result = await logService.getMyLogs(req.context!, query);
      res.status(200).json(buildSuccessResponse(result, "Your biometric punch history retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }

  // GET /api/v1/device/logs/summary (Admin dashboard statistics)
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await logService.getSummary(req.context!);
      res.status(200).json(buildSuccessResponse(result, "Biometric activity summary retrieved"));
    } catch (e) {
      next(e);
    }
  }
}
