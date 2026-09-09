import type { NextRequest } from 'next/server';
import { requestContext, failure, json } from '@/lib/academic/http';
import { connect, disconnect, status, cookieName, COOKIE_TTL } from '@/lib/academic/session';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try { const { token, provider } = requestContext(req); return json(status(token, provider)); }
  catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  try {
    const { token, provider } = requestContext(req);
    const result = await connect(token, provider);
    const response = json(result.view);
    response.cookies.set(cookieName(provider), result.token, { httpOnly: true, sameSite: 'strict',
      secure: req.nextUrl.protocol === 'https:', path: '/api/academic', maxAge: COOKIE_TTL });
    return response;
  } catch (error) { return failure(error); }
}
export async function DELETE(req: NextRequest) {
  try {
    const { token, provider } = requestContext(req);
    await disconnect(token, provider);
    const response = json({ available: true, state: 'disconnected' });
    response.cookies.set(cookieName(provider), '', { httpOnly: true, sameSite: 'strict',
      secure: req.nextUrl.protocol === 'https:', path: '/api/academic', maxAge: 0 });
    return response;
  } catch (error) { return failure(error); }
}
