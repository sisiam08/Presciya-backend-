import { Router } from "express";
import { SystemControllers } from "./system.controller";

const router = Router();

// Public: the client reads this before login to render "coming soon" states.
router.get("/availability", SystemControllers.getAvailability);

export const SystemRouters = router;
