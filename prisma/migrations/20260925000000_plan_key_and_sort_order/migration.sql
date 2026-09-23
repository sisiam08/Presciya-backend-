-- Stable plan identity (`key`) + canonical business ordering (`sortOrder`).
--
-- WHY: the seed located plans by `variantName`. Renaming a plan therefore broke
-- the lookup and the next seed run CREATED A DUPLICATE of the old plan. Plan
-- identity must never depend on display metadata, so a stable `key` is added
-- and the seed now matches on it.
--
-- SAFETY: additive only. No rows are deleted, no identity is changed, and every
-- statement is idempotent so the migration can be re-run safely.

ALTER TABLE "subscription_variants" ADD COLUMN IF NOT EXISTS "key" TEXT;
ALTER TABLE "subscription_variants" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 100;

-- Backfill the canonical plans from their CURRENT display names, assigning each
-- key to exactly ONE row (the earliest created) so the unique index can never
-- fail if a duplicate already exists. Extra duplicates keep a NULL key.
WITH canonical AS (
  SELECT
    id,
    CASE
      WHEN "variantName" = 'Free Trial' THEN 'free_trial'
      WHEN "variantName" IN ('Personal Practice', 'Personal Doctor') THEN 'personal'
      WHEN "variantName" = 'Small Clinic' THEN 'small_clinic'
      WHEN "variantName" IN ('Hospital Enterprise', 'Institute', 'Institution') THEN 'enterprise'
      ELSE NULL
    END AS k,
    CASE
      WHEN "variantName" = 'Free Trial' THEN 1
      WHEN "variantName" IN ('Personal Practice', 'Personal Doctor') THEN 2
      WHEN "variantName" = 'Small Clinic' THEN 3
      WHEN "variantName" IN ('Hospital Enterprise', 'Institute', 'Institution') THEN 4
      ELSE NULL
    END AS ord,
    ROW_NUMBER() OVER (
      PARTITION BY
        CASE
          WHEN "variantName" IN ('Personal Practice', 'Personal Doctor') THEN 'personal'
          WHEN "variantName" IN ('Hospital Enterprise', 'Institute', 'Institution') THEN 'enterprise'
          ELSE "variantName"
        END
      ORDER BY "createdAt" ASC
    ) AS rn
  FROM "subscription_variants"
)
UPDATE "subscription_variants" v
SET "key" = c.k, "sortOrder" = c.ord
FROM canonical c
WHERE v.id = c.id AND c.rn = 1 AND c.k IS NOT NULL AND v."key" IS NULL;

-- Non-canonical (admin-created) plans keep a deterministic order after the four
-- canonical ones, based on creation time.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) + 100 AS rn
  FROM "subscription_variants"
  WHERE "key" IS NULL
)
UPDATE "subscription_variants" v SET "sortOrder" = r.rn FROM ranked r WHERE v.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_variants_key_key"
  ON "subscription_variants"("key");
