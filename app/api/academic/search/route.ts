import type { NextRequest } from 'next/server';
import { requestContext, failure, json } from '@/lib/academic/http';
import { AcademicError } from '@/lib/academic/config';
import { search } from '@/lib/academic/session';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const { token, provider } = requestContext(req);
    const query = req.nextUrl.searchParams.get('q') || '';
    if (query.length > 200) throw new AcademicError('QUERY_TOO_LONG');
    return json(await search(token, provider, query));
  } catch (error) { return failure(error); }
}
