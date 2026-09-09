import Typesense from 'typesense';
import type { CampusEvent } from './events';

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST || 'localhost';
const TYPESENSE_PORT = Number(process.env.TYPESENSE_PORT || process.env.NEXT_PUBLIC_TYPESENSE_PORT || 443);
const TYPESENSE_PROTOCOL = process.env.TYPESENSE_PROTOCOL || process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL || 'https';
const TYPESENSE_ADMIN_API_KEY = process.env.TYPESENSE_ADMIN_API_KEY || '';

export const typesenseServerClient = new Typesense.Client({
  nodes: [
    {
      host: TYPESENSE_HOST,
      port: TYPESENSE_PORT,
      protocol: TYPESENSE_PROTOCOL,
    },
  ],
  apiKey: TYPESENSE_ADMIN_API_KEY,
  connectionTimeoutSeconds: 5,
});

export const campusDataSchema = {
  name: 'CampusData',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'category', type: 'string', facet: true },
    { name: 'description', type: 'string' },
  { name: 'location', type: 'string' },
  ],
};

export const diningMenuSchema = {
  name: 'DiningMenu',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'category', type: 'string', facet: true },
    { name: 'description', type: 'string' },
    { name: 'location', type: 'string', facet: true },
    { name: 'date', type: 'string', facet: true },
    { name: 'meal', type: 'string', facet: true },
    { name: 'station', type: 'string' },
    { name: 'vegetarian', type: 'bool', facet: true },
    { name: 'allergens', type: 'string[]', facet: true },
  ],
};

export const campusEventSchema = {
  name: 'CampusEvents',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'category', type: 'string', facet: true },
    { name: 'description', type: 'string' },
    { name: 'location', type: 'string', facet: true },
    { name: 'organizer', type: 'string', facet: true },
    { name: 'startsAt', type: 'string' },
    { name: 'endsAt', type: 'string' },
    { name: 'url', type: 'string' },
  ],
};

async function ensureCollection(collectionName: string, schema: object) {
  try {
    await typesenseServerClient.collections(collectionName).retrieve();
  } catch (error: any) {
    if (error.httpStatus === 404) {
      await typesenseServerClient.collections().create(schema as any);
    } else {
      throw error;
    }
  }
}

async function ensureCampusSynonyms() {
  const synonyms: Array<[string, string[]]> = [
    ['pmu', ['PMU', 'Purdue Memorial Union']],
    ['walc', ['WALC', 'Wilmeth Active Learning Center']],
    ['corec', ['CoRec', 'Purdue Recreation Center', 'Recreation Center']],
    ['earhart-dining', ['Earhart', 'Earhart Dining', 'Earhart Dining Court']],
    ['wiley-dining', ['Wiley', 'Wiley Dining', 'Wiley Dining Court']],
    ['hillenbrand-dining', ['Hillenbrand', 'Hillenbrand Dining', 'Hillenbrand Dining Court']],
    ['windsor-dining', ['Windsor', 'Windsor Dining', 'Windsor Dining Court']],
  ];

  const collection = typesenseServerClient.collections('CampusData');
  try {
    await Promise.all(synonyms.map(([id, values]) => collection.synonyms().upsert(id, { synonyms: values })));
  } catch (error) {
    console.warn('Typesense synonyms unavailable; continuing without synonyms:', error);
  }
}

export async function initializeAndIndexData(documents: any[]) {
  try {
    await ensureCollection('CampusData', campusDataSchema);
    await ensureCampusSynonyms();
    const importResults = await typesenseServerClient.collections('CampusData').documents().import(documents, { action: 'upsert' });
    return importResults;
  } catch (error) {
    console.error('Error during Typesense initialization:', error);
    throw error;
  }
}

export async function initializeAndIndexDiningMenus(date: string, documents: any[]) {
  try {
    await ensureCollection('DiningMenu', diningMenuSchema);

    if (documents.length > 0) {
      const collection = typesenseServerClient.collections('DiningMenu').documents();
      await collection.delete({ filter_by: `date:=${date}` });
      const importResults = await collection.import(documents, { action: 'upsert' });
      await collection.delete({ filter_by: `date:!=${date}` });
      return importResults;
    }

    return [];
  } catch (error) {
    console.error('Error indexing dining menus:', error);
    throw error;
  }
}

export async function initializeAndIndexEvents(events: CampusEvent[]) {
  await ensureCollection('CampusEvents', campusEventSchema);

  const documents = events.map((event) => ({
    id: event.id,
    title: event.title,
    category: 'event',
    description: `${event.organizer || 'Purdue campus event'} at ${event.location || 'Purdue University'}`,
    location: event.location,
    organizer: event.organizer,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    url: event.url,
  }));

  return typesenseServerClient.collections('CampusEvents').documents().import(documents, { action: 'upsert' });
}