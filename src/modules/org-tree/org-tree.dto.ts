import { CSuiteRole, WorkRelationshipType } from "./org-tree.model";


export interface CreateOrgNodeDto {
  title: string;
  code?: string;
  departmentId?: string;
  parentId?: string | null;
  cSuiteRole?: CSuiteRole;
  levelTier: number;
  levelName: string;
  description?: string;
  branchId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateOrgNodeDto {
  title?: string;
  code?: string;
  departmentId?: string;
  parentId?: string | null;
  cSuiteRole?: CSuiteRole;
  levelTier?: number;
  levelName?: string;
  description?: string;
  actingNodeId?: string | null;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

export interface AssignEmployeeNodeDto {
  nodeId: string;
  employeeId: string;
  isPrimary?: boolean;
  isActing?: boolean;
  startDate?: string;
  endDate?: string | null;
}


export interface CreateWorkSubmissionRouteDto {
  fromNodeId: string;
  toNodeId: string;
  relationshipType: WorkRelationshipType;
  projectName?: string;
  startDate?: string;
  endDate?: string | null;
  notes?: string;
}

export interface ReparentSubtreeDto {
  nodeId: string;
  newParentId: string | null;
}
