import mongoose from "mongoose";
import { TeamModel, TeamMemberModel, TeamDocument, TeamMemberDocument } from "./team.model";

export class TeamRepository {
  async createTeam(data: Partial<TeamDocument>): Promise<TeamDocument> {
    return TeamModel.create(data);
  }

  async findTeamById(tenantId: string, teamId: string): Promise<TeamDocument | null> {
    return TeamModel.findOne({
      _id: new mongoose.Types.ObjectId(teamId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    }).populate("leadId", "firstName lastName email employeeCode avatar")
      .populate("departmentId", "name code")
      .populate("branchId", "name code");
  }

  async findTeamByCode(tenantId: string, code: string): Promise<TeamDocument | null> {
    return TeamModel.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      code: code.toUpperCase(),
      isDeleted: false,
    });
  }

  async listTeams(tenantId: string, filter: Record<string, any> = {}): Promise<TeamDocument[]> {
    const query: Record<string, any> = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
      ...filter,
    };
    return TeamModel.find(query)
      .populate("leadId", "firstName lastName email employeeCode")
      .populate("departmentId", "name code")
      .sort({ createdAt: -1 });
  }

  async updateTeam(tenantId: string, teamId: string, data: Partial<TeamDocument>): Promise<TeamDocument | null> {
    return TeamModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(teamId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      },
      { $set: data },
      { new: true }
    );
  }

  async deleteTeam(tenantId: string, teamId: string): Promise<boolean> {
    const result = await TeamModel.updateOne(
      {
        _id: new mongoose.Types.ObjectId(teamId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      },
      { $set: { isDeleted: true, isActive: false } }
    );
    // Also soft-delete team members
    await TeamMemberModel.updateMany(
      {
        teamId: new mongoose.Types.ObjectId(teamId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      },
      { $set: { isDeleted: true, isActive: false } }
    );
    return result.modifiedCount > 0;
  }

  // TEAM MEMBERS REPOSITORY METHODS

  async addMember(data: Partial<TeamMemberDocument>): Promise<TeamMemberDocument> {
    return TeamMemberModel.create(data);
  }

  async findMember(tenantId: string, teamId: string, employeeId: string): Promise<TeamMemberDocument | null> {
    return TeamMemberModel.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      teamId: new mongoose.Types.ObjectId(teamId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    });
  }

  async getTeamMembers(tenantId: string, teamId: string): Promise<any[]> {
    return TeamMemberModel.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      teamId: new mongoose.Types.ObjectId(teamId),
      isDeleted: false,
      isActive: true,
    }).populate("employeeId", "firstName lastName email employeeCode designationId departmentId avatar phone");
  }

  async updateMember(
    tenantId: string,
    teamId: string,
    employeeId: string,
    data: Partial<TeamMemberDocument>
  ): Promise<TeamMemberDocument | null> {
    return TeamMemberModel.findOneAndUpdate(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        teamId: new mongoose.Types.ObjectId(teamId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        isDeleted: false,
      },
      { $set: data },
      { new: true }
    );
  }

  async removeMember(tenantId: string, teamId: string, employeeId: string): Promise<boolean> {
    const result = await TeamMemberModel.updateOne(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        teamId: new mongoose.Types.ObjectId(teamId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
      },
      { $set: { isDeleted: true, isActive: false, leftAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  async getEmployeeTeams(tenantId: string, employeeId: string): Promise<any[]> {
    return TeamMemberModel.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
      isActive: true,
    }).populate({
      path: "teamId",
      populate: [
        { path: "leadId", select: "firstName lastName email employeeCode" },
        { path: "departmentId", select: "name code" },
      ],
    });
  }
}
