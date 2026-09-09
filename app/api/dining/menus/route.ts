import { NextResponse } from 'next/server';
import { initializeAndIndexDiningMenus } from '../../../../lib/typesense';

const LOCATIONS_URL = 'https://api.hfs.purdue.edu/menus/v2/locations/';
const PURDUE_TIME_ZONE = 'America/Indiana/Indianapolis';

type PurdueMenuItem = {
  ID: string;
  Name: string;
  IsVegetarian?: boolean;
  Allergens?: Array<{ Name: string; Value: boolean }>;
};

type PurdueStation = {
  Name: string;
  Items: PurdueMenuItem[];
};

type PurdueMeal = {
  ID: string;
  Name: string;
  Status: string;
  Hours?: { StartTime: string; EndTime: string };
  Stations: PurdueStation[];
};

type PurdueMenu = {
  Date: string;
  IsPublished: boolean;
  Location: string;
  Notes?: string | null;
  Meals: PurdueMeal[];
};

type PurdueLocation = {
  Name: string;
  Type: string;
};

type PurdueLocationsResponse = {
  Location: PurdueLocation[];
};

function getToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PURDUE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeMenu(menu: PurdueMenu, requestedDate: string) {
  return {
    location: menu.Location,
    date: requestedDate,
    published: menu.IsPublished,
    notes: menu.Notes || null,
    meals: menu.Meals.map((meal) => ({
      id: meal.ID,
      name: meal.Name,
      status: meal.Status,
      hours: meal.Hours || null,
      stations: meal.Stations.map((station) => ({
        name: station.Name,
        items: station.Items.map((item) => ({
          id: item.ID,
          name: item.Name,
          vegetarian: item.IsVegetarian || false,
          allergens: (item.Allergens || [])
            .filter((allergen) => allergen.Value)
            .map((allergen) => allergen.Name),
        })),
      })),
    })),
  };
}

function toSearchDocuments(menus: ReturnType<typeof normalizeMenu>[]) {
  const locationDocuments = menus.map((menu) => ({
    id: `dining-location-${menu.location}-${menu.date}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    title: `${menu.location} Dining`,
    category: 'dining-location',
    description: `Today's dining menus and hours for ${menu.location}.`,
    location: menu.location,
    date: menu.date,
    meal: '',
    station: '',
    vegetarian: false,
    allergens: [],
  }));

  const itemDocuments = menus.flatMap((menu) =>
    menu.meals.flatMap((meal) =>
      meal.stations.flatMap((station) =>
        station.items.map((item) => ({
          id: `${menu.location}-${menu.date}-${meal.name}-${item.id}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          title: item.name,
          category: 'dining-menu',
          description: `${meal.name} at ${menu.location}, ${station.name}`,
          location: menu.location,
          date: menu.date,
          meal: meal.name,
          station: station.name,
          vegetarian: item.vegetarian,
          allergens: item.allergens,
        })),
      ),
    ),
  );

  return [...locationDocuments, ...itemDocuments];
}

async function getDiningLocations() {
  const response = await fetch(LOCATIONS_URL, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Dining locations returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as PurdueLocationsResponse;
  return data.Location.map((location) => location.Name);
}

export async function GET() {
  const date = getToday();
  let diningLocations: string[];

  try {
    diningLocations = await getDiningLocations();
  } catch (error) {
    console.error('Dining locations error:', error);
    return NextResponse.json({ date, menus: [], errors: [{ location: 'all', error: String(error) }] }, { status: 502 });
  }

  const results = await Promise.allSettled(
    diningLocations.map(async (hall) => {
      const response = await fetch(
        `https://api.hfs.purdue.edu/menus/v2/locations/${encodeURIComponent(hall)}/${date}`,
        { cache: 'no-store' },
      );

      if (!response.ok) {
        throw new Error(`${hall} returned HTTP ${response.status}`);
      }

      const menu = (await response.json()) as PurdueMenu;
      return normalizeMenu(menu, date);
    }),
  );

  const menus = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const errors = results.flatMap((result, index) =>
    result.status === 'rejected' ? [{ location: diningLocations[index], error: String(result.reason) }] : [],
  );

  if (menus.length === 0) {
    return NextResponse.json({ date, menus: [], errors }, { status: 502 });
  }

  let indexed = false;
  let indexingError: string | null = null;
  if (errors.length === 0) {
    try {
      await initializeAndIndexDiningMenus(date, toSearchDocuments(menus));
      indexed = true;
    } catch (error) {
      console.error('Dining menu indexing error:', error);
      indexingError = 'Menus loaded, but Typesense indexing is unavailable on this machine.';
    }
  }

  return NextResponse.json({ date, menus, errors, indexed, indexingError });
}
