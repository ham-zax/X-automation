import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const originalCwd = process.cwd();
const previousDirectory = process.env.VIRAL_STYLE_DIR;
const scratch = await mkdtemp(path.join(tmpdir(), 'viral-script-checks-'));
const directory = path.join(scratch, 'dataset');
process.chdir(scratch);
process.env.VIRAL_STYLE_DIR = directory;
const { viralStyleResearch: research } = await import('../viral_style_research.js');
const analysis = await import('../viral_style_analyze.js');
const sweep = await import('../viral_style_sweep.js');
const examples = await import('../writing_examples.js');
const drafting = await import('../drafting.js');
const now = Date.now();
after(async () => {
  process.chdir(originalCwd);
  if (previousDirectory === undefined) delete process.env.VIRAL_STYLE_DIR;
  else process.env.VIRAL_STYLE_DIR = previousDirectory;
  await rm(scratch, { recursive: true, force: true });
});
const observation = (id = '919191') => ({ transport: 'wh-browser', observedAt: now, sourceUrl: `https://x.com/builder/status/${id}`,
  tweet: { id, username: 'builder', text: 'Agent retries need a transaction boundary. Test rejected edits before retrying the developer API.',
    timestamp: now - 48 * 3_600_000, views: 10000, likes: 100, retweets: 10, replies: 5 },
  profile: { followersCount: 1000 }, sampleKind: 'viral_seed' });
