-- GeoApex PostgreSQL Migration: Secure 6-digit OTP Auth & Bcrypt Passwords
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "verification_codes" ALTER COLUMN "code" SET DEFAULT 'HASHED';
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "purpose" text NOT NULL DEFAULT 'register';
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "code_hash" text NOT NULL DEFAULT '';
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "pending_payload" text;
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "max_attempts" integer NOT NULL DEFAULT 5;
ALTER TABLE "verification_codes" ADD COLUMN IF NOT EXISTS "used_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_users_email_lower" ON "users" (lower("email"));
CREATE INDEX IF NOT EXISTS "idx_verification_codes_lookup" ON "verification_codes" ("email", "purpose", "used", "id" DESC);
