import { NextResponse } from 'next/server';
import { initializeAndIndexData } from '../../../lib/typesense';

const campusData = [
  {
    id: 'dining-earhart',
    title: 'Earhart Dining Court',
    category: 'dining',
    description: 'Purdue dining court with daily breakfast, lunch, and dinner options.',
    location: 'Earhart Hall, 639 Russell Street',
  },
  {
    id: 'dining-meredith-south',
    title: 'Sushi Boss at Meredith South',
    category: 'dining',
    description: 'Sushi and Japanese-inspired meals inside Meredith South dining.',
    location: 'Meredith South Hall, 701 N Martin Jischke Drive',
  },
  {
    id: 'building-purdue-union',
    title: 'Purdue Memorial Union',
    category: 'building',
    description: 'Student center with food, study areas, meeting rooms, and campus services.',
    location: '101 N Grant Street',
  },
  {
    id: 'building-krannert',
    title: 'Krannert Building',
    category: 'building',
    description: 'Classrooms and academic offices for management and economics courses.',
    location: '403 W State Street',
  },
  {
    id: 'course-cs-18000',
    title: 'CS 18000',
    category: 'course',
    description: 'Problem Solving and Object-Oriented Programming.',
    location: 'Purdue University',
  },
  {
    id: 'course-ma-16500',
    title: 'MA 16500',
    category: 'course',
    description: 'Analytic Geometry and Calculus I.',
    location: 'Purdue University',
  },
  {
    id: 'course-stat-11300',
    title: 'STAT 11300',
    category: 'course',
    description: 'Statistics and Society.',
    location: 'Purdue University',
  },
];

export async function POST(request: Request) {
  const seedSecret = process.env.SEED_SECRET;
  const providedSecret = request.headers.get('x-seed-secret');

  if (!seedSecret || providedSecret !== seedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await initializeAndIndexData(campusData);
    return NextResponse.json({ indexed: campusData.length, result });
  } catch (error) {
    console.error('Typesense seed error:', error);
    return NextResponse.json({ error: 'Seeding failed' }, { status: 500 });
  }
}