import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

/** Validates that an ID param is present and non-empty. */
function validateId(id: string | undefined): NextResponse | null {
  if (!id || id.trim().length === 0) {
    return NextResponse.json({ error: 'ID de lead inválido' }, { status: 400 });
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invalid = validateId(params.id);
  if (invalid) return invalid;

  const res = await backendFetch(`/leads/${params.id}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invalid = validateId(params.id);
  if (invalid) return invalid;

  const body = await req.json();
  const res = await backendFetch(`/leads/${params.id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
