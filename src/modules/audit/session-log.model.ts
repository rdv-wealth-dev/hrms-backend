import mongoose from "mongoose";
import { createOrgLevelSchema, OrgLevelDocument } from "../../shared/database/base.schema";

export enum SessionEventType {
    LOGIN = "LOGIN",
    LOGOUT = "LOGOUT",
    TOKEN_REFRESH = "TOKEN_REFRESH",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    FAILED_LOGIN = "FAILED_LOGIN"
}


export interface SessionLogDocument extends OrgLevelDocument {
    userId?: mongoose.Types.ObjectId;
    email: string;
    eventType: SessionEventType;
    ipAddress?: string;
    userAgent?: string;
    jti?: string;
    failureReason?: string;
    sessionStart?: Date;
    sessionEnd?: Date;
}

const SessionLogSchema = createOrgLevelSchema<SessionLogDocument>(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            index: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        eventType: {
            type: String,
            enum: Object.values(SessionEventType),
            required: true
        },
        ipAddress: {
            type: String,
            trim: true
        },
        userAgent: {
            type: String,
            trim: true
        },
        jti: {
            type: String,
            trim: true
        },
        failureReason: {
            type: String,
            trim: true
        },
        sessionStart: {
            type: Date
        },
        sessionEnd: {
            type: Date
        },
    },
    { collection: "session_logs" }
);


SessionLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
SessionLogSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
SessionLogSchema.index({ email: 1, eventType: 1, createdAt: -1 }); // for failed-login-across-tenants brute force detection

export const SessionLogModel = mongoose.model<SessionLogDocument>("SessionLog", SessionLogSchema);