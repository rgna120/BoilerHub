import { NextRequest, NextResponse } from 'next/server';
import { AcademicError, guardLocalRequest } from './config';
import { cookieName } from './session';
import type { Provider } from './types';
export function requestContext(req: NextRequest) {
  guardLocalRequest(req);
  const provider = req.nextUrl.searchParams.get('provider');
  if (provider !== 'brightspace' && provider !== 'gradescope') throw new AcademicError('INVALID_PROVIDER');
  return { provider: provider as Provider, token: req.cookies.get(cookieName(provider))?.value };
}
export const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie' },
});
export function failure(error: unknown) {
  // Do not expose browser errors, HTML, tickets, or Typesense request details.
  return error instanceof AcademicError ? json({ error: error.code }, error.status) : json({ error: 'ACADEMIC_SERVICE_FAILED' }, 502);
}
