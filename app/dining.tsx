import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const PURDUE_LOCATIONS = [
  'Earhart',
  'Wiley',
  'Ford',
  'Windsor',
  'Hillenbrand'
];

const BASE_URL = 'https://api.hfs.purdue.edu/rest/v2/locations';

function getFormattedDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Determines if a dining hall is currently open right now
function isOpenNow(hours) {
  if (!hours || hours.length === 0) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const h of hours) {
    if (!h.startTime || !h.endTime || h.startTime === 'N/A') continue;

    const [startH, startM] = h.startTime.split(':').map(Number);
    const [endH, endM] = h.endTime.split(':').map(Number);

    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (currentMinutes >= startMin && currentMinutes <= endMin) {
      return true;
    }
  }

  return false;
}

async function fetchPurdueCourtData(locationName, dateStr) {
  const url = `${BASE_URL}/${locationName}/${dateStr}`;
  try {
    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 8000
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch data for ${locationName}:`, error.message);
    return null;
  }
}

function normalizePurdueData(rawData) {
  if (!rawData || !rawData.Location) return null;

  const hallName = rawData.Location;
  const hours = [];
  const menuItems = [];

  const meals = rawData.Meals || [];
  for (const meal of meals) {
    const mealType = meal.Name;
    
    if (meal.Hours) {
      hours.push({
        mealType,
        startTime: meal.Hours.StartTime || 'N/A',
        endTime: meal.Hours.EndTime || 'N/A'
      });
    }

    const stations = meal.Stations || [];
    for (const station of stations) {
      const category = station.Name;
      const items = station.Items || [];

      for (const item of items) {
        menuItems.push({
          mealType,
          category,
          itemName: item.Name,
          isVegetarian: Boolean(item.IsVegetarian)
        });
      }
    }
  }

  return { name: hallName, hours, menuItems };
}

async function syncPurdueDiningWeekly() {
  console.log(`Starting 7-day Purdue Dining sync...\n`);

  // Loop through next 7 days
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + i);
    targetDate.setHours(0, 0, 0, 0);

    const dateStr = getFormattedDate(targetDate);
    console.log(`=== DATE: ${dateStr} ===`);

    for (const location of PURDUE_LOCATIONS) {
      const rawData = await fetchPurdueCourtData(location, dateStr);
      const normalized = normalizePurdueData(rawData);

      if (!normalized) {
        console.warn(`[${location}] No data returned.`);
        continue;
      }

      const openStatus = isOpenNow(normalized.hours) ? 'OPEN NOW' : 'CLOSED NOW';

      // Save to database
      await prisma.$transaction(async (tx) => {
        const diningHall = await tx.diningHall.upsert({
          where: { name: normalized.name },
          update: { updatedAt: new Date() },
          create: { name: normalized.name },
        });

        await tx.operatingHour.deleteMany({
          where: { diningHallId: diningHall.id },
        });

        if (normalized.hours.length > 0) {
          await tx.operatingHour.createMany({
            data: normalized.hours.map((h) => ({
              diningHallId: diningHall.id,
              mealType: h.mealType,
              startTime: h.startTime,
              endTime: h.endTime,
            })),
          });
        }

        await tx.meal.deleteMany({
          where: {
            diningHallId: diningHall.id,
            date: targetDate,
          },
        });

        if (normalized.menuItems.length > 0) {
          await tx.meal.createMany({
            data: normalized.menuItems.map((item) => ({
              diningHallId: diningHall.id,
              type: item.mealType,
              category: item.category,
              itemName: item.itemName,
              isVegetarian: item.isVegetarian,
              date: targetDate,
            })),
          });
        }
      });

      // Display Status & Food Items
      console.log(`\n📍 ${normalized.name} (${openStatus})`);
      if (normalized.menuItems.length === 0) {
        console.log(`   No menu available or closed today.`);
      } else {
        // Group and display menu items
        const preview = normalized.menuItems.slice(0, 5).map(m => m.itemName).join(', ');
        console.log(`   Food (${normalized.menuItems.length} items): ${preview}...`);
      }
    }
    console.log(`\n----------------------------------------\n`);
  }

  console.log('✓ 7-day Purdue Dining sync complete.');
  await prisma.$disconnect();
}

syncPurdueDiningWeekly();
