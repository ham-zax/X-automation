import { DEFAULT_FEATURES, TwitterHttpClient, GRAPHQL, postTweet, uploadImage } from 'xactions/scrapers/twitter/http';

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

function graphQlErrorMessage(value) {
  const errors = Array.isArray(value?.errors) ? value.errors : [];
  const details = errors
    .map((error) => String(error?.message || error?.code || '').trim())
    .filter(Boolean);
  return details.length ? details.join('; ') : '';
}

async function postQuoteTweetHttp(client, text, { quoteTweetId, mediaIds = [] } = {}) {
  const { queryId, operationName } = GRAPHQL.CreateTweet;
  const variables = {
    tweet_text: text,
    dark_request: false,
    attachment_url: `https://x.com/i/status/${quoteTweetId}`,
    media: {
      media_entities: mediaIds.map((id) => ({ media_id: id, tagged_users: [] })),
      possibly_sensitive: false,
    },
    semantic_annotation_ids: [],
  };
  const json = await client.graphql(queryId, operationName, variables, {
    mutation: true,
    features: DEFAULT_FEATURES,
  });
  const result = json?.data?.create_tweet?.tweet_results?.result
    ?? json?.data?.create_tweet?.tweet_result?.result
    ?? json?.data?.create_tweet
    ?? json;
  const errorMessage = graphQlErrorMessage(json) || graphQlErrorMessage(result);
  if (errorMessage && !String(result?.rest_id || result?.legacy?.id_str || result?.tweet?.rest_id || '')) {
    const error = new Error(`X CreateTweet rejected the Quote: ${errorMessage}`);
    error.code = 'X_CREATE_TWEET_REJECTED';
    error.transportResult = result;
    throw error;
  }
  return result;
}

export async function postTweetHttp(text, credentials, options = {}) {
  const { client } = await createHttpClient(credentials);
  const { mediaAttachment = null, ...tweetOptions } = options;
  if (mediaAttachment?.localPath) {
    const uploaded = await uploadImage(client, mediaAttachment.localPath, {
      mediaType: mediaAttachment.mimeType || undefined,
      altText: mediaAttachment.altText || undefined,
    });
    tweetOptions.mediaIds = [uploaded.mediaId];
  }
  if (tweetOptions.quoteTweetId) {
    return postQuoteTweetHttp(client, text, {
      quoteTweetId: tweetOptions.quoteTweetId,
      mediaIds: tweetOptions.mediaIds || [],
    });
  }
  return postTweet(client, text, tweetOptions);
}

export async function postThreadHttp(tweets, credentials, options = {}) {
  const { client } = await createHttpClient(credentials);
  const { mediaAttachment = null, ...threadOptions } = options;
  const normalized = tweets.map((tweet) => (typeof tweet === 'string' ? { text: tweet } : tweet));
  if (mediaAttachment?.localPath && normalized.length) {
    const uploaded = await uploadImage(client, mediaAttachment.localPath, {
      mediaType: mediaAttachment.mimeType || undefined,
      altText: mediaAttachment.altText || undefined,
    });
    normalized[0] = { ...normalized[0], mediaIds: [uploaded.mediaId] };
  }

  const results = [];
  let previousTweetId = null;
  for (let index = 0; index < normalized.length; index++) {
    const tweet = normalized[index];
    let result;
    try {
      result = await postTweet(client, tweet.text, {
        ...threadOptions,
        mediaIds: tweet.mediaIds || [],
        ...(previousTweetId ? { replyTo: previousTweetId } : {}),
      });
    } catch (error) {
      if (!results.length) throw error;
      const partial = new Error(`Thread publication stopped after ${results.length} part(s): ${error.message}`);
      partial.code = 'TRANSPORT_PARTIAL_THREAD';
      partial.rootTweetId = outputIdentity(results[0], '').tweetId;
      partial.transportResult = results;
      throw partial;
    }

    const tweetId = outputIdentity(result, '').tweetId;
    if (!tweetId) {
      const errorMessage = graphQlErrorMessage(result);
      const error = new Error(errorMessage
        ? `X CreateTweet rejected Thread part ${index + 1}: ${errorMessage}`
        : `Thread part ${index + 1} returned no tweet ID.`);
      error.code = results.length
        ? 'TRANSPORT_PARTIAL_THREAD'
        : errorMessage ? 'X_CREATE_TWEET_REJECTED' : 'TRANSPORT_RESULT_NO_TWEET_ID';
      error.rootTweetId = results.length ? outputIdentity(results[0], '').tweetId : null;
      error.transportResult = [...results, result];
      throw error;
    }

    results.push(result);
    previousTweetId = tweetId;
    if (index < normalized.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
    }
  }
  return results;
}

