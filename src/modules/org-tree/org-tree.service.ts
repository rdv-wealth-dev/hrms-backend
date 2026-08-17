import mongoose, { Types } from "mongoose";
import { OrgTreeRepository } from "./org-tree.repository";
import {
  CreateOrgNodeDto,
  UpdateOrgNodeDto,
  AssignEmployeeNodeDto,
  CreateWorkSubmissionRouteDto,
  ReparentSubtreeDto,
} from "./org-tree.dto";
import { CSuiteRole, IOrgNode } from "./org-tree.model";

export class OrgTreeService {
  private repo: OrgTreeRepository;

  constructor() {
    this.repo = new OrgTreeRepository();
  }

  // 1. Create a dynamic position/node
  async createNode(tenantId: string, dto: CreateOrgNodeDto): Promise<IOrgNode> {
    // Parent Validation
    let parentObjectId: Types.ObjectId | null = null;
    if (dto.parentId) {
      const parentNode = await this.repo.findNodeById(tenantId, dto.parentId);
      if (!parentNode) {
        throw new Error("Specified parent node does not exist in this organization");
      }
      parentObjectId = parentNode._id;
    }

    const nodeDoc = await this.repo.createNode({
      tenantId: new Types.ObjectId(tenantId),
      ...(dto.branchId ? { branchId: new Types.ObjectId(dto.branchId) } : {}),
      title: dto.title,
      code: dto.code,
      ...(dto.departmentId ? { departmentId: new Types.ObjectId(dto.departmentId) } : {}),
      parentId: parentObjectId,
      cSuiteRole: dto.cSuiteRole || CSuiteRole.NONE,
      levelTier: dto.levelTier,
      levelName: dto.levelName,
      isVacant: true,
      description: dto.description,
      metadata: dto.metadata || {},
      isActive: true,
      isDeleted: false,
    });

    return nodeDoc;
  }

  // 2. Update Node
  async updateNode(tenantId: string, nodeId: string, dto: UpdateOrgNodeDto): Promise<IOrgNode | null> {
    const updateData: any = { ...dto };
    if (dto.parentId !== undefined) {
      updateData.parentId = dto.parentId ? new Types.ObjectId(dto.parentId) : null;
    }
    if (dto.departmentId !== undefined) {
      updateData.departmentId = dto.departmentId ? new Types.ObjectId(dto.departmentId) : null;
    }
    if (dto.actingNodeId !== undefined) {
      updateData.actingNodeId = dto.actingNodeId ? new Types.ObjectId(dto.actingNodeId) : null;
    }

    return await this.repo.updateNode(tenantId, nodeId, updateData);
  }

  // 3. Assign Person to Seat (Node)
  async assignEmployeeToNode(tenantId: string, dto: AssignEmployeeNodeDto) {
    const node = await this.repo.findNodeById(tenantId, dto.nodeId);
    if (!node) throw new Error("Target Org Node not found");

    if (dto.isPrimary) {
      // Unassign existing active primary assignments on this seat
      await this.repo.unassignNodeEmployees(tenantId, dto.nodeId);
    }

    const assignment = await this.repo.assignEmployee({
      tenantId: new Types.ObjectId(tenantId),
      nodeId: node._id,
      employeeId: new Types.ObjectId(dto.employeeId),
      isPrimary: dto.isPrimary ?? true,
      isActing: dto.isActing ?? false,
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      isActive: true,
      isDeleted: false,
    });

    // Mark Node as filled (not vacant)
    await this.repo.updateNode(tenantId, dto.nodeId, { isVacant: false });

    return assignment;
  }

  // 4. Create Work Submission / Matrix Route
  async createWorkRoute(tenantId: string, dto: CreateWorkSubmissionRouteDto) {
    const [fromNode, toNode] = await Promise.all([
      this.repo.findNodeById(tenantId, dto.fromNodeId),
      this.repo.findNodeById(tenantId, dto.toNodeId),
    ]);

    if (!fromNode || !toNode) {
      throw new Error("Source or destination node does not exist");
    }

    return await this.repo.createWorkRoute({
      tenantId: new Types.ObjectId(tenantId),
      fromNodeId: fromNode._id,
      toNodeId: toNode._id,
      relationshipType: dto.relationshipType,
      projectName: dto.projectName,
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      notes: dto.notes,
      isActive: true,
      isDeleted: false,
    });
  }

  // 5. Reparent Sub-Tree without breaking workflows (Re-org Safe)
  async reparentSubtree(tenantId: string, dto: ReparentSubtreeDto) {
    if (dto.nodeId === dto.newParentId) {
      throw new Error("A node cannot be its own parent");
    }

    // Circular check: Make sure new parent is not inside descendant list
    if (dto.newParentId) {
      const downline = await this.repo.getDownlineSubtree(tenantId, dto.nodeId);
      const descendantIds = downline[0]?.descendants?.map((d: any) => d._id.toString()) || [];
      if (descendantIds.includes(dto.newParentId)) {
        throw new Error("Cannot move a node under one of its own descendants (Circular reporting loop prevented)");
      }
    }

    const newParentObjectId = dto.newParentId ? new Types.ObjectId(dto.newParentId) : null;
    return await this.repo.updateNode(tenantId, dto.nodeId, { parentId: newParentObjectId });
  }

  // 6. Fetch Full Tree Structure
  async getFullHierarchy(tenantId: string) {
    const rawNodes = await this.repo.getFullHierarchyTree(tenantId);

    // Construct nested JSON tree in-memory
    const nodeMap = new Map<string, any>();
    const rootNodes: any[] = [];

    rawNodes.forEach((node: any) => {
      nodeMap.set(node._id.toString(), {
        id: node._id,
        title: node.title,
        code: node.code,
        cSuiteRole: node.cSuiteRole,
        levelTier: node.levelTier,
        levelName: node.levelName,
        isVacant: node.isVacant,
        actingNodeId: node.actingNodeId,
        department: node.departmentDetails || null,
        assignedEmployee: node.assignments?.[0]?.employeeDetails || null,
        children: [],
      });
    });

    rawNodes.forEach((node: any) => {
      const mappedNode = nodeMap.get(node._id.toString());
      if (node.parentId && nodeMap.has(node.parentId.toString())) {
        nodeMap.get(node.parentId.toString()).children.push(mappedNode);
      } else {
        rootNodes.push(mappedNode);
      }
    });

    return rootNodes;
  }

  // 7. Get Work Routes for specific node
  async getNodeWorkRoutes(tenantId: string, nodeId: string) {
    return await this.repo.getWorkRoutesForNode(tenantId, nodeId);
  }
}
