import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  PaymentStatus,
  PaymentMethod,
  InvoiceStatus,
  NotificationType,
} from "../../../generated/prisma/enums";
import { NotificationServices } from "../notification/notification.service";

type FeaturePeriod = "daily" | "monthly";

const getPeriodStart = (period: FeaturePeriod): Date => {
  const now = new Date();
  if (period === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateInvoiceNumber = async (): Promise<string> => {
  const count = await prisma.invoice.count();
  const year = new Date().getFullYear();
  const padded = String(count + 1).padStart(5, "0");
  return `INV-${year}-${padded}`;
};

const DEFAULT_PLAN_NAME = "Free Trial";

const assignFreeTrial = async (params: {
  workspaceId?: string;
  userId?: string;
}) => {
  const variant = await prisma.subscriptionVariant.findFirst({
    where: { variantName: DEFAULT_PLAN_NAME, isActive: true },
  });

  if (!variant) return null;

  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setDate(expiryDate.getDate() + 30);

  try {
    const subscription = await prisma.subscription.create({
      data: {
        ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
        ...(params.userId ? { userId: params.userId } : {}),
        subscriptionVariantId: variant.id,
        startDate: now,
        expiryDate,
        price: variant.price,
        discount: 0,
        paymentStatus: PaymentStatus.PAID,
        isActive: true,
      },
      include: { subscriptionVariant: true },
    });

    return { subscription, variant: subscription.subscriptionVariant };
  } catch {
    // Concurrent creation race — resolve the existing subscription instead
    const existing = await prisma.subscription.findFirst({
      where: {
        ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
        ...(params.userId ? { userId: params.userId } : {}),
        isActive: true,
        expiryDate: { gte: new Date() },
      },
      include: { subscriptionVariant: true },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return { subscription: existing, variant: existing.subscriptionVariant };
    }
    return null;
  }
};

const getActivePlan = async (params: {
  workspaceId?: string;
  userId?: string;
}) => {
  const { workspaceId, userId } = params;

  if (!workspaceId && !userId) {
    throw createAppError(
      "WorkspaceId or userId is required to resolve subscription",
      Status.BAD_REQUEST,
    );
  }

  const now = new Date();

  const workspaceSubscription = workspaceId
    ? await prisma.subscription.findFirst({
        where: {
          workspaceId,
          isActive: true,
          expiryDate: { gte: now },
        },
        include: { subscriptionVariant: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (workspaceSubscription) {
    return {
      subscription: workspaceSubscription,
      variant: workspaceSubscription.subscriptionVariant,
    };
  }

  const userSubscription = userId
    ? await prisma.subscription.findFirst({
        where: {
          userId,
          isActive: true,
          expiryDate: { gte: now },
        },
        include: { subscriptionVariant: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (!userSubscription) {
    return assignFreeTrial(params);
  }

  return {
    subscription: userSubscription,
    variant: userSubscription.subscriptionVariant,
  };
};

const checkLimit = async (params: {
  userId: string;
  workspaceId: string;
  featureId: string;
  featureKey: string;
  subscriptionVariantId: string;
  incrementBy?: number;
  period?: FeaturePeriod;
  trackUsage?: boolean;
}) => {
  const {
    userId,
    workspaceId,
    featureId,
    featureKey,
    subscriptionVariantId,
    incrementBy = 1,
    period = "daily",
    trackUsage = true,
  } = params;

  const planFeature = await prisma.planFeature.findUnique({
    where: {
      variantId_featureId: {
        variantId: subscriptionVariantId,
        featureId,
      },
    },
  });

  if (!planFeature) {
    throw createAppError(
      "Feature is not included in the current plan",
      Status.PAYMENT_REQUIRED,
      true,
      "SUBSCRIPTION_REQUIRED",
    );
  }

  const periodStart = getPeriodStart(period);

  let usage = await prisma.usageTracking.findUnique({
    where: {
      workspaceId_featureKey: { workspaceId, featureKey },
    },
  });

  if (!usage) {
    usage = await prisma.usageTracking.create({
      data: {
        workspaceId,
        featureKey,
        used: 0,
        resetAt: periodStart,
      },
    });
  } else if (usage.resetAt < periodStart) {
    usage = await prisma.usageTracking.update({
      where: { workspaceId_featureKey: { workspaceId, featureKey } },
      data: {
        used: 0,
        resetAt: periodStart,
      },
    });
  }

  const limitValue = planFeature.limitValue;
  const nextUsed = usage.used + incrementBy;

  if (limitValue !== null && nextUsed > limitValue) {
    throw createAppError(
      `Feature limit exceeded (${usage.used}/${limitValue}). Please upgrade your plan.`,
      Status.PAYMENT_REQUIRED,
      true,
      "QUOTA_EXCEEDED",
    );
  }

  if (trackUsage && incrementBy > 0) {
    usage = await prisma.usageTracking.update({
      where: { workspaceId_featureKey: { workspaceId, featureKey } },
      data: { used: { increment: incrementBy } },
    });
  }

  return {
    featureId,
    featureKey,
    limitValue,
    used: usage.used,
    remaining:
      limitValue === null ? null : Math.max(0, limitValue - usage.used),
  };
};

// ─── Services ────────────────────────────────────────────────────────────────

/** Returns all available subscription plans that are currently active. */
const getAvailablePlans = async () => {
  return await prisma.subscriptionVariant.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });
};

/** Returns the workspace's active subscription along with usage metrics. */
const getMySubscription = async (params: {
  workspaceId: string;
  userId: string;
}) => {
  const { workspaceId, userId } = params;

  let subscription = await prisma.subscription.findFirst({
    where: { workspaceId, isActive: true },
    include: {
      subscriptionVariant: true,
      voucher: { select: { code: true, discountPercentage: true } },
      payments: { orderBy: { paymentDate: "desc" }, take: 1 },
      invoices: { orderBy: { issuedAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    subscription = await prisma.subscription.findFirst({
      where: { userId, isActive: true },
      include: {
        subscriptionVariant: true,
        voucher: { select: { code: true, discountPercentage: true } },
        payments: { orderBy: { paymentDate: "desc" }, take: 1 },
        invoices: { orderBy: { issuedAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Build usage snapshot for today
  const usageTracking = await prisma.usageTracking.findUnique({
    where: {
      workspaceId_featureKey: {
        workspaceId,
        featureKey: "create_prescription",
      },
    },
  });

  const dailyLimit =
    subscription?.subscriptionVariant.dailyPrescriptionLimit ?? 0;

  const usedToday = usageTracking?.used ?? 0;

  const percentageUsed =
    dailyLimit > 0 ? Math.round((usedToday / dailyLimit) * 100) : 0;

  return {
    subscription,
    usage: {
      today: usedToday,
      dailyLimit,
      remaining: Math.max(0, dailyLimit - usedToday),
      percentageUsed,
    },
  };
};

/** Validates a voucher code and returns discount information. */
const validateVoucher = async (code: string, subscriptionVariantId: string) => {
  const voucher = await prisma.voucher.findUnique({
    where: { code },
  });

  if (!voucher) {
    throw createAppError("Invalid voucher code", Status.NOT_FOUND);
  }

  const now = new Date();
  if (
    !voucher.isActive ||
    voucher.startDate > now ||
    voucher.expiryDate < now
  ) {
    throw createAppError(
      "This voucher is expired or not yet active",
      Status.BAD_REQUEST,
    );
  }

  const variant = await prisma.subscriptionVariant.findUnique({
    where: { id: subscriptionVariantId },
  });

  if (!variant) {
    throw createAppError("Subscription plan not found", Status.NOT_FOUND);
  }

  const discountAmount = (variant.price * voucher.discountPercentage) / 100;
  const finalPrice = variant.price - discountAmount;

  return {
    voucher: {
      code: voucher.code,
      discountPercentage: voucher.discountPercentage,
    },
    originalPrice: variant.price,
    discountAmount,
    finalPrice,
  };
};

/** Creates or upgrades a subscription for a personal doctor or institution. */
const createSubscription = async (
  params: {
    userId: string;
    workspaceId: string;
  },
  data: {
    subscriptionVariantId: string;
    voucherCode?: string;
    paymentMethod: string;
    startDate?: string;
  },
) => {
  const { userId, workspaceId } = params;

  const variant = await prisma.subscriptionVariant.findUnique({
    where: { id: data.subscriptionVariantId, isActive: true },
  });

  if (!variant) {
    throw createAppError(
      "Subscription plan not found or inactive",
      Status.NOT_FOUND,
    );
  }

  // Calculate pricing with optional voucher
  let finalPrice = variant.price;
  let discount = 0;

  if (data.voucherCode) {
    const voucher = await prisma.voucher.findUnique({
      where: { code: data.voucherCode },
    });

    if (!voucher || !voucher.isActive || voucher.expiryDate < new Date()) {
      throw createAppError(
        "Voucher is invalid or has expired",
        Status.BAD_REQUEST,
      );
    }

    discount = (variant.price * voucher.discountPercentage) / 100;
    finalPrice = variant.price - discount;
  }

  const startDate = data.startDate ? new Date(data.startDate) : new Date();
  const expiryDate = new Date(startDate);
  expiryDate.setMonth(expiryDate.getMonth() + 1); // 1-month billing cycle

  const result = await prisma.$transaction(async (tx) => {
    // 1. Deactivate any existing active subscription
    await tx.subscription.updateMany({
      where: { workspaceId, isActive: true },
      data: { isActive: false },
    });

    // 2. Create new subscription
    const subscription = await tx.subscription.create({
      data: {
        workspaceId,
        userId,
        subscriptionVariantId: data.subscriptionVariantId,
        voucherCode: data.voucherCode || null,
        startDate,
        expiryDate,
        price: finalPrice,
        discount,
        paymentStatus: PaymentStatus.PENDING,
        isActive: true,
      },
    });

    // 3. Create payment record
    const payment = await tx.payment.create({
      data: {
        subscriptionId: subscription.id,
        amount: finalPrice,
        paymentMethod:
          (data.paymentMethod as PaymentMethod) || PaymentMethod.CARD,
        status: PaymentStatus.PAID, // assume payment processed
      },
    });

    // 4. Update subscription payment status
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { paymentStatus: PaymentStatus.PAID },
    });

    // 5. Generate and attach invoice
    const invoiceNumber = await generateInvoiceNumber();
    await tx.invoice.create({
      data: {
        subscriptionId: subscription.id,
        invoiceNumber,
        amount: finalPrice,
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      },
    });

    return { subscription, payment, invoiceNumber };
  });

  await notifySubscription(
    workspaceId,
    "Subscription activated",
    `Your ${variant.variantName} plan is now active. Thank you for subscribing!`,
  );

  return result;
};

/** Notifies the workspace owner about subscription lifecycle events. */
const notifySubscription = async (
  workspaceId: string,
  title: string,
  message: string,
) => {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (workspace) {
      await NotificationServices.createNotification({
        userId: workspace.ownerId,
        title,
        message,
        type: NotificationType.SUBSCRIPTION,
      });
    }
  } catch (err) {
    console.error("Failed to create subscription notification:", err);
  }
};

/** Creates or upgrades a subscription for a personal doctor or institution. */

/** Cancels the caller's active subscription (soft cancel — expires naturally). */
const cancelSubscription = async (workspaceId: string) => {
  const subscription = await prisma.subscription.findFirst({
    where: { workspaceId, isActive: true },
  });

  if (!subscription) {
    throw createAppError("No active subscription found", Status.NOT_FOUND);
  }

  // We do NOT delete it — we just deactivate so records are preserved
  const cancelled = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { isActive: false },
  });

  await notifySubscription(
    workspaceId,
    "Subscription cancelled",
    "Your subscription has been cancelled. Your workspace will be downgraded to the Free Trial on the current period's expiry.",
  );

  return cancelled;
};

/** Returns the billing history / invoices for a user. */
const getBillingHistory = async (
  workspaceId: string,
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        subscription: { workspaceId },
      },
      orderBy: { issuedAt: "desc" },
      skip,
      take: limit,
      include: {
        subscription: {
          include: { subscriptionVariant: { select: { variantName: true } } },
        },
      },
    }),
    prisma.invoice.count({ where: { subscription: { workspaceId } } }),
  ]);

  return {
    invoices,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/** Admin: Seeds the default subscription variant plans if none exist. */
const seedDefaultPlans = async () => {
  const count = await prisma.subscriptionVariant.count();
  if (count > 0) return;

  await prisma.subscriptionVariant.createMany({
    data: [
      {
        variantName: "Free Trial",
        description: {
          en: "Get started with 3 prescriptions per day. No payment required.",
          bn: "প্রতিদিন ৩টি প্রেসক্রিপশন দিন। কোনো পেমেন্ট প্রয়োজন নেই।",
        },
        dailyPrescriptionLimit: 3,
        price: 0,
        isActive: true,
      },
      {
        variantName: "Personal Doctor",
        description: {
          en: "Ideal for individual doctors. Unlimited prescriptions, custom templates.",
          bn: "ব্যক্তিগত ডাক্তারের জন্য। সীমাহীন প্রেসক্রিপশন, কাস্টম টেমপ্লেট।",
        },
        dailyPrescriptionLimit: 100,
        price: 499,
        isActive: true,
      },
      {
        variantName: "Small Clinic",
        description: {
          en: "For small clinics with up to 5 doctors. Analytics + branding.",
          bn: "৫ জন পর্যন্ত ডাক্তার সহ ছোট ক্লিনিকের জন্য। এনালিটিক্স + ব্র্যান্ডিং।",
        },
        dailyPrescriptionLimit: 500,
        price: 1999,
        isActive: true,
      },
      {
        variantName: "Hospital Enterprise",
        description: {
          en: "Full institutional management. Unlimited doctors, departments, prescriptions.",
          bn: "সম্পূর্ণ প্রাতিষ্ঠানিক ব্যবস্থাপনা। সীমাহীন ডাক্তার, বিভাগ, প্রেসক্রিপশন।",
        },
        dailyPrescriptionLimit: 9999,
        price: 7999,
        isActive: true,
      },
    ],
  });

  console.log("✅ Default subscription plans seeded.");
};

export const SubscriptionServices = {
  getActivePlan,
  checkLimit,
  getAvailablePlans,
  getMySubscription,
  validateVoucher,
  createSubscription,
  cancelSubscription,
  getBillingHistory,
  seedDefaultPlans,
};
