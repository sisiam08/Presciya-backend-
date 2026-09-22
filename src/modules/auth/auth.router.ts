import { Router } from "express";
import { AuthControllers } from "./auth.controller";
import { AuthValidation } from "./auth.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly } from "../../middleware/auth";
import { authLimiter } from "../../middleware/rateLimiter";

const router = Router();

router.post(
  "/sendOTP",
  authLimiter,
  validateRequest(AuthValidation.SendOtpSchema),
  AuthControllers.sendOTP,
);

router.post(
  "/signup",
  authLimiter,
  validateRequest(AuthValidation.SignUpSchema),
  AuthControllers.signUp,
);

router.post(
  "/login",
  authLimiter,
  validateRequest(AuthValidation.logInSchema),
  AuthControllers.logIn,
);

router.post(
  "/refresh-token",
  validateRequest(AuthValidation.RefreshTokenSchema),
  AuthControllers.refreshToken,
);

router.get("/me", authOnly(), AuthControllers.getCurrentUser);

router.patch(
  "/me",
  authOnly(),
  validateRequest(AuthValidation.UpdateMeSchema),
  AuthControllers.updateMe,
);

// Logout must ALWAYS be able to tear the session down — including when the
// access token has already expired (the handler only needs the refresh cookie,
// which is what it invalidates). Requiring a valid access token here left the
// httpOnly refresh cookie in place and the session un-revocable.
router.post("/logout", AuthControllers.logOut);

router.post("/logout-all", authOnly(), AuthControllers.logoutAll);

router.post(
  "/forget-password",
  authLimiter,
  validateRequest(AuthValidation.ForgotPasswordSchema),
  AuthControllers.forgetPassword,
);

router.post(
  "/reset-password",
  authLimiter,
  validateRequest(AuthValidation.ResetPasswordSchema),
  AuthControllers.resetPassword,
);

router.post(
  "/switch-workspace",
  authOnly(),
  validateRequest(AuthValidation.SwitchWorkspaceSchema || { body: {} }),
  AuthControllers.switchWorkspace,
);

export const AuthRouters = router;
