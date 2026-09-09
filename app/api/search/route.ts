import { NextResponse } from 'next/server';
import { typesenseServerClient } from '../../../lib/typesense';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ hits: [] });
  }

  try {
    const campusResults = await typesenseServerClient
      .collections('CampusData')
      .documents()
      .search({
        q: query,
        query_by: 'title,description,location,category',
      });

    let diningHits: any[] = [];
    let diningFound = 0;
    try {
      const diningResults = await typesenseServerClient
        .collections('DiningMenu')
        .documents()
        .search({
          q: query,
          query_by: 'title,description,location,meal,station,category',
          per_page: 100,
        });
      diningHits = diningResults.hits || [];
      diningFound = diningResults.found || 0;
    } catch (error: any) {
      if (error.httpStatus !== 404) throw error;
    }

    return NextResponse.json({
      found: (campusResults.found || 0) + diningFound,
      hits: [...(campusResults.hits || []), ...diningHits],
    });
  } catch (error) {
    console.error('Typesense search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}