-- Sales Closer Engine v2: add preferred neighborhood and normalized urgency level to Lead
-- Migration: add_lead_neighborhood_urgency
-- These are nullable ADD COLUMN operations — no table rewrites, no data loss.
-- Safe to run on Neon PostgreSQL without downtime.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "slotNeighborhood" TEXT;
ALTER TABLE "Lead" ADD COLUMN "urgencyLevel" TEXT;
