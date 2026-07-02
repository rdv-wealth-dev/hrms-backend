import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { AppError } from "../../core/errors/app.error";

const authService = new AuthService();

export class AuthController {

  // POST /api/v1/auth/register
  async register(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(
        buildSuccessResponse(result, "Company registered successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/activate-account
  async activateAccount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.activateAccount(req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Account activated successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  //POST /api/v1/auth/login
  async login(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Login successful")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/verify-email
  async verifyEmail(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.verifyEmail(req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Email verification processed")
      );
    } catch (error) {
      next(error);
    }
  }

  //POST /api/v1/auth/refresh
  async refresh(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.refreshToken(req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Token refreshed successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  //GET /api/v1/auth/me
  async getMe(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.context?.userId) {
        next(new AppError("Unauthorized", 401));
        return;
      }

      const result = await authService.getMe(req.context.userId);
      res.status(200).json(
        buildSuccessResponse(result, "Profile fetched successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/forgot-password
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.forgotPassword(req.body);
      res.status(200).json(buildSuccessResponse(result, result.message));
    } catch (error) { next(error); }
  }

  // POST /api/v1/auth/reset-password
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.resetPassword(req.body);
      res.status(200).json(buildSuccessResponse(result, "Password reset successful"));
    } catch (error) { next(error); }
  }

  // POST /api/v1/auth/logout
  async logout(
    _req: Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Token discarded on client side
      // Redis jti blacklist added in Phase 12
      res.status(200).json(
        buildSuccessResponse(null, "Logged out successfully")
      );
    } catch (error) {
      next(error);
    }
  }
}