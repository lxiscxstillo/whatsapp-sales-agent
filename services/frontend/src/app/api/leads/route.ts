import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams.toString();
  const path = `/leads${searchParams ? `?${searchParams}` : ''}`;

  const res = await backendFetch(path);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
