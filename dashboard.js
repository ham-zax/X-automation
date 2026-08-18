import 'dotenv/config';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import {
  fetchGitHubTrending,
  fetchHackerNews,
  fetchXTechNews,
  generateMomentumPost,
  rankNews,
} from './tech_news.js';

const PORT = Number(process.env.WEB_PORT || 3030);
const NEWS_LIMIT = Number(process.env.NEWS_LIMIT || 8);
const MIN_MOMENTUM_SCORE = Number(process.env.MIN_MOMENTUM_SCORE || 70);
const POST_INTERVAL_HOURS = Number(process.env.POST_INTERVAL_HOURS || 4);
const AUTO_POST = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';
const STATE_FILE = path.resolve('.automation-state.json');
const X_ACCOUNTS = (process.env.X_NEWS_ACCOUNTS || 'github,OpenAI,ycombinator,TechCrunch')
  .split(',')
  .map((account) => account.trim().replace(/^@/, ''))
  .filter(Boolean);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch {
    return { lastPostedAt: 0, postedKeys: [] };
  }
}

async function collectRanked() {
  const [hnStories, ghRepos, xPosts] = await Promise.all([
    fetchHackerNews(NEWS_LIMIT),
    fetchGitHubTrending(NEWS_LIMIT),
    fetchXTechNews(X_ACCOUNTS, 2),
  ]);
  return rankNews({ hnStories, ghRepos, xPosts });
}

function candidateKey(candidate) {
  return candidate?.key || candidate?.url || `${candidate?.source}:${candidate?.title}`;
}

function candidateCard(candidate, index, selected) {
  const post = generateMomentumPost(candidate);
  const isX = candidate.source === 'x';
  const xMetrics = isX
    ? `${Number(candidate.metrics?.views || 0).toLocaleString()} views · ${Number(candidate.metrics?.likes || 0).toLocaleString()} likes · ${Number(candidate.metrics?.retweets || 0).toLocaleString()} reposts · ${Number(candidate.metrics?.replies || 0).toLocaleString()} replies`
    : '';
  return `
    <article class="card ${selected ? 'selected' : ''}">
      <div class="row">
        <strong>#${index + 1} ${escapeHtml(candidate.title)}</strong>
        <span class="score">${candidate.score}/100</span>
      </div>
      <div class="meta">${escapeHtml(candidate.source.toUpperCase())}${selected ? ' · automation pick' : ''}</div>
      ${isX ? `<pre>${escapeHtml(candidate.text)}</pre><div class="meta">${escapeHtml(xMetrics)}</div>` : `<pre>${escapeHtml(post)}</pre>`}
      <div class="row bottom">
        <span>${isX ? 'source post' : `${post.length}/280 chars`}</span>
        <a href="${escapeHtml(candidate.url)}" target="_blank" rel="noreferrer">Open source ↗</a>
      </div>
    </article>`;
}

async function renderPage(activeSource = 'x') {
  const [ranked, state] = await Promise.all([collectRanked(), loadState()]);
  const posted = new Set(state.postedKeys || []);
  const selected = ranked.find((item) => item.source !== 'x' && !posted.has(candidateKey(item))) || null;
  const visible = activeSource === 'all' ? ranked : ranked.filter((item) => item.source === activeSource);
  const nextAllowedAt = Number(state.lastPostedAt || 0) + POST_INTERVAL_HOURS * 3_600_000;
  const cooldownActive = Date.now() < nextAllowedAt;

  let decision = 'No unseen GitHub/Hacker News candidate.';
  if (selected) {
    if (selected.score < MIN_MOMENTUM_SCORE) decision = `Waiting: ${selected.score}/100 is below threshold ${MIN_MOMENTUM_SCORE}.`;
    else if (cooldownActive) decision = `Waiting for cooldown until ${new Date(nextAllowedAt).toLocaleString()}.`;
    else decision = AUTO_POST ? 'Ready for the automation loop to post.' : 'Preview only — AUTO_POST=false.';
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>X Automation Dashboard</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f5; color: #151515; }
    main { max-width: 900px; margin: 0 auto; padding: 32px 18px 60px; }
    header, .card { background: white; border: 1px solid #ddd; border-radius: 12px; }
    header { padding: 20px; margin-bottom: 18px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { margin: 6px 0; color: #555; }
    .toolbar { display: flex; gap: 12px; align-items: center; margin-top: 16px; flex-wrap: wrap; }
    .button { display: inline-block; background: #111; color: white; text-decoration: none; padding: 9px 14px; border-radius: 8px; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 18px; }
    .tab { display: inline-block; padding: 8px 12px; border: 1px solid #ccc; border-radius: 999px; text-decoration: none; background: white; }
    .tab.active { background: #111; color: white; border-color: #111; }
    .card { padding: 18px; margin: 12px 0; }
    .selected { border: 2px solid #111; }
    .row { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; }
    .score { font-weight: 700; white-space: nowrap; }
    .meta { margin-top: 5px; color: #777; font-size: 13px; }
    pre { white-space: pre-wrap; word-break: break-word; font: 15px/1.45 system-ui, sans-serif; background: #f7f7f7; padding: 14px; border-radius: 8px; margin: 14px 0; }
    .bottom { color: #666; font-size: 13px; }
    a { color: #111; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>X automation dashboard</h1>
      <p>${escapeHtml(decision)}</p>
      <p>Threshold ${MIN_MOMENTUM_SCORE}/100 · cooldown ${POST_INTERVAL_HOURS}h · auto-post ${AUTO_POST ? 'ON' : 'OFF'}</p>
      <div class="toolbar">
        <a class="button" href="/">Refresh research</a>
        <span>Updated ${escapeHtml(new Date().toLocaleString())}</span>
      </div>
    </header>
    <nav class="tabs">
      <a class="tab ${activeSource === 'x' ? 'active' : ''}" href="/?source=x">X posts</a>
      <a class="tab ${activeSource === 'github' ? 'active' : ''}" href="/?source=github">GitHub</a>
      <a class="tab ${activeSource === 'hn' ? 'active' : ''}" href="/?source=hn">Hacker News</a>
      <a class="tab ${activeSource === 'all' ? 'active' : ''}" href="/?source=all">All</a>
    </nav>
    ${visible.slice(0, 20).map((item, index) => candidateCard(item, index, item === selected)).join('') || '<p>No candidates found for this source.</p>'}
  </main>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const source = ['x', 'github', 'hn', 'all'].includes(requestUrl.searchParams.get('source'))
      ? requestUrl.searchParams.get('source')
      : 'x';
    const html = await renderPage(source);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Dashboard failed: ${error.message}`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[web] X automation dashboard: http://localhost:${PORT}`);
});
