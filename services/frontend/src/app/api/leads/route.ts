import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams.toString();
  const path = `/api/v1/leads${searchParams ? `?${searchParams}` : ''}`;

  const res = await backendFetch(path);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
