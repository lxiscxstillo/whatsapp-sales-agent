import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST — proxy session restart to backend-api/start-session.
// Calling WPPConnect directly from Vercel times out (10s serverless limit)
// because WPPConnect's close+start sequence can take 5-15s on cold start.
// The backend-api (Fly.io, persistent) handles the timing reliably.
export async function POST() {
  try {
    const res = await fetch(
      `${process.env.BACKEND_API_URL}/api/v1/auth/start-session`,
      {
        method: 'POST',
        headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? '' },
        cache: 'no-store',
      }
    );

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[whatsapp/route] POST error:', err);
    return NextResponse.json(
      { ok: false, connectionState: 'ERROR', error: (err as Error).message },
      { status: 500 }
    );
  }
}

// GET — proxy QR status to backend-api/qr (handles token auth + retry internally)
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
      connectionState: 'ERROR',
      connected: false,
      status: 'ERROR',
      qrcode: null,
      session: process.env.WPPCONNECT_SESSION ?? '',
      checkedAt: new Date().toISOString(),
      error: (err as Error).message,
    });
  }
}
