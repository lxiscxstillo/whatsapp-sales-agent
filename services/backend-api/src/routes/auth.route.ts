import { Router, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { config } from '../config';
import logger from '../utils/logger';
import * as wppconnect from '../services/wppconnect.service';

export const authRouter = Router();

// Token cache shared with wppconnect.service calls
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
// Fetches WhatsApp session status + QR code from WPPConnect.
// Retries up to 3 times on transient errors before returning ERROR status.
// Returns HTTP 200 always — error state is encoded in the `status` field.

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
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
        }
      );

      const status: string = data.status ?? 'unknown';
      const connected = status === 'isLogged';
      const qrcode: string | null = data.qrcode ?? null;

      return res.json({ status, connected, qrcode, session, checkedAt });
    } catch (err) {
      const axiosErr = err as AxiosError;

      // If token likely expired, clear cache so next attempt re-generates
      if (axiosErr.response?.status === 401) {
        tokenCache = null;
      }

      const isLastAttempt = attempt === MAX_ATTEMPTS;

      if (isLastAttempt) {
        logger.error({
          event: 'qr_fetch_failed',
          message: `WPPConnect unreachable after ${MAX_ATTEMPTS} attempts`,
          error: axiosErr.message,
        });
        return res.json({
          status: 'ERROR',
          connected: false,
          qrcode: null,
          session,
          checkedAt,
          error: `WPPConnect unreachable after ${MAX_ATTEMPTS} attempts: ${axiosErr.message}`,
        });
      }

      logger.warn({
        event: 'qr_fetch_retry',
        attempt,
        error: axiosErr.message,
      });

      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
    }
  }
});
