import { Request, Response, NextFunction } from "express";
import { EmployeeService } from "./employee.service";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { ListEmployeesQueryDto } from "./employee.dto";

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

}



