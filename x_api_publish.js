import { consumeMainFeedContentGate } from './x_browser_publish.js';

const CREATE_POST_URL = 'https://api.x.com/2/tweets';
const STATUS_ID = /\/status\/(\d+)/;

function mutationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function accessToken(credentials = {}) {
  return String(credentials.accessToken || '').trim();
}

function postUrl(account, tweetId) {
  return `https://x.com/${String(account || 'ham_zax').replace(/^@/, '')}/status/${tweetId}`;
}

function sourceTweetId(item) {
  for (const value of [item?.sourceTweetId, item?.sourceUrl, item?.candidate?.url, item?.candidate?.key]) {
    const raw = String(value || '').trim();
    if (/^\d+$/.test(raw)) return raw;
    const match = raw.match(STATUS_ID);
    if (match) return match[1];
  }
  return '';
}

function hasLocalMedia(item) {
  return Boolean(item?.media?.required === true || item?.media?.attachment?.localPath);
}

export function getXApiPipelineCapability(pipeline, {
  accessToken: suppliedAccessToken = process.env.X_API_ACCESS_TOKEN,
  enterpriseQuote = String(process.env.X_API_ENTERPRISE_QUOTE || 'false').toLowerCase() === 'true',
} = {}) {
  if (!String(suppliedAccessToken || '').trim()) {
    return { supported: false, code: 'missing_access_token', reason: 'X API user access token is not configured.' };
  }
  const selected = String(pipeline || '');
  if (!['original', 'thread', 'quote'].includes(selected)) {
    return { supported: false, code: 'unsupported_pipeline', reason: `X API main-feed transport does not support ${selected || 'missing'} pipeline.` };
  }
  if (selected === 'quote' && !enterpriseQuote) {
    return { supported: false, code: 'quote_requires_enterprise', reason: 'X API quote-posting requires Enterprise access.' };
  }
  return { supported: true, code: 'x_api_v2', reason: 'X API v2 user-context transport supports this pipeline.' };
}

export function getXApiMainFeedCapability(item, options = {}) {
  const pipeline = String(item?.pipeline || '');
  const pipelineCapability = getXApiPipelineCapability(pipeline, options);
  if (!pipelineCapability.supported) return pipelineCapability;
  if (hasLocalMedia(item)) {
    return { supported: false, code: 'media_upload_unavailable', reason: 'Local media upload is not implemented for the X API transport.' };
  }
  if (pipeline === 'quote' && !sourceTweetId(item)) {
    return { supported: false, code: 'missing_quote_source', reason: 'Quote publication requires a source tweet ID.' };
  }
  if (pipeline === 'thread' && !(Array.isArray(item?.threadParts) && item.threadParts.length > 0)) {
    return { supported: false, code: 'missing_thread_parts', reason: 'Thread publication requires approved thread parts.' };
  }
  return { supported: true, code: 'x_api_v2', reason: 'X API v2 user-context transport is available for this item.' };
}

async function createPost(payload, { token, fetchImpl, signal }) {
  let response;
  try {
    response = await fetchImpl(CREATE_POST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    throw mutationError(
      'TRANSPORT_RESULT_UNKNOWN',
      `X API request ended without a definitive response: ${error.message}`,
      { cause: error },
    );
  }

  const raw = await response.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const detail = String(parsed?.detail || parsed?.title || parsed?.errors?.[0]?.detail || parsed?.errors?.[0]?.message || raw || `HTTP ${response.status}`).slice(0, 1000);
    if (response.status === 408 || response.status >= 500) {
      throw mutationError(
        'TRANSPORT_RESULT_UNKNOWN',
        `X API create-post returned an ambiguous HTTP ${response.status} response: ${detail}`,
        { status: response.status },
      );
    }
    throw mutationError('X_API_HTTP_ERROR', `X API create-post failed (${response.status}): ${detail}`, { status: response.status });
  }

  const tweetId = String(parsed?.data?.id || '').trim();
  if (!tweetId) {
    throw mutationError('TRANSPORT_RESULT_NO_TWEET_ID', 'X API create-post returned success without a tweet ID.');
  }
  return { tweetId, text: String(parsed?.data?.text || payload.text || '') };
}

export async function publishMainFeedApi(item, credentials = {}, {
  account = process.env.X_ACCOUNT || 'ham_zax',
  contentGate = null,
  fetchImpl = globalThis.fetch,
  timeoutMs = 30_000,
} = {}) {
  const token = accessToken(credentials);
  if (!token) throw mutationError('X_API_AUTH_MISSING', 'X API publication requires a user access token.');
  if (typeof fetchImpl !== 'function') throw mutationError('X_API_FETCH_UNAVAILABLE', 'X API publication requires fetch support.');

  const capability = getXApiMainFeedCapability(item, { accessToken: token });
  if (!capability.supported) throw mutationError(`X_API_${capability.code.toUpperCase()}`, capability.reason);
  consumeMainFeedContentGate(contentGate, item);

  const pipeline = String(item.pipeline);
  const signal = AbortSignal.timeout(Math.max(1_000, Number(timeoutMs || 30_000)));
  if (pipeline === 'original') {
    const created = await createPost({ text: String(item.body || item.text || '').trim() }, { token, fetchImpl, signal });
    return {
      pipeline,
      tweetId: created.tweetId,
      url: postUrl(account, created.tweetId),
      result: { transport: 'x_api_v2', tweetId: created.tweetId },
    };
  }

  if (pipeline === 'quote') {
    const created = await createPost({
      text: String(item.body || item.text || '').trim(),
      quote_tweet_id: sourceTweetId(item),
    }, { token, fetchImpl, signal });
    return {
      pipeline,
      tweetId: created.tweetId,
      url: postUrl(account, created.tweetId),
      quotedTweetId: sourceTweetId(item),
      result: { transport: 'x_api_v2', tweetId: created.tweetId, quotedTweetId: sourceTweetId(item) },
    };
  }

  const parts = item.threadParts.map((part) => String(part || '').trim()).filter(Boolean);
  const ids = [];
  let previousTweetId = null;
  for (let index = 0; index < parts.length; index += 1) {
    const payload = previousTweetId
      ? { text: parts[index], reply: { in_reply_to_tweet_id: previousTweetId } }
      : { text: parts[index] };
    try {
      const created = await createPost(payload, { token, fetchImpl, signal });
      ids.push(created.tweetId);
      previousTweetId = created.tweetId;
    } catch (error) {
      if (!ids.length) throw error;
      throw mutationError(
        'TRANSPORT_PARTIAL_PUBLICATION',
        `X API thread publication stopped after ${ids.length}/${parts.length} part(s): ${error.message}`,
        {
          tweetId: ids[0],
          url: postUrl(account, ids[0]),
          threadTweetIds: ids,
          causeCode: error.code || null,
        },
      );
    }
  }

  return {
    pipeline,
    tweetId: ids[0],
    url: postUrl(account, ids[0]),
    threadTweetIds: ids,
    result: { transport: 'x_api_v2', tweetId: ids[0], threadTweetIds: ids },
  };
}
