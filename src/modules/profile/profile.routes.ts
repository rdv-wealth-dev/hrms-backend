import { Router } from "express";
import { authenticate } from "../../core/middlewares/auth.middleware";
import { buildSuccessResponse } from "../../core/database/base.schema";
import { ProfileService } from "./profile.service";

const router = Router();
const profileService = new ProfileService();

router.use(authenticate);

// GET /api/v1/profile/me — single call, everything the self-service dashboard needs
router.get("/me", async (req: any, res, next) => {
  try {
    const result = await profileService.getMyFullProfile(req.context);
    res.status(200).json(buildSuccessResponse(result, "Profile fetched successfully"));
  } catch (error) { next(error); }
});

export default router;