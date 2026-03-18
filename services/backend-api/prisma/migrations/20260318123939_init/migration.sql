-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFYING', 'HOT', 'HANDOFF', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('LEAD', 'AGENT', 'HUMAN');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "interestLevel" SMALLINT,
    "isHandoffRequested" BOOLEAN NOT NULL DEFAULT false,
    "handoffAt" TIMESTAMP(3),
    "handoffReason" TEXT,
    "assignedTo" TEXT,
    "agentNotes" TEXT,
    "ambiguityCount" INTEGER NOT NULL DEFAULT 0,
    "slotPropertyType" TEXT,
    "slotCity" TEXT,
    "slotZone" TEXT,
    "slotBudget" TEXT,
    "slotBudgetNumeric" BIGINT,
    "slotIntent" TEXT,
    "slotBedrooms" TEXT,
    "slotUrgency" TEXT,
    "slotMainNeed" TEXT,
    "slotObjections" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "wppMessageId" TEXT,
    "direction" "Direction" NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "body" TEXT NOT NULL,
    "isAmbiguous" BOOLEAN NOT NULL DEFAULT false,
    "rawPayload" JSONB,
    "langsmithRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_phone_key" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_isHandoffRequested_idx" ON "Lead"("isHandoffRequested");

-- CreateIndex
CREATE UNIQUE INDEX "Message_wppMessageId_key" ON "Message"("wppMessageId");

-- CreateIndex
CREATE INDEX "Message_leadId_createdAt_idx" ON "Message"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_direction_idx" ON "Message"("direction");

-- CreateIndex
CREATE INDEX "Message_wppMessageId_idx" ON "Message"("wppMessageId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
