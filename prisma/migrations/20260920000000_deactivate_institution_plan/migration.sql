-- Institution / hospital / clinic functionality is not part of the current
-- public release. Deactivate the institution tier so it is not offered
-- publicly or purchasable.
--
-- The plan is NOT deleted: it stays in the database and can be re-activated at
-- any time from the admin panel (Plans & Pricing). This is a one-time data
-- change; after this, the active/inactive state is owned by the admin.
UPDATE "subscription_variants"
SET "isActive" = false
WHERE "variantName" = 'Hospital Enterprise';
