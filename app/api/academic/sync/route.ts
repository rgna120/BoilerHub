import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { scrapeBrightspace } from "@/lib/brightspace.mjs";

export const runtime = "nodejs";
let busy = false;
const reply = (body: object, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});

export async function POST(req: Request) {
  // Server-to-server example. Keep this token out of browser bundles; a user-facing
  // deployment should authenticate the student's app session and enforce per-user quotas.
  const token = process.env.ACADEMIC_SYNC_TOKEN;
  if (!token || token.length < 32) return reply({ error: "Sync is not configured" }, 503);
  const actual = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${token}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return reply({ error: "Unauthorized" }, 401);
  }
  if (busy) return reply({ error: "Sync is busy" }, 429);
  const config = {
    loginUrl: process.env.BRIGHTSPACE_LOGIN_URL,
    dashboardUrl: process.env.BRIGHTSPACE_DASHBOARD_URL,
    casOrigin: process.env.CAS_ORIGIN,
    readySelector: process.env.BRIGHTSPACE_READY_SELECTOR,
    courseSelector: process.env.BRIGHTSPACE_COURSE_SELECTOR,
    usernameSelector: process.env.CAS_USERNAME_SELECTOR,
    passwordSelector: process.env.CAS_PASSWORD_SELECTOR,
    submitSelector: process.env.CAS_SUBMIT_SELECTOR,
  };
  if (!config.loginUrl || !config.dashboardUrl || !config.casOrigin ||
      !config.readySelector || !config.courseSelector) {
    return reply({ error: "Sync is not configured" }, 503);
  }
  busy = true;
  try {
    // Bound the body while streaming; Content-Length alone is not trustworthy.
    const reader = req.body?.getReader();
    if (!reader) return reply({ error: "Missing request body" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16_384) {
          await reader.cancel();
          return reply({ error: "Request too large" }, 413);
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let credentials;
    try { credentials = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return reply({ error: "Invalid JSON" }, 400); }
    if (!credentials || typeof credentials.username !== "string" ||
        !credentials.username.trim() || credentials.username.length > 320 ||
        typeof credentials.password !== "string" || !credentials.password ||
        credentials.password.length > 4096) {
      return reply({ error: "Username and password are required" }, 400);
    }
    const courses = await scrapeBrightspace(credentials, config);
    return reply({ success: true, courses });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTHENTICATION_INCOMPLETE") {
      return reply({ error: "Login did not complete. Check credentials or complete institutional MFA through a supported login flow." }, 401);
    }
    return reply({ error: "Course sync failed" }, 502);
  } finally {
    busy = false;
  }
}
