import { Request, Response } from "express";

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    code: "RESOURCE_NOT_FOUND",
    requestId: req.id,
  });
};
