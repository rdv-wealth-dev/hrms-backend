import mongoose from "mongoose";
import { EmployeeDocumentRepository } from "./employee-document.repository";
import { EmployeeDocumentModel, DocumentType } from "./employee-document.model";
import { EmployeeModel } from "../employee/models/employee.model";
import { OrganizationModel } from "../organization/organization.model";
import { UserModel } from "../user/user.model";
import { s3Service } from "../../shared/services/storage.service";
import { AppError } from "../../shared/errors/app.error";
import { RequestContext } from "../../shared/types/request-context.interface";
import { recalculateProfileCompletion } from "../employee/sub-modules/profile/profile-completion.util";
import { CountryRegistry } from "../../domain/localization/country.registry";
import {
  AddDocumentInput,
  RequestUploadUrlInput,
  VerifyDocumentInput,
  assertValidDocumentFile,
} from "./employee-document.dto";

export class EmployeeDocumentService {
  private docRepo = new EmployeeDocumentRepository();

  private async resolveOwnEmployeeIdForSelfService(context: RequestContext): Promise<string> {
    const user = await UserModel.findOne({
      _id: new mongoose.Types.ObjectId(context.userId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
    }).select("employeeId");

    if (!user?.employeeId) {
      throw new AppError("No employee record is linked to this account", 404);
    }
    return user.employeeId.toString();
  }

  private async findEmployee(context: RequestContext, employeeId: string) {
    const employee = await EmployeeModel.findOne({
      _id: new mongoose.Types.ObjectId(employeeId),
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
    });
    return employee;
  }

  async getDocuments(context: RequestContext, employeeId: string) {
    const employee = await this.findEmployee(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    return this.docRepo.getDocuments(context, employeeId);
  }

  async getMyDocuments(context: RequestContext) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.getDocuments(context, employeeId);
  }

  async addDocument(context: RequestContext, employeeId: string, input: AddDocumentInput) {
    const employee = await this.findEmployee(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    assertValidDocumentFile(input.mimeType, input.sizeBytes);

    // Dynamic country plugin validation hook for verifying document type eligibility
    const countryCode = employee.countryCode || "IN";
    const plugin = CountryRegistry.resolve(countryCode);
    const isValidType = plugin.statutoryFields.some(f => f.key === input.documentType) || 
                        ["OFFER_LETTER", "RESUME", "DEGREE", "EXPERIENCE", "OTHER"].includes(input.documentType);
    if (!isValidType) {
      throw new AppError(`Document type "${input.documentType}" is not supported for country ${countryCode}`, 400);
    }

    const doc = await this.docRepo.addDocument({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: employee.branchId as any,
      employeeId: new mongoose.Types.ObjectId(employeeId) as any,
      documentType: input.documentType as any,
      fileName: input.fileName,
      s3Key: input.s3Key,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedBy: new mongoose.Types.ObjectId(context.userId) as any,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      isVerified: false,
      createdBy: new mongoose.Types.ObjectId(context.userId) as any,
      updatedBy: new mongoose.Types.ObjectId(context.userId) as any,
    });

    await recalculateProfileCompletion(context.tenantId, employeeId);
    return doc;
  }

  async addMyDocument(context: RequestContext, input: AddDocumentInput) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.addDocument(context, employeeId, input);
  }

  async deleteDocument(context: RequestContext, employeeId: string, docId: string) {
    const employee = await this.findEmployee(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    await this.docRepo.deleteDocument(docId);
    await recalculateProfileCompletion(context.tenantId, employeeId);
    return { message: "Document removed successfully" };
  }

  async deleteMyDocument(context: RequestContext, docId: string) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.deleteDocument(context, employeeId, docId);
  }

  async requestDocumentUploadUrl(context: RequestContext, employeeId: string, input: RequestUploadUrlInput) {
    const employee = await this.findEmployee(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    assertValidDocumentFile(input.mimeType, 1);

    const org = await OrganizationModel.findById(context.tenantId).select("slug");
    const slug = org?.slug ?? context.tenantId;

    const s3Key = s3Service.buildDocumentKey(slug, employeeId, input.documentType, input.fileName);
    const { uploadUrl, expiresIn } = await s3Service.getUploadUrl(s3Key, input.mimeType);

    return {
      uploadUrl,
      expiresIn,
      s3Key,
      documentType: input.documentType,
      fileName: input.fileName,
    };
  }

  async requestMyUploadUrl(context: RequestContext, input: RequestUploadUrlInput) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.requestDocumentUploadUrl(context, employeeId, input);
  }

  async getDocumentDownloadUrl(context: RequestContext, employeeId: string, docId: string) {
    const employee = await this.findEmployee(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    const documents = await this.docRepo.getDocuments(context, employeeId);
    const doc = documents.find(d => d._id.toString() === docId);
    if (!doc) throw new AppError("Document not found", 404);

    const downloadUrl = await s3Service.getDownloadUrl(doc.s3Key);
    return { downloadUrl, fileName: doc.fileName, expiresIn: 900 };
  }

  async getMyDownloadUrl(context: RequestContext, docId: string) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.getDocumentDownloadUrl(context, employeeId, docId);
  }

  async uploadDocumentDirectly(context: RequestContext, employeeId: string, file: Express.Multer.File, documentType: string) {
    const employee = await this.findEmployee(context, employeeId);
    if (!employee) throw new AppError("Employee not found", 404);

    assertValidDocumentFile(file.mimetype, file.size);

    const org = await OrganizationModel.findById(context.tenantId).select("slug");
    const slug = org?.slug ?? context.tenantId;

    const s3Key = s3Service.buildDocumentKey(slug, employeeId, documentType, file.originalname);
    await s3Service.uploadObject(s3Key, file.buffer, file.mimetype);

    const doc = await this.docRepo.addDocument({
      tenantId: new mongoose.Types.ObjectId(context.tenantId) as any,
      branchId: employee.branchId as any,
      employeeId: new mongoose.Types.ObjectId(employeeId) as any,
      documentType: documentType as any,
      fileName: file.originalname,
      s3Key: s3Key,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedBy: new mongoose.Types.ObjectId(context.userId) as any,
      isVerified: false,
      createdBy: new mongoose.Types.ObjectId(context.userId) as any,
      updatedBy: new mongoose.Types.ObjectId(context.userId) as any,
    });

    await recalculateProfileCompletion(context.tenantId, employeeId);
    return doc;
  }

  async uploadMyDocumentDirectly(context: RequestContext, file: Express.Multer.File, documentType: string) {
    const employeeId = await this.resolveOwnEmployeeIdForSelfService(context);
    return this.uploadDocumentDirectly(context, employeeId, file, documentType);
  }

  async getPendingDocuments(context: RequestContext) {
    return this.docRepo.getPendingDocuments(context);
  }

  async verifyDocument(context: RequestContext, docId: string, input: VerifyDocumentInput) {
    const doc = await this.docRepo.verifyDocument(docId, input.isVerified, context.userId);
    if (!doc) throw new AppError("Document not found", 404);

    await recalculateProfileCompletion(context.tenantId, doc.employeeId.toString());
    return doc;
  }
}
