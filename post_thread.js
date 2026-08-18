import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createBrowser, createPage, loginWithCookie, postComposer } from 'xactions';
import { checkHttpSession, postThreadHttp } from './x_http.js';

// ============================================================================
// Sample Thread Definition
// (You can customize these tweets or pass a custom array / JSON file)
// ============================================================================
const DEFAULT_THREAD = [
  '1/3 🚀 Automating X/Twitter with XActions & Node.js!',
  '2/3 🤖 No API keys needed. You can automate reads, replies, likes, and full threads directly.',
  '3/3 🧵 Thread posting test completed successfully! Built with @nirholas XActions toolkit.',
];

// ============================================================================
// Helper: Load Saved Credentials from ~/.xactions or process.env
// ============================================================================
async function getAuthCredentials() {
  const envAuthToken = process.env.AUTH_TOKEN || process.env.XACTIONS_AUTH_TOKEN || process.env.XACTIONS_SESSION_COOKIE;
  const envCsrfToken = process.env.CT0 || process.env.CSRF_TOKEN;

  if (envAuthToken) {
    return {
      authToken: envAuthToken,
      csrfToken: envCsrfToken || '',
      source: '.env / environment variables',
    };
  }

  const configPath = path.join(os.homedir(), '.xactions', 'config.json');
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.authToken) {
      return {
        authToken: parsed.authToken,
        csrfToken: parsed.csrfToken || '',
        source: '~/.xactions/config.json (via xactions login)',
      };
    }
  } catch {
    // Config not found or invalid
  }

  const cookiePath = path.join(os.homedir(), '.xactions', 'cookies.json');
  try {
    const raw = await fs.readFile(cookiePath, 'utf-8');
    const cookies = JSON.parse(raw);
    const authCookie = cookies.find((c) => c.name === 'auth_token');
    const csrfCookie = cookies.find((c) => c.name === 'ct0');
    if (authCookie) {
      return {
        authToken: authCookie.value,
        csrfToken: csrfCookie ? csrfCookie.value : '',
        source: '~/.xactions/cookies.json (via xactions connect)',
      };
    }
  } catch {
    // Cookies not found
  }

  return null;
}

// ============================================================================
// Helper: Validate Tweets
// ============================================================================
function validateThread(tweets) {
  if (!Array.isArray(tweets) || tweets.length === 0) {
    throw new Error('Thread must contain at least 1 tweet.');
  }

  for (let i = 0; i < tweets.length; i++) {
    const text = typeof tweets[i] === 'string' ? tweets[i] : tweets[i]?.text;
    if (!text || typeof text !== 'string') {
      throw new Error(`Tweet #${i + 1} has invalid or empty text.`);
    }
    if (text.length > 280) {
      throw new Error(`Tweet #${i + 1} exceeds 280 characters (${text.length} chars):\n"${text}"`);
    }
  }
}

// ============================================================================
// Mode 1: Direct HTTP GraphQL API (Fastest, no browser UI needed)
// ============================================================================
async function postThreadViaHttp(tweets, creds) {
  console.log('📡 Validating HTTP session and discovering live CreateTweet operation...');
  return postThreadHttp(tweets, {
    authToken: creds.authToken,
    csrfToken: creds.csrfToken,
  });
}

// ============================================================================
// Mode 2: Puppeteer Stealth Browser Mode (Simulates real browser user)
// ============================================================================
async function postThreadViaBrowser(tweets, creds, headless = true) {
  console.log(`🌐 Launching Stealth Browser (headless: ${headless})...`);
  const browser = await createBrowser({ headless });
  const page = await createPage(browser);

  try {
    console.log('🔑 Logging into X via session cookie...');
    await loginWithCookie(page, creds.authToken);

    console.log('📝 Composing and publishing thread...');
    const result = await postComposer.postThread(page, tweets);
    return result;
  } finally {
    await browser.close();
  }
}

// ============================================================================
// Main Execution Function
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const useBrowser = args.includes('--browser');
  const httpCheck = args.includes('--http-check');
  const showHeadless = !args.includes('--headless=false');

  console.log('==============================================');
  console.log('🧵 XActions - Thread Publisher Script');
  console.log('==============================================');

  const creds = await getAuthCredentials();
  if (!creds) {
    console.error('\n❌ No authentication credentials found!');
    console.error('\nHow to authenticate (choose one):');
    console.error('  1. Run global CLI login:');
    console.error('     $ xactions login');
    console.error('  2. Or create a .env file in this directory with:');
    console.error('     AUTH_TOKEN=your_auth_token_cookie');
    console.error('     CT0=your_ct0_cookie\n');
    process.exit(1);
  }

  console.log(`✅ Loaded credentials from: ${creds.source}`);

  if (httpCheck) {
    const result = await checkHttpSession({
      authToken: creds.authToken,
      csrfToken: creds.csrfToken,
    });
    console.log(`✅ HTTP session authenticated. Live CreateTweet query ID: ${result.createTweetQueryId}`);
    return;
  }

  // Determine thread content: from --file, positional CLI arguments, or default array
  let thread = DEFAULT_THREAD;
  const fileArgIndex = args.indexOf('--file');

  if (fileArgIndex !== -1 && args[fileArgIndex + 1]) {
    const filePath = path.resolve(process.cwd(), args[fileArgIndex + 1]);
    const fileData = await fs.readFile(filePath, 'utf-8');
    thread = JSON.parse(fileData);
    console.log(`📂 Loaded thread from file: ${args[fileArgIndex + 1]}`);
  } else {
    // Filter out flags starting with --
    const positionalArgs = args.filter((a) => !a.startsWith('--'));
    if (positionalArgs.length > 0) {
      thread = positionalArgs;
      console.log(`💬 Loaded ${positionalArgs.length} tweets from CLI arguments`);
    } else {
      console.log('📝 Using default sample thread (customize in post_thread.js or pass arguments)');
    }
  }

  validateThread(thread);

  console.log(`\n📋 Thread Preview (${thread.length} tweets):`);
  thread.forEach((tweet, i) => {
    const text = typeof tweet === 'string' ? tweet : tweet.text;
    console.log(`  [${i + 1}/${thread.length}] (${text.length}/280 chars):`);
    console.log(`      ${text}`);
  });

  if (isDryRun) {
    console.log('\n🔍 DRY-RUN MODE: Thread validated successfully. Nothing was posted.');
    console.log('💡 Remove --dry-run to post for real.');
    return;
  }

  console.log('\n🚀 Publishing thread...');
  try {
    let result;
    if (useBrowser) {
      console.log('👉 Using Browser Automation Mode');
      result = await postThreadViaBrowser(thread, creds, showHeadless);
    } else {
      console.log('👉 Using Direct HTTP GraphQL Mode');
      result = await postThreadViaHttp(thread, creds);
    }

    console.log('\n🎉 Thread posted successfully!');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\n❌ Error posting thread:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
