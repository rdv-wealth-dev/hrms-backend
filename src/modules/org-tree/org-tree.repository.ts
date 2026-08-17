import mongoose, { Types } from "mongoose";
import {
  OrgNodeModel,
  OrgNodeAssignmentModel,
  WorkSubmissionRouteModel,
  IOrgNode,
  IOrgNodeAssignment,
  IWorkSubmissionRoute,
} from "./org-tree.model";

export class OrgTreeRepository {
  async createNode(data: Partial<IOrgNode>): Promise<IOrgNode> {
    return await OrgNodeModel.create(data);
  }

  async findNodeById(tenantId: string, nodeId: string): Promise<IOrgNode | null> {
    return await OrgNodeModel.findOne({
      _id: new Types.ObjectId(nodeId),
      tenantId: new Types.ObjectId(tenantId),
      isDeleted: false,
    });
  }

  async updateNode(tenantId: string, nodeId: string, update: Partial<IOrgNode>): Promise<IOrgNode | null> {
    return await OrgNodeModel.findOneAndUpdate(
      { _id: new Types.ObjectId(nodeId), tenantId: new Types.ObjectId(tenantId), isDeleted: false },
      { $set: update },
      { new: true }
    );
  }

  async deleteNodeSoft(tenantId: string, nodeId: string): Promise<boolean> {
    const res = await OrgNodeModel.updateOne(
      { _id: new Types.ObjectId(nodeId), tenantId: new Types.ObjectId(tenantId) },
      { $set: { isDeleted: true, isActive: false } }
    );
    return res.modifiedCount > 0;
  }

  // ── Aggregation: Fetch Full Hierarchical Tree with Assigned Employees 
  async getFullHierarchyTree(tenantId: string) {
    const tId = new Types.ObjectId(tenantId);

    return await OrgNodeModel.aggregate([
      { $match: { tenantId: tId, isDeleted: false, isActive: true } },
      // Lookup currently active assigned employee
      {
        $lookup: {
          from: "orgnodeassignments",
          let: { nodeId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$nodeId", "$$nodeId"] },
                    { $eq: ["$isActive", true] },
                    { $eq: ["$isDeleted", false] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: "employees",
                localField: "employeeId",
                foreignField: "_id",
                as: "employeeDetails",
              },
            },
            { $unwind: { path: "$employeeDetails", preserveNullAndEmptyArrays: true } },
          ],
          as: "assignments",
        },
      },
      // Lookup Department Details
      {
        $lookup: {
          from: "departments",
          localField: "departmentId",
          foreignField: "_id",
          as: "departmentDetails",
        },
      },
      { $unwind: { path: "$departmentDetails", preserveNullAndEmptyArrays: true } },
      { $sort: { levelTier: 1, title: 1 } },
    ]);
  }

  // ── Aggregation: Fast Sub-tree Downline using $graphLookup 
  async getDownlineSubtree(tenantId: string, rootNodeId: string) {
    const tId = new Types.ObjectId(tenantId);
    const nId = new Types.ObjectId(rootNodeId);

    return await OrgNodeModel.aggregate([
      { $match: { _id: nId, tenantId: tId, isDeleted: false } },
      {
        $graphLookup: {
          from: "orgnodes",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parentId",
          as: "descendants",
          restrictSearchWithMatch: { isDeleted: false, isActive: true },
        },
      },
    ]);
  }

  // ── Assignment Queries 
  async assignEmployee(data: Partial<IOrgNodeAssignment>): Promise<IOrgNodeAssignment> {
    return await OrgNodeAssignmentModel.create(data);
  }

  async unassignNodeEmployees(tenantId: string, nodeId: string): Promise<void> {
    await OrgNodeAssignmentModel.updateMany(
      {
        tenantId: new Types.ObjectId(tenantId),
        nodeId: new Types.ObjectId(nodeId),
        isActive: true,
      },
      { $set: { isActive: false, endDate: new Date() } }
    );
  }

  // ── Work Submission Routes 
  async createWorkRoute(data: Partial<IWorkSubmissionRoute>): Promise<IWorkSubmissionRoute> {
    return await WorkSubmissionRouteModel.create(data);
  }

  async getWorkRoutesForNode(tenantId: string, nodeId: string) {
    const tId = new Types.ObjectId(tenantId);
    const nId = new Types.ObjectId(nodeId);

    return await WorkSubmissionRouteModel.find({
      tenantId: tId,
      $or: [{ fromNodeId: nId }, { toNodeId: nId }],
      isActive: true,
      isDeleted: false,
    })
      .populate("fromNodeId", "title cSuiteRole levelTier")
      .populate("toNodeId", "title cSuiteRole levelTier");
  }
}
