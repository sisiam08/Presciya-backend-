import { Router } from "express";
import { SystemControllers } from "./system.controller";

const router = Router();


router.get("/availability", SystemControllers.getAvailability);

export const SystemRouters = router;
