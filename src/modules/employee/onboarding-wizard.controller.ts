import { Request, Response, NextFunction } from "express";
import { onboardingWizardService } from "./onboarding-wizard.service";
import { buildSuccessResponse } from "../../core/database/base.schema";

export class OnboardingWizardController {

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.getStatus(req.context);
      res.status(200).json(buildSuccessResponse(result, "Onboarding status fetched"));
    } catch (e) { next(e); }
  }

  async step1(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.submitStep1(req.context, req.body);
      res.status(200).json(buildSuccessResponse(result, result.message));
    } catch (e) { next(e); }
  }

  async step2(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.submitStep2(req.context, req.body);
      res.status(200).json(buildSuccessResponse(result, result.message));
    } catch (e) { next(e); }
  }

  async step3(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.submitStep3(req.context, req.body);
      res.status(200).json(buildSuccessResponse(result, result.message));
    } catch (e) { next(e); }
  }

  async step4(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.confirmStep4(req.context);
      res.status(200).json(buildSuccessResponse(result, result.message));
    } catch (e) { next(e); }
  }

  async step5(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await onboardingWizardService.submitStep5(req.context);
      res.status(200).json(buildSuccessResponse(result, result.message));
    } catch (e) { next(e); }
  }
}