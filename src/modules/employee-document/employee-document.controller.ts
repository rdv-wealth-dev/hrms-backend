import { Request, Response, NextFunction } from "express";
import { EmployeeDocumentService } from "./employee-document.service";
import { buildSuccessResponse } from "../../shared/database/base.schema";
import { AppError } from "../../shared/errors/app.error";

const docService = new EmployeeDocumentService();

export class EmployeeDocumentController {
  // GET /api/v1/employee-documents/:employeeId
  async getDocuments(
    req: Request<{ employeeId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.getDocuments(req.context, req.params.employeeId);
      res.status(200).json(
        buildSuccessResponse(result, "Documents fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/employee-documents/:employeeId
  async addDocument(
    req: Request<{ employeeId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.addDocument(req.context, req.params.employeeId, req.body);
      res.status(201).json(
        buildSuccessResponse(result, "Document uploaded successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/employee-documents/:employeeId/:docId
  async deleteDocument(
    req: Request<{ employeeId: string; docId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.deleteDocument(req.context, req.params.employeeId, req.params.docId);
      res.status(200).json(
        buildSuccessResponse(result, "Document removed")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/employee-documents/:employeeId/upload-url
  async requestUploadUrl(
    req: Request<{ employeeId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.requestDocumentUploadUrl(req.context, req.params.employeeId, req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Upload URL generated")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/employee-documents/:employeeId/:docId/download-url
  async getDownloadUrl(
    req: Request<{ employeeId: string; docId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.getDocumentDownloadUrl(req.context, req.params.employeeId, req.params.docId);
      res.status(200).json(
        buildSuccessResponse(result, "Download URL generated")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/employee-documents/:employeeId/upload
  async uploadDocumentDirectly(
    req: Request<{ employeeId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError("No file uploaded", 400);
      }
      const result = await docService.uploadDocumentDirectly(
        req.context,
        req.params.employeeId,
        req.file,
        req.body.documentType
      );
      res.status(201).json(
        buildSuccessResponse(result, "Document uploaded successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // ── Self-Service (Employee Portal) ──

  // GET /api/v1/employee-documents/me
  async getMyDocuments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.getMyDocuments(req.context);
      res.status(200).json(
        buildSuccessResponse(result, "Your documents fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/employee-documents/me
  async addMyDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.addMyDocument(req.context, req.body);
      res.status(201).json(
        buildSuccessResponse(result, "Document uploaded successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/employee-documents/me/:docId
  async deleteMyDocument(
    req: Request<{ docId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.deleteMyDocument(req.context, req.params.docId);
      res.status(200).json(
        buildSuccessResponse(result, "Document removed")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/employee-documents/me/upload-url
  async requestMyUploadUrl(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.requestMyUploadUrl(req.context, req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Upload URL generated")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/employee-documents/me/:docId/download-url
  async getMyDownloadUrl(
    req: Request<{ docId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.getMyDownloadUrl(req.context, req.params.docId);
      res.status(200).json(
        buildSuccessResponse(result, "Download URL generated")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/employee-documents/me/upload
  async uploadMyDocumentDirectly(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError("No file uploaded", 400);
      }
      const result = await docService.uploadMyDocumentDirectly(
        req.context,
        req.file,
        req.body.documentType
      );
      res.status(201).json(
        buildSuccessResponse(result, "Document uploaded successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // ── Verification (Admin Dashboard) ──

  // GET /api/v1/employee-documents/verification/pending
  async getPendingDocuments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.getPendingDocuments(req.context);
      res.status(200).json(
        buildSuccessResponse(result, "Pending documents fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/employee-documents/:docId/verify
  async verifyDocument(
    req: Request<{ docId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await docService.verifyDocument(req.context, req.params.docId, req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Document verification updated")
      );
    } catch (error) {
      next(error);
    }
  }
}
