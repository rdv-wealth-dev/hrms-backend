export interface RequestContext{
    tenantId: string,
    userId: string,
    role: string,
    branchIds : string[],
    permissions: string[],
    requestId?: string,
}