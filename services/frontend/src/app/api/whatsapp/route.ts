import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface WppTokenCache {
  token: string;
  expiresAt: number;
}

// Module-level token cache (valid for warm Vercel instances)
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
  // Auth middleware does bcrypt.compare(session + secretKey, tokenFromHeader)
  tokenCache = { token: data.token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.token;
}

export async function GET() {
  try {
    const token = await getToken();

    const res = await fetch(
      `${process.env.WPPCONNECT_URL}/api/${process.env.WPPCONNECT_SESSION}/status-session`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      // Token may have expired — clear cache and return error state
      tokenCache = null;
      throw new Error(`status-session failed: ${res.status}`);
    }

    const data = await res.json();

    return NextResponse.json({
      connected: data.status === 'isLogged',
      status: data.status as string,
      qrcode: data.qrcode ?? null,
      session: process.env.WPPCONNECT_SESSION ?? '',
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[whatsapp/route] error:', err);
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
