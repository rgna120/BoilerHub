import type { NextRequest } from 'next/server';
import { requestContext, failure, json } from '@/lib/academic/http';
import { refresh } from '@/lib/academic/session';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try { const { token, provider } = requestContext(req); return json(await refresh(token, provider)); }
  catch (error) { return failure(error); }
}
