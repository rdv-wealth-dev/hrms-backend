export interface RequestContext {
  tenantId: string;
  userId: string;
  role: string;
  branchIds: string[];
  requestId?: string;
}
