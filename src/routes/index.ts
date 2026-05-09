import { Router } from "express";
import { IRoute } from "../interface";
import { AuthRouters } from "../modules/auth/auth.router";
import { DoctorRouters } from "../modules/doctor/doctor.router";
const router = Router();

const routes: IRoute[] = [
  {
    path: "/auth",
    route: AuthRouters,
  },
  {
    path: "/doctor",
    route: DoctorRouters,
  },
];

routes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
