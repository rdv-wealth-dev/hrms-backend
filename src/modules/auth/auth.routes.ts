import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validateBody, validateQuery } from "../../core/validators/validate.middleware";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { loginRateLimiter } from "../../core/middlewares/rate-limiter.middleware";
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ActivateAccountDto,
  ResendVerificationEmailDto,
  CheckSlugDto,
  OnboardingWizardDto,
  CheckEmailDto,           // SSO detection + workspace branding
} from "./auth.dto";

const router = Router();
const controller = new AuthController();

//Public routes — no auth require

// POST /api/v1/auth/register
router.post(
  "/register",
  validateBody(RegisterDto),
  controller.register.bind(controller)
);

// POST /api/v1/auth/activate-account
router.post(
  "/activate-account",
  validateBody(ActivateAccountDto),
  controller.activateAccount.bind(controller)
);

// POST /api/v1/auth/login
// Layer 1: burst guard → max 3 taps / 10 s, then 15-min IP+email lockout
router.post(
  "/login",
  loginRateLimiter,
  validateBody(LoginDto),
  controller.login.bind(controller)
);

// POST /api/v1/auth/verify-email
router.post(
  "/verify-email",
  validateBody(VerifyEmailDto),
  controller.verifyEmail.bind(controller)
);

// POST /api/v1/auth/resend-verification
router.post(
  "/resend-verification",
  validateBody(ResendVerificationEmailDto),
  controller.resendVerification.bind(controller)
);

// POST /api/v1/auth/refresh
router.post(
  "/refresh",
  validateBody(RefreshTokenDto),
  controller.refresh.bind(controller)
);

// POST /api/v1/auth/forgot-password
router.post(
  "/forgot-password",
  validateBody(ForgotPasswordDto),
  controller.forgotPassword.bind(controller)
);

// POST /api/v1/auth/reset-password
router.post(
  "/reset-password",
  validateBody(ResetPasswordDto),
  controller.resetPassword.bind(controller)
);

// GET /api/v1/auth/check-slug?slug=acme — real-time subdomain availability check
router.get(
  "/check-slug",
  validateQuery(CheckSlugDto),
  controller.checkSlug.bind(controller)
);

// POST /api/v1/auth/check-email — SSO detection + workspace branding
// Called real-time as user finishes typing email on the login page
router.post(
  "/check-email",
  validateBody(CheckEmailDto),
  controller.checkEmail.bind(controller)
);

// POST /api/v1/auth/magic-link — passwordless login (Phase 2 ready)
// Uncomment when magic link is implemented
// router.post("/magic-link", validateBody(MagicLinkDto), controller.magicLink.bind(controller));

//Protected routes — auth required

// POST /api/v1/auth/complete-onboarding — Step 2 wizard submit
router.post(
  "/complete-onboarding",
  authenticate,
  validateBody(OnboardingWizardDto),
  controller.completeOnboarding.bind(controller)
);

// GET /api/v1/auth/me
router.get(
  "/me",
  authenticate,
  controller.getMe.bind(controller)
);

// POST /api/v1/auth/logout
router.post(
  "/logout",
  authenticate,
  controller.logout.bind(controller)
);

export default router;