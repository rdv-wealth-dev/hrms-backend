import mongoose from 'mongoose';
import { SessionLogModel } from './session-log.model';
import { ActionLogModel } from './action-log.model';
import { RequestContext } from '../../shared/types/request-context.interface';

export class AuditRepository {

    async findSessions(context: RequestContext, filters: Record<string, unknown>, page: number, pageSize: number) {
        const query = { tenantId: new mongoose.Types.ObjectId(context.tenantId), ...filters };
        const skip = (page - 1) * pageSize;
        const safe = Math.min(pageSize, 100);
        const [data, totalRecords] = await Promise.all([
            SessionLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(safe).lean(),
            SessionLogModel.countDocuments(query),
        ]);
        return { data, totalRecords, pageNumber: page, pageSize: safe };
    }

    async findActions(context: RequestContext, filters: Record<string, unknown>, page: number, pageSize: number) {
        const query = { tenantId: new mongoose.Types.ObjectId(context.tenantId), ...filters };
        const skip = (page - 1) * pageSize;
        const safe = Math.min(pageSize, 100);
        const [data, totalRecords] = await Promise.all([
            ActionLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(safe).lean(),
            ActionLogModel.countDocuments(query),
        ]);
        return { data, totalRecords, pageNumber: page, pageSize: safe };
    }
}