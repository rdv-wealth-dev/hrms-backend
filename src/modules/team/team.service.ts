import mongoose from "mongoose";
import { TeamRepository } from "./team.repository";
import { CreateTeamInput, UpdateTeamInput, AddTeamMemberInput, UpdateTeamMemberInput } from "./team.dto";
import { AppError } from "../../shared/errors/app.error";
import { RequestContext } from "../../shared/types/request-context.interface";
import { EmployeeModel } from "../employee/models/employee.model";
import { DepartmentModel } from "../department/department.model";

export class TeamService {
  private teamRepo = new TeamRepository();

  async createTeam(context: RequestContext, input: CreateTeamInput) {
    const existingTeam = await this.teamRepo.findTeamByCode(context.tenantId, input.code);
    if (existingTeam) {
      throw new AppError(`Team code "${input.code}" already exists`, 409);
    }

    // 1. Department is the top-level hierarchy — validate that parent Department exists
    const department = await DepartmentModel.findOne({
      _id: new mongoose.Types.ObjectId(input.departmentId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });
    if (!department) {
      throw new AppError("Department not found. A valid parent Department is mandatory to create a team.", 404);
    }

    if (input.leadId) {
      const leadEmployee = await EmployeeModel.findOne({
        _id: new mongoose.Types.ObjectId(input.leadId),
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        isDeleted: false,
      });
      if (!leadEmployee) {
        throw new AppError("Team lead employee not found", 404);
      }
    }

    const team = await this.teamRepo.createTeam({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      name: input.name,
      code: input.code,
      description: input.description || "",
      type: input.type,
      branchId: input.branchId ? new mongoose.Types.ObjectId(input.branchId) : undefined,
      departmentId: new mongoose.Types.ObjectId(input.departmentId),
      isCrossFunctional: input.isCrossFunctional || false,
      leadId: input.leadId ? new mongoose.Types.ObjectId(input.leadId) : undefined,
      reporting: {
        type: input.reporting?.type as any,
        targetId: input.reporting?.targetId ? new mongoose.Types.ObjectId(input.reporting.targetId) : undefined,
        targetName: input.reporting?.targetName || "",
      },
      maxConcurrentLeaves: input.maxConcurrentLeaves,
      shiftId: input.shiftId ? new mongoose.Types.ObjectId(input.shiftId) : undefined,
      tags: input.tags || [],
      startDate: input.startDate ? new Date(input.startDate) : new Date(),
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      isActive: true,
      isDeleted: false,
    });

    // If lead was assigned, automatically add them to team_members with role LEAD
    if (input.leadId) {
      await this.teamRepo.addMember({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        teamId: team._id as mongoose.Types.ObjectId,
        employeeId: new mongoose.Types.ObjectId(input.leadId),
        roleInTeam: "LEAD" as any,
        isPrimary: true,
        allocationPercentage: 100,
        joinedAt: new Date(),
        isActive: true,
        isDeleted: false,
      });
    }

    return team;
  }

  async getTeamById(context: RequestContext, teamId: string) {
    const team = await this.teamRepo.findTeamById(context.tenantId, teamId);
    if (!team) {
      throw new AppError("Team not found", 404);
    }
    const members = await this.teamRepo.getTeamMembers(context.tenantId, teamId);
    return {
      ...team.toObject(),
      members,
      memberCount: members.length,
    };
  }

  async listTeams(context: RequestContext, filters: { departmentId?: string; branchId?: string; type?: string; isCrossFunctional?: boolean }) {
    const query: Record<string, any> = {};
    if (filters.departmentId) query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
    if (filters.branchId) query.branchId = new mongoose.Types.ObjectId(filters.branchId);
    if (filters.type) query.type = filters.type;
    if (filters.isCrossFunctional !== undefined) query.isCrossFunctional = filters.isCrossFunctional;

    return this.teamRepo.listTeams(context.tenantId, query);
  }

  async updateTeam(context: RequestContext, teamId: string, input: UpdateTeamInput) {
    const team = await this.teamRepo.findTeamById(context.tenantId, teamId);
    if (!team) {
      throw new AppError("Team not found", 404);
    }

    const updatePayload: Record<string, any> = { ...input };
    if (input.branchId) updatePayload.branchId = new mongoose.Types.ObjectId(input.branchId);
    if (input.departmentId) updatePayload.departmentId = new mongoose.Types.ObjectId(input.departmentId);
    if (input.shiftId) updatePayload.shiftId = new mongoose.Types.ObjectId(input.shiftId);
    if (input.leadId) updatePayload.leadId = new mongoose.Types.ObjectId(input.leadId);
    if (input.reporting?.targetId) {
      updatePayload["reporting.targetId"] = new mongoose.Types.ObjectId(input.reporting.targetId);
    }

    return this.teamRepo.updateTeam(context.tenantId, teamId, updatePayload);
  }

  async deleteTeam(context: RequestContext, teamId: string) {
    const team = await this.teamRepo.findTeamById(context.tenantId, teamId);
    if (!team) {
      throw new AppError("Team not found", 404);
    }
    await this.teamRepo.deleteTeam(context.tenantId, teamId);
    return { message: "Team deleted successfully" };
  }

  // MEMBER MANAGEMENT
  async addMember(context: RequestContext, teamId: string, input: AddTeamMemberInput) {
    const team = await this.teamRepo.findTeamById(context.tenantId, teamId);
    if (!team) {
      throw new AppError("Team not found", 404);
    }

    const employee = await EmployeeModel.findOne({
      _id: new mongoose.Types.ObjectId(input.employeeId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    const existingMember = await this.teamRepo.findMember(context.tenantId, teamId, input.employeeId);
    if (existingMember) {
      if (existingMember.isActive) {
        throw new AppError("Employee is already a member of this team", 409);
      }
      // Re-activate member
      return this.teamRepo.updateMember(context.tenantId, teamId, input.employeeId, {
        isActive: true,
        roleInTeam: input.roleInTeam as any,
        isPrimary: input.isPrimary,
        allocationPercentage: input.allocationPercentage,
        leftAt: null,
      });
    }

    return this.teamRepo.addMember({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      teamId: new mongoose.Types.ObjectId(teamId),
      employeeId: new mongoose.Types.ObjectId(input.employeeId),
      roleInTeam: input.roleInTeam as any,
      isPrimary: input.isPrimary,
      allocationPercentage: input.allocationPercentage,
      joinedAt: input.joinedAt ? new Date(input.joinedAt) : new Date(),
      isActive: true,
      isDeleted: false,
    });
  }

  async updateMember(context: RequestContext, teamId: string, employeeId: string, input: UpdateTeamMemberInput) {
    const updated = await this.teamRepo.updateMember(context.tenantId, teamId, employeeId, input as any);
    if (!updated) {
      throw new AppError("Team member not found", 404);
    }
    return updated;
  }

  async removeMember(context: RequestContext, teamId: string, employeeId: string) {
    const success = await this.teamRepo.removeMember(context.tenantId, teamId, employeeId);
    if (!success) {
      throw new AppError("Team member not found", 404);
    }
    return { message: "Member removed from team successfully" };
  }

  async changeTeamLead(context: RequestContext, teamId: string, leadId: string) {
    const employee = await EmployeeModel.findOne({
      _id: new mongoose.Types.ObjectId(leadId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });
    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    await this.teamRepo.updateTeam(context.tenantId, teamId, {
      leadId: new mongoose.Types.ObjectId(leadId),
    });

    // Ensure they are marked as LEAD in team_members
    const existingMember = await this.teamRepo.findMember(context.tenantId, teamId, leadId);
    if (existingMember) {
      await this.teamRepo.updateMember(context.tenantId, teamId, leadId, {
        roleInTeam: "LEAD" as any,
        isActive: true,
      });
    } else {
      await this.teamRepo.addMember({
        tenantId: new mongoose.Types.ObjectId(context.tenantId),
        teamId: new mongoose.Types.ObjectId(teamId),
        employeeId: new mongoose.Types.ObjectId(leadId),
        roleInTeam: "LEAD" as any,
        isPrimary: true,
        allocationPercentage: 100,
        joinedAt: new Date(),
        isActive: true,
        isDeleted: false,
      });
    }

    return { message: "Team lead updated successfully" };
  }

  async getEmployeeTeams(context: RequestContext, employeeId: string) {
    return this.teamRepo.getEmployeeTeams(context.tenantId, employeeId);
  }
}
