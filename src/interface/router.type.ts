import { IRouter } from "express";

export interface IRoute {
    path: string;
    route: IRouter;
}