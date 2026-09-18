import bcrypt from "bcryptjs";
import { pathToFileURL } from "url";
import { prisma } from "../src/lib/prisma";
import config from "../src/config";
import { SystemRole } from "../generated/prisma/client";

/**
 * Platform feature catalog. Each feature gets a global feature flag and can be
 * attached to plan variants with per-period limits (Section 17).
 */
const FEATURES: {
  key: string;
  description: string;
  category: string;
}[] = [
  { key: "create_prescription", description: "Create digital prescriptions", category: "prescriptions" },
  { key: "appointments", description: "Appointment booking and live queue", category: "appointments" },
  { key: "advanced_pdf", description: "Advanced PDF templates and pagination", category: "pdf" },
  { key: "qr_verification", description: "Public QR prescription verification", category: "verification" },
  { key: "analytics", description: "Analytics dashboards", category: "analytics" },
  { key: "custom_branding", description: "Custom institution branding", category: "branding" },
  { key: "medicine_favorites", description: "Frequently used medicine favorites", category: "medicines" },
  { key: "export", description: "Export prescriptions and records", category: "data" },
];

const VARIANTS: {
  variantName: string;
  dailyPrescriptionLimit: number;
  price: number;
  description: Record<string, string>;
}[] = [
  {
    variantName: "Free Trial",
    dailyPrescriptionLimit: 3,
    price: 0,
    description: {
      en: "Get started with 3 prescriptions per day. No payment required.",
      bn: "প্রতিদিন ৩টি প্রেসক্রিপশন দিন। কোনো পেমেন্ট প্রয়োজন নেই।",
    },
  },
  {
    variantName: "Personal Doctor",
    dailyPrescriptionLimit: 100,
    price: 499,
    description: {
      en: "Ideal for individual doctors. Unlimited prescriptions, custom templates.",
      bn: "ব্যক্তিগত ডাক্তারের জন্য। সীমাহীন প্রেসক্রিপশন, কাস্টম টেমপ্লেট।",
    },
  },
  {
    variantName: "Small Clinic",
    dailyPrescriptionLimit: 500,
    price: 1999,
    description: {
      en: "For small clinics with up to 5 doctors. Analytics + branding.",
      bn: "৫ জন পর্যন্ত ডাক্তার সহ ছোট ক্লিনিকের জন্য। এনালিটিক্স + ব্র্যান্ডিং।",
    },
  },
  {
    variantName: "Hospital Enterprise",
    dailyPrescriptionLimit: 9999,
    price: 7999,
    description: {
      en: "Full institutional management. Unlimited doctors, departments, prescriptions.",
      bn: "সম্পূর্ণ প্রাতিষ্ঠানিক ব্যবস্থাপনা। সীমাহীন ডাক্তার, বিভাগ, প্রেসক্রিপশন।",
    },
  },
];

// Which feature keys each plan variant includes (limitValue = null → unlimited).
const PLAN_FEATURES: Record<string, { key: string; limit: number | null }[]> = {
  "Free Trial": [
    { key: "create_prescription", limit: 3 },
    { key: "medicine_favorites", limit: null },
  ],
  "Personal Doctor": [
    { key: "create_prescription", limit: 100 },
    { key: "appointments", limit: null },
    { key: "advanced_pdf", limit: null },
    { key: "qr_verification", limit: null },
    { key: "analytics", limit: null },
    { key: "medicine_favorites", limit: null },
    { key: "export", limit: null },
  ],
  "Small Clinic": [
    { key: "create_prescription", limit: 500 },
    { key: "appointments", limit: null },
    { key: "advanced_pdf", limit: null },
    { key: "qr_verification", limit: null },
    { key: "analytics", limit: null },
    { key: "custom_branding", limit: null },
    { key: "medicine_favorites", limit: null },
    { key: "export", limit: null },
  ],
  "Hospital Enterprise": [
    { key: "create_prescription", limit: 9999 },
    { key: "appointments", limit: null },
    { key: "advanced_pdf", limit: null },
    { key: "qr_verification", limit: null },
    { key: "analytics", limit: null },
    { key: "custom_branding", limit: null },
    { key: "medicine_favorites", limit: null },
    { key: "export", limit: null },
  ],
};

async function seedFeatures() {
  for (const feature of FEATURES) {
    const record = await prisma.feature.upsert({
      where: { key: feature.key },
      update: { description: feature.description, category: feature.category },
      create: feature,
    });

    await prisma.featureFlag.upsert({
      where: { featureId: record.id },
      update: {},
      create: { featureId: record.id, isEnabledGlobally: true },
    });
  }
  console.log(`Seeded ${FEATURES.length} features and feature flags.`);
}

async function seedPlans() {
  for (const variant of VARIANTS) {
    const existing = await prisma.subscriptionVariant.findFirst({
      where: { variantName: variant.variantName },
    });

    const record =
      existing ??
      (await prisma.subscriptionVariant.create({
        data: {
          variantName: variant.variantName,
          description: variant.description,
          dailyPrescriptionLimit: variant.dailyPrescriptionLimit,
          price: variant.price,
          isActive: true,
        },
      }));

    const features = PLAN_FEATURES[variant.variantName] ?? [];
    for (const pf of features) {
      const feature = await prisma.feature.findUnique({ where: { key: pf.key } });
      if (!feature) continue;

      await prisma.planFeature.upsert({
        where: {
          variantId_featureId: { variantId: record.id, featureId: feature.id },
        },
        update: { limitValue: pf.limit },
        create: {
          variantId: record.id,
          featureId: feature.id,
          limitValue: pf.limit,
        },
      });
    }
  }
  console.log(`Seeded ${VARIANTS.length} subscription variants and their features.`);
}

export async function seed() {
  console.log("Starting seed...");

  const hashedPassword = await bcrypt.hash(
    "@SuperAdmin@123!",
    config.bcrypt.bcryptSaltRound,
  );

  const admin = await prisma.user.upsert({
    where: { email: "superadmin@admin.com" },
    update: { isVerified: true, emailVerifiedAt: new Date() },
    create: {
      name: "Super Admin",
      email: "superadmin@admin.com",
      password: hashedPassword,
      systemRole: SystemRole.SUPER_ADMIN,
      isVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log("Created super admin:", admin.email);

  await seedFeatures();
  await seedPlans();

  console.log("Seed completed successfully!");
}

// Allow `npm run seed` (tsx prisma/seed.ts) to execute directly, while still
// exporting `seed` for programmatic use by the server bootstrap.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Seed failed:", error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
