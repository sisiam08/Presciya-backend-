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

/**
 * Start of the current quota period in Bangladesh time (the product's
 * operating timezone) so a "day" rolls over at local midnight.
 */
const getPeriodStart = (period: FeaturePeriod): Date =>
  period === "monthly" ? getStartOfMonth() : getStartOfDay();

/**
 * Effective usage for the current period. A usage row whose `resetAt` is older
 * than the current period start belongs to a previous period, so its counter
 * must not count towards the current one (yesterday's 5/10 becomes today's
 * 0/10). Every reader of `used` goes through this so a stale previous-day count
 * can never surface; `checkLimit` additionally persists the rollover.
 */
const getEffectiveUsed = (
  usage: { used: number; resetAt: Date } | null | undefined,
  period: FeaturePeriod = "daily",
): number => {
  if (!usage) return 0;
  return usage.resetAt < getPeriodStart(period) ? 0 : usage.used;
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
    // A new period has started (e.g. a new calendar day): reset the counter so
    // yesterday's usage is never counted towards today's limit.
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
    // Guarded increment: the WHERE clause re-checks the quota in a single
    // atomic statement, so two concurrent requests cannot both read the same
    // old value and together exceed the limit.
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

/**
 * Enforces the plan's `max_chambers` limit across the workspaces a user owns.
 * Free plan = 1 chamber; a null limit means unlimited. Called before creating a
 * chamber so the limit is enforced server-side (never only in the UI).
 */
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
  if (limit === null) return; // unlimited / not configured for this plan

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

// ─── Services ────────────────────────────────────────────────────────────────

/** Returns all available subscription plans that are currently active. */
/**
 * Available plans WITH their entitlements, so the UI can describe exactly what
 * each plan unlocks instead of a vague summary. The plan feature rows are the
 * same source of truth the backend gates on.
 */
const getAvailablePlans = async () => {
  return await prisma.subscriptionVariant.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
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

  // Lazily emit an expiry warning when the user views their subscription, so
  // warnings appear even without a dedicated scheduler.
  if (subscription) {
    notifyExpiryIfDue({
      id: subscription.id,
      expiryDate: subscription.expiryDate,
      userId: subscription.userId,
      workspaceId: subscription.workspaceId,
      subscriptionVariant: subscription.subscriptionVariant,
    }).catch(() => {});
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

  // Counts today's usage only — a row left over from a previous calendar day
  // resolves to 0 until the next action rolls it over.
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

/**
 * Returns the workspace's effective plan and per-feature entitlements so the
 * frontend can gate (and blur) unavailable features. Everything is driven by
 * the admin-configurable plan feature limits — nothing is hardcoded.
 */
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
    // Global kill switch. Enforcement (checkFeatureAccess) honours it, so the
    // entitlements response must too — otherwise the UI would unlock a feature
    // the API will reject.
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
  // Resolve each row against the current period so a previous day's usage is
  // reported as 0 rather than reused.
  const usedByKey = new Map(
    usageRows.map((u) => [u.featureKey, getEffectiveUsed(u)]),
  );

  const featuresResult: Record<
    string,
    { allowed: boolean; limit: number | null; used: number; remaining: number | null }
  > = {};

  for (const f of features) {
    // Enabled when the plan includes it AND it is not globally switched off.
    // A missing flag row means "enabled" (matches checkFeatureAccess).
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

// ─── Expiry warnings (idempotent) ────────────────────────────────────────────

const EXPIRY_WARNING_DAYS = 3;

/**
 * Creates an expiry-warning notification for a subscription if one is due and
 * not already sent. Recipients: the workspace owner for workspace
 * subscriptions (hospitals/clinics notify their owner — never individual
 * doctors), or the user for personal subscriptions. Idempotent via a
 * deterministic title.
 */
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
  if (sub.expiryDate > warnUntil) return false; // not due yet

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

/**
 * Scans active subscriptions for upcoming/at expiry and issues warnings.
 * Safe to call repeatedly (idempotent). Intended to be run by a scheduler and
 * on server bootstrap.
 */
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

  // Fall back to the Free plan: deactivate expired subscriptions (data is kept).
  await prisma.subscription.updateMany({
    where: { isActive: true, expiryDate: { lt: now } },
    data: { isActive: false },
  });

  return { scanned: subs.length, created };
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
