import { Request, Response, NextFunction } from "express";
import { LoanService } from "../services/loan.service";
import {
  CreateLoanDto,
  UpdateLoanDto,
  ApproveLoanDto,
  RejectLoanDto,
  ListLoansQueryDto,
} from "../dto/loan.dto";
import { buildSuccessResponse } from "../../../shared/database/base.schema";

const loanService = new LoanService();

export class LoanController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = CreateLoanDto.parse(req.body);
      const result = await loanService.createLoan(req.context!, input);
      res.status(201).json(buildSuccessResponse(result, "Loan / Advance created successfully"));
    } catch (e) {
      next(e);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = ListLoansQueryDto.parse(req.query);
      const result = await loanService.listLoans(req.context!, query);
      res.status(200).json(buildSuccessResponse(result, "Loans retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }

  async getMyLoans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await loanService.getMyLoans(req.context!);
      res.status(200).json(buildSuccessResponse(result, "Your loans retrieved successfully"));
    } catch (e) {
      next(e);
    }
  }

  async getById(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await loanService.getLoanById(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse(result, "Loan details retrieved"));
    } catch (e) {
      next(e);
    }
  }

  async approve(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = ApproveLoanDto.parse(req.body);
      const result = await loanService.approveLoan(req.context!, req.params.id, input);
      res.status(200).json(buildSuccessResponse(result, "Loan approved successfully and scheduled for EMI deductions"));
    } catch (e) {
      next(e);
    }
  }

  async reject(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = RejectLoanDto.parse(req.body);
      const result = await loanService.rejectLoan(req.context!, req.params.id, input);
      res.status(200).json(buildSuccessResponse(result, "Loan rejected"));
    } catch (e) {
      next(e);
    }
  }

  async update(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = UpdateLoanDto.parse(req.body);
      const result = await loanService.updateLoan(req.context!, req.params.id, input);
      res.status(200).json(buildSuccessResponse(result, "Loan updated successfully"));
    } catch (e) {
      next(e);
    }
  }

  async delete(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      await loanService.deleteLoan(req.context!, req.params.id);
      res.status(200).json(buildSuccessResponse(null, "Loan removed successfully"));
    } catch (e) {
      next(e);
    }
  }
}
