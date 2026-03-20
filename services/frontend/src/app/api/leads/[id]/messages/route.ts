import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

export const dynamic = 'force-dynamic';

/** Validates that an ID param is present and non-empty. */
function validateId(id: string | undefined): NextResponse | null {
  if (!id || id.trim().length === 0) {
    return NextResponse.json({ error: 'ID de lead inválido' }, { status: 400 });
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invalid = validateId(params.id);
  if (invalid) return invalid;

  const searchParams = req.nextUrl.searchParams.toString();
  const path = `/leads/${params.id}/messages${searchParams ? `?${searchParams}` : ''}`;
  const res = await backendFetch(path);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invalid = validateId(params.id);
  if (invalid) return invalid;

  const body = await req.json().catch(() => ({}));

  // Validate that the message body is a non-empty string.
  if (!body?.body || typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json(
      { error: 'El campo body es requerido y no puede estar vacío' },
      { status: 400 }
    );
  }

  const res = await backendFetch(`/leads/${params.id}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
