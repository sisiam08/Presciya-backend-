-- Personal-prescription settings (custom footer + watermark) for PERSONAL
-- workspaces. Additive and nullable — existing workspaces are unaffected and
-- chamber/institution branding continues to live on Chamber/Institution.
ALTER TABLE "Workspace" ADD COLUMN "templateConfig" JSONB;
