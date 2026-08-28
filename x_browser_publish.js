import { loginWithCookie, postComposer } from 'xactions';
import { createBrowser, createPage } from './x_browser.js';

const STATUS_ID = /\/status\/(\d+)/;
const TWEET_ARTICLE = 'article[data-testid="tweet"]';
const TWEET_TEXT = '[data-testid="tweetText"]';

function requireBrowserCredentials(credentials = {}) {
  const authToken = String(credentials.authToken || '').trim();
  if (!authToken) throw new Error('Browser publication requires AUTH_TOKEN.');
  return { authToken };
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function targetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//.test(raw)) return raw;
  return /^\d+$/.test(raw) ? `https://x.com/i/status/${raw}` : raw;
}

function sourceTweetUrl(item) {
  for (const value of [item?.sourceUrl, item?.candidate?.url, item?.candidate?.key]) {
    const raw = String(value || '').trim();
    if (STATUS_ID.test(raw)) return raw;
  }
  const explicit = String(item?.sourceTweetId || item?.source_tweet_id || '').trim();
  return explicit ? `https://x.com/i/status/${explicit}` : '';
}

async function openAuthenticatedBrowser(credentials, { headless = true } = {}) {
  const { authToken } = requireBrowserCredentials(credentials);
  const browser = await createBrowser({ headless });
  const page = await createPage(browser);
  try {
    await loginWithCookie(page, authToken);
    return { browser, page };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

async function recentPosts(page, account, { includeReplies = false } = {}) {
  const profileUrl = includeReplies
    ? `https://x.com/${account}/with_replies`
    : `https://x.com/${account}`;
  await page.goto(profileUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector(TWEET_ARTICLE, { timeout: 15_000 }).catch(() => {});
  return page.evaluate(({ accountName, articleSelector, textSelector }) => {
    const accountPrefix = `/${accountName}/status/`;
    return [...document.querySelectorAll(articleSelector)].map((article) => {
      const text = article.querySelector(textSelector)?.innerText || '';
      const href = [...article.querySelectorAll('a[href*="/status/"]')]
        .map((link) => link.getAttribute('href') || '')
        .find((value) => value.startsWith(accountPrefix) && /^\/[^/]+\/status\/\d+$/.test(value)) || '';
      const match = href.match(/\/status\/(\d+)/);
      return match ? { tweetId: match[1], url: `https://x.com${href}`, text } : null;
    }).filter(Boolean);
  }, { accountName: account, articleSelector: TWEET_ARTICLE, textSelector: TWEET_TEXT });
}

async function verifyNewPost(page, account, expectedText, beforeIds, { includeReplies = false } = {}) {
  const expected = normalizeText(expectedText);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await page.waitForTimeout(1_000);
    const rows = await recentPosts(page, account, { includeReplies });
    const match = rows.find((row) => !beforeIds.has(row.tweetId) && normalizeText(row.text) === expected);
    if (match) return match;
  }
  return null;
}

function ambiguousBrowserResult(message, cause = null) {
  const error = new Error(message);
  error.code = 'TRANSPORT_RESULT_NO_TWEET_ID';
  if (cause) error.cause = cause;
  return error;
}

async function postThreadUi(page, parts, mediaAttachment = null) {
  await page.goto('https://x.com/compose/tweet', { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15_000 });

  for (let index = 0; index < parts.length; index++) {
    if (index > 0) {
      await page.click('[data-testid="addButton"]');
      await page.waitForTimeout(500);
    }
    const textarea = `[data-testid="tweetTextarea_${index}"]`;
    await page.click(textarea).catch(() => page.click('[data-testid="tweetTextarea_0"]'));
    await page.keyboard.type(parts[index], { delay: 20 });

    if (index === 0 && mediaAttachment?.localPath) {
      const input = await page.$('[data-testid="fileInput"]');
      if (!input) throw new Error('Thread media input is unavailable in the X composer.');
      await input.uploadFile(mediaAttachment.localPath);
      await page.waitForTimeout(2_000);
      if (mediaAttachment.altText) {
        const alt = await page.$('[data-testid="altTextInput"]');
        if (alt) {
          await page.click('[data-testid="altTextInput"]');
          await page.keyboard.type(mediaAttachment.altText);
        }
      }
    }
  }

  await page.click('[data-testid="tweetButton"]');
  await page.waitForTimeout(3_000);
}

async function quotePostUi(page, postUrl, commentary, mediaAttachment = null) {
  if (!mediaAttachment?.localPath) {
    await postComposer.quotePost(page, postUrl, commentary);
    return;
  }

  await page.goto(postUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="retweet"]', { timeout: 15_000 });
  await page.click('[data-testid="retweet"]');
  await page.waitForTimeout(700);
  await page.click('[data-testid="quoteTweet"]');
  await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15_000 });
  await page.click('[data-testid="tweetTextarea_0"]');
  await page.keyboard.type(commentary, { delay: 30 });

  const input = await page.$('[data-testid="fileInput"]');
  if (!input) throw new Error('Quote media input is unavailable in the X composer.');
  await input.uploadFile(mediaAttachment.localPath);
  await page.waitForTimeout(2_000);
  if (mediaAttachment.altText) {
    const alt = await page.$('[data-testid="altTextInput"]');
    if (alt) {
      await page.click('[data-testid="altTextInput"]');
      await page.keyboard.type(mediaAttachment.altText);
    }
  }

  await page.click('[data-testid="tweetButton"]');
  await page.waitForTimeout(3_000);
}

