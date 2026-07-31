import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { OrganizationRepository } from "../organization/organization.repository";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { AppError } from "../../core/errors/app.error";
import { auditService } from "../audit/audit.service";
import { SessionEventType } from "../audit/session-log.model";

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
      const ip           = req.ip ?? (req.headers["x-forwarded-for"] as string) ?? "unknown";
      const device       = (req.headers["user-agent"] as string) ?? "unknown";
      const rememberDevice = req.body.rememberDevice === true;

      const result = await authService.login(req.body, { ip, device, rememberDevice });
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
  async forgotPassword(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.forgotPassword(req.body);
      res.status(200).json(
        buildSuccessResponse(result, result.message)
      );
    } catch (error) { 
      next(error); 
    }
  }

  // POST /api/v1/auth/reset-password
  async resetPassword(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.resetPassword(req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Password reset successful")
      );
    } catch (error) {
       next(error); 
      }
  }

  // POST /api/v1/auth/logout
  async logout(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (req.context) {
        await auditService.logSessionEvent({
          tenantId: req.context.tenantId,
          userId: req.context.userId,
          email: "",
          eventType: SessionEventType.LOGOUT,
        });
      }

      // Token discarded on client side
      // Redis jti blacklist added in Phase 12
      res.status(200).json(
        buildSuccessResponse(null, "Logged out successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/resend-verification
  async resendVerification(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.resendVerificationEmail(req.body);
      res.status(200).json(
        buildSuccessResponse(result, "Verification email resent successfully")
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/auth/check-slug?slug=acme
  async checkSlug(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { slug } = req.query as { slug: string };
      const orgRepo = new OrganizationRepository();
      const taken = await orgRepo.workspaceSlugExists(slug);
      if (!taken) {
        res.status(200).json(
          buildSuccessResponse({ available: true, slug }, "Slug is available")
        );
        return;
      }
      const suggestions = await orgRepo.suggestSlugs(slug);
      res.status(200).json(
        buildSuccessResponse(
          { available: false, slug, suggestions },
          "Slug is taken"
        )
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/complete-onboarding
  async completeOnboarding(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        next(new AppError("Unauthorized", 401));
        return;
      }
      const result = await authService.completeOnboarding(
        req.context.tenantId,
        req.context.userId,
        req.body
      );
      res.status(200).json(
        buildSuccessResponse(result, "Workspace setup complete")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/check-email — SSO detection + workspace branding
  // Called when user finishes typing email on login page (before password field appears)
  async checkEmail(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.checkEmail(req.body.email);
      res.status(200).json(
        buildSuccessResponse(result, "Email check complete")
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/change-password
  async changePassword(
    req:  Request,
    res:  Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.context?.userId) {
        next(new AppError("Unauthorized", 401));
        return;
      }
      const result = await authService.changePassword(
        req.context.userId,
        req.body
      );
      res.status(200).json(
        buildSuccessResponse(result, "Password changed successfully")
      );
    } catch (error) {
      next(error);
    }
  }
}