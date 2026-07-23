import { Router } from "express";
import { OnboardingWizardController } from "./onboarding-wizard.controller";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { validateBody } from "../../core/validators/validate.middleware";
import {
  OnboardingStep1Dto,
  OnboardingStep2Dto,
  OnboardingStep3Dto,
} from "./onboarding-wizard.dto";

const router = Router();
const controller = new OnboardingWizardController();

router.use(authenticate);
// NOTE: deliberately NOT gated by requireCompleteProfile — this IS the
// route that completes the profile, gating it here would create a lock-out

router.get(
    "/status",  
    controller.getStatus.bind(controller)
);

router.post(
    "/step-1", 
    validateBody(OnboardingStep1Dto), 
    controller.step1.bind(controller)
);

router.post(
    "/step-2", 
    validateBody(OnboardingStep2Dto), 
    controller.step2.bind(controller)
);

router.post(
    "/step-3", 
    validateBody(OnboardingStep3Dto), 
    controller.step3.bind(controller)
);

router.post(
    "/step-4", 
    controller.step4.bind(controller)
); // no body — checks uploaded docs

router.post(
    "/step-5", 
    controller.step5.bind(controller)
); // no body — final confirm


export default router;