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
import { getStartOfDay, getStartOfMonth } from "../../utils/datetime";

type FeaturePeriod = "daily" | "monthly";


const getPeriodStart = (period: FeaturePeriod): Date =>
  period === "monthly" ? getStartOfMonth() : getStartOfDay();


const getEffectiveUsed = (
  usage: { used: number; resetAt: Date } | null | undefined,
  period: FeaturePeriod = "daily",
): number => {
  if (!usage) return 0;
  return usage.resetAt < getPeriodStart(period) ? 0 : usage.used;
};



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
  const usedNow = getEffectiveUsed(usage, period);
  const nextUsed = usedNow + incrementBy;

  if (limitValue !== null && nextUsed > limitValue) {
    throw createAppError(
      `Feature limit exceeded (${usedNow}/${limitValue}). Please upgrade your plan.`,
      Status.PAYMENT_REQUIRED,
      true,
      "QUOTA_EXCEEDED",
    );
  }

  if (trackUsage && incrementBy > 0) {
    
    
    
    const incremented = await prisma.usageTracking.updateMany({
      where: {
        workspaceId,
        featureKey,
        ...(limitValue === null
          ? {}
          : { used: { lte: limitValue - incrementBy } }),
      },
      data: { used: { increment: incrementBy } },
    });

    if (incremented.count === 0) {
      const current = await prisma.usageTracking.findUnique({
        where: { workspaceId_featureKey: { workspaceId, featureKey } },
      });
      throw createAppError(
        `Feature limit exceeded (${current?.used ?? usedNow}/${limitValue}). Please upgrade your plan.`,
        Status.PAYMENT_REQUIRED,
        true,
        "QUOTA_EXCEEDED",
      );
    }

    usage =
      (await prisma.usageTracking.findUnique({
        where: { workspaceId_featureKey: { workspaceId, featureKey } },
      })) ?? usage;
  }

  const used = getEffectiveUsed(usage, period);

  return {
    featureId,
    featureKey,
    limitValue,
    used,
    remaining: limitValue === null ? null : Math.max(0, limitValue - used),
  };
};


const assertChamberLimit = async (userId: string, workspaceId: string) => {
  const activePlan = await getActivePlan({ workspaceId, userId });
  if (!activePlan) return;

  const feature = await prisma.feature.findUnique({
    where: { key: "max_chambers" },
  });
  if (!feature) return;

  const planFeature = await prisma.planFeature.findUnique({
    where: {
      variantId_featureId: {
        variantId: activePlan.variant.id,
        featureId: feature.id,
      },
    },
  });

  const limit = planFeature?.limitValue ?? null;
  if (limit === null) return; 

  const owned = await prisma.workspace.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const count = await prisma.chamber.count({
    where: { workspaceId: { in: owned.map((w) => w.id) } },
  });

  if (count >= limit) {
    throw createAppError(
      `Your plan allows up to ${limit} chamber${limit === 1 ? "" : "s"}. Upgrade your plan to add more.`,
      Status.PAYMENT_REQUIRED,
      true,
      "CHAMBER_LIMIT_EXCEEDED",
    );
  }
};





const getAvailablePlans = async () => {
  
  
  
  
  return await prisma.subscriptionVariant.findMany({
    
    
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      planFeatures: {
        include: {
          feature: {
            select: { key: true, description: true, category: true },
          },
        },
      },
    },
  });
};


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

  
  
  if (subscription) {
    notifyExpiryIfDue({
      id: subscription.id,
      expiryDate: subscription.expiryDate,
      userId: subscription.userId,
      workspaceId: subscription.workspaceId,
      subscriptionVariant: subscription.subscriptionVariant,
    }).catch(() => {});
  }

  
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

  
  
  const usedToday = getEffectiveUsed(usageTracking);

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


