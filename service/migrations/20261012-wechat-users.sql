CREATE TABLE IF NOT EXISTS "wechat_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "openid" character varying(128) NOT NULL,
  "nickname" character varying(40) NOT NULL DEFAULT '书友',
  "avatar" text,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wechat_users_openid" ON "wechat_users" ("openid");

CREATE TABLE IF NOT EXISTS "wechat_sessions" (
  "tokenHash" character varying(64) PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES "wechat_users" ("id") ON DELETE CASCADE,
  "expiresAt" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_wechat_sessions_expires_at" ON "wechat_sessions" ("expiresAt");

-- Preserve anonymous history; do not infer ownership from a client-supplied ID or phone.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "userId" uuid;
CREATE INDEX IF NOT EXISTS "IDX_bookings_user_id" ON "bookings" ("userId");
