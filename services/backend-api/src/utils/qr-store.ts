/**
 * In-memory QR code store.
 *
 * WPPConnect v2.8.x fires `onQRCode` webhook events but its REST
 * `status-session` endpoint stays at `INITIALIZING` while a QR is pending.
 * This module bridges the gap: the webhook handler writes here, the auth
 * route reads here — no circular imports needed.
 */

const QR_MAX_AGE_MS = 90_000; // WhatsApp QR expires ≈ 60 s; give 30 s buffer

let latestQr: string | null = null;
let qrSetAt = 0;

export function setQrCode(qr: string): void {
  latestQr = qr;
  qrSetAt = Date.now();
}

export function getQrCode(): string | null {
  if (!latestQr) return null;
  if (Date.now() - qrSetAt > QR_MAX_AGE_MS) {
    latestQr = null;
    return null;
  }
  return latestQr;
}

export function clearQrCode(): void {
  latestQr = null;
  qrSetAt = 0;
}
