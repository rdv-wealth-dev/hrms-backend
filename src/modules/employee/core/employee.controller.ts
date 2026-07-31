import { Request, Response, NextFunction } from "express";
import { EmployeeService } from "./employee.service";
import { buildSuccessResponse } from "../../../core/database/base.schema";
import { ListEmployeesQueryDto, CalendarEventsQueryDto, CropAvatarDto } from "./employee.dto";
import { AppError } from "../../../core/errors/app.error";
import { parseImportFile, buildExportBuffer, buildImportTemplate } from "./employee.utils";

const empService = new EmployeeService();

export class EmployeeController {
  // POST /api/v1/employees
  async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.createEmployee(req.context, req.body);
      res.status(201).json(
        buildSuccessResponse(result, "Employee created successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/employees
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = ListEmployeesQueryDto.parse(req.query);
      const result = await empService.listEmployees(req.context, query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/employees/:id
  async getById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getEmployeeById(req.context, req.params.id);
      res.status(200).json(
        buildSuccessResponse(result, "Employee fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/employees/:id/complete-profile
  async getCompleteProfile(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getCompleteEmployeeProfile(
        req.context, 
        req.params.id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Complete employee profile fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/employees/me
  async getMyProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getMyProfile(req.context);
      res.status(200).json(
        buildSuccessResponse(result, "Your profile fetched successfully")
      );
    } catch (error) {
      next(error)
    }
  }

  // PATCH /api/v1/employees/me  (self-service)
  async updateMyProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.updateMyProfile(req.context, req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Profile updated successfully")
      );
    } catch (error) {
      next(error)
    }
  }

  async getMyBankAccounts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getMyBankAccounts(req.context);
      res.status(200).json(
        buildSuccessResponse(result, "Your bank accounts fetched"));
    } catch (error) {
      next(error);
    }
  }

  async addMyBankAccount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.addMyBankAccount(req.context, req.body);
      res.status(201).json(
        buildSuccessResponse(result, "Bank account added"));
    } catch (error) {
      next(error);
    }
  }

  async deleteMyBankAccount(
    req: Request<{ bankId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.deleteMyBankAccount(req.context, req.params.bankId);
      res.status(200).json(
        buildSuccessResponse(result, "Bank account removed"));
    } catch (error) {
      next(error);
    }
  }

  async getMyDocuments(req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getMyDocuments(req.context);
      res.status(200).json(
        buildSuccessResponse(result, "Your documents fetched"));
    } catch (error) {
      next(error);
    }
  }

  async deleteMyDocument(
    req: Request<{ docId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.deleteMyDocument(req.context, req.params.docId);
      res.status(200).json(
        buildSuccessResponse(result, "Document removed"));
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/employees/:id
  async update(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.updateEmployee(
        req.context, req.params.id, req.body
      );
      res.status(200).json(
        buildSuccessResponse(result, "Employee updated successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/employees/:id/status
  async updateStatus(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.updateEmployeeStatus(
        req.context, req.params.id, req.body
      );
      res.status(200).json(
        buildSuccessResponse(result, "Employee status updated")
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/employees/:id
  async delete(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.deleteEmployee(
        req.context, req.params.id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Employee deleted successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/employees/:id/bank-accounts
  async addBankAccount(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.addBankAccount(
        req.context, req.params.id, req.body
      );
      res.status(201).json(
        buildSuccessResponse(result, "Bank account added successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/employees/:id/bank-accounts
  async getBankAccounts(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getBankAccounts(
        req.context, req.params.id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Bank accounts fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/employees/:id/bank-accounts/:bankId
  async deleteBankAccount(
    req: Request<{ id: string; bankId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.deleteBankAccount(
        req.context, req.params.id, req.params.bankId
      );
      res.status(200).json(
        buildSuccessResponse(result, "Bank account removed")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/employees/:id/documents
  async addDocument(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.addDocument(
        req.context, req.params.id, req.body
      );
      res.status(201).json(
        buildSuccessResponse(result, "Document added successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/employees/:id/documents
  async getDocuments(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getDocuments(
        req.context, req.params.id
      );
      res.status(200).json(
        buildSuccessResponse(result, "Documents fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/employees/:id/documents/:docId
  async deleteDocument(
    req: Request<{ id: string; docId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.deleteDocument(
        req.context, req.params.id, req.params.docId
      );
      res.status(200).json(
        buildSuccessResponse(result, "Document removed")
      );
    } catch (error) {
      next(error);
    }
  }

  // documents 

  async requestUploadUrl(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.requestDocumentUploadUrl(req.context, req.params.id, req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Upload URL generated")
      );
    } catch (error) {
      next(error);
    }
  }


  async getDownloadUrl(
    req: Request<{ id: string; docId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getDocumentDownloadUrl(req.context, req.params.id, req.params.docId);
      res.status(200).json(
        buildSuccessResponse(result, "Download URL generated")
      );
    } catch (error) {
      next(error);
    }
  }

  async getPendingDocuments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getPendingDocuments(req.context);
      res.status(200).json(
        buildSuccessResponse(result, "Pending documents fetched")
      );
    } catch (error) {
      next(error);
    }
  }

  async verifyDocument(
    req: Request<{ docId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.verifyDocument(req.context, req.params.docId, req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Document verified")
      );
    } catch (error) {
      next(error);
    }
  }

  async requestMyUploadUrl(
    req: Request,
    res: Response,
    next: NextFunction)
    : Promise<void> {
    try {
      const result = await empService.requestMyUploadUrl(req.context, req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Upload URL generated")
      );
    } catch (e) {
      next(e);
    }
  }
  async addMyDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.addMyDocument(req.context, req.body);
      res.status(201).json(
        buildSuccessResponse(result, "Document uploaded")
      );
    } catch (e) {
      next(e);
    }
  }

  async getMyDownloadUrl(
    req: Request<{ docId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getMyDownloadUrl(req.context, req.params.docId);
      res.status(200).json(
        buildSuccessResponse(result, "Download URL generated")
      );
    } catch (e) {
      next(e);
    }
  }

  async uploadMyDocumentDirectly(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError("No file uploaded", 400);
      }
      const result = await empService.uploadMyDocumentDirectly(
        req.context,
        req.file,
        req.body.documentType
      );
      res.status(201).json(
        buildSuccessResponse(result, "Document uploaded")
      );
    } catch (e) {
      next(e);
    }
  }

  async uploadDocumentDirectly(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError("No file uploaded", 400);
      }
      const result = await empService.uploadDocumentDirectly(
        req.context,
        req.params.id,
        req.file,
        req.body.documentType
      );
      res.status(201).json(
        buildSuccessResponse(result, "Document uploaded")
      );
    } catch (e) {
      next(e);
    }
  }

  // GET /api/v1/employees/events?period=TODAY&branchId=...
  async getCalendarEvents(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = CalendarEventsQueryDto.parse(req.query);
      const result = await empService.getCalendarEvents(req.context, query);
      res.status(200).json(
        buildSuccessResponse(result, "Calendar events fetched")
      );
    } catch (error) {
      next(error);
    }
  }

  async uploadMyAvatar(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError("No file uploaded", 400);
      }
      const cropParams = CropAvatarDto.parse({ ...req.query, ...req.body });
      const result = await empService.uploadMyAvatar(req.context, req.file, cropParams);
      res.status(200).json(
        buildSuccessResponse(result, "Profile picture uploaded successfully")
      );
    } catch (e) {
      next(e);
    }
  }

  async uploadAvatar(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError("No file uploaded", 400);
      }
      const cropParams = CropAvatarDto.parse({ ...req.query, ...req.body });
      const result = await empService.uploadAvatar(req.context, req.params.id, req.file, cropParams);
      res.status(200).json(
        buildSuccessResponse(result, "Profile picture uploaded successfully")
      );
    } catch (e) {
      next(e);
    }
  }

  // POST /api/v1/employees/bulk-import
  async importEmployees(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError("No import file uploaded", 400);
      }

      // Controller -> Service
      const result = await empService.importEmployees(req.context, req.file);

      res.status(200).json(
        buildSuccessResponse(result, "Bulk import processed successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/employees/bulk-export
  async exportEmployees(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const format = (req.query.format as string)?.toLowerCase() === "xlsx" ? "xlsx" : "csv";
      const filters = {
        departmentId: req.query.departmentId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        status: req.query.status as string | undefined,
      };

      // Controller -> Service
      const result = await empService.exportEmployees(req.context, format, filters);

      res.status(200).json(
        buildSuccessResponse(result, "Employee export generated successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  async downloadImportTemplate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const format = req.query.format === "csv" ? "csv" : "xlsx";
      const buffer = await buildImportTemplate(format);
      const mimeType = format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv";
      res.status(200).json(
        buildSuccessResponse({
          fileName: `employee_import_template.${format}`,
          mimeType,
          fileData: buffer.toString("base64"),
        }, "Import template generated")
      );
    } catch (e) { next(e); }
  }

  async validateImport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError("No import file uploaded", 400);
      }
      const result = await empService.validateImport(req.context, req.file);
      res.status(200).json(
        buildSuccessResponse(result, "Import file validated. Review preview details.")
      );
    } catch (e) { next(e); }
  }

  async getImportPreview(
    req: Request<{ sessionId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const pageNumber = req.query.pageNumber ? parseInt(req.query.pageNumber as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const result = await empService.getImportPreview(req.context, req.params.sessionId, pageNumber, pageSize);
      res.status(200).json(
        buildSuccessResponse(result, "Import preview page fetched")
      );
    } catch (e) { next(e); }
  }

  async commitImport(
    req: Request<{ sessionId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.commitImport(req.context, req.params.sessionId);
      res.status(200).json(
        buildSuccessResponse(result, "Employees imported successfully")
      );
    } catch (e) { next(e); }
  }

  async getImportExportHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await empService.getImportExportHistory(req.context);
      res.status(200).json(
        buildSuccessResponse(result, "Import and export history logs retrieved successfully")
      );
    } catch (e) { next(e); }
  }
}



