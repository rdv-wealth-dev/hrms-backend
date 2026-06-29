import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validateBody } from "../../core/validators/validate.middleware";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { authLimiter } from "../../core/middlewares/security.middleware";
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "./auth.dto";

const router     = Router();
const controller = new AuthController();

//Public routes — no auth require

// POST /api/v1/auth/register
router.post(
  "/register",
  validateBody(RegisterDto),
  controller.register.bind(controller)
);

// POST /api/v1/auth/login
router.post(
  "/login",
  authLimiter,                        // max 10 attempts per 15 min
  validateBody(LoginDto),
  controller.login.bind(controller)
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

//Protected routes — auth required

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