import { Router } from "express";
import { IRoute } from "../interface";

const router = Router();

const routes: IRoute[] = [];

routes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
