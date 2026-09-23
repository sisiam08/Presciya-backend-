import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { MedicineServices } from "./medicine.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { requireStringParam } from "../../utils/requestParams";
import { FeatureServices } from "../feature/feature.service";

const searchMedicines = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const { q = "", page = 1, limit = 20 } = req.query;

  // The EMPTY-query branch of search returns the doctor's frequently-used
  // medicines — that IS the `medicine_favorites` feature. Plain searching (with
  // a query) stays open because it powers the prescription autocomplete.
  // Enforced here so turning the plan feature off actually stops the feature
  // rather than only hiding it in the UI.
  const favoritesAllowed = await FeatureServices.isFeatureAllowed({
    userId,
    workspaceId,
    featureKey: "medicine_favorites",
  });

  const result = await MedicineServices.searchMedicines(
    userId,
    q as string,
    Number(page),
    Number(limit),
    favoritesAllowed,
  );

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Autocomplete search completed successfully",
    data: result.results,
    meta: result.meta,
  });
});

const getDoctorFavorites = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const result = await MedicineServices.getDoctorFavorites(userId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Doctor favorite medicines fetched successfully",
    data: result,
  });
});

const addFavorite = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const { medicineId } = req.body;
  const result = await MedicineServices.addFavorite(userId, medicineId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Medicine added to favorites successfully",
    data: result,
  });
});

const removeFavorite = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const medicineId = requireStringParam(req.params.medicineId, "Medicine ID");
  await MedicineServices.removeFavorite(userId, medicineId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Medicine removed from favorites successfully",
    data: null,
  });
});

export const MedicineControllers = {
  searchMedicines,
  getDoctorFavorites,
  addFavorite,
  removeFavorite,
};
