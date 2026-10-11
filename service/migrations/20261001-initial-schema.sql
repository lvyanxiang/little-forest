-- PostgreSQL 13+. Safe to run against an empty database or existing current tables.
-- Existing tables are preserved; later migrations handle changes to their columns.
CREATE TABLE IF NOT EXISTS "store_settings" (
  "id" integer PRIMARY KEY,
  "name" character varying NOT NULL,
  "address" character varying NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "phone" character varying NOT NULL,
  "hours" character varying NOT NULL,
  "closedWeekdays" text NOT NULL,
  "noticeHeading" character varying NOT NULL,
  "noticeItems" text NOT NULL,
  "noticeFoot" character varying NOT NULL,
  "homeNoticeText" text NOT NULL,
  "successNoticeLines" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "time_slots" (
  "id" SERIAL PRIMARY KEY,
  "startTime" character varying(5) NOT NULL,
  "endTime" character varying(5) NOT NULL,
  "maxCapacity" integer NOT NULL,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "isActive" boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clientId" character varying NOT NULL,
  "visitDate" character varying(10) NOT NULL,
  "slotId" integer NOT NULL,
  "slotLabel" character varying NOT NULL,
  "startTime" character varying(5) NOT NULL,
  "endTime" character varying(5) NOT NULL,
  "name" character varying NOT NULL,
  "phone" character varying NOT NULL,
  "people" integer NOT NULL DEFAULT 1,
  "status" character varying NOT NULL DEFAULT 'confirmed',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- Match TypeORM's default index names to avoid duplicates on existing databases.
CREATE INDEX IF NOT EXISTS "IDX_995104ad113361e0b1d0bd2950"
  ON "bookings" ("visitDate", "slotId", "status");
CREATE INDEX IF NOT EXISTS "IDX_ea203405627b9fb15023dd7566"
  ON "bookings" ("clientId");
