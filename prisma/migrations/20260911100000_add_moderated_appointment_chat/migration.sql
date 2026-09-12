-- CreateEnum
CREATE TYPE "ChatEmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "chat_message" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "clientId" VARCHAR(64) NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "moderationVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(3),
    "emailBatchId" TEXT,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_mailbox" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "lastSentAt" TIMESTAMPTZ(3),

    CONSTRAINT "chat_mailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_email_batch" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "status" "ChatEmailStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstAttemptAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMPTZ(3),
    "recipientEmail" TEXT,
    "fromEmail" TEXT,
    "conversationUrl" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "lastErrorCode" VARCHAR(64),

    CONSTRAINT "chat_email_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_send_attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_send_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_message_appointmentId_createdAt_id_idx" ON "chat_message"("appointmentId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "chat_message_recipientUserId_readAt_appointmentId_idx" ON "chat_message"("recipientUserId", "readAt", "appointmentId");

-- CreateIndex
CREATE INDEX "chat_message_emailBatchId_readAt_idx" ON "chat_message"("emailBatchId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_senderUserId_clientId_key" ON "chat_message"("senderUserId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_mailbox_appointmentId_recipientUserId_key" ON "chat_mailbox"("appointmentId", "recipientUserId");

-- CreateIndex
CREATE INDEX "chat_email_batch_status_dueAt_idx" ON "chat_email_batch"("status", "dueAt");

-- CreateIndex
CREATE INDEX "chat_email_batch_mailboxId_status_idx" ON "chat_email_batch"("mailboxId", "status");

-- CreateIndex
CREATE INDEX "chat_send_attempt_userId_createdAt_idx" ON "chat_send_attempt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_emailBatchId_fkey" FOREIGN KEY ("emailBatchId") REFERENCES "chat_email_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mailbox" ADD CONSTRAINT "chat_mailbox_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mailbox" ADD CONSTRAINT "chat_mailbox_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_email_batch" ADD CONSTRAINT "chat_email_batch_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "chat_mailbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_send_attempt" ADD CONSTRAINT "chat_send_attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one mutable batch and one frozen/in-flight batch per mailbox.
CREATE UNIQUE INDEX chat_email_one_pending ON chat_email_batch ("mailboxId") WHERE status = 'PENDING';
CREATE UNIQUE INDEX chat_email_one_sending ON chat_email_batch ("mailboxId") WHERE status = 'SENDING';
ALTER TABLE chat_message ADD CONSTRAINT chat_message_different_participants CHECK ("senderUserId" <> "recipientUserId");
ALTER TABLE chat_message ADD CONSTRAINT chat_message_nonempty CHECK (length(btrim(text)) > 0);
