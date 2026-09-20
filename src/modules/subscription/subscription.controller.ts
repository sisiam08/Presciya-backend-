import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { SubscriptionServices } from "./subscription.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";

const getAvailablePlans = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionServices.getAvailablePlans();
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Available subscription plans fetched successfully",
    data: result,
  });
});

const getMySubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const result = await SubscriptionServices.getMySubscription({
    userId,
    workspaceId,
  });
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Subscription details and usage metrics fetched successfully",
    data: result,
  });
});

const getEntitlements = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const result = await SubscriptionServices.getEntitlements({
    userId,
    workspaceId,
  });
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Feature entitlements fetched successfully",
    data: result,
  });
});

const validateVoucher = catchAsync(async (req: Request, res: Response) => {
  const { voucherCode, subscriptionVariantId } = req.body;
  const result = await SubscriptionServices.validateVoucher(
    voucherCode,
    subscriptionVariantId,
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Voucher applied successfully",
    data: result,
  });
});

const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const result = await SubscriptionServices.createSubscription(
    { userId, workspaceId },
    req.body,
  );
  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Subscription created successfully",
    data: result,
  });
});

const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId as string;
  const result = await SubscriptionServices.cancelSubscription(workspaceId);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Subscription cancelled successfully",
    data: result,
  });
});

const getBillingHistory = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId as string;
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);

  const result = await SubscriptionServices.getBillingHistory(
    workspaceId,
    page,
    limit,
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Billing history and invoices fetched successfully",
    data: result.invoices,
    meta: result.meta,
  });
});

const seedDefaultPlans = catchAsync(async (req: Request, res: Response) => {
  await SubscriptionServices.seedDefaultPlans();
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Default subscription plans seeded successfully",
    data: null,
  });
});

export const SubscriptionControllers = {
  getAvailablePlans,
  getMySubscription,
  getEntitlements,
  validateVoucher,
  createSubscription,
  cancelSubscription,
  getBillingHistory,
  seedDefaultPlans,
};
