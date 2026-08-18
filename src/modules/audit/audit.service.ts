import mongoose from "mongoose";
import { SessionLogModel, SessionEventType } from "./session-log.model";
import { ActionLogModel } from "./action-log.model";

export class AuditService {

  async logSessionEvent(params: {
    tenantId?: string; userId?: string; email: string; eventType: SessionEventType;
    ipAddress?: string; userAgent?: string; jti?: string; failureReason?: string;
  }): Promise<void> {
    try {
      await SessionLogModel.create({
        tenantId: params.tenantId ? new mongoose.Types.ObjectId(params.tenantId) : undefined,
        userId: params.userId ? new mongoose.Types.ObjectId(params.userId) : undefined,
        email: params.email, eventType: params.eventType,
        ipAddress: params.ipAddress, userAgent: params.userAgent,
        jti: params.jti, failureReason: params.failureReason,
        sessionStart: params.eventType === SessionEventType.LOGIN ? new Date() : undefined,
        sessionEnd: params.eventType === SessionEventType.LOGOUT ? new Date() : undefined,
      });
    } catch { /* never let logging break the actual request */ }
  }

  async logAction(params: {
    tenantId: string; userId: string; userEmail: string; module: string; action: string;
    resourceType: string; resourceId?: string; oldValue?: unknown; newValue?: unknown;
    ipAddress?: string; requestId?: string; success?: boolean; errorMessage?: string;
  }): Promise<void> {
    try {
      await ActionLogModel.create({
        tenantId: new mongoose.Types.ObjectId(params.tenantId),
        userId: new mongoose.Types.ObjectId(params.userId),
        userEmail: params.userEmail, module: params.module, action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ? new mongoose.Types.ObjectId(params.resourceId) : undefined,
        oldValue: params.oldValue, newValue: params.newValue,
        ipAddress: params.ipAddress, requestId: params.requestId,
        success: params.success ?? true, errorMessage: params.errorMessage,
      });
    } catch { /* never let logging break the actual request */ }
  }
}

export const auditService = new AuditService();