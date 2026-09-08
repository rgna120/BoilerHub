import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch raw locations from Purdue API
    const response = await fetch("http://api.hfs.purdue.edu/menus/v2/locations/");
    const data = await response.json();

    // Normalize data format
    const formattedLocations = data.Locations.map((loc: any) => ({
      name: loc.Name,
      status: loc.FormalName,
      type: loc.Type 
    }));

    return NextResponse.json({ locations: formattedLocations });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch dining menus" }, { status: 500 });
  }
}
