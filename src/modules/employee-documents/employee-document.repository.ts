import mongoose from "mongoose";
import { EmployeeDocumentRecord, EmployeeDocumentModel } from "./employee-document.model";
import { RequestContext } from "../../core/interfaces/request-context.interface";

export class EmployeeDocumentRepository {
  async addDocument(
    data: Partial<EmployeeDocumentRecord>
  ): Promise<EmployeeDocumentRecord> {
    return new EmployeeDocumentModel(data).save();
  }

  async getDocuments(
    context: RequestContext,
    employeeId: string
  ): Promise<EmployeeDocumentRecord[]> {
    return EmployeeDocumentModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    }).sort({ createdAt: -1 });
  }

  async deleteDocument(id: string): Promise<void> {
    await EmployeeDocumentModel.findByIdAndUpdate(
      id,
      { isDeleted: true }
    );
  }

  async getPendingDocuments(context: RequestContext) {
    return EmployeeDocumentModel.find({
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isVerified: false,
      isDeleted: false,
    }).populate("employeeId", "employeeCode firstName lastName").sort({ createdAt: 1 });
  }

  async verifyDocument(id: string, isVerified: boolean, verifiedBy: string) {
    return EmployeeDocumentModel.findByIdAndUpdate(
      id,
      { isVerified, updatedBy: new mongoose.Types.ObjectId(verifiedBy) },
      { new: true }
    );
  }
}
