import { Request, Response, NextFunction } from "express";
import { TeamService } from "./team.service";
import {
  CreateTeamDto,
  UpdateTeamDto,
  AddTeamMemberDto,
  UpdateTeamMemberDto,
  ChangeTeamLeadDto,
} from "./team.dto";

const teamService = new TeamService();

export async function createTeamHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = CreateTeamDto.parse(req.body);
    const team = await teamService.createTeam(req.context, input);
    res.status(201).json({
      success: true,
      message: "Team created successfully",
      data: team,
    });
  } catch (error) {
    next(error);
  }
}

export async function listTeamsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { departmentId, branchId, type, isCrossFunctional } = req.query;
    const teams = await teamService.listTeams(req.context, {
      departmentId: departmentId ? String(departmentId) : undefined,
      branchId: branchId ? String(branchId) : undefined,
      type: type ? String(type) : undefined,
      isCrossFunctional: isCrossFunctional !== undefined ? isCrossFunctional === "true" : undefined,
    });
    res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTeamByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = String(req.params.id);
    const team = await teamService.getTeamById(req.context, teamId);
    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTeamHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = String(req.params.id);
    const input = UpdateTeamDto.parse(req.body);
    const updated = await teamService.updateTeam(req.context, teamId, input);
    res.status(200).json({
      success: true,
      message: "Team updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTeamHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = String(req.params.id);
    const result = await teamService.deleteTeam(req.context, teamId);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

// MEMBERS
export async function addMemberHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = String(req.params.id);
    const input = AddTeamMemberDto.parse(req.body);
    const member = await teamService.addMember(req.context, teamId, input);
    res.status(201).json({
      success: true,
      message: "Member added to team successfully",
      data: member,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMemberHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = String(req.params.id);
    const memberId = String(req.params.memberId);
    const input = UpdateTeamMemberDto.parse(req.body);
    const updated = await teamService.updateMember(
      req.context,
      teamId,
      memberId,
      input
    );
    res.status(200).json({
      success: true,
      message: "Team member updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMemberHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = String(req.params.id);
    const memberId = String(req.params.memberId);
    const result = await teamService.removeMember(
      req.context,
      teamId,
      memberId
    );
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function changeLeadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = String(req.params.id);
    const input = ChangeTeamLeadDto.parse(req.body);
    const result = await teamService.changeTeamLead(
      req.context,
      teamId,
      input.leadId
    );
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyTeamsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = (req.context as any).employeeId || req.query.employeeId;
    if (!employeeId) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    const teams = await teamService.getEmployeeTeams(req.context, String(employeeId));
    res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (error) {
    next(error);
  }
}
