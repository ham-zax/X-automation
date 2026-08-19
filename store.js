import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import {
  RELATIONSHIP_EVENT_TYPES,
  RELATIONSHIP_STAGES,
  TARGET_CLASSES,
  refreshRelationshipProfile,
} from './relationship.js';
import {
  analyzeReplyRepetition,
  calculateInteractionYield,
  calculateSaturationPressure,
  deriveAccountHealth,
  summarizeNetworkQuality,
} from './health.js';

export const DB_FILE = path.resolve('.x-research.sqlite');
export const ACCOUNT_HEALTH_OBSERVATION_TYPES = [
  'under_the_hood_snapshot',
  'visibility_label_observed',
  'visibility_label_cleared',
  'platform_challenge_observed',
  'platform_restriction_observed',
  'operator_note',
];

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
    thread_parts_json TEXT NOT NULL DEFAULT '[]',
    editor_json TEXT NOT NULL DEFAULT '{}',
    gate_json TEXT NOT NULL DEFAULT '{}',
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

  CREATE TABLE IF NOT EXISTS relationship_profiles (
    username TEXT PRIMARY KEY,
    display_name TEXT,
    bio TEXT,
    classes_json TEXT NOT NULL DEFAULT '[]',
    primary_topics_json TEXT NOT NULL DEFAULT '[]',
    matched_keywords_json TEXT NOT NULL DEFAULT '[]',
    topic_fit REAL NOT NULL DEFAULT 0,
    audience_overlap REAL NOT NULL DEFAULT 0,
    conversation_quality REAL NOT NULL DEFAULT 0,
    reply_visibility REAL NOT NULL DEFAULT 0,
    relationship_potential REAL NOT NULL DEFAULT 0,
    reach_modifier REAL NOT NULL DEFAULT 0,
    target_score REAL NOT NULL DEFAULT 0,
    relevance_score REAL NOT NULL DEFAULT 0,
    customer_density REAL NOT NULL DEFAULT 0,
    authority_score REAL NOT NULL DEFAULT 0,
    follows_you INTEGER NOT NULL DEFAULT 0,
    you_follow INTEGER NOT NULL DEFAULT 0,
    mutual INTEGER NOT NULL DEFAULT 0,
    relationship_stage TEXT NOT NULL DEFAULT 'observed',
    meaningful_interactions INTEGER NOT NULL DEFAULT 0,
    their_replies_to_us INTEGER NOT NULL DEFAULT 0,
    our_replies_to_them INTEGER NOT NULL DEFAULT 0,
    our_quotes_of_them INTEGER NOT NULL DEFAULT 0,
    their_quotes_of_us INTEGER NOT NULL DEFAULT 0,
    their_reposts_of_us INTEGER NOT NULL DEFAULT 0,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    last_interaction_at INTEGER,
    last_response_at INTEGER,
    last_scored_at INTEGER NOT NULL,
    score_explanation_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS relationship_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    event_type TEXT NOT NULL,
    candidate_key TEXT,
    source_tweet_id TEXT,
    our_tweet_id TEXT,
    topic TEXT,
    occurred_at INTEGER NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS account_health_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    source TEXT NOT NULL,
    source_ref TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    observed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
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
    target_username TEXT,
    target_tweet_id TEXT,
    engagement_kind TEXT NOT NULL DEFAULT '',
    parent_our_tweet_id TEXT,
    priority REAL NOT NULL DEFAULT 0,
    urgency REAL NOT NULL DEFAULT 0,
    expires_at INTEGER,
    contribution_summary TEXT NOT NULL DEFAULT '',
    reply_archetype TEXT NOT NULL DEFAULT '',
    engagement_json TEXT NOT NULL DEFAULT '{}',
    approved_text TEXT,
    output_tweet_id TEXT,
    output_url TEXT,
    schedule_urgency TEXT NOT NULL DEFAULT 'evergreen',
    scheduled_at INTEGER,
    schedule_source TEXT NOT NULL DEFAULT '',
    publish_started_at INTEGER,
    publish_error TEXT,
    published_at INTEGER,
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
  CREATE INDEX IF NOT EXISTS idx_relationship_target_score ON relationship_profiles(target_score DESC, last_scored_at DESC);
  CREATE INDEX IF NOT EXISTS idx_relationship_stage ON relationship_profiles(relationship_stage, target_score DESC);
  CREATE INDEX IF NOT EXISTS idx_relationship_response ON relationship_profiles(last_response_at DESC);
  CREATE INDEX IF NOT EXISTS idx_relationship_events_user_time ON relationship_events(username, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_relationship_events_type_time ON relationship_events(event_type, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_relationship_events_source ON relationship_events(source_tweet_id);
  CREATE INDEX IF NOT EXISTS idx_relationship_events_ours ON relationship_events(our_tweet_id);
  CREATE INDEX IF NOT EXISTS idx_health_observed_at ON account_health_observations(observed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_health_type_observed ON account_health_observations(type, observed_at DESC);
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

const draftColumns = new Set(db.prepare('PRAGMA table_info(drafts)').all().map((row) => row.name));
for (const [name, sql] of [
  ['thread_parts_json', "ALTER TABLE drafts ADD COLUMN thread_parts_json TEXT NOT NULL DEFAULT '[]'"],
  ['editor_json', "ALTER TABLE drafts ADD COLUMN editor_json TEXT NOT NULL DEFAULT '{}'"],
  ['gate_json', "ALTER TABLE drafts ADD COLUMN gate_json TEXT NOT NULL DEFAULT '{}'"],
]) {
  if (!draftColumns.has(name)) db.exec(sql);
}

const queueColumns = new Set(db.prepare('PRAGMA table_info(queue_items)').all().map((row) => row.name));
for (const [name, sql] of [
  ['target_username', 'ALTER TABLE queue_items ADD COLUMN target_username TEXT'],
  ['target_tweet_id', 'ALTER TABLE queue_items ADD COLUMN target_tweet_id TEXT'],
  ['engagement_kind', "ALTER TABLE queue_items ADD COLUMN engagement_kind TEXT NOT NULL DEFAULT ''"],
  ['parent_our_tweet_id', 'ALTER TABLE queue_items ADD COLUMN parent_our_tweet_id TEXT'],
  ['priority', 'ALTER TABLE queue_items ADD COLUMN priority REAL NOT NULL DEFAULT 0'],
  ['urgency', 'ALTER TABLE queue_items ADD COLUMN urgency REAL NOT NULL DEFAULT 0'],
  ['expires_at', 'ALTER TABLE queue_items ADD COLUMN expires_at INTEGER'],
  ['contribution_summary', "ALTER TABLE queue_items ADD COLUMN contribution_summary TEXT NOT NULL DEFAULT ''"],
  ['reply_archetype', "ALTER TABLE queue_items ADD COLUMN reply_archetype TEXT NOT NULL DEFAULT ''"],
  ['engagement_json', "ALTER TABLE queue_items ADD COLUMN engagement_json TEXT NOT NULL DEFAULT '{}'"],
  ['approved_text', 'ALTER TABLE queue_items ADD COLUMN approved_text TEXT'],
  ['output_tweet_id', 'ALTER TABLE queue_items ADD COLUMN output_tweet_id TEXT'],
  ['output_url', 'ALTER TABLE queue_items ADD COLUMN output_url TEXT'],
  ['schedule_urgency', "ALTER TABLE queue_items ADD COLUMN schedule_urgency TEXT NOT NULL DEFAULT 'evergreen'"],
  ['scheduled_at', 'ALTER TABLE queue_items ADD COLUMN scheduled_at INTEGER'],
  ['schedule_source', "ALTER TABLE queue_items ADD COLUMN schedule_source TEXT NOT NULL DEFAULT ''"],
  ['publish_started_at', 'ALTER TABLE queue_items ADD COLUMN publish_started_at INTEGER'],
  ['publish_error', 'ALTER TABLE queue_items ADD COLUMN publish_error TEXT'],
  ['published_at', 'ALTER TABLE queue_items ADD COLUMN published_at INTEGER'],
]) {
  if (!queueColumns.has(name)) db.exec(sql);
}
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_queue_engagement_priority ON queue_items(lane, status, priority DESC, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_queue_engagement_source ON queue_items(target_tweet_id, engagement_kind, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_queue_main_schedule ON queue_items(lane, status, scheduled_at, updated_at DESC);
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
    targetUsername: row.target_username || '',
    targetTweetId: row.target_tweet_id || '',
    engagementKind: row.engagement_kind || '',
    parentOurTweetId: row.parent_our_tweet_id || '',
    priority: Number(row.priority || 0),
    urgency: Number(row.urgency || 0),
    expiresAt: row.expires_at == null ? null : Number(row.expires_at),
    contributionSummary: row.contribution_summary || '',
    replyArchetype: row.reply_archetype || '',
    engagement: json(row.engagement_json, {}),
    approvedText: row.approved_text,
    outputTweetId: row.output_tweet_id,
    outputUrl: row.output_url,
    scheduleUrgency: row.schedule_urgency || 'evergreen',
    scheduledAt: row.scheduled_at == null ? null : Number(row.scheduled_at),
    scheduleSource: row.schedule_source || '',
    publishStartedAt: row.publish_started_at == null ? null : Number(row.publish_started_at),
    publishError: row.publish_error || '',
    publishedAt: row.published_at == null ? null : Number(row.published_at),
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
    recommended_pipeline = ?, routing_reason = ?, draft_id = ?, human_approved_at = ?,
    target_username = ?, target_tweet_id = ?, engagement_kind = ?, parent_our_tweet_id = ?,
    priority = ?, urgency = ?, expires_at = ?, contribution_summary = ?, reply_archetype = ?,
    engagement_json = ?, approved_text = ?, output_tweet_id = ?, output_url = ?,
    schedule_urgency = ?, scheduled_at = ?, schedule_source = ?, publish_started_at = ?,
    publish_error = ?, published_at = ?, updated_at = ?
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
    next.targetUsername || null,
    next.targetTweetId || null,
    next.engagementKind || '',
    next.parentOurTweetId || null,
    Number(next.priority || 0),
    Number(next.urgency || 0),
    next.expiresAt ?? null,
    next.contributionSummary || '',
    next.replyArchetype || '',
    JSON.stringify(next.engagement || {}),
    next.approvedText ?? null,
    next.outputTweetId ?? null,
    next.outputUrl ?? null,
    next.scheduleUrgency || 'evergreen',
    next.scheduledAt ?? null,
    next.scheduleSource || '',
    next.publishStartedAt ?? null,
    next.publishError || null,
    next.publishedAt ?? null,
    Date.now(),
    current.id,
  );
  return getQueueItem(current.id);
}

const MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread', 'repost']);
const AUTOMATED_MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread']);
const SCHEDULE_URGENCIES = new Set(['evergreen', 'timely', 'viral']);

function buildMainFeedScheduleItem(queueItem) {
  if (!queueItem) return null;
  const candidate = getCandidate(queueItem.candidateKey);
  const draft = queueItem.draftId ? getDraft(queueItem.draftId) : getDraftByCandidate(queueItem.candidateKey);
  const media = draft?.editor?.media || { required: false, type: 'none', reason: '', source: '', altText: '' };
  const isRepost = queueItem.pipeline === 'repost';
  const gatesPassed = isRepost
    ? Boolean(queueItem.humanApprovedAt)
    : Boolean(draft && draft.status === 'ready' && draft.gates?.passed === true && media.required !== true);
  const threadParts = Array.isArray(draft?.threadParts) ? draft.threadParts : [];
  const body = String(draft?.body || '');
  const text = queueItem.pipeline === 'thread' ? String(threadParts[0] || '') : body;
  return {
    ...queueItem,
    priority: null,
    urgency: queueItem.scheduleUrgency || 'evergreen',
    humanScheduleOverrideAt: queueItem.scheduleSource === 'human' ? queueItem.scheduledAt : null,
    qualityScore: Number(draft?.qualityScore || 0),
    gatesPassed,
    published: queueItem.publishedAt != null || Boolean(queueItem.outputTweetId),
    body,
    text,
    threadParts,
    semanticAnchors: Array.isArray(draft?.editor?.semanticAnchors) ? draft.editor.semanticAnchors : [],
    topics: Array.isArray(candidate?.niche?.tags) ? candidate.niche.tags : [],
    media,
    candidate,
    draft,
  };
}

export function getMainFeedScheduleItem(candidateKey) {
  const queueItem = getQueueItemByCandidate(candidateKey);
  if (!queueItem || !['main', 'main_feed'].includes(queueItem.lane) || !MAIN_FEED_PIPELINES.has(queueItem.pipeline)) return null;
  return buildMainFeedScheduleItem(queueItem);
}

export function listApprovedMainFeedItems({ automatedOnly = false, limit = 100 } = {}) {
  const pipelines = automatedOnly ? AUTOMATED_MAIN_FEED_PIPELINES : MAIN_FEED_PIPELINES;
  const bounded = Math.max(1, Math.min(500, Number(limit || 100)));
  return db.prepare(`SELECT * FROM queue_items
    WHERE lane IN ('main', 'main_feed') AND status = 'approved'
    ORDER BY updated_at ASC LIMIT ?`).all(bounded)
    .map(decodeQueueItem)
    .filter((item) => pipelines.has(item.pipeline))
    .map(buildMainFeedScheduleItem);
}

export function listRecentMainFeedPublications({ limit = 20 } = {}) {
  const bounded = Math.max(1, Math.min(100, Number(limit || 20)));
  const published = db.prepare(`SELECT * FROM queue_items
    WHERE lane IN ('main', 'main_feed') AND status = 'published' AND published_at IS NOT NULL
      AND pipeline IN ('original', 'quote', 'thread', 'repost')
    ORDER BY published_at DESC LIMIT ?`).all(bounded).map(decodeQueueItem).map(buildMainFeedScheduleItem);
  const seen = new Set(published.map((item) => item.candidateKey));
  const legacy = db.prepare(`SELECT candidate_key, updated_at FROM drafts
    WHERE status = 'published' ORDER BY updated_at DESC LIMIT ?`).all(bounded);
  for (const row of legacy) {
    if (seen.has(row.candidate_key)) continue;
    const queueItem = getQueueItemByCandidate(row.candidate_key);
    if (queueItem && (!['main', 'main_feed'].includes(queueItem.lane) || !MAIN_FEED_PIPELINES.has(queueItem.pipeline))) continue;
    const draft = getDraftByCandidate(row.candidate_key);
    const candidate = getCandidate(row.candidate_key);
    const pipeline = queueItem?.pipeline && MAIN_FEED_PIPELINES.has(queueItem.pipeline) ? queueItem.pipeline : 'original';
    const threadParts = Array.isArray(draft?.threadParts) ? draft.threadParts : [];
    published.push({
      ...(queueItem || {}),
      candidateKey: row.candidate_key,
      pipeline,
      priority: null,
      urgency: queueItem?.scheduleUrgency || 'evergreen',
      published: true,
      publishedAt: Number(row.updated_at || 0),
      qualityScore: Number(draft?.qualityScore || 0),
      body: String(draft?.body || ''),
      text: pipeline === 'thread' ? String(threadParts[0] || '') : String(draft?.body || ''),
      threadParts,
      semanticAnchors: Array.isArray(draft?.editor?.semanticAnchors) ? draft.editor.semanticAnchors : [],
      topics: Array.isArray(candidate?.niche?.tags) ? candidate.niche.tags : [],
    });
    seen.add(row.candidate_key);
  }
  return published.sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0)).slice(0, bounded);
}

export function setMainFeedSchedule(candidateKey, changes = {}, { actor = 'human' } = {}) {
  if (actor !== 'human') throw new Error('Main-feed schedule overrides require an explicit human action.');
  const current = getQueueItemByCandidate(candidateKey);
  if (!current || !['main', 'main_feed'].includes(current.lane) || !MAIN_FEED_PIPELINES.has(current.pipeline)) {
    throw new Error(`Main-feed queue item not found: ${candidateKey}`);
  }
  if (current.status !== 'approved') throw new Error('Main-feed scheduling controls are available only after human approval.');
  const urgency = changes.scheduleUrgency == null ? current.scheduleUrgency : String(changes.scheduleUrgency);
  if (!SCHEDULE_URGENCIES.has(urgency)) throw new Error(`Invalid schedule urgency: ${urgency}`);
  const scheduledAt = changes.scheduledAt === undefined || changes.scheduledAt === current.scheduledAt
    ? current.scheduledAt
    : (changes.scheduledAt == null ? null : Number(changes.scheduledAt));
  const expiresAt = changes.expiresAt === undefined || changes.expiresAt === current.expiresAt
    ? current.expiresAt
    : (changes.expiresAt == null ? null : Number(changes.expiresAt));
  if (scheduledAt != null && !Number.isFinite(scheduledAt)) throw new Error('Invalid main-feed schedule override time.');
  if (expiresAt != null && !Number.isFinite(expiresAt)) throw new Error('Invalid main-feed expiry time.');
  if (scheduledAt != null && expiresAt != null && scheduledAt >= expiresAt) {
    throw new Error('Main-feed schedule override must be before expiry.');
  }
  return saveQueueItem({
    ...current,
    scheduleUrgency: urgency,
    scheduledAt,
    scheduleSource: scheduledAt == null ? '' : 'human',
    expiresAt,
  });
}

export function claimQueueItem(id, { expectedUpdatedAt = null, now = Date.now() } = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('claimQueueItem requires a numeric now timestamp.');
  const params = [timestamp, timestamp, Number(id), timestamp];
  let sql = `UPDATE queue_items SET status = 'publishing', publish_started_at = ?, publish_error = NULL, updated_at = ?
    WHERE id = ? AND lane IN ('main', 'main_feed') AND status = 'approved'
      AND pipeline IN ('original', 'quote', 'thread') AND human_approved_at IS NOT NULL
      AND (expires_at IS NULL OR expires_at > ?)
      AND published_at IS NULL AND output_tweet_id IS NULL`;
  if (expectedUpdatedAt != null) {
    sql += ' AND updated_at = ?';
    params.push(Number(expectedUpdatedAt));
  }
  const result = db.prepare(sql).run(...params);
  return Number(result.changes || 0) === 1 ? getQueueItem(Number(id)) : null;
}

export function markQueuePublished(id, tweetId, outputUrl = null, { publishedAt = Date.now() } = {}) {
  const normalizedTweetId = String(tweetId || '').trim();
  if (!normalizedTweetId) throw new Error('markQueuePublished requires tweetId.');
  const timestamp = Number(publishedAt);
  if (!Number.isFinite(timestamp)) throw new Error('markQueuePublished requires a numeric publishedAt timestamp.');
  const result = db.prepare(`UPDATE queue_items SET status = 'published', output_tweet_id = ?, output_url = ?,
      published_at = ?, publish_error = NULL, updated_at = ? WHERE id = ? AND status = 'publishing'`)
    .run(normalizedTweetId, outputUrl || null, timestamp, timestamp, Number(id));
  if (Number(result.changes || 0) !== 1) throw new Error(`Queue item ${id} is not in publishing state.`);
  return getQueueItem(Number(id));
}

export function markQueueFailed(id, error, { failedAt = Date.now() } = {}) {
  const timestamp = Number(failedAt);
  if (!Number.isFinite(timestamp)) throw new Error('markQueueFailed requires a numeric failedAt timestamp.');
  const message = String(error?.message || error || 'Publication failed.');
  const result = db.prepare(`UPDATE queue_items SET status = 'failed', publish_error = ?, updated_at = ?
    WHERE id = ? AND status = 'publishing'`).run(message, timestamp, Number(id));
  if (Number(result.changes || 0) !== 1) throw new Error(`Queue item ${id} is not in publishing state.`);
  return getQueueItem(Number(id));
}

const ENGAGEMENT_TERMINAL_STATUSES = new Set(['ignored', 'expired', 'published', 'failed']);

export function ensureEngagementItem(item = {}) {
  const candidateKey = String(item.candidateKey || '');
  const targetTweetId = String(item.targetTweetId || '');
  const engagementKind = String(item.engagementKind || 'initial_reply');
  if (!candidateKey || !targetTweetId) throw new Error('candidateKey and targetTweetId are required for engagement items.');

  const existingBySource = decodeQueueItem(db.prepare(`SELECT * FROM queue_items
    WHERE lane = 'engagement' AND target_tweet_id = ? AND engagement_kind = ?
    ORDER BY id DESC LIMIT 1`).get(targetTweetId, engagementKind));
  if (existingBySource) {
    if (ENGAGEMENT_TERMINAL_STATUSES.has(existingBySource.status)) return existingBySource;
    return saveQueueItem({
      ...item,
      id: existingBySource.id,
      candidateKey: existingBySource.candidateKey,
      lane: 'engagement',
      pipeline: 'reply',
      status: existingBySource.status,
    });
  }

  const existingCandidate = getQueueItemByCandidate(candidateKey);
  if (existingCandidate) {
    if (ENGAGEMENT_TERMINAL_STATUSES.has(existingCandidate.status)) return existingCandidate;
    if (existingCandidate.lane !== 'engagement'
      && (existingCandidate.pipeline !== 'triage' || existingCandidate.status !== 'triage')) {
      return existingCandidate;
    }
    return saveQueueItem({
      ...item,
      id: existingCandidate.id,
      lane: 'engagement',
      pipeline: 'reply',
      status: existingCandidate.lane === 'engagement' ? existingCandidate.status : (item.status || 'triage'),
    });
  }

  ensureQueueItem(candidateKey, { lane: 'engagement', pipeline: 'reply', status: item.status || 'triage' });
  return saveQueueItem({ ...item, candidateKey, lane: 'engagement', pipeline: 'reply' });
}

export function getActiveEngagementItem(targetTweetId, engagementKind = 'initial_reply') {
  return decodeQueueItem(db.prepare(`SELECT * FROM queue_items
    WHERE lane = 'engagement' AND target_tweet_id = ? AND engagement_kind = ?
      AND status NOT IN ('ignored', 'expired', 'published', 'failed')
    ORDER BY priority DESC, updated_at DESC LIMIT 1`).get(String(targetTweetId || ''), engagementKind));
}

export function listEngagementItems({ status, minPriority = 0, includeExpired = false, limit = 100 } = {}) {
  const where = ["lane = 'engagement'", 'priority >= ?'];
  const params = [Number(minPriority || 0)];
  if (status) { where.push('status = ?'); params.push(status); }
  params.push(Math.max(1, Math.min(500, Number(limit || 100))));
  const items = db.prepare(`SELECT * FROM queue_items WHERE ${where.join(' AND ')}
    ORDER BY priority DESC, updated_at DESC LIMIT ?`).all(...params).map(decodeQueueItem);
  if (includeExpired) return items;
  return items.filter((item) => !['ignored', 'expired', 'published'].includes(item.status)
    && item.engagement?.expiry?.effectiveExpired !== true);
}

export function listRecentOurConversationPosts({ limit = 100 } = {}) {
  const bounded = Math.max(1, Math.min(500, Number(limit || 100)));
  const actions = db.prepare(`SELECT a.output_tweet_id AS tweet_id, a.candidate_key, a.action AS kind,
      a.created_at AS occurred_at, q.target_tweet_id AS source_tweet_id
    FROM candidate_actions a LEFT JOIN queue_items q ON q.candidate_key = a.candidate_key
    WHERE a.output_tweet_id IS NOT NULL AND a.action IN ('direct', 'quote', 'reply')
    ORDER BY a.created_at DESC LIMIT ?`).all(bounded);
  const drafts = db.prepare(`SELECT d.published_tweet_id AS tweet_id, d.candidate_key,
      CASE WHEN q.pipeline = 'reply' THEN 'reply' WHEN q.pipeline = 'quote' THEN 'quote' ELSE 'direct' END AS kind,
      d.updated_at AS occurred_at, q.target_tweet_id AS source_tweet_id
    FROM drafts d LEFT JOIN queue_items q ON q.candidate_key = d.candidate_key
    WHERE d.published_tweet_id IS NOT NULL
    ORDER BY d.updated_at DESC LIMIT ?`).all(bounded);
  const events = db.prepare(`SELECT our_tweet_id AS tweet_id, candidate_key,
      CASE WHEN event_type = 'our_reply' THEN 'reply' ELSE 'quote' END AS kind,
      occurred_at, source_tweet_id
    FROM relationship_events
    WHERE our_tweet_id IS NOT NULL AND event_type IN ('our_reply', 'our_quote')
    ORDER BY occurred_at DESC LIMIT ?`).all(bounded);

  const seen = new Set();
  return [...actions, ...drafts, ...events]
    .filter((row) => row.tweet_id)
    .sort((left, right) => Number(right.occurred_at || 0) - Number(left.occurred_at || 0))
    .filter((row) => {
      const tweetId = String(row.tweet_id);
      if (seen.has(tweetId)) return false;
      seen.add(tweetId);
      return true;
    })
    .slice(0, bounded)
    .map((row) => ({
      tweetId: String(row.tweet_id),
      candidateKey: row.candidate_key || '',
      kind: row.kind || 'direct',
      sourceTweetId: row.source_tweet_id ? String(row.source_tweet_id) : '',
      occurredAt: Number(row.occurred_at || 0),
    }));
}

export function countQueueItems({ status, lane } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (lane) { where.push('lane = ?'); params.push(lane); }
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM queue_items${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`).get(...params).count || 0);
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

export function getAudienceProfile(username) {
  return decodeAudience(db.prepare('SELECT * FROM audience_profiles WHERE username = ? COLLATE NOCASE').get(String(username || '').replace(/^@/, '').toLowerCase()));
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

function decodeRelationshipProfile(row) {
  if (!row) return null;
  return {
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    classes: json(row.classes_json, []),
    primaryTopics: json(row.primary_topics_json, []),
    matchedKeywords: json(row.matched_keywords_json, []),
    topicFit: Number(row.topic_fit || 0),
    audienceOverlap: Number(row.audience_overlap || 0),
    conversationQuality: Number(row.conversation_quality || 0),
    replyVisibility: Number(row.reply_visibility || 0),
    relationshipPotential: Number(row.relationship_potential || 0),
    reachModifier: Number(row.reach_modifier || 0),
    targetScore: Number(row.target_score || 0),
    relevanceScore: Number(row.relevance_score || 0),
    customerDensity: Number(row.customer_density || 0),
    authorityScore: Number(row.authority_score || 0),
    followsYou: Boolean(row.follows_you),
    youFollow: Boolean(row.you_follow),
    mutual: Boolean(row.mutual),
    relationshipStage: row.relationship_stage,
    meaningfulInteractions: Number(row.meaningful_interactions || 0),
    theirRepliesToUs: Number(row.their_replies_to_us || 0),
    ourRepliesToThem: Number(row.our_replies_to_them || 0),
    ourQuotesOfThem: Number(row.our_quotes_of_them || 0),
    theirQuotesOfUs: Number(row.their_quotes_of_us || 0),
    theirRepostsOfUs: Number(row.their_reposts_of_us || 0),
    firstSeenAt: Number(row.first_seen_at || 0),
    lastSeenAt: Number(row.last_seen_at || 0),
    lastInteractionAt: row.last_interaction_at == null ? null : Number(row.last_interaction_at),
    lastResponseAt: row.last_response_at == null ? null : Number(row.last_response_at),
    lastScoredAt: Number(row.last_scored_at || 0),
    scoreExplanation: json(row.score_explanation_json, {}),
  };
}

function normalizeRelationshipUsername(username) {
  return String(username || '').replace(/^@/, '').trim().toLowerCase();
}

const upsertRelationshipProfileStatement = db.prepare(`INSERT INTO relationship_profiles(
  username, display_name, bio, classes_json, primary_topics_json, matched_keywords_json,
  topic_fit, audience_overlap, conversation_quality, reply_visibility, relationship_potential,
  reach_modifier, target_score, relevance_score, customer_density, authority_score,
  follows_you, you_follow, mutual, relationship_stage,
  meaningful_interactions, their_replies_to_us, our_replies_to_them, our_quotes_of_them,
  their_quotes_of_us, their_reposts_of_us, first_seen_at, last_seen_at, last_interaction_at,
  last_response_at, last_scored_at, score_explanation_json
) VALUES (
  @username, @displayName, @bio, @classes, @primaryTopics, @matchedKeywords,
  @topicFit, @audienceOverlap, @conversationQuality, @replyVisibility, @relationshipPotential,
  @reachModifier, @targetScore, @relevanceScore, @customerDensity, @authorityScore,
  @followsYou, @youFollow, @mutual, @relationshipStage,
  @meaningfulInteractions, @theirRepliesToUs, @ourRepliesToThem, @ourQuotesOfThem,
  @theirQuotesOfUs, @theirRepostsOfUs, @firstSeenAt, @lastSeenAt, @lastInteractionAt,
  @lastResponseAt, @lastScoredAt, @scoreExplanation
)
ON CONFLICT(username) DO UPDATE SET
  display_name = excluded.display_name,
  bio = excluded.bio,
  classes_json = excluded.classes_json,
  primary_topics_json = excluded.primary_topics_json,
  matched_keywords_json = excluded.matched_keywords_json,
  topic_fit = excluded.topic_fit,
  audience_overlap = excluded.audience_overlap,
  conversation_quality = excluded.conversation_quality,
  reply_visibility = excluded.reply_visibility,
  relationship_potential = excluded.relationship_potential,
  reach_modifier = excluded.reach_modifier,
  target_score = excluded.target_score,
  relevance_score = excluded.relevance_score,
  customer_density = excluded.customer_density,
  authority_score = excluded.authority_score,
  follows_you = excluded.follows_you,
  you_follow = excluded.you_follow,
  mutual = excluded.mutual,
  relationship_stage = excluded.relationship_stage,
  meaningful_interactions = excluded.meaningful_interactions,
  their_replies_to_us = excluded.their_replies_to_us,
  our_replies_to_them = excluded.our_replies_to_them,
  our_quotes_of_them = excluded.our_quotes_of_them,
  their_quotes_of_us = excluded.their_quotes_of_us,
  their_reposts_of_us = excluded.their_reposts_of_us,
  last_seen_at = MAX(relationship_profiles.last_seen_at, excluded.last_seen_at),
  last_interaction_at = COALESCE(excluded.last_interaction_at, relationship_profiles.last_interaction_at),
  last_response_at = COALESCE(excluded.last_response_at, relationship_profiles.last_response_at),
  last_scored_at = excluded.last_scored_at,
  score_explanation_json = excluded.score_explanation_json`);

export function getRelationshipProfile(username) {
  return decodeRelationshipProfile(db.prepare('SELECT * FROM relationship_profiles WHERE username = ?').get(normalizeRelationshipUsername(username)));
}

export function listRelationshipProfiles({ className, stage, minTargetScore = 0, limit = 100 } = {}) {
  if (className && !TARGET_CLASSES.includes(className)) throw new Error(`Invalid relationship class: ${className}`);
  if (stage && !RELATIONSHIP_STAGES.includes(stage)) throw new Error(`Invalid relationship stage: ${stage}`);
  const where = ['target_score >= ?'];
  const params = [Number(minTargetScore || 0)];
  if (className) { where.push('classes_json LIKE ?'); params.push(`%\"${className}\"%`); }
  if (stage) { where.push('relationship_stage = ?'); params.push(stage); }
  params.push(Math.max(1, Math.min(1000, Number(limit || 100))));
  return db.prepare(`SELECT * FROM relationship_profiles WHERE ${where.join(' AND ')}
    ORDER BY target_score DESC, last_scored_at DESC LIMIT ?`).all(...params).map(decodeRelationshipProfile);
}

export function getRelationshipSummary() {
  const stageRows = db.prepare('SELECT relationship_stage AS stage, COUNT(*) AS count FROM relationship_profiles GROUP BY relationship_stage').all();
  const stages = Object.fromEntries(RELATIONSHIP_STAGES.map((stage) => [stage, 0]));
  for (const row of stageRows) stages[row.stage] = Number(row.count || 0);
  const classes = Object.fromEntries(TARGET_CLASSES.map((className) => [
    className,
    Number(db.prepare('SELECT COUNT(*) AS count FROM relationship_profiles WHERE classes_json LIKE ?').get(`%\"${className}\"%`).count || 0),
  ]));
  return {
    total: Number(db.prepare('SELECT COUNT(*) AS count FROM relationship_profiles').get().count || 0),
    stages,
    classes,
  };
}

export function upsertRelationshipProfile(profile) {
  const username = normalizeRelationshipUsername(profile?.username);
  if (!username) throw new Error('relationship profile username is required.');
  const now = Date.now();
  const classes = [...new Set((profile.classes || []).filter((value) => TARGET_CLASSES.includes(value)))];
  const stage = RELATIONSHIP_STAGES.includes(profile.relationshipStage) ? profile.relationshipStage : 'observed';
  const firstSeenAt = Number(profile.firstSeenAt || profile.lastSeenAt || now);
  upsertRelationshipProfileStatement.run({
    username,
    displayName: profile.displayName || username,
    bio: profile.bio || '',
    classes: JSON.stringify(classes),
    primaryTopics: JSON.stringify(profile.primaryTopics || []),
    matchedKeywords: JSON.stringify(profile.matchedKeywords || []),
    topicFit: Number(profile.topicFit ?? 0),
    audienceOverlap: Number(profile.audienceOverlap ?? 0),
    conversationQuality: Number(profile.conversationQuality ?? 0),
    replyVisibility: Number(profile.replyVisibility ?? 0),
    relationshipPotential: Number(profile.relationshipPotential ?? 0),
    reachModifier: Number(profile.reachModifier ?? 0),
    targetScore: Number(profile.targetScore ?? 0),
    relevanceScore: Number(profile.relevanceScore ?? 0),
    customerDensity: Number(profile.customerDensity ?? 0),
    authorityScore: Number(profile.authorityScore ?? 0),
    followsYou: profile.followsYou ? 1 : 0,
    youFollow: profile.youFollow ? 1 : 0,
    mutual: profile.mutual ? 1 : 0,
    relationshipStage: stage,
    meaningfulInteractions: Number(profile.meaningfulInteractions || 0),
    theirRepliesToUs: Number(profile.theirRepliesToUs || 0),
    ourRepliesToThem: Number(profile.ourRepliesToThem || 0),
    ourQuotesOfThem: Number(profile.ourQuotesOfThem || 0),
    theirQuotesOfUs: Number(profile.theirQuotesOfUs || 0),
    theirRepostsOfUs: Number(profile.theirRepostsOfUs || 0),
    firstSeenAt,
    lastSeenAt: Number(profile.lastSeenAt || firstSeenAt),
    lastInteractionAt: profile.lastInteractionAt ?? null,
    lastResponseAt: profile.lastResponseAt ?? null,
    lastScoredAt: Number(profile.lastScoredAt || now),
    scoreExplanation: JSON.stringify(profile.scoreExplanation || {}),
  });
  return getRelationshipProfile(username);
}

function decodeRelationshipEvent(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    eventType: row.event_type,
    candidateKey: row.candidate_key,
    sourceTweetId: row.source_tweet_id,
    ourTweetId: row.our_tweet_id,
    topic: row.topic,
    occurredAt: Number(row.occurred_at || 0),
    metadata: json(row.metadata_json, {}),
  };
}

function allRelationshipEvents(username) {
  return db.prepare('SELECT * FROM relationship_events WHERE username = ? ORDER BY occurred_at ASC, id ASC')
    .all(normalizeRelationshipUsername(username)).map(decodeRelationshipEvent);
}

export function listRelationshipEvents(username, { limit = 100 } = {}) {
  const normalized = normalizeRelationshipUsername(username);
  if (!normalized) throw new Error('relationship event username is required.');
  return db.prepare('SELECT * FROM relationship_events WHERE username = ? ORDER BY occurred_at DESC, id DESC LIMIT ?')
    .all(normalized, Math.max(1, Math.min(1000, Number(limit || 100)))).map(decodeRelationshipEvent);
}

export function applyRelationshipEvent(username) {
  const normalized = normalizeRelationshipUsername(username);
  if (!normalized) throw new Error('relationship event username is required.');
  const events = allRelationshipEvents(normalized);
  if (!events.length) return getRelationshipProfile(normalized);
  const current = getRelationshipProfile(normalized) || {
    username: normalized,
    displayName: normalized,
    firstSeenAt: events[0].occurredAt,
    lastSeenAt: events[0].occurredAt,
  };
  return upsertRelationshipProfile(refreshRelationshipProfile(current, { events }));
}

export function refreshRelationshipFromAudience(audienceProfile) {
  const username = normalizeRelationshipUsername(audienceProfile?.username);
  if (!username) throw new Error('audience relationship username is required.');
  const current = getRelationshipProfile(username) || {};
  const events = allRelationshipEvents(username);
  const input = {
    ...current,
    username,
    displayName: audienceProfile.displayName || current.displayName || username,
    bio: audienceProfile.bio ?? current.bio ?? '',
    primaryTopics: audienceProfile.nicheTags || [],
    matchedKeywords: audienceProfile.matchedKeywords || [],
    relevanceScore: Number(audienceProfile.relevanceScore || 0),
    followsYou: Boolean(audienceProfile.followsYou),
    youFollow: Boolean(audienceProfile.youFollow),
    lastSeenAt: Number(audienceProfile.lastSeenAt || current.lastSeenAt || Date.now()),
  };
  return upsertRelationshipProfile(refreshRelationshipProfile(input, { events }));
}

export function recordRelationshipEvent(event) {
  const username = normalizeRelationshipUsername(event?.username);
  const type = String(event?.eventType || event?.event_type || '');
  if (!username) throw new Error('relationship event username is required.');
  if (!RELATIONSHIP_EVENT_TYPES.includes(type)) throw new Error(`Invalid relationship event type: ${type}`);
  const occurredAt = Number(event?.occurredAt || event?.occurred_at || Date.now());
  db.exec('BEGIN');
  try {
    const inserted = db.prepare(`INSERT INTO relationship_events(
      username, event_type, candidate_key, source_tweet_id, our_tweet_id, topic, occurred_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      username,
      type,
      event?.candidateKey ?? event?.candidate_key ?? null,
      event?.sourceTweetId ?? event?.source_tweet_id ?? null,
      event?.ourTweetId ?? event?.our_tweet_id ?? null,
      event?.topic || null,
      occurredAt,
      JSON.stringify(event?.metadata || {}),
    );
    applyRelationshipEvent(username);
    db.exec('COMMIT');
    return decodeRelationshipEvent(db.prepare('SELECT * FROM relationship_events WHERE id = ?').get(Number(inserted.lastInsertRowid)));
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function decodeAccountHealthObservation(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    type: row.type,
    severity: row.severity,
    source: row.source,
    sourceRef: row.source_ref || '',
    metadata: json(row.metadata_json, {}),
    observedAt: Number(row.observed_at || 0),
    createdAt: Number(row.created_at || 0),
  };
}

export function recordAccountHealthObservation(observation = {}) {
  const type = String(observation.type || '');
  if (!ACCOUNT_HEALTH_OBSERVATION_TYPES.includes(type)) throw new Error(`Unsupported account health observation type: ${type || 'missing'}.`);
  const source = String(observation.source || '').trim();
  if (!source) throw new Error('Account health observation source is required.');
  const sourceRef = String(observation.sourceRef ?? observation.source_ref ?? '').trim();
  if (['visibility_label_observed', 'visibility_label_cleared', 'platform_challenge_observed', 'platform_restriction_observed'].includes(type) && !sourceRef) {
    throw new Error(`${type} requires sourceRef provenance.`);
  }
  const observedAt = Number(observation.observedAt ?? observation.observed_at ?? Date.now());
  if (!Number.isFinite(observedAt) || observedAt <= 0) throw new Error('Account health observation observedAt must be a positive timestamp.');
  const metadata = observation.metadata && typeof observation.metadata === 'object' && !Array.isArray(observation.metadata)
    ? observation.metadata
    : {};
  const inserted = db.prepare(`INSERT INTO account_health_observations(
    type, severity, source, source_ref, metadata_json, observed_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    type,
    String(observation.severity || 'info'),
    source,
    sourceRef,
    JSON.stringify(metadata),
    observedAt,
    Date.now(),
  );
  return decodeAccountHealthObservation(db.prepare('SELECT * FROM account_health_observations WHERE id = ?').get(Number(inserted.lastInsertRowid)));
}

export function listAccountHealthObservations({ type, limit = 100 } = {}) {
  if (type && !ACCOUNT_HEALTH_OBSERVATION_TYPES.includes(type)) throw new Error(`Unsupported account health observation type: ${type}.`);
  const bounded = Math.max(1, Math.min(1000, Number(limit || 100)));
  const rows = type
    ? db.prepare('SELECT * FROM account_health_observations WHERE type = ? ORDER BY observed_at DESC, id DESC LIMIT ?').all(type, bounded)
    : db.prepare('SELECT * FROM account_health_observations ORDER BY observed_at DESC, id DESC LIMIT ?').all(bounded);
  return rows.map(decodeAccountHealthObservation);
}

export function getLatestHealthObservation(type = null) {
  if (type && !ACCOUNT_HEALTH_OBSERVATION_TYPES.includes(type)) throw new Error(`Unsupported account health observation type: ${type}.`);
  const row = type
    ? db.prepare('SELECT * FROM account_health_observations WHERE type = ? ORDER BY observed_at DESC, id DESC LIMIT 1').get(type)
    : db.prepare('SELECT * FROM account_health_observations ORDER BY observed_at DESC, id DESC LIMIT 1').get();
  return decodeAccountHealthObservation(row);
}

export function recordUnderTheHoodSnapshot(report) {
  if (report?.available !== true) return null;
  return recordAccountHealthObservation({
    type: 'under_the_hood_snapshot',
    severity: 'info',
    source: 'x_under_the_hood',
    sourceRef: 'https://x.com/i/under_the_hood',
    observedAt: Number(report.capturedAt || Date.now()),
    metadata: {
      accountLabels: Array.isArray(report.accountLabels) ? report.accountLabels : [],
      postLabels: Array.isArray(report.postLabels) ? report.postLabels : [],
      period: report.period ?? null,
      rawSummary: report.rawSummary && typeof report.rawSummary === 'object' ? report.rawSummary : {},
    },
  });
}

export function listRecentPublishedReplies({ targetUsername = null, topic = null, since = null, limit = 30 } = {}) {
  const bounded = Math.max(1, Math.min(200, Number(limit || 30)));
  const sinceTimestamp = since == null ? 0 : Number(since);
  if (!Number.isFinite(sinceTimestamp) || sinceTimestamp < 0) throw new Error('Recent reply since must be a non-negative timestamp.');
  const rows = db.prepare(`SELECT a.commentary AS text, a.created_at,
      q.target_username, q.reply_archetype,
      (SELECT r.topic FROM relationship_events r
        WHERE r.candidate_key = a.candidate_key AND r.event_type = 'our_reply'
        ORDER BY r.occurred_at DESC, r.id DESC LIMIT 1) AS topic
    FROM candidate_actions a LEFT JOIN queue_items q ON q.candidate_key = a.candidate_key
    WHERE a.action = 'reply' AND a.created_at >= ? AND TRIM(COALESCE(a.commentary, '')) <> ''
    ORDER BY a.created_at DESC LIMIT ?`).all(sinceTimestamp, Math.max(bounded, 100));
  const usernameFilter = targetUsername ? normalizeRelationshipUsername(targetUsername) : null;
  const topicFilter = topic ? String(topic).trim().toLowerCase() : null;
  return rows
    .map((row) => ({
      text: row.text || '',
      targetUsername: normalizeRelationshipUsername(row.target_username),
      archetype: row.reply_archetype || '',
      topic: String(row.topic || '').trim().toLowerCase(),
      createdAt: Number(row.created_at || 0),
    }))
    .filter((reply) => (!usernameFilter || reply.targetUsername === usernameFilter) && (!topicFilter || reply.topic === topicFilter))
    .slice(0, bounded);
}

function recentRelationshipEvents(since, limit = 5000) {
  return db.prepare('SELECT * FROM relationship_events WHERE occurred_at >= ? ORDER BY occurred_at ASC, id ASC LIMIT ?')
    .all(Number(since || 0), Math.max(1, Math.min(5000, Number(limit || 5000))))
    .map(decodeRelationshipEvent);
}

function meaningfulHealthEvent(event) {
  return event?.metadata?.meaningful !== false;
}

function currentUnderTheHoodEvidence(observations) {
  const latest = observations.find((observation) => observation.type === 'under_the_hood_snapshot') || null;
  if (!latest) return [];
  const labels = [
    ...(Array.isArray(latest.metadata?.accountLabels) ? latest.metadata.accountLabels : []),
    ...(Array.isArray(latest.metadata?.postLabels) ? latest.metadata.postLabels : []),
  ];
  return labels.filter((label) => String(label?.label || '').trim()).map((label) => ({
    type: 'visibility_label_observed',
    source: latest.source,
    sourceRef: latest.sourceRef,
    observedAt: latest.observedAt,
    metadata: {
      label: String(label.label),
      about: label.about || '',
      effect: label.effect || '',
      underTheHoodSnapshotId: latest.id,
    },
  }));
}

function countRecentRecurringTransitions(since) {
  const events = db.prepare(`SELECT username, source_tweet_id, candidate_key, occurred_at, metadata_json
    FROM relationship_events WHERE event_type = 'conversation_continued'
    ORDER BY occurred_at ASC, id ASC LIMIT 5000`).all();
  const byUser = new Map();
  let count = 0;
  for (const row of events) {
    if (json(row.metadata_json, {}).meaningful === false) continue;
    const username = normalizeRelationshipUsername(row.username);
    const key = String(row.source_tweet_id || row.candidate_key || row.occurred_at || '');
    const state = byUser.get(username) || { keys: new Set(), reached: false };
    state.keys.add(key);
    if (!state.reached && state.keys.size >= 2) {
      state.reached = true;
      if (Number(row.occurred_at || 0) >= since) count++;
    }
    byUser.set(username, state);
  }
  return count;
}

export function getAccountHealthSummary({ now = Date.now() } = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Account health summary now must be numeric.');
  const sevenDaysAgo = timestamp - 7 * 24 * 3_600_000;
  const thirtyDaysAgo = timestamp - 30 * 24 * 3_600_000;
  const observations = listAccountHealthObservations({ limit: 200 });
  const effectiveObservations = [
    ...observations.filter((observation) => observation.type !== 'under_the_hood_snapshot'),
    ...currentUnderTheHoodEvidence(observations),
  ];
  const profiles = listRelationshipProfiles({ minTargetScore: 0, limit: 1000 });
  const events30d = recentRelationshipEvents(thirtyDaysAgo);
  const events7d = events30d.filter((event) => event.occurredAt >= sevenDaysAgo);
  const eventsByUsername = new Map();
  for (const event of events30d) {
    const current = eventsByUsername.get(event.username) || [];
    current.push(event);
    eventsByUsername.set(event.username, current);
  }
  const saturationTargets = profiles
    .map((profile) => {
      const events = eventsByUsername.get(profile.username) || [];
      if (!events.length && Number(profile.meaningfulInteractions || 0) === 0) return null;
      return { username: profile.username, ...calculateSaturationPressure(profile, events, { now: timestamp }) };
    })
    .filter(Boolean)
    .sort((left, right) => right.pressure - left.pressure || left.username.localeCompare(right.username));
  const saturationDistribution = { low: 0, mild: 0, meaningful: 0, high: 0 };
  for (const target of saturationTargets) saturationDistribution[target.band]++;

  const networkQuality = summarizeNetworkQuality(profiles, events30d);
  const recentReplies = listRecentPublishedReplies({ since: sevenDaysAgo, limit: 50 });
  const repetition = analyzeReplyRepetition(recentReplies);
  const meaningfulOutbound30d = events30d.filter((event) => ['our_reply', 'our_quote'].includes(event.eventType) && meaningfulHealthEvent(event));
  const responseEvents30d = events30d.filter((event) => ['target_reply', 'target_quote', 'target_repost'].includes(event.eventType) && meaningfulHealthEvent(event));
  const interactionYield = calculateInteractionYield({
    authorResponses: responseEvents30d.length,
    continuedConversations: events30d.filter((event) => event.eventType === 'conversation_continued' && meaningfulHealthEvent(event)).length,
    newRecurringRelationships: countRecentRecurringTransitions(thirtyDaysAgo),
    relevantTargetFollows: new Set(events30d.filter((event) => event.eventType === 'target_follow').map((event) => event.username)).size,
    newMutualConnections: new Set(events30d.filter((event) => event.eventType === 'mutual_reached').map((event) => event.username)).size,
    meaningfulInteractions: meaningfulOutbound30d.length,
  });
  const topTargetUsername = networkQuality.components?.topTargetConcentration?.username || null;
  const topTargetActiveConversation = topTargetUsername
    ? saturationTargets.find((target) => target.username === topTargetUsername)?.overrideReasons?.includes('active_conversation') === true
    : false;
  const health = deriveAccountHealth({
    observations: effectiveObservations,
    relationshipSummary: networkQuality,
    engagementSummary: { saturationPressure: saturationTargets, topTargetActiveConversation },
    repetitionSummary: repetition,
  });

  return {
    generatedAt: timestamp,
    health,
    observations,
    latestObservation: observations[0] || null,
    latestUnderTheHood: observations.find((observation) => observation.type === 'under_the_hood_snapshot') || null,
    networkQuality,
    interactionYield,
    repetition,
    recentReplies,
    saturation: {
      distribution: saturationDistribution,
      targets: saturationTargets,
      highest: saturationTargets[0] || null,
    },
    interactionCounts: {
      meaningfulInteractions7d: events7d.filter((event) => ['our_reply', 'our_quote'].includes(event.eventType) && meaningfulHealthEvent(event)).length,
      meaningfulInteractions30d: meaningfulOutbound30d.length,
      authorResponses30d: responseEvents30d.length,
    },
    evidence: {
      hard: health.reasons
        .filter((reason) => reason.level === 'constrained')
        .map((reason) => ({ code: reason.code, evidence: reason.evidence, provenance: reason.provenance })),
      soft: ['saturation', 'repetition', 'network_quality', 'interaction_yield'],
    },
  };
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
    threadParts: json(row.thread_parts_json, []),
    editor: json(row.editor_json, {}),
    gates: json(row.gate_json, {}),
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
      thread_parts_json = ?, editor_json = ?, gate_json = ?, quality_score = ?, status = ?,
      scheduled_at = ?, published_tweet_id = ?, updated_at = ? WHERE id = ?`).run(
      draft.hook || '', draft.insight || '', draft.evidence || '', draft.action || '', draft.body || '',
      JSON.stringify(draft.threadParts || []), JSON.stringify(draft.editor || {}), JSON.stringify(draft.gates || {}),
      Number(draft.qualityScore || 0), draft.status || 'draft', draft.scheduledAt || null,
      draft.publishedTweetId || null, now, existing.id,
    );
    return getDraft(existing.id);
  }

  const result = db.prepare(`INSERT INTO drafts (
    candidate_key, hook, insight, evidence, action, body, thread_parts_json, editor_json, gate_json,
    quality_score, status, scheduled_at, published_tweet_id, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    draft.candidateKey, draft.hook || '', draft.insight || '', draft.evidence || '', draft.action || '',
    draft.body || '', JSON.stringify(draft.threadParts || []), JSON.stringify(draft.editor || {}), JSON.stringify(draft.gates || {}),
    Number(draft.qualityScore || 0), draft.status || 'draft', draft.scheduledAt || null,
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

export function listRecentPublishedContent({ kind = 'main', limit = 20, excludeCandidateKey = null } = {}) {
  const routeClause = kind === 'reply'
    ? `(q.pipeline = 'reply' OR ((q.pipeline IS NULL OR q.pipeline = 'triage')
        AND EXISTS (SELECT 1 FROM candidate_actions a WHERE a.candidate_key = d.candidate_key AND a.action = 'reply')
        AND NOT EXISTS (SELECT 1 FROM candidate_actions a WHERE a.candidate_key = d.candidate_key AND a.action IN ('direct', 'quote'))))`
    : `(q.pipeline IN ('original', 'quote', 'thread') OR ((q.pipeline IS NULL OR q.pipeline = 'triage')
        AND EXISTS (SELECT 1 FROM candidate_actions a WHERE a.candidate_key = d.candidate_key AND a.action IN ('direct', 'quote')))
        OR (q.pipeline IS NULL AND d.status = 'published'
          AND NOT EXISTS (SELECT 1 FROM candidate_actions a WHERE a.candidate_key = d.candidate_key)))`;
  const where = [routeClause, "(q.status = 'approved' OR d.status = 'published')"];
  const params = [];
  if (excludeCandidateKey) {
    where.push('d.candidate_key <> ?');
    params.push(excludeCandidateKey);
  }
  params.push(Math.max(1, Math.min(100, Number(limit || 20))));
  const rows = db.prepare(`SELECT d.*, q.pipeline AS queue_pipeline
    FROM drafts d LEFT JOIN queue_items q ON q.candidate_key = d.candidate_key
    WHERE ${where.join(' AND ')}
    ORDER BY MAX(d.updated_at, COALESCE(q.updated_at, 0)) DESC LIMIT ?`).all(...params);
  return rows.map((row) => {
    const draft = decodeDraft(row);
    const pipeline = row.queue_pipeline && row.queue_pipeline !== 'triage'
      ? row.queue_pipeline
      : (kind === 'reply' ? 'reply' : 'original');
    const text = pipeline === 'thread' ? String(draft.threadParts?.[0] || '') : String(draft.body || '');
    return { candidateKey: draft.candidateKey, pipeline, text };
  }).filter((item) => item.text.trim());
}

export function getNextReadyDraft(now = Date.now(), minScore = 40) {
  return decodeDraft(db.prepare(`SELECT d.* FROM drafts d
    LEFT JOIN queue_items q ON q.candidate_key = d.candidate_key
    WHERE d.status = 'ready' AND d.quality_score >= ? AND (d.scheduled_at IS NULL OR d.scheduled_at <= ?)
      AND (q.lane IS NULL OR q.lane = 'main')
    ORDER BY COALESCE(d.scheduled_at, d.updated_at) ASC LIMIT 1`).get(minScore, now));
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
