import { Router } from "express";
import { AuthControllers } from "./auth.controller";
import { AuthValidation } from "./auth.validation";
import validateRequest from "../../middleware/validateRequest";

const router = Router();

router.post(
  "/signup",
  validateRequest(AuthValidation.SignUpSchema),
  AuthControllers.signUp,
);
router.post(
  "/login",
  validateRequest(AuthValidation.logInSchema),
  AuthControllers.logIn,
);

export const AuthRouters = router;
