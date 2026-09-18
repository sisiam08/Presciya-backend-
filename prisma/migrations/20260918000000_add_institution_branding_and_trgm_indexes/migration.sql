-- Institution branding persistence (Section 10.1)
ALTER TABLE "institutions" ADD COLUMN     "fontFamily" TEXT,
ADD COLUMN     "footerTemplate" TEXT,
ADD COLUMN     "headerTemplate" TEXT,
ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "secondaryColor" TEXT,
ADD COLUMN     "showLogo" BOOLEAN;

-- Typo-tolerant medicine search (Section 12): ensure pg_trgm is available and
-- the GIN trigram indexes exist (idempotent for databases where they were
-- created out-of-band).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "medicine_brand_trgm_idx" ON "medicines" USING GIN ("brandName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "medicine_generic_trgm_idx" ON "medicines" USING GIN ("generic" gin_trgm_ops);
