-- Production databases run with synchronize=false. Apply this once before deploying the new service.
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS "homeHeroText" text NOT NULL
  DEFAULT E'讀著書\n一輩子很快就過去了\n去讀書吧\n讀一句\n便經歷一句';

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS "homeHeroImage" text;
