/**
 * Server-side helper to call the backend API.
 * Used in Route Handlers to proxy requests while hiding credentials.
 */

const BACKEND_URL = process.env.BACKEND_API_URL!;
const INTERNAL_KEY = process.env.INTERNAL_API_KEY!;

export async function backendFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': INTERNAL_KEY,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}
