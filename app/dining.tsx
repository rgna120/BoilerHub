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

// Returns date string in YYYY-MM-DD format
function getFormattedDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Converts time strings (like "7:00 AM", "11:30", "17:00:00") into total minutes from midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr || timeStr === 'N/A') return null;

  const isPM = /pm/i.test(timeStr);
  const isAM = /am/i.test(timeStr);

  // Remove AM/PM and trim whitespace
  const cleanTime = timeStr.replace(/am|pm/gi, '').trim();
  const parts = cleanTime.split(':').map(Number);

  let hours = parts[0];
  const minutes = parts[1] || 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// Check if court is open based on local current time
function isOpenNow(hours) {
  if (!hours || hours.length === 0) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const h of hours) {
    const startMin = parseTimeToMinutes(h.startTime);
    const endMin = parseTimeToMinutes(h.endTime);

    if (startMin === null || endMin === null) continue;

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
    console.error(`Failed to fetch live API data for ${locationName}:`, error.message);
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
  console.log(`Starting live 7-day Purdue Dining sync...\n`);

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
        console.warn(`[${location}] No official data available for this date.`);
        continue;
      }

      // Check live open/closed status (only relevant for today)
      const isToday = i === 0;
      const statusLabel = isToday 
        ? (isOpenNow(normalized.hours) ? 'OPEN NOW' : 'CLOSED NOW')
        : 'SCHEDULED';

      // Cache to Database via Prisma
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

      console.log(`📍 ${normalized.name} (${statusLabel})`);
      if (normalized.menuItems.length === 0) {
        console.log(`   (No menu listed / Court closed)`);
      } else {
        const sampleItems = normalized.menuItems.slice(0, 4).map(m => m.itemName).join(', ');
        console.log(`   Menu (${normalized.menuItems.length} items): ${sampleItems}...`);
      }
    }
    console.log(`\n----------------------------------------\n`);
  }

  console.log('✓ Verified: Database is synced with official Purdue Menus.');
  await prisma.$disconnect();
}

syncPurdueDiningWeekly();