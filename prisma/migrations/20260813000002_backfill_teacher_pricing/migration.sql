-- One-time backfill of legacy teacher subscription pricing (200/600 -> 180/750/1200).
--
-- This previously ran from src/instrumentation.ts on every server boot, in every
-- PM2 worker, which meant any teacher who deliberately set priceMonthly = 200 or
-- priceTermly = 600 had all three price columns silently overwritten on the next
-- restart. Running it once as a migration preserves the original intent without
-- the recurring data loss.
UPDATE "TeacherProfile"
SET "priceMonthly" = 180,
    "priceTermly"  = 750,
    "priceYearly"  = 1200
WHERE "priceMonthly" = 200
   OR "priceTermly"  = 600;