export async function checkBrowserSession(credentials, {
  account = process.env.X_ACCOUNT || 'ham_zax',
  headless = true,
} = {}) {
  const { browser, page } = await openAuthenticatedBrowser(credentials, { headless });
  try {
    await page.goto(`https://x.com/${account}`, { waitUntil: 'networkidle2' });
    const ownProfile = await page.waitForSelector('a[href="/settings/profile"]', { timeout: 10_000 }).catch(() => null);
    if (!ownProfile) throw new Error(`Browser session is not authenticated as @${account}.`);
    return { authenticated: true, account, transport: 'clearcote_browser_ui' };
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function postTweetBrowser(text, credentials, {
  account = process.env.X_ACCOUNT || 'ham_zax',
  replyTo = null,
  mediaAttachment = null,
  headless = true,
} = {}) {
  const body = String(text || '').trim();
  if (!body) throw new Error('Browser publication requires non-empty text.');
  const { browser, page } = await openAuthenticatedBrowser(credentials, { headless });
  try {
    const includeReplies = Boolean(replyTo);
    const beforeIds = new Set((await recentPosts(page, account, { includeReplies })).map((row) => row.tweetId));
    try {
      await postComposer.postTweet(page, body, {
        replyTo: replyTo ? targetUrl(replyTo) : null,
        media: mediaAttachment?.localPath || null,
        altText: mediaAttachment?.altText || null,
      });
    } catch (error) {
      throw ambiguousBrowserResult(`Browser publication result is ambiguous: ${error.message}`, error);
    }
    const identity = await verifyNewPost(page, account, body, beforeIds, { includeReplies });
    if (!identity) throw ambiguousBrowserResult('Browser publication completed without a verifiable new tweet ID.');
    return { rest_id: identity.tweetId, permanentUrl: identity.url };
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function publishMainFeedBrowser(item, credentials, {
  account = process.env.X_ACCOUNT || 'ham_zax',
  headless = true,
} = {}) {
  const pipeline = String(item?.pipeline || '');
  const attachment = item?.media?.attachment || null;
  if (item?.media?.required === true && !attachment?.localPath) {
    throw new Error('Required media must have an attached image before publishing.');
  }
  const mediaAttachment = attachment?.localPath ? {
    localPath: attachment.localPath,
    altText: item?.media?.altText || '',
  } : null;

  let expectedText = '';
  if (pipeline === 'original' || pipeline === 'quote') expectedText = String(item?.body || item?.text || '').trim();
  if (pipeline === 'thread') expectedText = String(item?.threadParts?.[0] || '').trim();
  if (!expectedText) throw new Error(`${pipeline || 'Main-feed'} publication requires final text.`);

  const { browser, page } = await openAuthenticatedBrowser(credentials, { headless });
  try {
    const beforeIds = new Set((await recentPosts(page, account)).map((row) => row.tweetId));
    try {
      if (pipeline === 'original') {
        await postComposer.postTweet(page, expectedText, {
          media: mediaAttachment?.localPath || null,
          altText: mediaAttachment?.altText || null,
        });
      } else if (pipeline === 'quote') {
        const sourceUrl = sourceTweetUrl(item);
        if (!sourceUrl) throw new Error('Quote publication requires a source tweet URL or ID.');
        await quotePostUi(page, sourceUrl, expectedText, mediaAttachment);
      } else if (pipeline === 'thread') {
        const parts = Array.isArray(item?.threadParts) ? item.threadParts.map((part) => String(part).trim()).filter(Boolean) : [];
        if (!parts.length) throw new Error('Thread publication requires approved thread parts.');
        await postThreadUi(page, parts, mediaAttachment);
      } else {
        throw new Error(`Unsupported main-feed pipeline: ${pipeline || 'missing'}.`);
      }
    } catch (error) {
      throw ambiguousBrowserResult(`Browser ${pipeline} publication result is ambiguous: ${error.message}`, error);
    }

    const identity = await verifyNewPost(page, account, expectedText, beforeIds);
    if (!identity) throw ambiguousBrowserResult(`Browser ${pipeline} publication completed without a verifiable new root tweet ID.`);
    return {
      pipeline,
      tweetId: identity.tweetId,
      url: identity.url,
      result: { transport: 'clearcote_browser_ui', tweetId: identity.tweetId, url: identity.url },
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
