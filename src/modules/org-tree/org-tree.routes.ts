import { Router } from "express";
import {
  createNodeHandler,
  updateNodeHandler,
  assignEmployeeHandler,
  createWorkRouteHandler,
  reparentSubtreeHandler,
  getFullHierarchyHandler,
  getNodeWorkRoutesHandler,
} from "./org-tree.controller";

const router = Router();

// Full Hierarchy View
router.get("/hierarchy", getFullHierarchyHandler);

// Node CRUD
router.post("/nodes", createNodeHandler);
router.put("/nodes/:id", updateNodeHandler);
router.patch("/reparent", reparentSubtreeHandler);

// Person Assignment & Matrix Work Routes
router.post("/assign-employee", assignEmployeeHandler);
router.post("/work-routes", createWorkRouteHandler);
router.get("/nodes/:id/work-routes", getNodeWorkRoutesHandler);

export default router;
