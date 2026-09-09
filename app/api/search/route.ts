import { NextResponse } from 'next/server';
import { typesenseServerClient } from '../../../lib/typesense';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const autocomplete = searchParams.get('autocomplete') === 'true';

  if (!query) {
    return NextResponse.json({ found: 0, hits: [], facets: {}, suggestions: [] });
  }

  try {
    const collectionNames = ['CampusData', 'DiningMenu', 'CampusEvents'];
    const availableCollections = (await Promise.all(collectionNames.map(async (name) => {
      try {
        await typesenseServerClient.collections(name).retrieve();
        return name;
      } catch (error: any) {
        if (error.httpStatus === 404) return null;
        throw error;
      }
    }))).filter((name): name is string => Boolean(name));

    const searches = [
        {
          collection: 'CampusData',
          q: query,
          query_by: 'title,description,location,category',
          query_by_weights: 'title,description,location,category',
          facet_by: 'category',
          per_page: autocomplete ? 5 : 100,
          prioritize_exact_match: true,
          highlight_full_fields: 'title,description,location',
        },
        {
          collection: 'DiningMenu',
          q: query,
          query_by: 'title,description,location,meal,station,category',
          query_by_weights: 'title,description,location,meal,station,category',
          facet_by: 'category,location,meal',
          per_page: autocomplete ? 5 : 100,
          prioritize_exact_match: true,
          highlight_full_fields: 'title,description,location,meal,station',
        },
        {
          collection: 'CampusEvents',
          q: query,
          query_by: 'title,description,location,organizer,category',
          query_by_weights: 'title,description,location,organizer,category',
          facet_by: 'category,location,organizer',
          per_page: autocomplete ? 5 : 100,
          prioritize_exact_match: true,
          highlight_full_fields: 'title,description,location,organizer',
        },
      ].filter((search) => availableCollections.includes(search.collection));

    const multiSearch = await typesenseServerClient.multiSearch.perform({ searches });

    const responses = multiSearch.results || [];
    const hits = responses.flatMap((response: any) => response.hits || []);
    const facetMaps: Record<string, Map<string, number>> = {};
    for (const response of responses as any[]) {
      for (const facet of response.facet_counts || []) {
        const values = facetMaps[facet.field_name] || (facetMaps[facet.field_name] = new Map());
        for (const count of facet.counts || []) values.set(count.value, (values.get(count.value) || 0) + count.count);
      }
    }
    const facets = Object.fromEntries(Object.entries(facetMaps).map(([field, values]) => [
      field,
      Array.from(values.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    ]));
    const suggestions = Array.from(new Set(hits.map((hit: any) => hit.document?.title).filter(Boolean))).slice(0, 8);

    return NextResponse.json({
      found: responses.reduce((total: number, response: any) => total + (response.found || 0), 0),
      hits,
      facets,
      suggestions,
    });
  } catch (error) {
    console.error('Typesense search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}