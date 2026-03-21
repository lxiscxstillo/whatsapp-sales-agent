import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Token cache for the POST (restart session) path — still needs direct WPPConnect access
interface WppTokenCache {
  token: string;
  expiresAt: number;
}
let tokenCache: WppTokenCache | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const res = await fetch(
    `${process.env.WPPCONNECT_URL}/api/${process.env.WPPCONNECT_SESSION}/${process.env.WPPCONNECT_SECRET_KEY}/generate-token`,
    { method: 'POST', cache: 'no-store' }
  );

  if (!res.ok) {
    throw new Error(`generate-token failed: ${res.status}`);
  }

  const data = await res.json();

  if (!data.token) {
    throw new Error('generate-token response missing token field');
  }

  // IMPORTANT: use only data.token (the bcrypt hash), NOT data.full
  tokenCache = { token: data.token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.token;
}

// POST — restart the WPPConnect session (triggers a new QR cycle)
export async function POST() {
  try {
    const token = await getToken();

    // Close existing session first, then start fresh
    await fetch(
      `${process.env.WPPCONNECT_URL}/api/${process.env.WPPCONNECT_SESSION}/close-session`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );

    await new Promise((r) => setTimeout(r, 1500));

    const res = await fetch(
      `${process.env.WPPCONNECT_URL}/api/${process.env.WPPCONNECT_SESSION}/${process.env.WPPCONNECT_SECRET_KEY}/start-session`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );

    tokenCache = null; // force fresh token on next GET
    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

// GET — proxy to backend-api /api/v1/auth/qr (handles token auth + retry internally)
export async function GET() {
  try {
    const res = await fetch(
      `${process.env.BACKEND_API_URL}/api/v1/auth/qr`,
      {
        headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? '' },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      throw new Error(`backend /api/v1/auth/qr failed: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[whatsapp/route] GET error:', err);
    return NextResponse.json({
      connected: false,
      status: 'ERROR',
      qrcode: null,
      session: process.env.WPPCONNECT_SESSION ?? '',
      checkedAt: new Date().toISOString(),
      error: (err as Error).message,
    });
  }
}