function sourceTweetId(item) {
  const explicit = String(item?.sourceTweetId || item?.source_tweet_id || '').trim();
  if (explicit) return explicit;
  for (const value of [item?.candidate?.url, item?.candidate?.key, item?.sourceUrl]) {
    const match = String(value || '').match(/\/status\/(\d+)/);
    if (match) return match[1];
  }
  return '';
}

function outputIdentity(result, account) {
  const root = Array.isArray(result) ? result[0] : result;
  const tweetId = String(root?.rest_id || root?.id || root?.legacy?.id_str || root?.tweet?.rest_id || '');
  const url = root?.permanentUrl || root?.url || (tweetId ? `https://x.com/${account}/status/${tweetId}` : '');
  return { tweetId, url };
}

function transportResultSummary(result) {
  try {
    const json = JSON.stringify(result);
    return json.length > 1800 ? `${json.slice(0, 1800)}…` : json;
  } catch {
    return String(result || '');
  }
}

export async function publishMainFeedHttp(item, credentials, {
  account = process.env.X_ACCOUNT || 'ham_zax',
  tweetTransport = postTweetHttp,
  threadTransport = postThreadHttp,
} = {}) {
  const pipeline = String(item?.pipeline || '');
  const attachment = item?.media?.attachment || null;
  if (item?.media?.required === true && !attachment?.localPath) {
    throw new Error('Required media must have an attached image before publishing.');
  }
  const mediaAttachment = attachment?.localPath ? {
    localPath: attachment.localPath,
    mimeType: attachment.mimeType || '',
    altText: item?.media?.altText || '',
  } : null;

  let result;
  if (pipeline === 'original') {
    const body = String(item?.body || item?.text || '').trim();
    if (!body) throw new Error('Original publication requires final body text.');
    result = await tweetTransport(body, credentials, { mediaAttachment });
  } else if (pipeline === 'quote') {
    const body = String(item?.body || item?.text || '').trim();
    const quoteTweetId = sourceTweetId(item);
    if (!body) throw new Error('Quote publication requires final body text.');
    if (!quoteTweetId) throw new Error('Quote publication requires a source tweet ID.');
    result = await tweetTransport(body, credentials, { quoteTweetId, mediaAttachment });
  } else if (pipeline === 'thread') {
    const parts = Array.isArray(item?.threadParts) ? item.threadParts.map((part) => String(part).trim()).filter(Boolean) : [];
    if (!parts.length) throw new Error('Thread publication requires approved thread parts.');
    result = await threadTransport(parts, credentials, { mediaAttachment });
  } else if (pipeline === 'repost') {
    throw new Error('Automated repost transport is not enabled; repost remains a manual main-feed action.');
  } else {
    throw new Error(`Unsupported main-feed pipeline: ${pipeline || 'missing'}.`);
  }

  const { tweetId, url } = outputIdentity(result, account);
  if (!tweetId) {
    const summary = transportResultSummary(result);
    const error = new Error(`${pipeline} transport returned no root tweet ID.${summary ? ` Result: ${summary}` : ''}`);
    error.code = 'TRANSPORT_RESULT_NO_TWEET_ID';
    error.transportResult = result;
    throw error;
  }
  return { pipeline, tweetId, url, result };
}
