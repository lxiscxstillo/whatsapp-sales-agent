import { Router, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { config } from '../config';
import logger from '../utils/logger';
import * as wppconnect from '../services/wppconnect.service';

export const authRouter = Router();

// ── ConnectionState enum ──────────────────────────────────────────────────────
// Normalized 5-value state machine. Maps WPPConnect raw status strings to a
// clean enum the frontend uses to drive its panel state machine.

export type ConnectionState =
  | 'CONNECTED'      // isLogged — session active
  | 'QR_CODE_READY'  // QRCODE — QR generated, awaiting scan
  | 'AUTHENTICATING' // qrReadSuccess | SYNCING — QR scanned, syncing
  | 'DISCONNECTED'   // notLogged | browserClose | desconnectedMobile | serverClose | etc.
  | 'ERROR';         // backend cannot reach WPPConnect

function toConnectionState(rawStatus: string, hasQrcode: boolean): ConnectionState {
  switch (rawStatus) {
    case 'isLogged':
      return 'CONNECTED';
    case 'QRCODE':
      return hasQrcode ? 'QR_CODE_READY' : 'DISCONNECTED';
    case 'qrReadSuccess':
    case 'SYNCING':
      return 'AUTHENTICATING';
    case 'notLogged':
    case 'browserClose':
    case 'desconnectedMobile':
    case 'serverClose':
    case 'qrReadFail':
    case 'autocloseCalled':
    default:
      return 'DISCONNECTED';
  }
}

// ── Token cache ───────────────────────────────────────────────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getCachedToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const token = await wppconnect.generateToken();
  tokenCache = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

// ── GET /api/v1/auth/qr ───────────────────────────────────────────────────────
// Returns normalized connectionState + raw WPPConnect status + QR code.
// Retries up to 3 times on transient errors. Always returns HTTP 200 —
// error state is encoded in connectionState: 'ERROR'.

authRouter.get('/qr', async (_req: Request, res: Response) => {
  const session = config.WPPCONNECT_SESSION;
  const checkedAt = new Date().toISOString();

  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS = [500, 1000];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const token = await getCachedToken();

      const { data } = await axios.get(
        `${config.WPPCONNECT_URL}/api/${session}/status-session`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
      );

      const status: string = data.status ?? 'unknown';
      const qrcode: string | null = data.qrcode ?? null;
      const connected = status === 'isLogged';
      const connectionState = toConnectionState(status, qrcode !== null);

      return res.json({ connectionState, status, connected, qrcode, session, checkedAt });
    } catch (err) {
      const axiosErr = err as AxiosError;

      if (axiosErr.response?.status === 401) tokenCache = null;

      const isLastAttempt = attempt === MAX_ATTEMPTS;

      if (isLastAttempt) {
        logger.error({
          event: 'qr_fetch_failed',
          message: `WPPConnect unreachable after ${MAX_ATTEMPTS} attempts`,
          error: axiosErr.message,
        });
        return res.json({
          connectionState: 'ERROR' as ConnectionState,
          status: 'ERROR',
          connected: false,
          qrcode: null,
          session,
          checkedAt,
          error: `WPPConnect unreachable after ${MAX_ATTEMPTS} attempts: ${axiosErr.message}`,
        });
      }

      logger.warn({ event: 'qr_fetch_retry', attempt, error: axiosErr.message });
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
    }
  }
});

// ── POST /api/v1/auth/start-session ──────────────────────────────────────────
// Closes the existing WPPConnect session and starts a fresh one (new QR cycle).
// The frontend calls this through the Vercel proxy — never directly — to avoid
// Vercel's 10s serverless timeout on cold WPPConnect starts.

authRouter.post('/start-session', async (_req: Request, res: Response) => {
  const session = config.WPPCONNECT_SESSION;

  try {
    const token = await getCachedToken();

    // 1. Close existing session (ignore errors — it may already be closed)
    try {
      await axios.post(
        `${config.WPPCONNECT_URL}/api/${session}/close-session`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
      );
    } catch {
      // Intentionally ignored — session may not exist yet
    }

    // 2. Brief pause before starting fresh
    await new Promise((r) => setTimeout(r, 1500));

    // 3. Start new session (generates a fresh QR)
    await axios.post(
      `${config.WPPCONNECT_URL}/api/${session}/${config.WPPCONNECT_SECRET_KEY}/start-session`,
      {},
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
    );

    // Invalidate token cache — new session generates a new token
    tokenCache = null;

    logger.info({ event: 'session_started', session });

    return res.json({ ok: true, connectionState: 'DISCONNECTED' as ConnectionState });
  } catch (err) {
    const axiosErr = err as AxiosError;
    logger.error({
      event: 'session_start_failed',
      session,
      error: axiosErr.message,
    });
    return res.json({
      ok: false,
      connectionState: 'ERROR' as ConnectionState,
      error: axiosErr.message,
    });
  }
});
