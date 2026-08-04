import { LRUCache } from "lru-cache";
import { DepartmentModel } from "../../department/department.model";
import { DesignationModel } from "../../designation/designation.model";
import { BranchModel } from "../../branch/branch.model";
import mongoose from "mongoose";

export interface MasterDataMaps {
  departments: any[];
  designations: any[];
  branches: any[];
}

const masterDataCache = new LRUCache<string, MasterDataMaps>({
  max: 200,            // bounded by concurrent active tenants doing imports
  ttl: 1000 * 60 * 15, // 15 minutes TTL
});

export async function getMasterDataMaps(tenantId: string): Promise<MasterDataMaps> {
  const cacheKey = `masterdata:${tenantId}`;
  const cached = masterDataCache.get(cacheKey);
  if (cached) return cached;

  const tenantIdObj = new mongoose.Types.ObjectId(tenantId);
  const [departments, designations, branches] = await Promise.all([
    DepartmentModel.find({ tenantId: tenantIdObj, isDeleted: false }).lean(),
    DesignationModel.find({ tenantId: tenantIdObj, isDeleted: false }).lean(),
    BranchModel.find({ tenantId: tenantIdObj, isDeleted: false }).lean(),
  ]);

  const maps = { departments, designations, branches };
  masterDataCache.set(cacheKey, maps);
  return maps;
}

export function invalidateMasterDataCache(tenantId: string) {
  masterDataCache.delete(`masterdata:${tenantId}`);
}
