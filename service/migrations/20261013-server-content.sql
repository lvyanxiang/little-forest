ALTER TABLE "store_settings"
  ADD COLUMN IF NOT EXISTS "quickDateDays" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bookingAdvanceDays" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "uiText" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "brandLogoImage" text;

-- Business defaults now come from init/init.sql, rather than ORM metadata.
ALTER TABLE "store_settings" ALTER COLUMN "homeHeroText" DROP DEFAULT;
