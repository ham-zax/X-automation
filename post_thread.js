import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { checkBrowserSession } from './x_browser_publish.js';

const DEFAULT_THREAD = [
  '1/3 Validate the first thread part.',
  '2/3 Validate the second thread part.',
  '3/3 Dry-run validation only; scripted x.com mutation is disabled.',
];

async function getAuthCredentials() {
  const envAuthToken = process.env.AUTH_TOKEN || process.env.XACTIONS_AUTH_TOKEN || process.env.XACTIONS_SESSION_COOKIE;
  if (envAuthToken) return { authToken: envAuthToken, source: '.env / environment variables' };

  const configPath = path.join(os.homedir(), '.xactions', 'config.json');
  try {
    const parsed = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    if (parsed.authToken) return { authToken: parsed.authToken, source: '~/.xactions/config.json (via xactions login)' };
  } catch {}

  const cookiePath = path.join(os.homedir(), '.xactions', 'cookies.json');
  try {
    const cookies = JSON.parse(await fs.readFile(cookiePath, 'utf-8'));
    const authCookie = cookies.find((cookie) => cookie.name === 'auth_token');
    if (authCookie) return { authToken: authCookie.value, source: '~/.xactions/cookies.json (via xactions connect)' };
  } catch {}

  return null;
}

function validateThread(tweets) {
  if (!Array.isArray(tweets) || tweets.length === 0) throw new Error('Thread must contain at least 1 tweet.');
  for (let index = 0; index < tweets.length; index++) {
    const text = typeof tweets[index] === 'string' ? tweets[index] : tweets[index]?.text;
    if (!text || typeof text !== 'string') throw new Error(`Tweet #${index + 1} has invalid or empty text.`);
    if (text.length > 280) throw new Error(`Tweet #${index + 1} exceeds 280 characters (${text.length} chars).`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const browserCheck = args.includes('--browser-check');
  const headless = !args.includes('--headless=false');
  const account = process.env.X_ACCOUNT || 'ham_zax';

  const credentials = await getAuthCredentials();
  if (!credentials) throw new Error('No AUTH_TOKEN browser session credential found.');
  console.log(`Loaded browser session credential from: ${credentials.source}`);

  if (browserCheck) {
    const result = await checkBrowserSession(credentials, { account, headless });
    console.log(`Browser session authenticated as @${result.account} via ${result.transport}.`);
    return;
  }

  let thread = DEFAULT_THREAD;
  const fileArgIndex = args.indexOf('--file');
  if (fileArgIndex !== -1 && args[fileArgIndex + 1]) {
    thread = JSON.parse(await fs.readFile(path.resolve(process.cwd(), args[fileArgIndex + 1]), 'utf-8'));
  } else {
    const positionalArgs = args.filter((arg) => !arg.startsWith('--'));
    if (positionalArgs.length) thread = positionalArgs;
  }

  validateThread(thread);
  if (isDryRun) {
    console.log(`Dry run: ${thread.length} thread part(s) validated. Nothing was posted.`);
    return;
  }

  throw new Error('This standalone command never publishes. Route the exact thread through Growth OS; after current gates/approval and scheduler eligibility, the background daemon may use its supported API transport or the persistent Growth Operator may atomically claim it with browser-publish-claim and execute it through the browser-agent lane.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
