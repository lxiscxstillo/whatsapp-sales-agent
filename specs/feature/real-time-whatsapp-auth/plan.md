# Implementation Plan: Real-Time WhatsApp Authentication Flow

**Branch**: `feature/real-time-whatsapp-auth` | **Date**: 2026-03-21 | **Spec**: spec.md

## Summary

Add `connectionState` enum normalization to the backend QR endpoint, create a `POST /api/v1/auth/start-session` proxy, and rebuild the WhatsApp page into a proper 5-state machine with 2s polling when QR is shown and a success animation on first connection.

## Technical Context

**Language/Version**: TypeScript 5.x (backend-api, frontend Next.js 14)
**Primary Dependencies**: Express 4.x, SWR 2.x, Framer Motion v11, Lucide React, Axios
**Storage**: None — connection state is in-memory (WPPConnect manages session persistence via volume mount)
**Testing**: Manual via `fly logs` + browser DevTools Network tab
**Target Platform**: Fly.io (wsa-backend-api), Vercel (frontend)
**Project Type**: Multi-service web application
**Performance Goals**: QR scan → CONNECTED detection ≤ 3s (2s poll + ~1s network)
**Constraints**: Vercel free tier (10s serverless function timeout); Fly.io free tier 256MB backend
**Scale/Scope**: 3 files modified, 1 new backend endpoint, 1 page component rebuild

## Constitution Check

No constitution defined. Proceeding without gate checks.

## Project Structure

### Documentation (this feature)
```text
specs/feature/real-time-whatsapp-auth/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research
├── data-model.md        # State machine + connection state types
├── contracts/           # Updated API contracts
│   └── qr-endpoint.md
├── quickstart.md        # Test scenarios
└── tasks.md             # Task list (generated next)
```

### Source Code (files modified)
```text
services/backend-api/src/routes/auth.route.ts
  # Add connectionState normalization + POST /start-session endpoint

services/frontend/src/app/api/whatsapp/route.ts
  # POST: proxy to BACKEND_API_URL/api/v1/auth/start-session instead of direct WPPConnect

services/frontend/src/app/dashboard/whatsapp/page.tsx
  # Full 5-state panel rebuild + 2s QR polling + success animation + QR timeout
```

## Complexity Tracking

No violations. All changes are minimal modifications to existing files.
