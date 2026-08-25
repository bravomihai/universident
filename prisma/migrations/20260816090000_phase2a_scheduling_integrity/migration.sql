-- Expand first: all new columns are nullable so the migration is safe for
-- existing appointments and old application instances during rollout.
ALTER TABLE "appointment"
  ADD COLUMN "pendingExpiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "idempotencyKeyHash" CHAR(64),
  ADD COLUMN "idempotencyRequestHash" CHAR(64);

-- Existing pending requests receive the same deterministic expiry policy as
-- new requests: the earlier of 24 hours after creation and the slot start.
UPDATE "appointment"
SET "pendingExpiresAt" = LEAST(
  "createdAt" + INTERVAL '24 hours',
  "scheduledStartsAt"
)
WHERE "status" = 'PENDING';

ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_pending_expiry_required_check"
  CHECK (
    "status" <> 'PENDING'
    OR (
      "pendingExpiresAt" IS NOT NULL
      AND "pendingExpiresAt" <= "scheduledStartsAt"
      AND "pendingExpiresAt" <= "createdAt" + INTERVAL '24 hours'
    )
  ),
  ADD CONSTRAINT "appointment_idempotency_pair_check"
  CHECK (
    ("idempotencyKeyHash" IS NULL AND "idempotencyRequestHash" IS NULL)
    OR
    (
      "idempotencyKeyHash" IS NOT NULL
      AND "idempotencyRequestHash" IS NOT NULL
      AND "idempotencyKeyHash" ~ '^[0-9a-f]{64}$'
      AND "idempotencyRequestHash" ~ '^[0-9a-f]{64}$'
    )
  );

CREATE UNIQUE INDEX "appointment_idempotencyKeyHash_key"
  ON "appointment"("idempotencyKeyHash");

CREATE INDEX "appointment_status_pending_expiry_idx"
  ON "appointment"("status", "pendingExpiresAt");

CREATE INDEX "appointment_patient_status_pending_expiry_idx"
  ON "appointment"("patientProfileId", "status", "pendingExpiresAt");
