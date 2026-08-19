import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

export const DB_FILE = path.resolve('.x-research.sqlite');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
db.exec(`
  CREATE TABLE IF NOT EXISTS candidates (
    key TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT,
    text TEXT,
    url TEXT,
    score REAL NOT NULL DEFAULT 0,
    niche_score REAL NOT NULL DEFAULT 0,
    niche_tags TEXT NOT NULL DEFAULT '[]',
    matched_keywords TEXT NOT NULL DEFAULT '[]',
    metrics_json TEXT NOT NULL DEFAULT '{}',
    published_at INTEGER,
    viral_score REAL,
    viral_tier TEXT,
    views_per_hour REAL,
    engagements_per_hour REAL,
    saved INTEGER NOT NULL DEFAULT 0,
    discovered_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_key TEXT NOT NULL UNIQUE,
    hook TEXT NOT NULL DEFAULT '',
    insight TEXT NOT NULL DEFAULT '',
    evidence TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    quality_score INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    scheduled_at INTEGER,
    published_tweet_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(candidate_key) REFERENCES candidates(key)
  );

  CREATE TABLE IF NOT EXISTS post_metrics (
    tweet_id TEXT NOT NULL,
    captured_at INTEGER NOT NULL,
    text TEXT,
    published_at INTEGER,
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    reposts INTEGER NOT NULL DEFAULT 0,
    replies INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(tweet_id, captured_at)
  );

  CREATE TABLE IF NOT EXISTS account_metrics (
    captured_at INTEGER PRIMARY KEY,
    followers INTEGER NOT NULL DEFAULT 0,
    following INTEGER NOT NULL DEFAULT 0,
    posts INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS candidate_actions (
    candidate_key TEXT NOT NULL,
    action TEXT NOT NULL,
    output_tweet_id TEXT,
    output_url TEXT,
    commentary TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(candidate_key, action),
    FOREIGN KEY(candidate_key) REFERENCES candidates(key)
  );

  CREATE TABLE IF NOT EXISTS audience_profiles (
    username TEXT PRIMARY KEY,
    display_name TEXT,
    bio TEXT,
    follows_you INTEGER NOT NULL DEFAULT 0,
    you_follow INTEGER NOT NULL DEFAULT 0,
    relevance_score REAL NOT NULL DEFAULT 0,
    niche_tags TEXT NOT NULL DEFAULT '[]',
    matched_keywords TEXT NOT NULL DEFAULT '[]',
    last_seen_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS queue_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_key TEXT NOT NULL UNIQUE,
    lane TEXT NOT NULL DEFAULT 'main',
    pipeline TEXT NOT NULL DEFAULT 'triage',
    status TEXT NOT NULL DEFAULT 'triage',
    reach_potential REAL NOT NULL DEFAULT 0,
    follow_potential REAL NOT NULL DEFAULT 0,
    conversation_potential REAL NOT NULL DEFAULT 0,
    relationship_potential REAL NOT NULL DEFAULT 0,
    recommended_pipeline TEXT NOT NULL DEFAULT '',
    routing_reason TEXT NOT NULL DEFAULT '',
    draft_id INTEGER,
    human_approved_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(candidate_key) REFERENCES candidates(key),
    FOREIGN KEY(draft_id) REFERENCES drafts(id)
  );

  CREATE INDEX IF NOT EXISTS idx_candidates_source_updated ON candidates(source, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_candidates_saved ON candidates(saved, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_candidates_viral ON candidates(viral_score DESC, published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status, scheduled_at, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_candidate_actions_created ON candidate_actions(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audience_relevance ON audience_profiles(relevance_score DESC, last_seen_at DESC);
  CREATE INDEX IF NOT EXISTS idx_queue_status_updated ON queue_items(status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_queue_pipeline_status ON queue_items(pipeline, status, updated_at DESC);

  INSERT OR IGNORE INTO queue_items (
    candidate_key, lane, pipeline, status,
    reach_potential, follow_potential, conversation_potential, relationship_potential,
    recommended_pipeline, routing_reason, draft_id, human_approved_at, created_at, updated_at
  )
  SELECT
    c.key, 'main', 'triage', 'triage',
    0, 0, 0, 0,
    '', '', NULL, NULL, c.updated_at, c.updated_at
  FROM candidates c
  WHERE c.saved = 1
    AND NOT EXISTS (
      SELECT 1 FROM candidate_actions a WHERE a.candidate_key = c.key
    );
`);

