import { Request, Response, NextFunction } from "express";
import { OrgTreeService } from "./org-tree.service";
import { buildSuccessResponse } from "../../shared/database/base.schema";

const service = new OrgTreeService();

export async function createNodeHandler(req: Request, res: Response, next?: NextFunction) {
  try {
    const tenantId = (req as any).context?.tenantId || (req as any).user?.tenantId || req.headers["x-tenant-id"] || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ isSuccess: false, message: "Tenant ID missing" });

    const result = await service.createNode(String(tenantId), req.body);
    return res.status(201).json(buildSuccessResponse(result, "Org node created successfully"));
  } catch (err: any) {
    if (next) return next(err);
    return res.status(400).json({ isSuccess: false, message: err.message });
  }
}

export async function updateNodeHandler(req: Request, res: Response, next?: NextFunction) {
  try {
    const tenantId = (req as any).context?.tenantId || (req as any).user?.tenantId || req.headers["x-tenant-id"] || req.body.tenantId;
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ isSuccess: false, message: "Node ID is required" });

    const result = await service.updateNode(String(tenantId), id, req.body);
    return res.status(200).json(buildSuccessResponse(result, "Org node updated successfully"));
  } catch (err: any) {
    if (next) return next(err);
    return res.status(400).json({ isSuccess: false, message: err.message });
  }
}

export async function assignEmployeeHandler(req: Request, res: Response, next?: NextFunction) {
  try {
    const tenantId = (req as any).context?.tenantId || (req as any).user?.tenantId || req.headers["x-tenant-id"] || req.body.tenantId;
    const result = await service.assignEmployeeToNode(String(tenantId), req.body);
    return res.status(200).json(buildSuccessResponse(result, "Employee assigned to node successfully"));
  } catch (err: any) {
    if (next) return next(err);
    return res.status(400).json({ isSuccess: false, message: err.message });
  }
}

export async function createWorkRouteHandler(req: Request, res: Response, next?: NextFunction) {
  try {
    const tenantId = (req as any).context?.tenantId || (req as any).user?.tenantId || req.headers["x-tenant-id"] || req.body.tenantId;
    const result = await service.createWorkRoute(String(tenantId), req.body);
    return res.status(201).json(buildSuccessResponse(result, "Work submission route created"));
  } catch (err: any) {
    if (next) return next(err);
    return res.status(400).json({ isSuccess: false, message: err.message });
  }
}

export async function reparentSubtreeHandler(req: Request, res: Response, next?: NextFunction) {
  try {
    const tenantId = (req as any).context?.tenantId || (req as any).user?.tenantId || req.headers["x-tenant-id"] || req.body.tenantId;
    const result = await service.reparentSubtree(String(tenantId), req.body);
    return res.status(200).json(buildSuccessResponse(result, "Subtree reparented successfully"));
  } catch (err: any) {
    if (next) return next(err);
    return res.status(400).json({ isSuccess: false, message: err.message });
  }
}

export async function getFullHierarchyHandler(req: Request, res: Response, next?: NextFunction) {
  try {
    const tenantId = (req as any).context?.tenantId || (req as any).user?.tenantId || req.headers["x-tenant-id"] || req.query.tenantId;
    if (!tenantId) return res.status(400).json({ isSuccess: false, message: "Tenant ID missing" });

    const tree = await service.getFullHierarchy(String(tenantId));
    return res.status(200).json(buildSuccessResponse(tree, "Org hierarchy fetched successfully"));
  } catch (err: any) {
    if (next) return next(err);
    return res.status(500).json({ isSuccess: false, message: err.message });
  }
}

export async function getNodeWorkRoutesHandler(req: Request, res: Response, next?: NextFunction) {
  try {
    const tenantId = (req as any).context?.tenantId || (req as any).user?.tenantId || req.headers["x-tenant-id"] || req.query.tenantId;
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ isSuccess: false, message: "Node ID is required" });

    const routes = await service.getNodeWorkRoutes(String(tenantId), id);
    return res.status(200).json(buildSuccessResponse(routes, "Node work routes fetched successfully"));
  } catch (err: any) {
    if (next) return next(err);
    return res.status(500).json({ isSuccess: false, message: err.message });
  }
}
