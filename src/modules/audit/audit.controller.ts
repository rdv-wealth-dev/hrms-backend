import { Request, Response, NextFunction } from "express";
import { AuditRepository } from "./audit.repository";

const repo = new AuditRepository();

export class AuditController {
  async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.pageNumber as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const filters: Record<string, any> = {};
      if (req.query.userId) filters.userId = req.query.userId;
      if (req.query.eventType) filters.eventType = req.query.eventType;
      if (req.query.requestId) filters.requestId = req.query.requestId;

      // Filter by Date Range (e.g. night logs)
      if (req.query.startDate || req.query.endDate) {
        filters.createdAt = {};
        if (req.query.startDate) filters.createdAt.$gte = new Date(req.query.startDate as string);
        if (req.query.endDate) filters.createdAt.$lte = new Date(req.query.endDate as string);
      }

      res.status(200).json(
        await repo.findSessions(req.context, filters, page, pageSize)
      );
    } catch (e) {
      next(e);
    }
  }

  async getActions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.pageNumber as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const filters: Record<string, any> = {};
      if (req.query.userId) filters.userId = req.query.userId;
      if (req.query.module) filters.module = req.query.module;
      if (req.query.resourceId) filters.resourceId = req.query.resourceId;
      if (req.query.requestId) filters.requestId = req.query.requestId;
      if (req.query.success) filters.success = req.query.success === "true";

      // Filter by Date Range (e.g. actions at a specific time)
      if (req.query.startDate || req.query.endDate) {
        filters.createdAt = {};
        if (req.query.startDate) filters.createdAt.$gte = new Date(req.query.startDate as string);
        if (req.query.endDate) filters.createdAt.$lte = new Date(req.query.endDate as string);
      }

      res.status(200).json(
        await repo.findActions(req.context, filters, page, pageSize)
      );
    } catch (e) {
      next(e);
    }
  }
}