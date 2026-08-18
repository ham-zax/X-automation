import { TwitterHttpClient, GRAPHQL, postThread, postTweet } from 'xactions/scrapers/twitter/http';

const HOME_URL = 'https://x.com/home';
const AUTH_PROBE_URL = 'https://x.com/i/api/1.1/users/recommendations.json?limit=1';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133 Safari/537.36';

function cookieHeader(authToken, csrfToken) {
  if (!authToken || !csrfToken) {
    throw new Error('HTTP mode requires both AUTH_TOKEN and CT0.');
  }
  return `auth_token=${authToken}; ct0=${csrfToken}`;
}

async function discoverOperationQueryId(operationName) {
  const home = await fetch(HOME_URL, { headers: { 'user-agent': USER_AGENT } });
  if (!home.ok) throw new Error(`Unable to load X web client (HTTP ${home.status}).`);

  const html = await home.text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((match) => new URL(match[1], HOME_URL).href);
  const mainScript = scripts.find((src) => /\/main\.[^/]+\.js(?:\?|$)/.test(src));
  if (!mainScript) throw new Error('Unable to locate X main web bundle.');

  const bundle = await fetch(mainScript, { headers: { 'user-agent': USER_AGENT } });
  if (!bundle.ok) throw new Error(`Unable to load X main web bundle (HTTP ${bundle.status}).`);

  const source = await bundle.text();
  const escapedName = operationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`queryId:"([^"]+)",operationName:"${escapedName}"`));
  if (!match) throw new Error(`Unable to discover live GraphQL operation: ${operationName}.`);
  return match[1];
}

export async function createHttpClient({ authToken, csrfToken }) {
  const client = new TwitterHttpClient({
    cookies: cookieHeader(authToken, csrfToken),
    maxRetries: 1,
  });

  // This endpoint is read-only and currently requires a logged-in session.
  await client.request(AUTH_PROBE_URL, { method: 'GET' });

  const createTweetQueryId = await discoverOperationQueryId('CreateTweet');
  GRAPHQL.CreateTweet.queryId = createTweetQueryId;

  return { client, createTweetQueryId };
}

export async function checkHttpSession(credentials) {
  const { createTweetQueryId } = await createHttpClient(credentials);
  return { authenticated: true, createTweetQueryId };
}

export async function postTweetHttp(text, credentials, options = {}) {
  const { client } = await createHttpClient(credentials);
  return postTweet(client, text, options);
}

export async function postThreadHttp(tweets, credentials, options = {}) {
  const { client } = await createHttpClient(credentials);
  const normalized = tweets.map((tweet) => (typeof tweet === 'string' ? { text: tweet } : tweet));
  return postThread(client, normalized, options);
}
