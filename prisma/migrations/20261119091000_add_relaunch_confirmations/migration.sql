BEGIN;

ALTER TABLE "user"
  ADD COLUMN "signupPolicyVersion" TEXT,
  ADD COLUMN "signupPolicyConfirmedAt" TIMESTAMPTZ(3),
  ADD CONSTRAINT "user_signup_policy_confirmation_pair_check" CHECK (
    ("signupPolicyVersion" IS NULL) = ("signupPolicyConfirmedAt" IS NULL)
  );

CREATE TABLE "account_policy_confirmation" (
  "userId" TEXT NOT NULL,
  "policy" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "confirmedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_policy_confirmation_pkey" PRIMARY KEY ("userId", "policy", "version"),
  CONSTRAINT "account_policy_confirmation_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "chat_medical_data_report" (
  "messageId" TEXT NOT NULL,
  "reporterUserId" TEXT NOT NULL,
  "reportedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(3),
  CONSTRAINT "chat_medical_data_report_pkey" PRIMARY KEY ("messageId", "reporterUserId"),
  CONSTRAINT "chat_medical_data_report_messageId_fkey" FOREIGN KEY ("messageId")
    REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_medical_data_report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId")
    REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "chat_medical_data_report_resolvedAt_reportedAt_idx"
  ON "chat_medical_data_report"("resolvedAt", "reportedAt");

COMMIT;
