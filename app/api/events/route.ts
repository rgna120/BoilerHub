import { NextResponse } from 'next/server';
import { cachedEvents, eventRange } from '@/lib/boilerlink';
import { initializeAndIndexEvents } from '@/lib/typesense';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { start, end } = eventRange(url.searchParams.get('start'), url.searchParams.get('end'));
    const feed = await cachedEvents(start, end);
    let indexed = false;
    try {
      await initializeAndIndexEvents(feed.events);
      indexed = true;
    } catch (error) {
      console.error('Campus event indexing error:', error);
    }
    return NextResponse.json({ ...feed, indexed }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (error) {
    const invalid = error instanceof Error && error.message === 'INVALID_RANGE';
    return NextResponse.json({ error: invalid ? 'Choose a calendar range of up to 45 days.' : 'BoilerLink events are temporarily unavailable. Try again shortly.' },
      { status: invalid ? 400 : 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
