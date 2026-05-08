import { Router } from "express";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";
import validateRequest from "../../middleware/validateRequest";

const router = Router();

router.post(
  "/signup",
  validateRequest(AuthValidation.SignUpSchema),
  AuthController.signUp,
);
router.post(
  "/login",
  validateRequest(AuthValidation.logInSchema),
  AuthController.logIn,
);

export const AuthRouter = router;
