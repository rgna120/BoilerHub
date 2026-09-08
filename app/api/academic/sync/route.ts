import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function POST(req: Request) {
  let browser;
  try {
    const { username, password } = await req.json();
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Navigate to Brightspace CAS
    await page.goto("https://purdue.brightspace.com/d2l/login", { waitUntil: "networkidle2" });
    
    return NextResponse.json({
      success: false,
      message: "Brightspace was reached, but Purdue CAS selectors still need to be configured before credentials can be submitted.",
    }, { status: 501 });
  } catch (error) {
    return NextResponse.json({ error: "Scraping failed" }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