function json(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function candidateKey(candidate) {
  return candidate?.key || candidate?.url || `${candidate?.source}:${candidate?.title}`;
}

function decodeCandidate(row) {
  if (!row) return null;
  const metrics = json(row.metrics_json, {});
  const niche = {
    score: Number(row.niche_score || 0),
    tags: json(row.niche_tags, []),
    matches: json(row.matched_keywords, []),
  };
  const viral = row.viral_score == null ? null : {
    score: Number(row.viral_score),
    tier: row.viral_tier,
    ageHours: row.published_at ? Math.max((Date.now() - row.published_at) / 3_600_000, 0) : 0,
    viewsPerHour: Number(row.views_per_hour || 0),
    engagementsPerHour: Number(row.engagements_per_hour || 0),
  };
  return {
    key: row.key,
    source: row.source,
    title: row.title,
    text: row.text,
    url: row.url,
    score: Number(row.score || 0),
    niche,
    metrics,
    timestamp: row.published_at,
    viral,
    saved: Boolean(row.saved),
    discoveredAt: row.discovered_at,
    updatedAt: row.updated_at,
  };
}

const upsertCandidateStatement = db.prepare(`
  INSERT INTO candidates (
    key, source, title, text, url, score, niche_score, niche_tags, matched_keywords,
    metrics_json, published_at, viral_score, viral_tier, views_per_hour,
    engagements_per_hour, saved, discovered_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    source = excluded.source,
    title = excluded.title,
    text = excluded.text,
    url = excluded.url,
    score = excluded.score,
    niche_score = excluded.niche_score,
    niche_tags = CASE WHEN excluded.niche_tags <> '[]' THEN excluded.niche_tags ELSE candidates.niche_tags END,
    matched_keywords = CASE WHEN excluded.matched_keywords <> '[]' THEN excluded.matched_keywords ELSE candidates.matched_keywords END,
    metrics_json = excluded.metrics_json,
    published_at = COALESCE(excluded.published_at, candidates.published_at),
    viral_score = COALESCE(excluded.viral_score, candidates.viral_score),
    viral_tier = COALESCE(excluded.viral_tier, candidates.viral_tier),
    views_per_hour = COALESCE(excluded.views_per_hour, candidates.views_per_hour),
    engagements_per_hour = COALESCE(excluded.engagements_per_hour, candidates.engagements_per_hour),
    saved = MAX(candidates.saved, excluded.saved),
    updated_at = excluded.updated_at
`);

export function upsertCandidates(candidates = [], { saved = false } = {}) {
  const now = Date.now();
  db.exec('BEGIN');
  try {
    for (const candidate of candidates) {
      const key = candidateKey(candidate);
      if (!key) continue;
      upsertCandidateStatement.run(
        key,
        candidate.source || 'unknown',
        candidate.title || '',
        candidate.text || '',
        candidate.url || key,
        Number(candidate.score || 0),
        Number(candidate.niche?.score || 0),
        JSON.stringify(candidate.niche?.tags || []),
        JSON.stringify(candidate.niche?.matches || []),
        JSON.stringify(candidate.metrics || {}),
        Number(candidate.timestamp || 0) || null,
        candidate.viral ? Number(candidate.viral.score ?? candidate.score ?? 0) : null,
        candidate.viral?.tier || null,
        candidate.viral ? Number(candidate.viral.viewsPerHour || 0) : null,
        candidate.viral ? Number(candidate.viral.engagementsPerHour || 0) : null,
        saved || candidate.saved ? 1 : 0,
        Number(candidate.discoveredAt || now),
        now,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getCandidate(key) {
  return decodeCandidate(db.prepare('SELECT * FROM candidates WHERE key = ?').get(key));
}

export function listCandidates({ source, saved, viralOnly = false, withinHours, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (source) {
    where.push('source = ?');
    params.push(source);
  }
  if (saved != null) {
    where.push('saved = ?');
    params.push(saved ? 1 : 0);
  }
  if (viralOnly) where.push('viral_score IS NOT NULL');
  if (withinHours) {
    where.push('published_at >= ?');
    params.push(Date.now() - withinHours * 3_600_000);
  }
  const sql = `SELECT * FROM candidates ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${viralOnly ? 'viral_score DESC, published_at DESC' : 'saved DESC, score DESC, updated_at DESC'} LIMIT ?`;
  params.push(limit);
  return db.prepare(sql).all(...params).map(decodeCandidate);
}

export function markCandidateSaved(key, saved = true) {
  db.prepare('UPDATE candidates SET saved = ?, updated_at = ? WHERE key = ?').run(saved ? 1 : 0, Date.now(), key);
  return getCandidate(key);
}

export function countSavedCandidates() {
  return Number(db.prepare('SELECT COUNT(*) AS count FROM candidates WHERE saved = 1').get().count || 0);
}

function decodeQueueItem(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    candidateKey: row.candidate_key,
    lane: row.lane,
    pipeline: row.pipeline,
    status: row.status,
    reachPotential: Number(row.reach_potential || 0),
    followPotential: Number(row.follow_potential || 0),
    conversationPotential: Number(row.conversation_potential || 0),
    relationshipPotential: Number(row.relationship_potential || 0),
    recommendedPipeline: row.recommended_pipeline || '',
    routingReason: row.routing_reason || '',
    draftId: row.draft_id == null ? null : Number(row.draft_id),
    humanApprovedAt: row.human_approved_at == null ? null : Number(row.human_approved_at),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

export function ensureQueueItem(candidateKey, defaults = {}) {
  const now = Date.now();
  db.prepare(`INSERT OR IGNORE INTO queue_items(
    candidate_key, lane, pipeline, status,
    reach_potential, follow_potential, conversation_potential, relationship_potential,
    recommended_pipeline, routing_reason, draft_id, human_approved_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    candidateKey,
    defaults.lane || 'main',
    defaults.pipeline || 'triage',
    defaults.status || 'triage',
    Number(defaults.reachPotential || 0),
    Number(defaults.followPotential || 0),
    Number(defaults.conversationPotential || 0),
    Number(defaults.relationshipPotential || 0),
    defaults.recommendedPipeline || '',
    defaults.routingReason || '',
    defaults.draftId ?? null,
    defaults.humanApprovedAt ?? null,
    now,
    now,
  );
  return getQueueItemByCandidate(candidateKey);
}

export function getQueueItem(id) {
  return decodeQueueItem(db.prepare('SELECT * FROM queue_items WHERE id = ?').get(Number(id)));
}

export function getQueueItemByCandidate(candidateKey) {
  return decodeQueueItem(db.prepare('SELECT * FROM queue_items WHERE candidate_key = ?').get(candidateKey));
}

export function listQueueItems({ status, pipeline, lane, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (pipeline) { where.push('pipeline = ?'); params.push(pipeline); }
  if (lane) { where.push('lane = ?'); params.push(lane); }
  params.push(Number(limit || 100));
  return db.prepare(`SELECT * FROM queue_items ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC LIMIT ?`).all(...params).map(decodeQueueItem);
}

export function saveQueueItem(item) {
  const current = item?.id ? getQueueItem(item.id) : getQueueItemByCandidate(item?.candidateKey);
  if (!current) throw new Error(`Queue item not found: ${item?.candidateKey || item?.id || 'unknown'}`);
  const next = { ...current, ...item };
  db.prepare(`UPDATE queue_items SET
    lane = ?, pipeline = ?, status = ?,
    reach_potential = ?, follow_potential = ?, conversation_potential = ?, relationship_potential = ?,
    recommended_pipeline = ?, routing_reason = ?, draft_id = ?, human_approved_at = ?, updated_at = ?
    WHERE id = ?`).run(
    next.lane,
    next.pipeline,
    next.status,
    Number(next.reachPotential || 0),
    Number(next.followPotential || 0),
    Number(next.conversationPotential || 0),
    Number(next.relationshipPotential || 0),
    next.recommendedPipeline || '',
    next.routingReason || '',
    next.draftId ?? null,
    next.humanApprovedAt ?? null,
    Date.now(),
    current.id,
  );
  return getQueueItem(current.id);
}

export function countQueueItems({ status } = {}) {
  if (status) return Number(db.prepare('SELECT COUNT(*) AS count FROM queue_items WHERE status = ?').get(status).count || 0);
  return Number(db.prepare('SELECT COUNT(*) AS count FROM queue_items').get().count || 0);
}

export function recordCandidateAction({ candidateKey: key, action, outputTweetId = null, outputUrl = null, commentary = '' }) {
  if (!key || !action) throw new Error('candidateKey and action are required.');
  db.prepare(`INSERT INTO candidate_actions(candidate_key, action, output_tweet_id, output_url, commentary, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(candidate_key, action) DO UPDATE SET
      output_tweet_id = excluded.output_tweet_id,
      output_url = excluded.output_url,
      commentary = excluded.commentary,
      created_at = excluded.created_at`).run(key, action, outputTweetId, outputUrl, commentary, Date.now());
  return db.prepare('SELECT * FROM candidate_actions WHERE candidate_key = ? AND action = ?').get(key, action);
}

export function listCandidateActions(key) {
  return db.prepare('SELECT * FROM candidate_actions WHERE candidate_key = ? ORDER BY created_at DESC').all(key);
}

export function hasCandidateAction(key, action = null) {
  const row = action
    ? db.prepare('SELECT 1 AS found FROM candidate_actions WHERE candidate_key = ? AND action = ?').get(key, action)
    : db.prepare('SELECT 1 AS found FROM candidate_actions WHERE candidate_key = ? LIMIT 1').get(key);
  return Boolean(row);
}

export function getPreferenceProfile() {
  const rows = db.prepare('SELECT niche_tags, matched_keywords FROM candidates WHERE saved = 1').all();
  const tags = {};
  const keywords = {};
  for (const row of rows) {
    for (const tag of json(row.niche_tags, [])) tags[tag] = (tags[tag] || 0) + 1;
    for (const keyword of json(row.matched_keywords, [])) keywords[keyword] = (keywords[keyword] || 0) + 1;
  }
  return { savedCount: rows.length, tags, keywords };
}

export function replaceAudienceSnapshot({ followers = [], following = [] } = {}) {
  const now = Date.now();
  const merged = new Map();
  for (const profile of followers) merged.set(profile.username, { ...profile, followsYou: true, youFollow: false });
  for (const profile of following) {
    const existing = merged.get(profile.username) || {};
    merged.set(profile.username, { ...existing, ...profile, followsYou: Boolean(existing.followsYou), youFollow: true });
  }

  db.exec('BEGIN');
  try {
    const upsert = db.prepare(`INSERT INTO audience_profiles(
      username, display_name, bio, follows_you, you_follow, relevance_score, niche_tags, matched_keywords, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      display_name = excluded.display_name,
      bio = excluded.bio,
      follows_you = MAX(audience_profiles.follows_you, excluded.follows_you),
      you_follow = MAX(audience_profiles.you_follow, excluded.you_follow),
      relevance_score = excluded.relevance_score,
      niche_tags = excluded.niche_tags,
      matched_keywords = excluded.matched_keywords,
      last_seen_at = excluded.last_seen_at`);
    for (const profile of merged.values()) {
      if (!profile.username) continue;
      upsert.run(
        profile.username,
        profile.displayName || '',
        profile.bio || '',
        profile.followsYou ? 1 : 0,
        profile.youFollow ? 1 : 0,
        Number(profile.relevanceScore || 0),
        JSON.stringify(profile.nicheTags || []),
        JSON.stringify(profile.matchedKeywords || []),
        now,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getAudienceSummary();
}

function decodeAudience(row) {
  if (!row) return null;
  return {
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    followsYou: Boolean(row.follows_you),
    youFollow: Boolean(row.you_follow),
    relevanceScore: Number(row.relevance_score || 0),
    nicheTags: json(row.niche_tags, []),
    matchedKeywords: json(row.matched_keywords, []),
    lastSeenAt: Number(row.last_seen_at || 0),
  };
}

export function listAudienceProfiles({ followsYou, youFollow, minScore = 0, limit = 100 } = {}) {
  const where = ['relevance_score >= ?'];
  const params = [Number(minScore || 0)];
  if (followsYou != null) { where.push('follows_you = ?'); params.push(followsYou ? 1 : 0); }
  if (youFollow != null) { where.push('you_follow = ?'); params.push(youFollow ? 1 : 0); }
  params.push(Number(limit || 100));
  return db.prepare(`SELECT * FROM audience_profiles WHERE ${where.join(' AND ')}
    ORDER BY relevance_score DESC, last_seen_at DESC LIMIT ?`).all(...params).map(decodeAudience);
}

export function getAudienceSummary() {
  const row = db.prepare(`SELECT
    SUM(follows_you) AS followers,
    SUM(you_follow) AS following,
    SUM(CASE WHEN follows_you = 1 AND you_follow = 1 THEN 1 ELSE 0 END) AS mutuals,
    SUM(CASE WHEN follows_you = 1 AND relevance_score >= 12 THEN 1 ELSE 0 END) AS relevant_followers,
    SUM(CASE WHEN you_follow = 1 AND relevance_score >= 12 THEN 1 ELSE 0 END) AS relevant_following,
    SUM(CASE WHEN you_follow = 1 AND follows_you = 0 AND relevance_score >= 12 THEN 1 ELSE 0 END) AS target_accounts
    FROM audience_profiles`).get();
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, Number(value || 0)]));
}

function decodeDraft(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    candidateKey: row.candidate_key,
    hook: row.hook,
    insight: row.insight,
    evidence: row.evidence,
    action: row.action,
    body: row.body,
    qualityScore: Number(row.quality_score || 0),
    status: row.status,
    scheduledAt: row.scheduled_at,
    publishedTweetId: row.published_tweet_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function saveDraft(draft) {
  const now = Date.now();
  const existing = draft.id
    ? db.prepare('SELECT id, created_at FROM drafts WHERE id = ?').get(draft.id)
    : db.prepare('SELECT id, created_at FROM drafts WHERE candidate_key = ?').get(draft.candidateKey);
  if (existing) {
    db.prepare(`UPDATE drafts SET hook = ?, insight = ?, evidence = ?, action = ?, body = ?,
      quality_score = ?, status = ?, scheduled_at = ?, published_tweet_id = ?, updated_at = ? WHERE id = ?`).run(
      draft.hook || '', draft.insight || '', draft.evidence || '', draft.action || '', draft.body || '',
      Number(draft.qualityScore || 0), draft.status || 'draft', draft.scheduledAt || null,
      draft.publishedTweetId || null, now, existing.id,
    );
    return getDraft(existing.id);
  }

  const result = db.prepare(`INSERT INTO drafts (
    candidate_key, hook, insight, evidence, action, body, quality_score, status,
    scheduled_at, published_tweet_id, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    draft.candidateKey, draft.hook || '', draft.insight || '', draft.evidence || '', draft.action || '',
    draft.body || '', Number(draft.qualityScore || 0), draft.status || 'draft', draft.scheduledAt || null,
    draft.publishedTweetId || null, now, now,
  );
  return getDraft(Number(result.lastInsertRowid));
}

export function getDraft(id) {
  return decodeDraft(db.prepare('SELECT * FROM drafts WHERE id = ?').get(id));
}

export function getDraftByCandidate(key) {
  return decodeDraft(db.prepare('SELECT * FROM drafts WHERE candidate_key = ?').get(key));
}

export function listDrafts({ status, limit = 100 } = {}) {
  const rows = status
    ? db.prepare('SELECT * FROM drafts WHERE status = ? ORDER BY updated_at DESC LIMIT ?').all(status, limit)
    : db.prepare('SELECT * FROM drafts ORDER BY updated_at DESC LIMIT ?').all(limit);
  return rows.map(decodeDraft);
}

export function getNextReadyDraft(now = Date.now(), minScore = 40) {
  return decodeDraft(db.prepare(`SELECT * FROM drafts
    WHERE status = 'ready' AND quality_score >= ? AND (scheduled_at IS NULL OR scheduled_at <= ?)
    ORDER BY COALESCE(scheduled_at, updated_at) ASC LIMIT 1`).get(minScore, now));
}

export function setAppState(key, value) {
  db.prepare(`INSERT INTO app_state(key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value));
}

export function getAppState(key, fallback = null) {
  return db.prepare('SELECT value FROM app_state WHERE key = ?').get(key)?.value ?? fallback;
}

export function recordPerformanceSnapshot({ profile, posts = [] }) {
  const capturedAt = Date.now();
  db.exec('BEGIN');
  try {
    if (profile) {
      db.prepare(`INSERT OR REPLACE INTO account_metrics(captured_at, followers, following, posts, likes)
        VALUES (?, ?, ?, ?, ?)`).run(
        capturedAt,
        Number(profile.followersCount || 0),
        Number(profile.followingCount || 0),
        Number(profile.tweetCount || 0),
        Number(profile.likesCount || 0),
      );
    }
    const insert = db.prepare(`INSERT OR REPLACE INTO post_metrics(
      tweet_id, captured_at, text, published_at, views, likes, reposts, replies
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const post of posts) {
      if (!post.id) continue;
      insert.run(
        String(post.id), capturedAt, post.text || '', Number(post.timestamp || 0) || null,
        Number(post.views || 0), Number(post.likes || 0), Number(post.retweets || 0), Number(post.replies || 0),
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return capturedAt;
}

export function getPerformanceSnapshot(limit = 30) {
  const accounts = db.prepare('SELECT * FROM account_metrics ORDER BY captured_at DESC LIMIT 2').all();
  const account = accounts[0] || null;
  const previousAccount = accounts[1] || null;
  const posts = db.prepare(`SELECT p.* FROM post_metrics p
    JOIN (SELECT tweet_id, MAX(captured_at) AS latest FROM post_metrics GROUP BY tweet_id) x
      ON x.tweet_id = p.tweet_id AND x.latest = p.captured_at
    ORDER BY p.published_at DESC LIMIT ?`).all(limit);
  return { account, previousAccount, posts };
}

function migrateLegacyFiles() {
  if (getAppState('legacy_migrated') === '1') return;
  const interestingFile = path.resolve('.interesting-posts.json');
  if (fs.existsSync(interestingFile)) {
    try {
      const candidates = JSON.parse(fs.readFileSync(interestingFile, 'utf8'));
      if (Array.isArray(candidates)) upsertCandidates(candidates, { saved: true });
    } catch {
      // Leave a malformed legacy file untouched; the new database remains usable.
    }
  }
  const automationFile = path.resolve('.automation-state.json');
  if (fs.existsSync(automationFile)) {
    try {
      const state = JSON.parse(fs.readFileSync(automationFile, 'utf8'));
      if (state?.lastPostedAt) setAppState('last_posted_at', state.lastPostedAt);
    } catch {
      // Legacy state is optional.
    }
  }
  setAppState('legacy_migrated', '1');
}

migrateLegacyFiles();
