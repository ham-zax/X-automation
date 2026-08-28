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
      if (!match) return null;
      const quoteCard = [...article.querySelectorAll('[role="link"]')]
        .find((element) => element.tagName !== 'A' && element.querySelector('[data-testid="Tweet-User-Avatar"]'));
      const quoteText = quoteCard?.querySelector(textSelector)?.innerText || '';
      const quoteHandle = (quoteCard?.innerText || '').match(/(?:^|\n)@([A-Za-z0-9_]{1,15})(?:\n|$)/)?.[1] || '';
      return {
        tweetId: match[1],
        url: `https://x.com${href}`,
        text,
        quote: quoteCard ? { authorHandle: quoteHandle, text: quoteText } : null,
      };
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

async function verifyThreadStructure(page, account, rootIdentity, parts) {
  const expected = parts.map(normalizeText);
  await page.goto(rootIdentity.url, { waitUntil: 'networkidle2' });
  await page.waitForSelector(TWEET_ARTICLE, { timeout: 15_000 }).catch(() => {});

  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt) await page.waitForTimeout(1_000);
    const rows = await page.evaluate(({ accountName, articleSelector, textSelector }) => {
      const accountPrefix = `/${accountName}/status/`;
      return [...document.querySelectorAll(articleSelector)].map((article, articleIndex) => {
        const href = [...article.querySelectorAll('a[href*="/status/"]')]
          .map((link) => link.getAttribute('href') || '')
          .find((value) => value.startsWith(accountPrefix) && /^\/[^/]+\/status\/\d+$/.test(value)) || '';
        const match = href.match(/\/status\/(\d+)/);
        return match ? {
          articleIndex,
          tweetId: match[1],
          url: `https://x.com${href}`,
          text: article.querySelector(textSelector)?.innerText || '',
        } : null;
      }).filter(Boolean);
    }, { accountName: account, articleSelector: TWEET_ARTICLE, textSelector: TWEET_TEXT });

    const thread = rows.slice(0, expected.length);
    const complete = thread.length === expected.length
      && thread[0]?.tweetId === rootIdentity.tweetId
      && thread.every((row, index) => row.articleIndex === index && normalizeText(row.text) === expected[index])
      && new Set(thread.map((row) => row.tweetId)).size === expected.length;
    if (complete) return thread;
  }
  return null;
}

async function verifyQuoteSource(page, rootIdentity, item, sourceUrl) {
  const sourceId = String(sourceUrl || '').match(STATUS_ID)?.[1] || '';
  const sourceHandle = String(sourceUrl || '').match(/x\.com\/([^/]+)\/status\/\d+/i)?.[1]
    || String(item?.candidate?.title || '').match(/^@([A-Za-z0-9_]{1,15})$/)?.[1]
    || '';
  const sourceText = normalizeText(item?.candidate?.text || '');
  const renderedSourceMatches = Boolean(sourceId
    && sourceHandle
    && sourceText
    && rootIdentity?.quote?.authorHandle?.toLowerCase() === sourceHandle.toLowerCase()
    && normalizeText(rootIdentity.quote.text) === sourceText);
  if (!renderedSourceMatches) return false;

  const clicked = await page.evaluate(({ rootTweetId }) => {
    const article = [...document.querySelectorAll('article[data-testid="tweet"]')].find((item) =>
      [...item.querySelectorAll('a[href*="/status/"]')].some((link) =>
        (link.getAttribute('href') || '').includes(`/status/${rootTweetId}`)));
    if (!article) return false;
    const quoteCard = [...article.querySelectorAll('[role="link"]')]
      .find((element) => element.tagName !== 'A' && element.querySelector('[data-testid="Tweet-User-Avatar"]'));
    if (!quoteCard) return false;
    quoteCard.click();
    return true;
  }, { rootTweetId: rootIdentity.tweetId });
  if (!clicked) return false;
  await page.waitForTimeout(700);
  return page.url().match(STATUS_ID)?.[1] === sourceId;
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
  await page.goto(postUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="retweet"]', { timeout: 15_000 });
  await page.click('[data-testid="retweet"]');
  await page.waitForTimeout(700);
  const quoteMenuItem = page.getByRole('menuitem', { name: 'Quote', exact: true });
  await quoteMenuItem.waitFor({ state: 'visible', timeout: 15_000 });
  await quoteMenuItem.click();
  await page.waitForURL((url) => url.pathname === '/compose/post', { timeout: 15_000 });
  const quoteDialog = page.getByRole('dialog').last();
  const quoteText = quoteDialog.getByRole('textbox', { name: 'Post text' });
  await quoteText.waitFor({ state: 'visible', timeout: 15_000 });
  await quoteText.click();
  await page.keyboard.type(commentary, { delay: 30 });

  if (mediaAttachment?.localPath) {
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
  }

  await quoteText.press('Control+Enter');
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
  const quoteSourceUrl = pipeline === 'quote' ? sourceTweetUrl(item) : '';
  const threadParts = pipeline === 'thread'
    ? (Array.isArray(item?.threadParts) ? item.threadParts.map((part) => String(part).trim()).filter(Boolean) : [])
    : [];

  if (!['original', 'quote', 'thread'].includes(pipeline)) {
    throw new Error(`Unsupported main-feed pipeline: ${pipeline || 'missing'}.`);
  }
  if (pipeline === 'quote' && !quoteSourceUrl) throw new Error('Quote publication requires a source tweet URL or ID.');
  if (pipeline === 'thread' && !threadParts.length) throw new Error('Thread publication requires approved thread parts.');

  const expectedText = pipeline === 'thread'
    ? threadParts[0]
    : String(item?.body || item?.text || '').trim();
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
        await quotePostUi(page, quoteSourceUrl, expectedText, mediaAttachment);
      } else {
        await postThreadUi(page, threadParts, mediaAttachment);
      }
    } catch (error) {
      throw ambiguousBrowserResult(`Browser ${pipeline} publication result is ambiguous: ${error.message}`, error);
    }

    try {
      const identity = await verifyNewPost(page, account, expectedText, beforeIds);
      if (!identity) throw ambiguousBrowserResult(`Browser ${pipeline} publication completed without a verifiable new root tweet ID.`);

      let structure = {};
      if (pipeline === 'quote') {
        const quoteVerified = await verifyQuoteSource(page, identity, item, quoteSourceUrl);
        if (!quoteVerified) {
          throw ambiguousBrowserResult('Browser quote publication root exists, but the rendered quoted source could not be verified.');
        }
        structure = { quotedTweetId: quoteSourceUrl.match(STATUS_ID)?.[1] || null };
      } else if (pipeline === 'thread') {
        const thread = await verifyThreadStructure(page, account, identity, threadParts);
        if (!thread) {
          throw ambiguousBrowserResult('Browser thread publication root exists, but the complete approved thread structure could not be verified.');
        }
        structure = { threadTweetIds: thread.map((row) => row.tweetId) };
      }

      return {
        pipeline,
        tweetId: identity.tweetId,
        url: identity.url,
        ...structure,
        result: { transport: 'clearcote_browser_ui', tweetId: identity.tweetId, url: identity.url, ...structure },
      };
    } catch (error) {
      if (error?.code === 'TRANSPORT_RESULT_NO_TWEET_ID') throw error;
      throw ambiguousBrowserResult(`Browser ${pipeline} publication verification failed after submission: ${error.message}`, error);
    }
  } finally {
    await browser.close().catch(() => {});
  }
}