const getEntitlements = async (params: {
  workspaceId: string;
  userId: string;
}) => {
  const { workspaceId, userId } = params;
  const activePlan = await getActivePlan({ workspaceId, userId });

  if (!activePlan) {
    return { plan: null, subscription: null, features: {} };
  }

  const variantId = activePlan.variant.id;

  const [features, planFeatures, usageRows, flags] = await Promise.all([
    prisma.feature.findMany({
      select: { id: true, key: true, description: true },
    }),
    prisma.planFeature.findMany({
      where: { variantId },
      select: { featureId: true, limitValue: true },
    }),
    prisma.usageTracking.findMany({ where: { workspaceId } }),
    
    
    
    prisma.featureFlag.findMany({
      select: { featureId: true, isEnabledGlobally: true },
    }),
  ]);

  const limitByFeature = new Map(
    planFeatures.map((pf) => [pf.featureId, pf.limitValue]),
  );
  const globallyEnabledByFeature = new Map(
    flags.map((flag) => [flag.featureId, flag.isEnabledGlobally]),
  );
  
  
  const usedByKey = new Map(
    usageRows.map((u) => [u.featureKey, getEffectiveUsed(u)]),
  );

  const featuresResult: Record<
    string,
    { allowed: boolean; limit: number | null; used: number; remaining: number | null }
  > = {};

  for (const f of features) {
    
    
    const globallyEnabled = globallyEnabledByFeature.get(f.id) !== false;
    const allowed = limitByFeature.has(f.id) && globallyEnabled;
    const limit = allowed ? limitByFeature.get(f.id) ?? null : null;
    const used = usedByKey.get(f.key) ?? 0;
    featuresResult[f.key] = {
      allowed,
      limit,
      used,
      remaining: limit === null ? null : Math.max(0, limit - used),
    };
  }

  return {
    plan: {
      id: activePlan.variant.id,
      name: activePlan.variant.variantName,
      dailyPrescriptionLimit: activePlan.variant.dailyPrescriptionLimit,
      price: activePlan.variant.price,
    },
    subscription: {
      expiryDate: activePlan.subscription.expiryDate,
      isActive: activePlan.subscription.isActive,
    },
    features: featuresResult,
  };
};



const EXPIRY_WARNING_DAYS = 3;


const notifyExpiryIfDue = async (sub: {
  id: string;
  expiryDate: Date;
  userId: string | null;
  workspaceId: string | null;
  subscriptionVariant?: { variantName: string } | null;
}): Promise<boolean> => {
  const now = new Date();
  const warnUntil = new Date(
    now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000,
  );
  if (sub.expiryDate > warnUntil) return false; 

  let recipientId = sub.userId;
  if (sub.workspaceId) {
    const ws = await prisma.workspace.findUnique({
      where: { id: sub.workspaceId },
      select: { ownerId: true },
    });
    recipientId = ws?.ownerId ?? sub.userId;
  }
  if (!recipientId) return false;

  const expired = sub.expiryDate <= now;
  const expiryLabel = sub.expiryDate.toISOString().slice(0, 10);
  const planName = sub.subscriptionVariant?.variantName ?? "subscription";
  const title = expired
    ? `Subscription expired (${expiryLabel})`
    : `Subscription expires soon (${expiryLabel})`;
  const message = expired
    ? `Your ${planName} plan has expired. Premium features (appointments, finance) are now disabled. Your data is safe — renew to restore access.`
    : `Your ${planName} plan expires on ${expiryLabel}. Renew to keep premium features.`;

  const existing = await prisma.notification.findFirst({
    where: { userId: recipientId, title },
    select: { id: true },
  });
  if (existing) return false;

  await NotificationServices.createNotification({
    userId: recipientId,
    title,
    message,
    type: NotificationType.SUBSCRIPTION,
  });
  return true;
};


const runExpiryChecks = async () => {
  const now = new Date();
  const warnUntil = new Date(
    now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000,
  );

  const subs = await prisma.subscription.findMany({
    where: { isActive: true, expiryDate: { lte: warnUntil } },
    select: {
      id: true,
      expiryDate: true,
      userId: true,
      workspaceId: true,
      subscriptionVariant: { select: { variantName: true } },
    },
  });

  let created = 0;
  for (const sub of subs) {
    if (await notifyExpiryIfDue(sub)) created++;
  }

  
  await prisma.subscription.updateMany({
    where: { isActive: true, expiryDate: { lt: now } },
    data: { isActive: false },
  });

  return { scanned: subs.length, created };
};


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
  expiryDate.setMonth(expiryDate.getMonth() + 1); 

  const result = await prisma.$transaction(async (tx) => {
    
    await tx.subscription.updateMany({
      where: { workspaceId, isActive: true },
      data: { isActive: false },
    });

    
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

    
    const payment = await tx.payment.create({
      data: {
        subscriptionId: subscription.id,
        amount: finalPrice,
        paymentMethod:
          (data.paymentMethod as PaymentMethod) || PaymentMethod.CARD,
        status: PaymentStatus.PAID, 
      },
    });

    
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { paymentStatus: PaymentStatus.PAID },
    });

    
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




const cancelSubscription = async (workspaceId: string) => {
  const subscription = await prisma.subscription.findFirst({
    where: { workspaceId, isActive: true },
  });

  if (!subscription) {
    throw createAppError("No active subscription found", Status.NOT_FOUND);
  }

  
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
  assertChamberLimit,
  getAvailablePlans,
  getMySubscription,
  getEntitlements,
  validateVoucher,
  createSubscription,
  cancelSubscription,
  getBillingHistory,
  seedDefaultPlans,
  runExpiryChecks,
  notifyExpiryIfDue,
};
