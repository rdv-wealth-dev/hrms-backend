import { Router } from "express";
import { checkPermission } from "../../shared/middlewares/rbac.middleware";
import {
  createTeamHandler,
  listTeamsHandler,
  getTeamByIdHandler,
  updateTeamHandler,
  deleteTeamHandler,
  addMemberHandler,
  updateMemberHandler,
  removeMemberHandler,
  changeLeadHandler,
  getMyTeamsHandler,
} from "./team.controller";

const router = Router();

// Employee self view of assigned teams
router.get("/my-teams", getMyTeamsHandler);

// Team CRUD
router.post("/", checkPermission("team.create"), createTeamHandler);
router.get("/", checkPermission("team.read"), listTeamsHandler);
router.get("/:id", checkPermission("team.read"), getTeamByIdHandler);
router.put("/:id", checkPermission("team.update"), updateTeamHandler);
router.delete("/:id", checkPermission("team.delete"), deleteTeamHandler);

// Team Members & Lead Management
router.post("/:id/members", checkPermission("team.update"), addMemberHandler);
router.patch("/:id/members/:memberId", checkPermission("team.update"), updateMemberHandler);
router.delete("/:id/members/:memberId", checkPermission("team.update"), removeMemberHandler);
router.patch("/:id/lead", checkPermission("team.update"), changeLeadHandler);

export default router;
