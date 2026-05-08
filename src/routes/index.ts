import { Router } from "express";
import { IRoute } from "../interface";
import { AuthRouter } from "../modules/auth/auth.router";

const router = Router();

const routes: IRoute[] = [
  {
    path: "/auth",
    route: AuthRouter,
  }
];

routes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
