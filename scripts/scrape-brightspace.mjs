import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { scrapeBrightspace } from '../lib/brightspace.mjs';

async function credentials() {
  // Never accept passwords as command-line arguments (shell history/process lists).
  if (!process.stdin.isTTY) {
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 16_384) throw new Error('INPUT_TOO_LARGE');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  let muted = false;
  const output = new Writable({ write(chunk, encoding, done) {
    if (!muted) process.stderr.write(chunk, encoding);
    done();
  } });
  const input = createInterface({ input: process.stdin, output, terminal: true });
  try {
    const username = await input.question('Username: ');
    process.stderr.write('Password (hidden): ');
    muted = true;
    const password = await input.question('');
    process.stderr.write('\n');
    return { username, password };
  } finally { muted = false; input.close(); }
}

try {
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
  if (!config.loginUrl || !config.dashboardUrl || !config.casOrigin || !config.readySelector || !config.courseSelector) {
    throw new Error('CONFIGURATION_REQUIRED');
  }
  const courses = await scrapeBrightspace(await credentials(), config);
  // Output only course data; never cookies, authentication headers, or credentials.
  process.stdout.write(`${JSON.stringify({ success: true, courses }, null, 2)}\n`);
} catch (error) {
  const safe = new Set(['CONFIGURATION_REQUIRED', 'INVALID_CONFIG', 'INVALID_CREDENTIALS',
    'AUTHENTICATION_INCOMPLETE', 'SCRAPE_FAILED', 'INPUT_TOO_LARGE']);
  process.stderr.write(`${JSON.stringify({ error: safe.has(error?.message) ? error.message : 'SCRAPE_FAILED' })}\n`);
  process.exitCode = 1;
}