const readRows = async file => (await readFile(path.join(directory, file), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

test('unobserved metrics stay unknown, including aggregate engagement', () => {
  const missing = research.snapshotRecord({ id: '1', timestamp: now - 1000 }, {}, now);
  for (const key of ['views', 'likes', 'reposts', 'replies', 'bookmarks', 'authorFollowers', 'authorBlueVerified', 'engagementsPerView']) assert.equal(missing[key], null, key);
  const partial = research.snapshotRecord({ id: '1', timestamp: now - 1000, views: 100, likes: 5 }, {}, now);
  assert.equal(partial.engagementsPerView, null);
  const zero = research.snapshotRecord({ id: '1', timestamp: now - 1000, views: 100, likes: 0, retweets: 0, replies: 0 }, {}, now);
  assert.equal(zero.engagementsPerView, 0);
});

test('explicit browser observations round-trip into mature analysis without live reads', async () => {
  const result = await research.ingestObservations([observation()]);
  assert.equal(result.observed, 1);
  const posts = await readRows('posts.jsonl');
  assert.equal(posts[0].url, observation().sourceUrl);
  assert.match(posts[0].sourceQuery, /^browser_observed:wh-browser:/);
  const report = await analysis.analyzeStoredDataset({ days: 21, analysisNow: now });
  assert.equal(report.dataset.eligiblePosts, 1);
  assert.equal(report.freshness.state, 'available');
  assert.equal(report.supportedGroups.length, 0, 'A single selected post cannot establish a repeated pattern.');
  assert.equal(examples.getCurrentPatternFreshness({ dataDirectory: directory, now }).windowPostCount, 1);
});

test('invalid observation batches fail before partial writes and concurrent collections fail clearly', async () => {
  const before = await readFile(path.join(directory, 'snapshots.jsonl'), 'utf8');
  await assert.rejects(research.ingestObservations([observation('929292'), { ...observation('939393'), sourceUrl: 'https://evil.invalid/builder/status/939393' }]), /exact matching/);
  await assert.rejects(research.ingestObservations([{ ...observation(), tweet: { ...observation().tweet, timestamp: undefined } }]), /exact matching/);
  assert.equal(await readFile(path.join(directory, 'snapshots.jsonl'), 'utf8'), before);
  const lock = path.join(directory, '.collection.lock');
  await writeFile(lock, 'existing worker', { flag: 'wx' });
  try { await assert.rejects(research.ingestObservations([observation()]), /Another viral collection is active/); }
  finally { await rm(lock); }
  assert.equal(await readFile(path.join(directory, 'snapshots.jsonl'), 'utf8'), before);
});

test('stale datasets produce no current patterns and future observations retain the last valid snapshot', async () => {
  const posts = await readRows('posts.jsonl');
  const snapshots = await readRows('snapshots.jsonl');
  const options = { days: 21, matureHours: 24, confidence: 0.9, analysisNow: now };
  const future = { ...snapshots[0], observedAt: now + 86_400_000, views: 999999 };
  const report = analysis.viralStyleRetrospective.analyzeWindow(posts, [...snapshots, future], [], options);
  assert.equal(report.dataset.eligiblePosts, 1);
  assert.equal(report.topPosts[0].views, 10000);
  const stale = await analysis.analyzeStoredDataset({ days: 21, analysisNow: now + 60 * 86_400_000 });
  assert.equal(stale.freshness.state, 'stale');
  assert.equal(stale.dataset.eligiblePosts, 0);
  assert.equal(examples.getCurrentPatternFreshness({ dataDirectory: directory, now: now + 60 * 86_400_000 }).state, 'stale');
  assert.throws(() => analysis.viralStyleRetrospective.analyzeWindow(posts, snapshots, [], { ...options, days: 0 }), /Analysis requires/);
});

test('zero work performs no live reads; invalid read budgets and sweep windows are rejected', async () => {
  assert.equal((await research.collect({ limit: 0, controls: 0 })).seeds, 0);
  assert.equal((await research.snapshotTracked({ limit: 0 })).observed, 0);
  await assert.rejects(research.collect({ limit: -1 }), /integer/);
  await assert.rejects(research.inspectTweet('https://x.com/builder/status/919191', { controls: 100 }), /integer/);
  await assert.rejects(research.snapshotTracked({ days: 0 }), /positive/);
  assert.throws(() => sweep.buildViralSweepJobs({ windowDays: 0 }), /windowDays/);
  assert.throws(() => sweep.buildViralSweepJobs({ days: Infinity }), /days/);
  assert.throws(() => sweep.buildViralSweepJobs({ niches: ['not-a-configured-niche'] }), /configured niche/);
  await assert.rejects(sweep.runViralSweep({ limitPerQuery: 0 }), /Sweep limits/);
  assert.ok(sweep.buildViralSweepJobs().length > 0);
});

test('historical examples match route and topic, remain bounded, and respect No influence', async () => {
  const corpus = path.join(scratch, 'corpus');
  await mkdir(corpus);
  const rows = Array.from({ length: 5 }, (_, index) => ({ id: String(700 + index), authorHandle: `author${index}`,
    url: `https://x.com/author${index}/status/${700 + index}`, postType: 'original', text: `Agent API retries require bounded transactions. Example ${index}.` }));
  rows.push({ ...rows[0], id: '800', postType: 'quote' });
  await writeFile(path.join(corpus, 'authored_posts.jsonl'), rows.map(row => JSON.stringify(row)).join('\n'));
  const candidate = { text: 'Agent API retries need bounded transactions.', url: rows[0].url };
  const matched = examples.getHistoricalWritingExamples({ candidate, pipeline: 'original', directory: corpus });
  assert.equal(matched.examples.length, 3);
  assert.ok(matched.examples.every(row => row.id !== '700' && row.format === 'original'));
  assert.equal(matched.observationalShapeOnly, true);
  const packet = drafting.buildWriterPacket({ candidate, queueItem: { pipeline: 'original' }, draft: { body: 'Draft', editor: {} } });
  assert.equal(packet.patternContext.historical.status, 'disabled');
  assert.equal(packet.patternContext.historical.examples.length, 0);
});

test('analysis CLI rejects invalid windows without silently substituting defaults', () => {
  assert.throws(() => execFileSync(process.execPath, [path.join(originalCwd, 'viral_style_analyze.js'), '--days', 'invalid'],
    { cwd: scratch, env: process.env, stdio: 'pipe' }), error => error.status === 1 && /Expected a number/.test(String(error.stderr)));
});
