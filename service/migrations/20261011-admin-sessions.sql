CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "tokenHash" character varying(64) PRIMARY KEY,
  "email" character varying NOT NULL,
  "credentialVersion" character varying(64) NOT NULL,
  "expiresAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_admin_sessions_expires_at"
  ON "admin_sessions" ("expiresAt");
