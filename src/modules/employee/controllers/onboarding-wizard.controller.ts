import { Request, Response, NextFunction } from "express";
import { onboardingWizardService } from "../services/onboarding-wizard.service";
import { buildSuccessResponse } from "../../../shared/database/base.schema";

export class OnboardingWizardController {

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.getStatus(req.context);
      res.status(200).json(
        buildSuccessResponse(
          result, "Onboarding status fetched"));
    } catch (e) {
      next(e);
    }
  }

  async getEducationOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const qualificationLevel = typeof req.query.qualificationLevel === "string"
        ? req.query.qualificationLevel
        : typeof req.query.level === "string"
          ? req.query.level
          : undefined;
      const result = onboardingWizardService.getEducationOptions(qualificationLevel);
      res.status(200).json(
        buildSuccessResponse(result, "Education options fetched successfully")
      );
    } catch (e) {
      next(e);
    }
  }

  async step1(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.submitStep1(req.context, req.body);
      res.status(200).json(
        buildSuccessResponse(
          result, result.message)
      );
    } catch (e) {
      next(e);
    }
  }

  async step2(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.submitStep2(req.context, req.body);
      res.status(200).json(
        buildSuccessResponse(
          result, result.message)
      );
    } catch (e) {
      next(e);
    }
  }

  async step3(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.submitStep3(req.context, req.body);
      res.status(200).json(
        buildSuccessResponse(
          result, result.message)
      );
    } catch (e) {
      next(e);
    }
  }

  async step4(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.confirmStep4(req.context);
      res.status(200).json(
        buildSuccessResponse(
          result, result.message)
      );
    } catch (e) {
      next(e);
    }
  }

  async step5(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.submitStep5(req.context);
      res.status(200).json(
        buildSuccessResponse(
          result, result.message)
      );
    } catch (e) {
      next(e);
    }
  }

  async skip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const step = req.body?.step ? Number(req.body.step) : undefined;
      const result = await onboardingWizardService.skipStep(req.context, step);
      res.status(200).json(
        buildSuccessResponse(result, result.message)
      );
    } catch (e) {
      next(e);
    }
  }

  async navigate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const step = Number(req.body.step);
      const result = await onboardingWizardService.navigateStep(req.context, step);
      res.status(200).json(
        buildSuccessResponse(result, result.message)
      );
    } catch (e) {
      next(e);
    }
  }
}