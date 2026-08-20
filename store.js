import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
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
import {
  normalizeContentMeasurement,
  summarizeContentCohort,
  summarizeExperiment,
  validateExperimentDefinition,
  validateVariantAssignment,
} from './experiments.js';
import {
  LEARNED_RULE_SCOPES,
  LEARNED_RULE_STATUSES,
  applyAcceptedLearnedRules,
  createExperimentLearnedRuleCandidate,
  reviewLearnedRules,
  transitionLearnedRule,
} from './learning.js';
import { classifyAudienceProfile } from './strategy.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const DB_FILE = path.resolve('.x-research.sqlite');
export const PUBLICATION_MEASUREMENT_WINDOWS = Object.freeze([15, 60, 360, 1440]);
export const ACCOUNT_HEALTH_OBSERVATION_TYPES = [
  'under_the_hood_snapshot',
  'visibility_label_observed',
  'visibility_label_cleared',
  'platform_challenge_observed',
  'platform_restriction_observed',
  'operator_note',
];
export const AI_RUNTIME_TYPES = Object.freeze(['direct_api', 'codex', 'opencode', 'opencode2', 'agy']);
export const AI_PROVIDER_KINDS = Object.freeze(['openai', 'openrouter', 'openai_compatible', 'runtime_managed']);
export const AI_PROTOCOLS = Object.freeze(['responses', 'chat_completions', 'runtime_native']);
export const AI_ROLES = Object.freeze(['continuous_scan', 'editorial_scan', 'editorial_final', 'writer']);
export const SOURCE_SNAPSHOT_KINDS = Object.freeze(['x_latest', 'x_momentum', 'github_trending', 'hn_top']);

const AI_RUNTIME_SET = new Set(AI_RUNTIME_TYPES);
const AI_PROVIDER_SET = new Set(AI_PROVIDER_KINDS);
const AI_PROTOCOL_SET = new Set(AI_PROTOCOLS);
const AI_ROLE_SET = new Set(AI_ROLES);
const AI_ATTEMPT_KIND_SET = new Set(['primary', 'fallback']);
const AI_RUN_STATUS_SET = new Set(['running', 'complete', 'failed']);
const AI_STRUCTURED_OUTPUT_STATE_SET = new Set(['supported', 'compatible_fallback', 'unknown', 'unsupported']);
const AI_PROFILE_SETTING_KEYS = new Set(['catalogPath', 'structuredOutput', 'httpReferer', 'appTitle']);
const SOURCE_SNAPSHOT_KIND_SET = new Set(SOURCE_SNAPSHOT_KINDS);
const EDITORIAL_RUN_STATUS_SET = new Set(['building', 'complete', 'failed']);
const RESEARCH_CLAIM_TYPE_SET = new Set(['announcement', 'capability', 'implementation', 'benchmark', 'performance', 'reliability', 'security', 'pricing', 'compatibility', 'other']);
const RESEARCH_EVIDENCE_STATUS_SET = new Set(['primary_supported', 'source_claim', 'contradicted', 'unresolved']);
const EDITORIAL_RECOMMENDATION_STATUS_SET = new Set(['suggested', 'selected', 'dismissed', 'superseded']);
const QUEUE_SOURCE_ROLE_SET = new Set(['primary', 'supporting']);
const DISCOVER_SNAPSHOT_PREFIX = 'discover_snapshot:';
const DISCOVER_REFRESH_STATUS_PREFIX = 'discover_refresh_status:';
const LEGACY_DISCOVER_KIND = Object.freeze({ x_latest: 'x', x_momentum: 'viral', github_trending: 'github', hn_top: 'hn' });

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
    first_seen_at INTEGER NOT NULL,
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
    measurement_baseline_at INTEGER,
    measurement_baseline_followers INTEGER,
    experiment_variant_id INTEGER,
    experiment_assigned_at INTEGER,
    experiment_assignment_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(candidate_key) REFERENCES candidates(key),
    FOREIGN KEY(draft_id) REFERENCES drafts(id)
  );

  CREATE TABLE IF NOT EXISTS publication_measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_item_id INTEGER NOT NULL,
    tweet_id TEXT NOT NULL,
    window_minutes INTEGER NOT NULL,
    baseline_at INTEGER NOT NULL,
    baseline_followers INTEGER NOT NULL,
    captured_at INTEGER NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    reposts INTEGER NOT NULL DEFAULT 0,
    replies INTEGER NOT NULL DEFAULT 0,
    followers INTEGER NOT NULL DEFAULT 0,
    follower_delta INTEGER NOT NULL DEFAULT 0,
    follows_per_1000_views REAL,
    replies_per_1000_views REAL,
    reposts_per_1000_views REAL,
    visible_engagement_per_1000_views REAL,
    views_per_hour REAL,
    attribution_confidence TEXT NOT NULL DEFAULT 'unknown',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE(queue_item_id, window_minutes)
  );

  CREATE TABLE IF NOT EXISTS experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    dimension TEXT NOT NULL,
    population_json TEXT NOT NULL DEFAULT '{}',
    primary_metric TEXT NOT NULL,
    secondary_metrics_json TEXT NOT NULL DEFAULT '[]',
    minimum_completed_per_variant INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    ended_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS experiment_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE(experiment_id, label),
    FOREIGN KEY(experiment_id) REFERENCES experiments(id)
  );

  CREATE TABLE IF NOT EXISTS learned_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    recommendation_json TEXT NOT NULL DEFAULT '{}',
    evidence_json TEXT NOT NULL DEFAULT '{}',
    evidence_state TEXT NOT NULL DEFAULT 'insufficient',
    adjustment REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'suggested',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    accepted_at INTEGER,
    retired_at INTEGER,
    UNIQUE(scope, key)
  );

  CREATE TABLE IF NOT EXISTS ai_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    runtime TEXT NOT NULL,
    provider_kind TEXT NOT NULL,
    base_url TEXT NOT NULL DEFAULT '',
    protocol TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    reasoning TEXT NOT NULL DEFAULT '',
    runtime_profile TEXT NOT NULL DEFAULT '',
    secret_ref TEXT NOT NULL DEFAULT '',
    settings_json TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_runtime_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    default_profile_id INTEGER,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(default_profile_id) REFERENCES ai_profiles(id)
  );

  CREATE TABLE IF NOT EXISTS ai_role_bindings (
    role TEXT PRIMARY KEY,
    primary_profile_id INTEGER,
    fallback_profile_id INTEGER,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(primary_profile_id) REFERENCES ai_profiles(id),
    FOREIGN KEY(fallback_profile_id) REFERENCES ai_profiles(id)
  );

  CREATE TABLE IF NOT EXISTS ai_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invocation_id TEXT NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 1,
    attempt_kind TEXT NOT NULL DEFAULT 'primary',
    role TEXT NOT NULL,
    profile_id INTEGER,
    runtime TEXT NOT NULL,
    provider_kind TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    reasoning TEXT NOT NULL DEFAULT '',
    fallback_profile_id INTEGER,
    fallback_used INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    error_code TEXT NOT NULL DEFAULT '',
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    duration_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd REAL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(profile_id) REFERENCES ai_profiles(id)
  );

  CREATE TABLE IF NOT EXISTS source_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_key TEXT NOT NULL,
    snapshot_kind TEXT NOT NULL,
    observed_at INTEGER NOT NULL,
    rank INTEGER,
    metrics_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(candidate_key) REFERENCES candidates(key),
    UNIQUE(candidate_key, snapshot_kind, observed_at)
  );

  CREATE TABLE IF NOT EXISTS editorial_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    objective TEXT NOT NULL,
    source_snapshot_json TEXT NOT NULL DEFAULT '{}',
    context_json TEXT NOT NULL DEFAULT '{}',
    scan_json TEXT NOT NULL DEFAULT '{}',
    ai_execution_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'building',
    error TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS research_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    editorial_run_id INTEGER NOT NULL,
    story_key TEXT NOT NULL,
    candidate_key TEXT,
    claim TEXT NOT NULL DEFAULT '',
    claim_type TEXT NOT NULL,
    status TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_family TEXT NOT NULL,
    requested_url TEXT NOT NULL,
    resolved_url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    observed_at INTEGER NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(editorial_run_id) REFERENCES editorial_runs(id)
  );

  CREATE TABLE IF NOT EXISTS editorial_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    editorial_run_id INTEGER NOT NULL,
    story_key TEXT NOT NULL,
    rank INTEGER NOT NULL,
    decision TEXT NOT NULL,
    pipeline TEXT NOT NULL DEFAULT '',
    objective TEXT NOT NULL,
    title TEXT NOT NULL,
    thesis TEXT NOT NULL DEFAULT '',
    why_now TEXT NOT NULL DEFAULT '',
    why_format TEXT NOT NULL DEFAULT '',
    desired_reader_outcome TEXT NOT NULL DEFAULT '',
    candidate_keys_json TEXT NOT NULL DEFAULT '[]',
    potentials_json TEXT NOT NULL DEFAULT '{}',
    authority_json TEXT NOT NULL DEFAULT '{}',
    profile_proof_json TEXT NOT NULL DEFAULT '{}',
    evidence_ids_json TEXT NOT NULL DEFAULT '[]',
    algorithm_evidence_json TEXT NOT NULL DEFAULT '[]',
    learned_context_json TEXT NOT NULL DEFAULT '{}',
    ai_execution_json TEXT NOT NULL DEFAULT '{}',
    risks_json TEXT NOT NULL DEFAULT '[]',
    alternatives_json TEXT NOT NULL DEFAULT '[]',
    research_questions_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'suggested',
    selected_at INTEGER,
    dismissed_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(editorial_run_id) REFERENCES editorial_runs(id)
  );

  CREATE TABLE IF NOT EXISTS queue_sources (
    queue_item_id INTEGER NOT NULL,
    candidate_key TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY(queue_item_id, candidate_key),
    FOREIGN KEY(queue_item_id) REFERENCES queue_items(id),
    FOREIGN KEY(candidate_key) REFERENCES candidates(key)
  );

  CREATE TABLE IF NOT EXISTS editorial_selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    editorial_recommendation_id INTEGER NOT NULL UNIQUE,
    queue_item_id INTEGER NOT NULL,
    selected_pipeline TEXT NOT NULL,
    selected_at INTEGER NOT NULL,
    FOREIGN KEY(editorial_recommendation_id) REFERENCES editorial_recommendations(id),
    FOREIGN KEY(queue_item_id) REFERENCES queue_items(id)
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
  CREATE INDEX IF NOT EXISTS idx_measurements_queue_window ON publication_measurements(queue_item_id, window_minutes);
  CREATE INDEX IF NOT EXISTS idx_measurements_captured ON publication_measurements(captured_at DESC);
  CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_variants_experiment ON experiment_variants(experiment_id, id);
  CREATE INDEX IF NOT EXISTS idx_learned_rules_status ON learned_rules(status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_learned_rules_scope ON learned_rules(scope, status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ai_profiles_enabled_updated ON ai_profiles(enabled, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ai_runs_started ON ai_runs(started_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_ai_runs_role_started ON ai_runs(role, started_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_ai_runs_profile_started ON ai_runs(profile_id, started_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_ai_runs_invocation_attempt ON ai_runs(invocation_id, attempt ASC);
  CREATE INDEX IF NOT EXISTS idx_source_observations_kind_time ON source_observations(snapshot_kind, observed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_source_observations_candidate_time ON source_observations(candidate_key, observed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_editorial_runs_objective_time ON editorial_runs(objective, created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_research_evidence_run_story ON research_evidence(editorial_run_id, story_key, id);
  CREATE INDEX IF NOT EXISTS idx_editorial_recommendations_run_rank ON editorial_recommendations(editorial_run_id, rank, id);
  CREATE INDEX IF NOT EXISTS idx_editorial_recommendations_objective_status ON editorial_recommendations(objective, status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_queue_sources_queue_role ON queue_sources(queue_item_id, role);
  CREATE INDEX IF NOT EXISTS idx_editorial_selections_queue_time ON editorial_selections(queue_item_id, selected_at DESC, id DESC);

  INSERT OR IGNORE INTO ai_runtime_settings(id, default_profile_id, updated_at) VALUES (1, NULL, 0);

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

const audienceColumns = new Set(db.prepare('PRAGMA table_info(audience_profiles)').all().map((row) => row.name));
if (!audienceColumns.has('first_seen_at')) {
  db.exec('ALTER TABLE audience_profiles ADD COLUMN first_seen_at INTEGER');
  db.exec('UPDATE audience_profiles SET first_seen_at = last_seen_at WHERE first_seen_at IS NULL');
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
  ['measurement_baseline_at', 'ALTER TABLE queue_items ADD COLUMN measurement_baseline_at INTEGER'],
  ['measurement_baseline_followers', 'ALTER TABLE queue_items ADD COLUMN measurement_baseline_followers INTEGER'],
  ['experiment_variant_id', 'ALTER TABLE queue_items ADD COLUMN experiment_variant_id INTEGER'],
  ['experiment_assigned_at', 'ALTER TABLE queue_items ADD COLUMN experiment_assigned_at INTEGER'],
  ['experiment_assignment_json', "ALTER TABLE queue_items ADD COLUMN experiment_assignment_json TEXT NOT NULL DEFAULT '{}'"],
]) {
  if (!queueColumns.has(name)) db.exec(sql);
}
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_queue_engagement_priority ON queue_items(lane, status, priority DESC, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_queue_engagement_source ON queue_items(target_tweet_id, engagement_kind, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_queue_main_schedule ON queue_items(lane, status, scheduled_at, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_queue_experiment_variant ON queue_items(experiment_variant_id, updated_at DESC);
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

export function listCandidates({ source, saved, viralOnly = false, withinHours, resolution, limit = 100 } = {}) {
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
  if (resolution === 'actionable') {
    where.push(`NOT EXISTS (
      SELECT 1 FROM candidate_actions a WHERE a.candidate_key = candidates.key
    )`);
    where.push(`NOT EXISTS (
      SELECT 1 FROM queue_items q
      WHERE q.candidate_key = candidates.key
        AND q.status <> 'triage'
    )`);
  } else if (resolution === 'handled') {
    where.push(`(
      EXISTS (SELECT 1 FROM candidate_actions a WHERE a.candidate_key = candidates.key)
      OR EXISTS (
        SELECT 1 FROM queue_items q
        WHERE q.candidate_key = candidates.key
          AND (q.status = 'published' OR q.published_at IS NOT NULL OR q.output_tweet_id IS NOT NULL)
      )
    )`);
  }
  const orderBy = resolution === 'handled'
    ? `COALESCE(
        (SELECT MAX(a.created_at) FROM candidate_actions a WHERE a.candidate_key = candidates.key),
        (SELECT MAX(q.published_at) FROM queue_items q WHERE q.candidate_key = candidates.key),
        candidates.updated_at
      ) DESC`
    : (viralOnly ? 'viral_score DESC, published_at DESC' : 'saved DESC, score DESC, updated_at DESC');
  const sql = `SELECT * FROM candidates ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${orderBy} LIMIT ?`;
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
    measurementBaselineAt: row.measurement_baseline_at == null ? null : Number(row.measurement_baseline_at),
    measurementBaselineFollowers: row.measurement_baseline_followers == null ? null : Number(row.measurement_baseline_followers),
    experimentVariantId: row.experiment_variant_id == null ? null : Number(row.experiment_variant_id),
    experimentAssignedAt: row.experiment_assigned_at == null ? null : Number(row.experiment_assigned_at),
    experimentAssignment: json(row.experiment_assignment_json, {}),
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
    publish_error = ?, published_at = ?, measurement_baseline_at = ?, measurement_baseline_followers = ?,
    experiment_variant_id = ?, experiment_assigned_at = ?,
    experiment_assignment_json = ?, updated_at = ?
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
    next.measurementBaselineAt ?? null,
    next.measurementBaselineFollowers ?? null,
    next.experimentVariantId ?? null,
    next.experimentAssignedAt ?? null,
    JSON.stringify(next.experimentAssignment || {}),
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

export function listPublishedMainFeedContent({ limit = 30 } = {}) {
  const bounded = Math.max(1, Math.min(100, Number(limit || 30)));
  const rows = db.prepare(`SELECT q.*, d.published_tweet_id AS draft_published_tweet_id,
      d.status AS draft_status, d.body AS draft_body, d.thread_parts_json AS draft_thread_parts_json,
      d.editor_json AS draft_editor_json
    FROM queue_items q
    LEFT JOIN drafts d ON d.id = q.draft_id OR (q.draft_id IS NULL AND d.candidate_key = q.candidate_key)
    WHERE q.lane IN ('main', 'main_feed')
      AND q.pipeline IN ('original', 'quote', 'thread')
      AND q.status = 'published'
      AND COALESCE(NULLIF(q.output_tweet_id, ''), NULLIF(d.published_tweet_id, '')) IS NOT NULL
    ORDER BY COALESCE(q.published_at, q.updated_at) DESC
    LIMIT ?`).all(bounded);
  const published = rows.map((row) => {
    const candidate = getCandidate(row.candidate_key);
    const threadParts = json(row.draft_thread_parts_json, []);
    const editor = json(row.draft_editor_json, {});
    return {
      candidateKey: row.candidate_key,
      pipeline: row.pipeline,
      status: 'published',
      published: true,
      publishedTweetId: String(row.output_tweet_id || row.draft_published_tweet_id || ''),
      outputTweetId: row.output_tweet_id || null,
      publishedAt: Number(row.published_at || row.updated_at || 0),
      text: row.pipeline === 'thread' ? String(threadParts[0] || '') : String(row.draft_body || ''),
      body: String(row.draft_body || ''),
      threadParts: Array.isArray(threadParts) ? threadParts : [],
      semanticAnchors: Array.isArray(editor.semanticAnchors) ? editor.semanticAnchors : [],
      topics: Array.isArray(candidate?.niche?.tags) ? candidate.niche.tags : [],
    };
  });
  const seen = new Set(published.map((item) => item.candidateKey));
  const legacy = db.prepare(`SELECT d.* FROM drafts d
    WHERE d.status = 'published' AND NULLIF(d.published_tweet_id, '') IS NOT NULL
    ORDER BY d.updated_at DESC LIMIT ?`).all(bounded);
  for (const row of legacy) {
    if (seen.has(row.candidate_key)) continue;
    const queueItem = getQueueItemByCandidate(row.candidate_key);
    if (queueItem && (!['main', 'main_feed'].includes(queueItem.lane) || !['original', 'quote', 'thread'].includes(queueItem.pipeline))) continue;
    const candidate = getCandidate(row.candidate_key);
    const threadParts = json(row.thread_parts_json, []);
    const editor = json(row.editor_json, {});
    const pipeline = queueItem?.pipeline && ['original', 'quote', 'thread'].includes(queueItem.pipeline) ? queueItem.pipeline : 'original';
    published.push({
      candidateKey: row.candidate_key,
      pipeline,
      status: 'published',
      published: true,
      publishedTweetId: String(row.published_tweet_id),
      outputTweetId: queueItem?.outputTweetId || null,
      publishedAt: Number(queueItem?.publishedAt || row.updated_at || 0),
      text: pipeline === 'thread' ? String(threadParts[0] || '') : String(row.body || ''),
      body: String(row.body || ''),
      threadParts: Array.isArray(threadParts) ? threadParts : [],
      semanticAnchors: Array.isArray(editor.semanticAnchors) ? editor.semanticAnchors : [],
      topics: Array.isArray(candidate?.niche?.tags) ? candidate.niche.tags : [],
    });
    seen.add(row.candidate_key);
  }
  return published.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, bounded);
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

export function replaceAudienceSnapshot({
  followers = [],
  following = [],
  observedAt = Date.now(),
  followersComplete = false,
  followingComplete = false,
} = {}) {
  const now = Number(observedAt);
  if (!Number.isFinite(now) || now <= 0) throw new Error('Audience snapshot observedAt must be a positive timestamp.');
  const merged = new Map();
  for (const profile of followers) merged.set(profile.username, { ...profile, followsYou: true, youFollow: false });
  for (const profile of following) {
    const existing = merged.get(profile.username) || {};
    merged.set(profile.username, { ...existing, ...profile, followsYou: Boolean(existing.followsYou), youFollow: true });
  }

  db.exec('BEGIN');
  try {
    if (followersComplete) db.prepare('UPDATE audience_profiles SET follows_you = 0').run();
    if (followingComplete) db.prepare('UPDATE audience_profiles SET you_follow = 0').run();
    const upsert = db.prepare(`INSERT INTO audience_profiles(
      username, display_name, bio, follows_you, you_follow, relevance_score, niche_tags, matched_keywords, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      display_name = excluded.display_name,
      bio = excluded.bio,
      follows_you = ${followersComplete ? 'excluded.follows_you' : 'MAX(audience_profiles.follows_you, excluded.follows_you)'},
      you_follow = ${followingComplete ? 'excluded.you_follow' : 'MAX(audience_profiles.you_follow, excluded.you_follow)'},
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
  // ponytail: Reclassify on read; persist fit buckets if full audience scans become a measured bottleneck.
  const classification = classifyAudienceProfile({
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
  });
  return {
    ...classification,
    followsYou: Boolean(row.follows_you),
    youFollow: Boolean(row.you_follow),
    firstSeenAt: Number(row.first_seen_at || row.last_seen_at || 0),
    lastSeenAt: Number(row.last_seen_at || 0),
  };
}

export function getAudienceProfile(username) {
  return decodeAudience(db.prepare('SELECT * FROM audience_profiles WHERE username = ? COLLATE NOCASE').get(String(username || '').replace(/^@/, '').toLowerCase()));
}

export function setAudienceFollowState(username, { youFollow } = {}) {
  const normalized = String(username || '').replace(/^@/, '').trim().toLowerCase();
  if (!normalized) throw new Error('Audience username is required.');
  if (typeof youFollow !== 'boolean') throw new Error('Audience youFollow state must be boolean.');
  const result = db.prepare('UPDATE audience_profiles SET you_follow = ?, last_seen_at = ? WHERE username = ? COLLATE NOCASE')
    .run(youFollow ? 1 : 0, Date.now(), normalized);
  if (!result.changes) throw new Error(`Audience profile not found: @${normalized}`);
  return getAudienceProfile(normalized);
}

export function listAudienceProfiles({ followsYou, youFollow, minScore = 0, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (followsYou != null) { where.push('follows_you = ?'); params.push(followsYou ? 1 : 0); }
  if (youFollow != null) { where.push('you_follow = ?'); params.push(youFollow ? 1 : 0); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM audience_profiles ${clause}`).all(...params)
    .map(decodeAudience)
    .filter((profile) => profile.relevanceScore >= Number(minScore || 0))
    .sort((left, right) => right.relevanceScore - left.relevanceScore || right.lastSeenAt - left.lastSeenAt || left.username.localeCompare(right.username))
    .slice(0, Number(limit || 100));
}

export function getAudienceSummary() {
  const profiles = db.prepare('SELECT * FROM audience_profiles').all().map(decodeAudience);
  return {
    followers: profiles.filter((profile) => profile.followsYou).length,
    following: profiles.filter((profile) => profile.youFollow).length,
    mutuals: profiles.filter((profile) => profile.followsYou && profile.youFollow).length,
    relevant_followers: profiles.filter((profile) => profile.followsYou && profile.relevanceScore >= 12).length,
    relevant_following: profiles.filter((profile) => profile.youFollow && profile.relevanceScore >= 12).length,
    target_accounts: profiles.filter((profile) => profile.youFollow && !profile.followsYou && profile.relevanceScore >= 12).length,
  };
}

export function getNewFollowerQuality({ since = 0, until = Date.now(), minScore = 12 } = {}) {
  const from = Number(since || 0);
  const to = Number(until);
  const threshold = Number(minScore);
  if (!Number.isFinite(from) || from < 0 || !Number.isFinite(to) || to < from) throw new Error('Invalid new-follower observation window.');
  if (!Number.isFinite(threshold)) throw new Error('New-follower minScore must be numeric.');
  const profiles = db.prepare(`SELECT * FROM audience_profiles
    WHERE follows_you = 1 AND first_seen_at > ? AND first_seen_at <= ?
    ORDER BY first_seen_at ASC, username ASC`).all(from, to).map(decodeAudience);
  const nicheAligned = profiles.filter((profile) => profile.relevanceScore >= threshold);
  return {
    since: from,
    until: to,
    newlyObservedFollowers: profiles.length,
    nicheAlignedNewFollowers: nicheAligned.length,
    alignmentRate: profiles.length ? nicheAligned.length / profiles.length : null,
    minRelevanceScore: threshold,
    profiles: profiles.map((profile) => ({ ...profile, nicheAligned: profile.relevanceScore >= threshold })),
    attribution: 'period_association_only',
  };
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

function getStoredRelationshipProfile(username) {
  return decodeRelationshipProfile(
    db.prepare('SELECT * FROM relationship_profiles WHERE username = ?').get(normalizeRelationshipUsername(username)),
  );
}

function relationshipNeedsAudienceRefresh(profile, audience) {
  if (!profile || !audience) return false;
  return Number(profile.relevanceScore || 0) !== Number(audience.relevanceScore || 0)
    || JSON.stringify(profile.primaryTopics || []) !== JSON.stringify(audience.nicheTags || [])
    || JSON.stringify(profile.matchedKeywords || []) !== JSON.stringify(audience.matchedKeywords || [])
    || Boolean(profile.followsYou) !== Boolean(audience.followsYou)
    || Boolean(profile.youFollow) !== Boolean(audience.youFollow);
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
  const stored = getStoredRelationshipProfile(username);
  if (!stored) return null;
  const audience = getAudienceProfile(stored.username);
  return relationshipNeedsAudienceRefresh(stored, audience)
    ? refreshRelationshipFromAudience(audience)
    : stored;
}

export function listRelationshipProfiles({ className, stage, minTargetScore = 0, limit = 100 } = {}) {
  if (className && !TARGET_CLASSES.includes(className)) throw new Error(`Invalid relationship class: ${className}`);
  if (stage && !RELATIONSHIP_STAGES.includes(stage)) throw new Error(`Invalid relationship stage: ${stage}`);
  const minScore = Number(minTargetScore || 0);
  const maxRows = Math.max(1, Math.min(1000, Number(limit || 100)));
  return db.prepare('SELECT username FROM relationship_profiles').all()
    .map((row) => getRelationshipProfile(row.username))
    .filter(Boolean)
    .filter((profile) => profile.targetScore >= minScore)
    .filter((profile) => !className || profile.classes.includes(className))
    .filter((profile) => !stage || profile.relationshipStage === stage)
    .sort((left, right) => right.targetScore - left.targetScore || right.lastScoredAt - left.lastScoredAt)
    .slice(0, maxRows);
}

export function getRelationshipSummary() {
  const profiles = db.prepare('SELECT username FROM relationship_profiles').all()
    .map((row) => getRelationshipProfile(row.username))
    .filter(Boolean);
  const stages = Object.fromEntries(RELATIONSHIP_STAGES.map((stage) => [stage, 0]));
  for (const profile of profiles) stages[profile.relationshipStage] += 1;
  const classes = Object.fromEntries(TARGET_CLASSES.map((className) => [className, 0]));
  for (const profile of profiles) {
    for (const className of profile.classes) classes[className] += 1;
  }
  return {
    total: profiles.length,
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
  const audience = getAudienceProfile(normalized);
  const input = audience ? {
    ...current,
    followsYou: audience.followsYou,
    youFollow: audience.youFollow,
    lastSeenAt: Math.max(Number(current.lastSeenAt || 0), Number(audience.lastSeenAt || 0)),
  } : current;
  return upsertRelationshipProfile(refreshRelationshipProfile(input, {
    events,
    authoritativeFollowState: Boolean(audience),
    learnedRules: listAcceptedLearnedRules({ limit: 500 }),
  }));
}

export function refreshRelationshipFromAudience(audienceProfile) {
  const username = normalizeRelationshipUsername(audienceProfile?.username);
  if (!username) throw new Error('audience relationship username is required.');
  const current = getStoredRelationshipProfile(username) || {};
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
    firstSeenAt: Number(audienceProfile.firstSeenAt || current.firstSeenAt || audienceProfile.lastSeenAt || Date.now()),
    lastSeenAt: Number(audienceProfile.lastSeenAt || current.lastSeenAt || Date.now()),
  };
  return upsertRelationshipProfile(refreshRelationshipProfile(input, {
    events,
    authoritativeFollowState: true,
    learnedRules: listAcceptedLearnedRules({ limit: 500 }),
  }));
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

function listHardAccountHealthObservations() {
  return db.prepare(`SELECT * FROM account_health_observations
    WHERE type IN ('visibility_label_observed', 'visibility_label_cleared', 'platform_challenge_observed', 'platform_restriction_observed')
    ORDER BY observed_at ASC, id ASC`).all().map(decodeAccountHealthObservation);
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
  const latestUnderTheHood = getLatestHealthObservation('under_the_hood_snapshot');
  const effectiveObservations = [
    ...listHardAccountHealthObservations(),
    ...currentUnderTheHoodEvidence(latestUnderTheHood ? [latestUnderTheHood] : []),
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
  const acceptedHealthRules = listAcceptedLearnedRules({ scope: 'health', limit: 500 });
  const saturationTargets = profiles
    .map((profile) => {
      const events = eventsByUsername.get(profile.username) || [];
      if (!events.length && Number(profile.meaningfulInteractions || 0) === 0) return null;
      const base = calculateSaturationPressure(profile, events, { now: timestamp });
      const learned = applyAcceptedLearnedRules(base.pressure, acceptedHealthRules, {
        targetUsername: profile.username,
        targetClass: profile.classes || [],
        relationshipStage: profile.relationshipStage || 'observed',
        topicTags: profile.primaryTopics || [],
        healthState: 'advisory',
      }, { adjustmentTarget: 'saturation_pressure', finalMin: 0, finalMax: 100 });
      return {
        username: profile.username,
        ...base,
        basePressure: base.pressure,
        pressure: learned.finalValue,
        band: learned.finalValue < 25 ? 'low' : learned.finalValue < 50 ? 'mild' : learned.finalValue < 75 ? 'meaningful' : 'high',
        learnedAdjustment: learned,
        explanation: learned.learnedAdjustment
          ? `${base.explanation} Accepted learned saturation adjustment ${learned.learnedAdjustment >= 0 ? '+' : ''}${learned.learnedAdjustment} yields ${learned.finalValue}/100.`
          : base.explanation,
      };
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
    latestUnderTheHood,
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

function decodePublicationMeasurement(row) {
  if (!row) return null;
  const metadata = json(row.metadata_json, {});
  return {
    id: Number(row.id),
    queueItemId: Number(row.queue_item_id),
    tweetId: row.tweet_id,
    windowMinutes: Number(row.window_minutes),
    baselineAt: Number(row.baseline_at),
    baselineFollowers: Number(row.baseline_followers),
    capturedAt: Number(row.captured_at),
    views: Number(row.views || 0),
    likes: Number(row.likes || 0),
    reposts: Number(row.reposts || 0),
    replies: Number(row.replies || 0),
    followers: Number(row.followers || 0),
    followerDelta: Number(row.follower_delta || 0),
    associatedFollowsPer1000Views: row.follows_per_1000_views == null ? null : Number(row.follows_per_1000_views),
    repliesPer1000Views: row.replies_per_1000_views == null ? null : Number(row.replies_per_1000_views),
    repostsPer1000Views: row.reposts_per_1000_views == null ? null : Number(row.reposts_per_1000_views),
    visibleEngagementPer1000Views: row.visible_engagement_per_1000_views == null ? null : Number(row.visible_engagement_per_1000_views),
    viewsPerHour: row.views_per_hour == null ? null : Number(row.views_per_hour),
    attributionConfidence: row.attribution_confidence || 'unknown',
    attribution: metadata.attributionInput || {},
    metadata,
  };
}

export function getPublicationMeasurements(queueItemId) {
  return db.prepare('SELECT * FROM publication_measurements WHERE queue_item_id = ? ORDER BY window_minutes ASC')
    .all(Number(queueItemId)).map(decodePublicationMeasurement);
}

function numericOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function editorialEvidenceSummary(recommendation) {
  const requestedIds = [...new Set((recommendation?.evidenceIds || []).map((value) => Number(value)).filter(Number.isFinite))];
  const rows = requestedIds
    .map((id) => getResearchEvidence(id))
    .filter((row) => row
      && row.editorialRunId === recommendation.editorialRunId
      && row.storyKey === recommendation.storyKey);
  const statusCounts = {};
  for (const row of rows) statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
  return {
    evidenceIds: requestedIds,
    resolvedEvidenceIds: rows.map((row) => row.id),
    statuses: Object.keys(statusCounts).sort(),
    statusCounts,
    sourceFamilies: [...new Set(rows.map((row) => row.sourceFamily).filter(Boolean))].sort(),
    claimTypes: [...new Set(rows.map((row) => row.claimType).filter(Boolean))].sort(),
  };
}

function editorialMechanismTags(recommendation) {
  return [...new Set((recommendation?.algorithmEvidence || []).map((entry) => (
    typeof entry === 'string' ? entry : entry?.tag
  )).map((value) => String(value || '').trim()).filter(Boolean))].sort();
}

function editorialLearningContext(provenance) {
  if (!provenance) return {};
  return {
    editorialObjective: provenance.objective || '',
    editorialStoryKey: provenance.storyKey || '',
    recommendedFormat: provenance.recommendedPipeline || '',
    selectedFormat: provenance.selectedPipeline || '',
    finalPublishedFormat: provenance.finalPublishedPipeline || '',
    editorialTopic: provenance.profileProof?.topic || '',
  };
}

export function getEditorialSelectionInForceAtPublication(queueItemId) {
  const queueItem = getQueueItem(Number(queueItemId));
  if (!queueItem?.publishedAt) return null;
  return decodeEditorialSelection(db.prepare(`SELECT * FROM editorial_selections
    WHERE queue_item_id = ? AND selected_at <= ?
    ORDER BY selected_at DESC, id DESC LIMIT 1`).get(queueItem.id, queueItem.publishedAt));
}

export function getPublicationEditorialProvenance(queueItemId) {
  const queueItem = getQueueItem(Number(queueItemId));
  if (!queueItem?.publishedAt) return null;
  const selection = getEditorialSelectionInForceAtPublication(queueItem.id);
  if (!selection) return null;
  const recommendation = getEditorialRecommendation(selection.editorialRecommendationId);
  if (!recommendation) {
    return {
      selectionId: selection.id,
      recommendationId: selection.editorialRecommendationId,
      selectedAt: selection.selectedAt,
      recommendedPipeline: null,
      selectedPipeline: selection.selectedPipeline,
      finalPublishedPipeline: queueItem.pipeline,
      unavailable: 'recommendation_missing',
      learningContext: {},
    };
  }
  const potentials = recommendation.potentials || {};
  const authority = recommendation.authority || {};
  const profileProof = recommendation.profileProof || {};
  const provenance = {
    selectionId: selection.id,
    recommendationId: recommendation.id,
    selectedAt: selection.selectedAt,
    objective: recommendation.objective,
    storyKey: recommendation.storyKey,
    recommendedPipeline: recommendation.pipeline,
    selectedPipeline: selection.selectedPipeline,
    finalPublishedPipeline: queueItem.pipeline,
    objectiveFit: numericOrNull(potentials.objectiveFit),
    storyPreResearchFit: numericOrNull(potentials.storyPreResearchFit),
    objectiveFitComponents: {
      reachPotential: numericOrNull(potentials.reachPotential),
      followPotential: numericOrNull(potentials.followPotential),
      conversationPotential: numericOrNull(potentials.conversationPotential),
      relationshipPotential: numericOrNull(potentials.relationshipPotential),
      authorityValue: numericOrNull(authority.value),
    },
    authority,
    profileProof,
    evidence: editorialEvidenceSummary(recommendation),
    algorithmEvidence: recommendation.algorithmEvidence || [],
    algorithmMechanismTags: editorialMechanismTags(recommendation),
  };
  return { ...provenance, learningContext: editorialLearningContext(provenance) };
}

export function listPublicationMeasurements({ windowMinutes = null, limit = 200 } = {}) {
  const bounded = Math.max(1, Math.min(2000, Number(limit || 200)));
  if (windowMinutes != null && !PUBLICATION_MEASUREMENT_WINDOWS.includes(Number(windowMinutes))) {
    throw new Error(`Unsupported publication measurement window: ${windowMinutes}.`);
  }
  const rows = windowMinutes == null
    ? db.prepare('SELECT * FROM publication_measurements ORDER BY captured_at DESC, id DESC LIMIT ?').all(bounded)
    : db.prepare('SELECT * FROM publication_measurements WHERE window_minutes = ? ORDER BY captured_at DESC, id DESC LIMIT ?').all(Number(windowMinutes), bounded);
  return rows.map(decodePublicationMeasurement);
}

function countOverlappingMainFeedPublications(queueItemId, baselineAt, capturedAt) {
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM queue_items
    WHERE id <> ? AND lane IN ('main', 'main_feed') AND status = 'published'
      AND published_at > ? AND published_at <= ?`).get(Number(queueItemId), Number(baselineAt), Number(capturedAt)).count || 0);
}

export function recordPublicationFollowerBaseline(queueItemId, { followers, capturedAt = Date.now() } = {}) {
  const queueItem = getQueueItem(Number(queueItemId));
  if (!queueItem || !['main', 'main_feed'].includes(queueItem.lane) || queueItem.status !== 'published' || !queueItem.publishedAt) {
    throw new Error('Publication follower baseline requires a published main-feed queue item.');
  }
  if (queueItem.measurementBaselineAt != null && queueItem.measurementBaselineFollowers != null) return queueItem;
  const timestamp = Number(capturedAt);
  const count = Number(followers);
  if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(count) || count < 0) {
    throw new Error('Publication follower baseline requires a positive capture timestamp and non-negative follower count.');
  }
  return saveQueueItem({ ...queueItem, measurementBaselineAt: timestamp, measurementBaselineFollowers: count });
}

export function getPublicationFollowerBaseline(queueItemId, { fallbackFollowers = null, fallbackAt = null } = {}) {
  const queueItem = getQueueItem(Number(queueItemId));
  if (!queueItem?.publishedAt) throw new Error(`Published queue item not found: ${queueItemId}`);
  if (queueItem.measurementBaselineAt != null && queueItem.measurementBaselineFollowers != null) {
    return {
      capturedAt: queueItem.measurementBaselineAt,
      followers: queueItem.measurementBaselineFollowers,
      source: 'queue_publication_baseline',
      delayMinutes: Math.max(0, (queueItem.measurementBaselineAt - queueItem.publishedAt) / 60_000),
    };
  }
  const existing = db.prepare(`SELECT baseline_at, baseline_followers FROM publication_measurements
    WHERE queue_item_id = ? ORDER BY window_minutes ASC LIMIT 1`).get(Number(queueItemId));
  if (existing) {
    return {
      capturedAt: Number(existing.baseline_at),
      followers: Number(existing.baseline_followers),
      source: 'publication_measurement',
      delayMinutes: Math.max(0, (Number(existing.baseline_at) - queueItem.publishedAt) / 60_000),
    };
  }
  const prior = db.prepare(`SELECT captured_at, followers FROM account_metrics
    WHERE captured_at <= ? ORDER BY captured_at DESC LIMIT 1`).get(queueItem.publishedAt);
  if (prior) return { capturedAt: Number(prior.captured_at), followers: Number(prior.followers), source: 'account_metrics_before_publish', delayMinutes: 0 };
  const after = db.prepare(`SELECT captured_at, followers FROM account_metrics
    WHERE captured_at > ? ORDER BY captured_at ASC LIMIT 1`).get(queueItem.publishedAt);
  if (after) {
    return {
      capturedAt: Number(after.captured_at),
      followers: Number(after.followers),
      source: 'account_metrics_after_publish',
      delayMinutes: Math.max(0, (Number(after.captured_at) - queueItem.publishedAt) / 60_000),
    };
  }
  const followers = Number(fallbackFollowers);
  const capturedAt = Number(fallbackAt);
  if (!Number.isFinite(followers) || !Number.isFinite(capturedAt)) throw new Error(`Follower baseline unavailable for queue item ${queueItemId}.`);
  return {
    capturedAt,
    followers,
    source: 'capture_fallback',
    delayMinutes: Math.max(0, (capturedAt - queueItem.publishedAt) / 60_000),
  };
}

export function recordPublicationMeasurement(measurement = {}) {
  const queueItem = getQueueItem(Number(measurement.queueItemId));
  if (!queueItem || !['main', 'main_feed'].includes(queueItem.lane) || queueItem.status !== 'published' || !queueItem.publishedAt) {
    throw new Error('Publication measurements require a published main-feed queue item.');
  }
  const windowMinutes = Number(measurement.windowMinutes);
  if (!PUBLICATION_MEASUREMENT_WINDOWS.includes(windowMinutes)) throw new Error(`Unsupported publication measurement window: ${windowMinutes}.`);
  const capturedAt = Number(measurement.capturedAt);
  const baselineAt = Number(measurement.baselineAt);
  const baselineFollowers = Number(measurement.baselineFollowers);
  const followers = Number(measurement.followers);
  if (![capturedAt, baselineAt, baselineFollowers, followers].every(Number.isFinite)) throw new Error('Publication measurement timestamps/follower counts must be numeric.');
  if (baselineAt > capturedAt) throw new Error('Publication follower baseline cannot be after capture.');
  if (baselineFollowers < 0 || followers < 0) throw new Error('Publication follower counts cannot be negative.');
  if (capturedAt < queueItem.publishedAt + windowMinutes * 60_000) throw new Error('Publication measurement capture is earlier than its target window.');
  const tweetId = String(measurement.tweetId || queueItem.outputTweetId || '').trim();
  if (!tweetId) throw new Error('Publication measurement requires a tweet ID.');
  if (queueItem.outputTweetId && tweetId !== String(queueItem.outputTweetId)) throw new Error('Publication measurement tweet ID does not match the published queue item.');
  const attributionInput = {
    overlappingMainFeedPublications: countOverlappingMainFeedPublications(queueItem.id, baselineAt, capturedAt),
    ...(measurement.attribution || {}),
  };
  const followerDelta = followers - baselineFollowers;
  const normalized = normalizeContentMeasurement({
    views: Number(measurement.views || 0), likes: Number(measurement.likes || 0),
    reposts: Number(measurement.reposts || 0), replies: Number(measurement.replies || 0),
    followerDelta, capturedAt, publishedAt: queueItem.publishedAt, attribution: attributionInput,
  });
  const suppliedMetadata = { ...(measurement.metadata || {}) };
  delete suppliedMetadata.editorial;
  const editorial = getPublicationEditorialProvenance(queueItem.id);
  const metadata = {
    ...suppliedMetadata,
    attributionInput,
    associatedFollowerDelta: true,
    causalClaimAllowed: false,
    ...(editorial ? { editorial } : {}),
  };
  db.prepare(`INSERT OR IGNORE INTO publication_measurements(
    queue_item_id, tweet_id, window_minutes, baseline_at, baseline_followers, captured_at,
    views, likes, reposts, replies, followers, follower_delta, follows_per_1000_views,
    replies_per_1000_views, reposts_per_1000_views, visible_engagement_per_1000_views,
    views_per_hour, attribution_confidence, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    queueItem.id, tweetId, windowMinutes, baselineAt, baselineFollowers, capturedAt,
    normalized.raw.views, normalized.raw.likes, normalized.raw.reposts, normalized.raw.replies,
    followers, followerDelta, normalized.metrics.associated_follows_per_1000_views,
    normalized.metrics.replies_per_1000_views, normalized.metrics.reposts_per_1000_views,
    normalized.metrics.visible_engagement_per_1000_views, normalized.metrics.views_per_hour,
    normalized.attribution.confidence || 'unknown', JSON.stringify(metadata),
  );
  return decodePublicationMeasurement(db.prepare(`SELECT * FROM publication_measurements
    WHERE queue_item_id = ? AND window_minutes = ?`).get(queueItem.id, windowMinutes));
}

export function listDueMeasurementWindows(now = Date.now()) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Measurement due-window timestamp must be numeric.');
  const published = db.prepare(`SELECT * FROM queue_items
    WHERE lane IN ('main', 'main_feed') AND status = 'published'
      AND published_at IS NOT NULL AND output_tweet_id IS NOT NULL
    ORDER BY published_at ASC, id ASC`).all().map(decodeQueueItem);
  const due = [];
  for (const queueItem of published) {
    const recorded = new Set(getPublicationMeasurements(queueItem.id).map((measurement) => measurement.windowMinutes));
    for (const windowMinutes of PUBLICATION_MEASUREMENT_WINDOWS) {
      const dueAt = queueItem.publishedAt + windowMinutes * 60_000;
      if (timestamp >= dueAt && !recorded.has(windowMinutes)) due.push({ queueItem, queueItemId: queueItem.id, tweetId: queueItem.outputTweetId, windowMinutes, dueAt });
    }
  }
  return due;
}

export function listPublicationMeasurementSeries({ limit = 30 } = {}) {
  const queueItems = db.prepare(`SELECT * FROM queue_items
    WHERE lane IN ('main', 'main_feed') AND status = 'published' AND published_at IS NOT NULL
    ORDER BY published_at DESC LIMIT ?`).all(Math.max(1, Math.min(200, Number(limit || 30)))).map(decodeQueueItem);
  return queueItems.map((queueItem) => ({
    queueItem,
    candidate: getCandidate(queueItem.candidateKey),
    measurements: getPublicationMeasurements(queueItem.id).map((measurement) => ({
      ...measurement,
      newFollowerQuality: getNewFollowerQuality({ since: measurement.baselineAt, until: measurement.capturedAt }),
    })),
  }));
}

function editorialOutcomeObservation(measurement) {
  const provenance = measurement?.metadata?.editorial;
  if (!provenance) return null;
  const queueItem = getQueueItem(measurement.queueItemId);
  if (!queueItem?.publishedAt) return null;
  const context = provenance.learningContext || editorialLearningContext(provenance);
  return {
    measurement: { ...measurement, publishedAt: queueItem.publishedAt },
    item: {
      ...context,
      format: provenance.finalPublishedPipeline || queueItem.pipeline || '',
      topic: context.editorialTopic || '',
      topicTags: context.editorialTopic ? [context.editorialTopic] : [],
    },
    context,
    confounders: context,
  };
}

function summarizeEditorialGroups(observations, key) {
  const groups = new Map();
  for (const observation of observations) {
    const label = String(observation?.context?.[key] || '').trim();
    if (!label) continue;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(observation);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, rows]) => ({ value, summary: summarizeContentCohort(rows) }));
}

export function getEditorialOutcomeSummary({ windowMinutes = 1440, limit = 200 } = {}) {
  const window = Number(windowMinutes);
  if (!PUBLICATION_MEASUREMENT_WINDOWS.includes(window)) throw new Error(`Unsupported editorial outcome window: ${windowMinutes}.`);
  const observations = listPublicationMeasurements({ windowMinutes: window, limit })
    .map(editorialOutcomeObservation)
    .filter(Boolean);
  if (!observations.length) return null;
  return {
    windowMinutes: window,
    observationCount: observations.length,
    byObjective: summarizeEditorialGroups(observations, 'editorialObjective'),
    byRecommendedPipeline: summarizeEditorialGroups(observations, 'recommendedFormat'),
    bySelectedPipeline: summarizeEditorialGroups(observations, 'selectedFormat'),
    byFinalPublishedPipeline: summarizeEditorialGroups(observations, 'finalPublishedFormat'),
    byTopic: summarizeEditorialGroups(observations, 'editorialTopic'),
    causalClaimAllowed: false,
  };
}

const EXPERIMENT_STATUSES = new Set(['draft', 'active', 'completed']);
const NETWORK_EXPERIMENT_DIMENSIONS = new Set([
  'target_class', 'target_score_bucket', 'target_size_bucket', 'reply_age_bucket',
  'conversation_saturation_bucket', 'reply_archetype', 'relationship_stage',
  'interaction_volume_bucket', 'target_concentration_bucket', 'archetype_repetition_bucket',
]);

function decodeExperiment(row) {
  if (!row) return null;
  const variants = db.prepare('SELECT * FROM experiment_variants WHERE experiment_id = ? ORDER BY id ASC').all(Number(row.id)).map((variant) => ({
    id: Number(variant.id), experimentId: Number(variant.experiment_id), label: variant.label, config: json(variant.config_json, {}),
  }));
  return {
    id: Number(row.id), name: row.name, hypothesis: row.hypothesis, dimension: row.dimension,
    population: json(row.population_json, {}), primaryMetric: row.primary_metric,
    secondaryMetrics: json(row.secondary_metrics_json, []), minimumCompletedPerVariant: Number(row.minimum_completed_per_variant),
    status: row.status, createdAt: Number(row.created_at), startedAt: row.started_at == null ? null : Number(row.started_at),
    endedAt: row.ended_at == null ? null : Number(row.ended_at), variants,
  };
}

export function getExperiment(id) {
  return decodeExperiment(db.prepare('SELECT * FROM experiments WHERE id = ?').get(Number(id)));
}

export function listExperiments({ status = null, limit = 100 } = {}) {
  if (status && !EXPERIMENT_STATUSES.has(status)) throw new Error(`Invalid experiment status: ${status}`);
  const bounded = Math.max(1, Math.min(500, Number(limit || 100)));
  const rows = status
    ? db.prepare('SELECT * FROM experiments WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT ?').all(status, bounded)
    : db.prepare('SELECT * FROM experiments ORDER BY created_at DESC, id DESC LIMIT ?').all(bounded);
  return rows.map(decodeExperiment);
}

export function createExperiment(definition = {}) {
  const validation = validateExperimentDefinition(definition);
  if (!validation.valid) throw new Error(`Invalid experiment: ${validation.errors.map((error) => error.message).join(' ')}`);
  const status = String(definition.status || 'draft');
  if (!EXPERIMENT_STATUSES.has(status)) throw new Error(`Invalid experiment status: ${status}`);
  const now = Date.now();
  db.exec('BEGIN');
  try {
    const inserted = db.prepare(`INSERT INTO experiments(
      name, hypothesis, dimension, population_json, primary_metric, secondary_metrics_json,
      minimum_completed_per_variant, status, created_at, started_at, ended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      validation.experiment.name, validation.experiment.hypothesis, validation.experiment.dimension,
      JSON.stringify(validation.experiment.population), validation.experiment.primaryMetric,
      JSON.stringify(validation.experiment.secondaryMetrics), validation.experiment.minimumCompletedPerVariant,
      status, now, status === 'active' ? now : null, status === 'completed' ? now : null,
    );
    const experimentId = Number(inserted.lastInsertRowid);
    const insertVariant = db.prepare('INSERT INTO experiment_variants(experiment_id, label, config_json) VALUES (?, ?, ?)');
    for (const variant of validation.experiment.variants) insertVariant.run(experimentId, variant.label, JSON.stringify(variant.config || {}));
    db.exec('COMMIT');
    return getExperiment(experimentId);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function setExperimentStatus(id, status) {
  const normalized = String(status || '');
  if (!EXPERIMENT_STATUSES.has(normalized)) throw new Error(`Invalid experiment status: ${normalized || 'missing'}`);
  const current = getExperiment(id);
  if (!current) throw new Error(`Experiment not found: ${id}`);
  if (current.status === normalized) return current;
  const allowed = (current.status === 'draft' && normalized === 'active')
    || (current.status === 'active' && normalized === 'completed');
  if (!allowed) throw new Error(`Invalid experiment status transition: ${current.status} -> ${normalized}`);
  const now = Date.now();
  db.prepare(`UPDATE experiments SET status = ?, started_at = CASE WHEN ? = 'active' THEN COALESCE(started_at, ?) ELSE started_at END,
    ended_at = CASE WHEN ? = 'completed' THEN ? ELSE NULL END WHERE id = ?`)
    .run(normalized, normalized, now, normalized, now, Number(id));
  return getExperiment(id);
}

function experimentDefinition(experiment) {
  return {
    name: experiment.name, hypothesis: experiment.hypothesis, dimension: experiment.dimension,
    population: experiment.population, primaryMetric: experiment.primaryMetric,
    secondaryMetrics: experiment.secondaryMetrics, minimumCompletedPerVariant: experiment.minimumCompletedPerVariant,
    variants: experiment.variants.map((variant) => ({ label: variant.label, config: variant.config })), status: experiment.status,
  };
}

function compactHealthContext(now) {
  const summary = getAccountHealthSummary({ now });
  const components = summary.networkQuality?.components || {};
  return {
    health: {
      state: summary.health.state,
      reasons: (summary.health.reasons || []).map((reason) => ({ code: reason.code, level: reason.level, evidence: reason.evidence })),
      generatedAt: summary.generatedAt,
    },
    networkContext: {
      targetDiversity: components.targetDiversity?.uniqueTargets ?? 0,
      classDiversity: components.classDiversity?.uniqueClasses ?? 0,
      topicDiversity: components.topicDiversity?.uniqueTopics ?? 0,
      topTargetConcentration: components.topTargetConcentration?.rate ?? null,
      interactionYield: summary.interactionYield?.value ?? null,
      interactionYieldComponents: summary.interactionYield?.components || {},
    },
  };
}

function assignmentItem(queueItem, context = {}) {
  const candidate = getCandidate(queueItem.candidateKey);
  const draft = queueItem.draftId ? getDraft(queueItem.draftId) : getDraftByCandidate(queueItem.candidateKey);
  const relationship = queueItem.targetUsername ? getRelationshipProfile(queueItem.targetUsername) : null;
  const editorial = queueItem.publishedAt ? getPublicationEditorialProvenance(queueItem.id) : null;
  const editorialContext = editorial?.learningContext || {};
  return {
    ...queueItem,
    format: queueItem.pipeline,
    mediaType: draft?.editor?.media?.type || 'none',
    topicTags: [...new Set([
      ...(candidate?.niche?.tags || []),
      ...(draft?.editor?.semanticAnchors || []),
      ...(relationship?.primaryTopics || []),
      ...(editorialContext.editorialTopic ? [editorialContext.editorialTopic] : []),
    ])],
    targetClass: relationship?.classes || [],
    relationshipStage: relationship?.relationshipStage || '',
    relationshipStageBefore: relationship?.relationshipStage || '',
    replyArchetype: queueItem.replyArchetype || '',
    targetUsername: queueItem.targetUsername || '',
    candidate, draft, relationship, editorial, ...context, ...editorialContext,
  };
}

export function assignExperimentVariant(candidateKey, experimentId, variantLabel, { context = {}, timingHistorySufficient = false, assignedAt = Date.now() } = {}) {
  const queueItem = getQueueItemByCandidate(candidateKey);
  if (!queueItem) throw new Error(`Queue item not found: ${candidateKey}`);
  const experiment = getExperiment(experimentId);
  if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);
  if (experiment.status !== 'active') throw new Error('Experiment assignment requires an active experiment.');
  if (queueItem.experimentVariantId != null) {
    const assigned = db.prepare('SELECT experiment_id, label FROM experiment_variants WHERE id = ?').get(Number(queueItem.experimentVariantId));
    if (assigned && Number(assigned.experiment_id) === experiment.id && String(assigned.label) === String(variantLabel)) return queueItem;
    throw new Error('Queue item already has an experiment assignment; each item supports one declared experiment assignment.');
  }
  if (!['triage', 'researching', 'watching', 'drafting'].includes(queueItem.status)) {
    throw new Error('Experiment assignment must happen before review, approval, or publication finalizes the treatment.');
  }
  const timestamp = Number(assignedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Experiment assignedAt must be a positive timestamp.');
  const profile = queueItem.targetUsername ? getRelationshipProfile(queueItem.targetUsername) : null;
  const assignmentContext = {
    relationshipStageBefore: profile?.relationshipStage || '',
    followsYouBefore: Boolean(profile?.followsYou),
    mutualBefore: Boolean(profile?.mutual),
    targetClass: profile?.classes || [],
    ...context,
  };
  const validation = validateVariantAssignment(experimentDefinition(experiment), variantLabel, assignmentItem(queueItem, assignmentContext), {
    ...assignmentContext, timingHistorySufficient: timingHistorySufficient === true,
  });
  if (!validation.valid) throw new Error(`Experiment assignment rejected: ${validation.errors.map((error) => error.message).join(' ')}`);
  const variant = experiment.variants.find((entry) => entry.label === variantLabel);
  return saveQueueItem({
    ...queueItem,
    experimentVariantId: variant.id,
    experimentAssignedAt: timestamp,
    experimentAssignment: {
      experimentId: experiment.id, variantLabel: variant.label, assignedAt: timestamp,
      assignmentPolicy: 'caller_selected', randomized: false, duplicatePairingRequired: false,
      context: assignmentContext, population: validation.population, ...compactHealthContext(timestamp),
    },
  });
}

export function listExperimentAssignments(experimentId) {
  return db.prepare(`SELECT q.*, v.label AS variant_label FROM queue_items q
    JOIN experiment_variants v ON v.id = q.experiment_variant_id
    WHERE v.experiment_id = ? ORDER BY q.experiment_assigned_at ASC, q.id ASC`).all(Number(experimentId)).map((row) => ({
    queueItem: decodeQueueItem(row), variantLabel: row.variant_label,
  }));
}

function contentObservationForAssignment(queueItem, variantLabel, windowMinutes) {
  const assignment = queueItem.experimentAssignment || {};
  const measurement = getPublicationMeasurements(queueItem.id).find((entry) => entry.windowMinutes === windowMinutes) || null;
  const editorialContext = measurement?.metadata?.editorial?.learningContext || {};
  const context = { ...(assignment.context || {}), ...editorialContext };
  return {
    variantLabel, completed: Boolean(measurement), item: assignmentItem(queueItem, context),
    context,
    measurement: measurement ? { ...measurement, publishedAt: queueItem.publishedAt } : null,
    health: measurement?.metadata?.health || assignment.health || null,
    networkContext: measurement?.metadata?.networkContext || assignment.networkContext || {},
    confounders: context,
  };
}

function networkObservationForAssignment(queueItem, variantLabel) {
  const assignment = queueItem.experimentAssignment || {};
  const editorialContext = getPublicationEditorialProvenance(queueItem.id)?.learningContext || {};
  const context = { ...(assignment.context || {}), ...editorialContext };
  const targetUsername = queueItem.targetUsername;
  const profile = targetUsername ? getRelationshipProfile(targetUsername) : null;
  const events = targetUsername ? allRelationshipEvents(targetUsername).filter((event) => event.occurredAt >= Number(queueItem.experimentAssignedAt || 0)) : [];
  const responses = queueItem.outputTweetId
    ? events.filter((event) => ['target_reply', 'target_quote', 'target_repost'].includes(event.eventType) && String(event.ourTweetId || '') === String(queueItem.outputTweetId))
    : [];
  const continued = events.some((event) => event.eventType === 'conversation_continued'
    || (event.eventType === 'our_reply' && event.metadata?.engagementKind === 'follow_up'));
  const beforeStage = String(context.relationshipStageBefore || '');
  const afterStage = String(profile?.relationshipStage || beforeStage);
  const beforeIndex = RELATIONSHIP_STAGES.indexOf(beforeStage);
  const afterIndex = RELATIONSHIP_STAGES.indexOf(afterStage);
  const completed = queueItem.status === 'published';
  return {
    variantLabel, completed, item: assignmentItem(queueItem, context), context,
    health: assignment.health || null, networkContext: assignment.networkContext || {}, confounders: context,
    network: {
      targetUsername, targetClass: context.targetClass || profile?.classes || [],
      topic: context.topic || getCandidate(queueItem.candidateKey)?.niche?.tags?.[0] || null,
      topicTags: context.topicTags || getCandidate(queueItem.candidateKey)?.niche?.tags || [],
      relationshipStageBefore: beforeStage,
      meaningfulInitialReplies: completed && queueItem.pipeline === 'reply' && queueItem.engagementKind === 'initial_reply' ? 1 : 0,
      authorResponses: responses.length ? 1 : 0,
      continuedConversations: continued ? 1 : 0,
      relationshipStageProgressions: beforeIndex >= 0 && afterIndex > beforeIndex ? 1 : 0,
      connectedTargetConversions: !['connected', 'mutual'].includes(beforeStage) && ['connected', 'mutual'].includes(afterStage) ? 1 : 0,
      newRecurringRelationships: beforeStage !== 'recurring' && afterStage === 'recurring' ? 1 : 0,
      relevantTargetFollows: context.followsYouBefore !== true && profile?.followsYou === true ? 1 : 0,
      newMutualConnections: context.mutualBefore !== true && profile?.mutual === true ? 1 : 0,
      meaningfulInteractions: completed ? 1 : 0,
      ...context,
    },
  };
}

export function getExperimentSummary(id, { windowMinutes = null } = {}) {
  const experiment = getExperiment(id);
  if (!experiment) throw new Error(`Experiment not found: ${id}`);
  const definition = experimentDefinition(experiment);
  const assignments = listExperimentAssignments(experiment.id);
  if (NETWORK_EXPERIMENT_DIMENSIONS.has(experiment.dimension)) {
    return {
      experiment, kind: 'network',
      summary: summarizeExperiment(definition, assignments.map(({ queueItem, variantLabel }) => networkObservationForAssignment(queueItem, variantLabel))),
    };
  }
  const summarizeWindow = (value) => summarizeExperiment(definition,
    assignments.map(({ queueItem, variantLabel }) => contentObservationForAssignment(queueItem, variantLabel, value)));
  if (windowMinutes != null) {
    const value = Number(windowMinutes);
    if (!PUBLICATION_MEASUREMENT_WINDOWS.includes(value)) throw new Error(`Unsupported experiment summary window: ${windowMinutes}.`);
    return { experiment, kind: 'content', windowMinutes: value, summary: summarizeWindow(value) };
  }
  return {
    experiment, kind: 'content',
    byWindow: Object.fromEntries(PUBLICATION_MEASUREMENT_WINDOWS.map((value) => [value, summarizeWindow(value)])),
  };
}

const LEARNED_SCOPE_SET = new Set(LEARNED_RULE_SCOPES);
const LEARNED_STATUS_SET = new Set(LEARNED_RULE_STATUSES);
const LEARNING_DIMENSION_DEFAULTS = Object.freeze({
  target_class: { scope: 'targeting', adjustmentTarget: 'target_score_component', adjustmentComponent: 'relationshipPotential', matchKey: 'targetClass' },
  target_score_bucket: { scope: 'targeting', adjustmentTarget: 'target_score_component', adjustmentComponent: 'relationshipPotential', matchKey: 'targetScoreBucket' },
  target_size_bucket: { scope: 'targeting', adjustmentTarget: 'target_score_component', adjustmentComponent: 'relationshipPotential', matchKey: 'targetSizeBucket' },
  relationship_stage: { scope: 'targeting', adjustmentTarget: 'target_score_component', adjustmentComponent: 'relationshipPotential', matchKey: 'relationshipStage' },
  reply_age_bucket: { scope: 'engagement', adjustmentTarget: 'engage_priority', adjustmentComponent: null, matchKey: 'replyAgeBucket' },
  reply_archetype: { scope: 'engagement', adjustmentTarget: 'engage_priority', adjustmentComponent: null, matchKey: 'replyArchetype' },
  conversation_saturation_bucket: { scope: 'health', adjustmentTarget: 'engage_priority', adjustmentComponent: null, matchKey: 'conversationSaturationBucket' },
  interaction_volume_bucket: { scope: 'health', adjustmentTarget: 'engage_priority', adjustmentComponent: null, matchKey: 'interactionVolumeBucket' },
  target_concentration_bucket: { scope: 'health', adjustmentTarget: 'engage_priority', adjustmentComponent: null, matchKey: 'targetConcentrationBucket' },
  archetype_repetition_bucket: { scope: 'health', adjustmentTarget: 'engage_priority', adjustmentComponent: null, matchKey: 'archetypeRepetitionBucket' },
  timing_bucket: { scope: 'timing', adjustmentTarget: 'scheduler_timing_preference', adjustmentComponent: null, matchKey: 'timingBucket' },
  format: { scope: 'format', adjustmentTarget: 'format_preference', adjustmentComponent: null, matchKey: 'format' },
  style: { scope: 'content', adjustmentTarget: 'content_preference', adjustmentComponent: null, matchKey: 'style' },
  hook_type: { scope: 'content', adjustmentTarget: 'content_preference', adjustmentComponent: null, matchKey: 'hookType' },
  media_type: { scope: 'content', adjustmentTarget: 'content_preference', adjustmentComponent: null, matchKey: 'mediaType' },
});

function decodeLearnedRule(row) {
  if (!row) return null;
  const recommendation = json(row.recommendation_json, {});
  const evidence = json(row.evidence_json, {});
  const proposed = Number(row.adjustment || 0);
  const status = row.status || 'suggested';
  const adjustment = {
    ...(recommendation.adjustment || {}),
    proposed,
    effective: status === 'accepted' ? proposed : 0,
    effectiveReason: status === 'accepted'
      ? 'explicitly_accepted'
      : status === 'retired'
        ? 'retired_rules_have_zero_production_effect'
        : 'suggested_rules_have_zero_production_effect',
  };
  return {
    id: Number(row.id),
    ruleId: recommendation.ruleId || `${row.scope}:${row.key}`,
    scope: row.scope,
    key: row.key,
    status,
    match: recommendation.match || {},
    finding: recommendation.finding || '',
    recommendation: recommendation.recommendation || '',
    primaryMetric: recommendation.primaryMetric || '',
    comparison: recommendation.comparison || null,
    evidence,
    adjustment,
    acceptance: recommendation.acceptance || { eligible: false, reasons: [] },
    mechanismTags: recommendation.mechanismTags || [],
    guardrails: recommendation.guardrails || {},
    source: recommendation.source || null,
    retirementReason: recommendation.retirementReason || '',
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
    acceptedAt: row.accepted_at == null ? null : Number(row.accepted_at),
    retiredAt: row.retired_at == null ? null : Number(row.retired_at),
  };
}

function encodeLearnedRecommendation(rule, source = rule.source || null) {
  return {
    ruleId: rule.ruleId || `${rule.scope}:${rule.key}`,
    match: rule.match || {},
    finding: rule.finding || '',
    recommendation: rule.recommendation || '',
    primaryMetric: rule.primaryMetric || '',
    comparison: rule.comparison || null,
    adjustment: rule.adjustment || {},
    acceptance: rule.acceptance || { eligible: false, reasons: [] },
    mechanismTags: rule.mechanismTags || [],
    guardrails: rule.guardrails || {},
    source,
    retirementReason: rule.retirementReason || '',
  };
}

export function getLearnedRule(id) {
  return decodeLearnedRule(db.prepare('SELECT * FROM learned_rules WHERE id = ?').get(Number(id)));
}

export function getLearnedRuleByKey(scope, key) {
  return decodeLearnedRule(db.prepare('SELECT * FROM learned_rules WHERE scope = ? AND key = ?').get(String(scope || ''), String(key || '')));
}

export function listLearnedRules({ status = null, scope = null, limit = 200 } = {}) {
  if (status && !LEARNED_STATUS_SET.has(status)) throw new Error(`Invalid learned-rule status: ${status}`);
  if (scope && !LEARNED_SCOPE_SET.has(scope)) throw new Error(`Invalid learned-rule scope: ${scope}`);
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (scope) { where.push('scope = ?'); params.push(scope); }
  params.push(Math.max(1, Math.min(1000, Number(limit || 200))));
  return db.prepare(`SELECT * FROM learned_rules ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC, id DESC LIMIT ?`).all(...params).map(decodeLearnedRule);
}

export function listAcceptedLearnedRules({ scope = null, limit = 500, includeSuspended = false } = {}) {
  const rules = listLearnedRules({ status: 'accepted', scope, limit });
  if (includeSuspended) return rules;
  const algorithmEvidence = listAlgorithmEvidenceEntries();
  return rules.filter((rule) => {
    const review = reviewLearnedRules([rule], {
      byRule: { [rule.ruleId]: currentReviewContext(rule) },
      algorithmEvidence,
    })[0];
    return review?.suspendEffect !== true;
  });
}

function persistLearnedRule(rule, { source = rule.source || null, allowAcceptedUpdate = false } = {}) {
  if (!rule || !LEARNED_SCOPE_SET.has(rule.scope) || !String(rule.key || '').trim()) throw new Error('A valid learned rule is required.');
  const existing = getLearnedRuleByKey(rule.scope, rule.key);
  if (existing && existing.status !== 'suggested' && !allowAcceptedUpdate) {
    return { rule: existing, updated: false, reason: `existing_${existing.status}_rule_preserved` };
  }
  const now = Date.now();
  const recommendation = JSON.stringify(encodeLearnedRecommendation(rule, source));
  const evidence = JSON.stringify(rule.evidence || {});
  const evidenceState = String(rule.evidence?.state || 'insufficient');
  const adjustment = Number(rule.adjustment?.proposed || 0);
  if (existing) {
    db.prepare(`UPDATE learned_rules SET recommendation_json = ?, evidence_json = ?, evidence_state = ?, adjustment = ?,
      status = ?, updated_at = ?, accepted_at = ?, retired_at = ? WHERE id = ?`).run(
      recommendation, evidence, evidenceState, adjustment, rule.status || existing.status, now,
      rule.acceptedAt ?? existing.acceptedAt ?? null, rule.retiredAt ?? existing.retiredAt ?? null, existing.id,
    );
    return { rule: getLearnedRule(existing.id), updated: true, reason: 'updated' };
  }
  const inserted = db.prepare(`INSERT INTO learned_rules(
    scope, key, recommendation_json, evidence_json, evidence_state, adjustment, status,
    created_at, updated_at, accepted_at, retired_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    rule.scope, rule.key, recommendation, evidence, evidenceState, adjustment, rule.status || 'suggested',
    now, now, rule.acceptedAt ?? null, rule.retiredAt ?? null,
  );
  return { rule: getLearnedRule(Number(inserted.lastInsertRowid)), updated: true, reason: 'created' };
}

function learningDefaultsForExperiment(experiment) {
  const defaults = LEARNING_DIMENSION_DEFAULTS[experiment?.dimension];
  if (!defaults) throw new Error(`No learned-strategy default exists for experiment dimension: ${experiment?.dimension || 'missing'}.`);
  return defaults;
}

function experimentSummaryForLearning(experiment, windowMinutes) {
  if (NETWORK_EXPERIMENT_DIMENSIONS.has(experiment.dimension)) return getExperimentSummary(experiment.id).summary;
  const value = Number(windowMinutes);
  if (!PUBLICATION_MEASUREMENT_WINDOWS.includes(value)) {
    throw new Error(`Content/timing learning requires an explicit measurement window: ${PUBLICATION_MEASUREMENT_WINDOWS.join(', ')} minutes.`);
  }
  return getExperimentSummary(experiment.id, { windowMinutes: value }).summary;
}

function buildExperimentLearningCandidate(input = {}) {
  const experiment = getExperiment(Number(input.experimentId));
  if (!experiment) throw new Error(`Experiment not found: ${input.experimentId}`);
  const baselineLabel = String(input.baselineLabel || '').trim();
  const comparisonLabel = String(input.comparisonLabel || '').trim();
  if (!baselineLabel || !comparisonLabel || baselineLabel === comparisonLabel) {
    throw new Error('Learning refresh requires distinct explicit baselineLabel and comparisonLabel values.');
  }
  const defaults = learningDefaultsForExperiment(experiment);
  const summary = experimentSummaryForLearning(experiment, input.windowMinutes);
  const scope = String(input.scope || defaults.scope);
  const adjustmentTarget = String(input.adjustmentTarget || defaults.adjustmentTarget);
  const adjustmentComponent = input.adjustmentComponent ?? defaults.adjustmentComponent;
  const key = String(input.key || `experiment:${experiment.id}:${experiment.dimension}:${comparisonLabel}`);
  const match = input.match && typeof input.match === 'object' && !Array.isArray(input.match)
    ? input.match
    : { [defaults.matchKey]: comparisonLabel };
  const candidate = createExperimentLearnedRuleCandidate(summary, {
    scope,
    key,
    baselineLabel,
    comparisonLabel,
    adjustmentTarget,
    ...(adjustmentComponent ? { adjustmentComponent } : {}),
    match,
    mechanismTags: Array.isArray(input.mechanismTags) ? input.mechanismTags : [],
    outlierDominated: input.outlierDominated === true,
    requiresBroadSupport: input.requiresBroadSupport === true,
    support: input.support,
    minimumSampleSize: input.minimumSampleSize,
    higherIsBetter: input.higherIsBetter,
    proposedAdjustment: input.proposedAdjustment,
  });
  const source = {
    kind: 'experiment',
    experimentId: experiment.id,
    dimension: experiment.dimension,
    windowMinutes: NETWORK_EXPERIMENT_DIMENSIONS.has(experiment.dimension) ? null : Number(input.windowMinutes),
    request: {
      scope,
      key,
      baselineLabel,
      comparisonLabel,
      adjustmentTarget,
      adjustmentComponent: adjustmentComponent || null,
      match,
      mechanismTags: Array.isArray(input.mechanismTags) ? input.mechanismTags : [],
      outlierDominated: input.outlierDominated === true,
      requiresBroadSupport: input.requiresBroadSupport === true,
      support: input.support || null,
      minimumSampleSize: input.minimumSampleSize ?? null,
      higherIsBetter: input.higherIsBetter,
      proposedAdjustment: input.proposedAdjustment,
    },
  };
  return { experiment, summary, candidate, source };
}

export function refreshLearnedRuleSuggestion(input = {}) {
  const built = buildExperimentLearningCandidate(input);
  if (!built.candidate.created) return { ...built, persisted: null };
  const rule = { ...built.candidate.rule, source: built.source };
  const persisted = persistLearnedRule(rule, { source: built.source });
  return { ...built, candidate: { ...built.candidate, rule }, persisted };
}

export function acceptLearnedRule(id, { at = Date.now() } = {}) {
  const current = getLearnedRule(id);
  if (!current) throw new Error(`Learned rule not found: ${id}`);
  const next = transitionLearnedRule(current, 'accepted', { at });
  return persistLearnedRule(next, { source: current.source, allowAcceptedUpdate: true }).rule;
}

export function retireLearnedRule(id, { at = Date.now(), reason = '' } = {}) {
  const current = getLearnedRule(id);
  if (!current) throw new Error(`Learned rule not found: ${id}`);
  const next = transitionLearnedRule(current, 'retired', { at, reason });
  return persistLearnedRule(next, { source: current.source, allowAcceptedUpdate: true }).rule;
}

function ledgerTag(title) {
  return String(title || '')
    .replace(/^\d+(?:\.\d+)*\s*/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function listAlgorithmEvidenceEntries() {
  try {
    const text = fs.readFileSync(path.join(MODULE_DIR, 'docs/ALGORITHM_EVIDENCE_LEDGER.md'), 'utf8');
    const headings = [...text.matchAll(/^###\s+(.+)$/gm)];
    return headings.map((match, index) => {
      const start = match.index + match[0].length;
      const end = index + 1 < headings.length ? headings[index + 1].index : text.length;
      const section = text.slice(start, end);
      const statusMatch = section.match(/\*\*Status:\*\*\s+`?([A-Z_]+)`?/);
      if (!statusMatch) return null;
      const title = match[1].trim();
      const tag = ledgerTag(title);
      return { id: tag, key: tag, tag, title, status: statusMatch[1], materiallyChanged: false };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function currentReviewContext(rule) {
  const source = rule.source;
  if (!source || source.kind !== 'experiment') return {};
  try {
    const request = source.request || {};
    const built = buildExperimentLearningCandidate({
      experimentId: source.experimentId,
      windowMinutes: source.windowMinutes,
      ...request,
    });
    if (!built.candidate.created) return { stale: true };
    return {
      newerRelevantObservations: Math.max(0, Number(built.candidate.rule.evidence?.sampleSize || 0) - Number(rule.evidence?.sampleSize || 0)),
      newerAdjustment: Number(built.candidate.rule.adjustment?.proposed || 0),
    };
  } catch {
    return { stale: true };
  }
}

export function getLearningOverview({ algorithmEvidence = null, limit = 500 } = {}) {
  const rules = listLearnedRules({ limit });
  const byRule = Object.fromEntries(rules.map((rule) => [rule.ruleId, currentReviewContext(rule)]));
  const evidenceEntries = Array.isArray(algorithmEvidence) ? algorithmEvidence : listAlgorithmEvidenceEntries();
  const reviews = reviewLearnedRules(rules, { byRule, algorithmEvidence: evidenceEntries });
  const reviewByRule = Object.fromEntries(reviews.map((review) => [review.ruleId, review]));
  return {
    rules: rules.map((rule) => ({ ...rule, review: reviewByRule[rule.ruleId] || null })),
    suggested: rules.filter((rule) => rule.status === 'suggested').length,
    accepted: rules.filter((rule) => rule.status === 'accepted').length,
    retired: rules.filter((rule) => rule.status === 'retired').length,
    algorithmEvidence: evidenceEntries,
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

export function deleteDraft(id) {
  db.prepare('DELETE FROM drafts WHERE id = ?').run(Number(id));
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

function requireSourceSnapshotKind(kind) {
  const value = String(kind || '');
  if (!SOURCE_SNAPSHOT_KIND_SET.has(value)) throw new Error(`Unsupported source snapshot kind: ${value || 'missing'}.`);
  return value;
}

function parseAppStateJson(key, fallback) {
  return json(getAppState(key, JSON.stringify(fallback)), fallback);
}

export function saveDiscoverSnapshot(kind, candidates = [], fetchedAt = Date.now()) {
  const snapshotKind = requireSourceSnapshotKind(kind);
  const timestamp = Number(fetchedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Discover snapshot fetchedAt must be a positive timestamp.');
  const keys = [...new Set((Array.isArray(candidates) ? candidates : []).map((candidate) => candidateKey(candidate)).filter(Boolean))];
  setAppState(`${DISCOVER_SNAPSHOT_PREFIX}${snapshotKind}`, JSON.stringify({ fetchedAt: timestamp, keys }));
  setAppState(`${DISCOVER_REFRESH_STATUS_PREFIX}${snapshotKind}`, JSON.stringify({ attemptedAt: timestamp, error: null }));
  return getDiscoverSnapshot(snapshotKind);
}

export function recordDiscoverSnapshotError(kind, error, attemptedAt = Date.now()) {
  const snapshotKind = requireSourceSnapshotKind(kind);
  const timestamp = Number(attemptedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Discover refresh attemptedAt must be a positive timestamp.');
  const message = String(error?.message || error || 'Source refresh failed.');
  setAppState(`${DISCOVER_REFRESH_STATUS_PREFIX}${snapshotKind}`, JSON.stringify({ attemptedAt: timestamp, error: message }));
  return { kind: snapshotKind, attemptedAt: timestamp, error: message };
}

export function getDiscoverSnapshot(kind) {
  const snapshotKind = requireSourceSnapshotKind(kind);
  const canonicalKey = `${DISCOVER_SNAPSHOT_PREFIX}${snapshotKind}`;
  let stored = parseAppStateJson(canonicalKey, null);
  let legacy = false;
  if (!stored || !Array.isArray(stored.keys)) {
    const legacyKind = LEGACY_DISCOVER_KIND[snapshotKind];
    stored = legacyKind ? parseAppStateJson(`${DISCOVER_SNAPSHOT_PREFIX}${legacyKind}`, null) : null;
    legacy = Boolean(stored && Array.isArray(stored.keys));
  }
  const status = parseAppStateJson(`${DISCOVER_REFRESH_STATUS_PREFIX}${snapshotKind}`, {});
  const keys = Array.isArray(stored?.keys) ? stored.keys : [];
  return {
    kind: snapshotKind,
    fetchedAt: Number(stored?.fetchedAt || 0) || null,
    candidates: keys.map((key) => getCandidate(key)).filter(Boolean),
    lastRefreshAttemptAt: Number(status?.attemptedAt || 0) || null,
    error: status?.error ? String(status.error) : null,
    legacyFallback: legacy,
  };
}

export function recordSourceObservations(observations = []) {
  const values = Array.isArray(observations) ? observations : [];
  if (!values.length) return [];
  const statement = db.prepare(`INSERT OR IGNORE INTO source_observations(
    candidate_key, snapshot_kind, observed_at, rank, metrics_json
  ) VALUES (?, ?, ?, ?, ?)`);
  const inserted = [];
  db.exec('BEGIN');
  try {
    for (const observation of values) {
      const key = String(observation?.candidateKey || '').trim();
      if (!key) throw new Error('Source observation candidateKey is required.');
      const snapshotKind = requireSourceSnapshotKind(observation.snapshotKind);
      const observedAt = Number(observation.observedAt);
      if (!Number.isFinite(observedAt) || observedAt <= 0) throw new Error('Source observation observedAt must be a positive timestamp.');
      const rank = observation.rank == null ? null : Number(observation.rank);
      if (rank != null && (!Number.isInteger(rank) || rank < 1)) throw new Error('Source observation rank must be a positive integer when supplied.');
      statement.run(key, snapshotKind, observedAt, rank, JSON.stringify(observation.metrics || {}));
      inserted.push({ candidateKey: key, snapshotKind, observedAt, rank, metrics: observation.metrics || {} });
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return inserted;
}

function decodeSourceObservation(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    candidateKey: row.candidate_key,
    snapshotKind: row.snapshot_kind,
    observedAt: Number(row.observed_at),
    rank: row.rank == null ? null : Number(row.rank),
    metrics: json(row.metrics_json, {}),
  };
}

function metricDelta(current, previous, key) {
  if (current?.[key] == null || previous?.[key] == null) return null;
  const left = Number(current[key]);
  const right = Number(previous[key]);
  return Number.isFinite(left) && Number.isFinite(right) ? left - right : null;
}

export function getSourceMomentum(candidateKeyValue, snapshotKindValue) {
  const candidateKeyText = String(candidateKeyValue || '').trim();
  const snapshotKind = requireSourceSnapshotKind(snapshotKindValue);
  const rows = db.prepare(`SELECT * FROM source_observations
    WHERE candidate_key = ? AND snapshot_kind = ?
    ORDER BY observed_at DESC, id DESC LIMIT 2`).all(candidateKeyText, snapshotKind).map(decodeSourceObservation);
  const current = rows[0] || null;
  const previous = rows[1] || null;
  if (!current) return { candidateKey: candidateKeyText, snapshotKind, current: null, previous: null, intervalMs: null, intervalHours: null, deltas: null, reason: 'no_observation' };
  if (!previous) return { candidateKey: candidateKeyText, snapshotKind, current, previous: null, intervalMs: null, intervalHours: null, deltas: null, reason: 'no_prior_observation' };
  const intervalMs = Math.max(0, current.observedAt - previous.observedAt);
  const intervalHours = intervalMs > 0 ? intervalMs / 3_600_000 : null;
  let deltas;
  if (snapshotKind === 'github_trending') {
    deltas = {
      rankMovement: current.rank != null && previous.rank != null ? previous.rank - current.rank : null,
      stars: metricDelta(current.metrics, previous.metrics, 'stars'),
      starsToday: metricDelta(current.metrics, previous.metrics, 'starsToday'),
    };
  } else if (snapshotKind === 'hn_top') {
    deltas = {
      rankMovement: current.rank != null && previous.rank != null ? previous.rank - current.rank : null,
      points: metricDelta(current.metrics, previous.metrics, 'points'),
      comments: metricDelta(current.metrics, previous.metrics, 'comments'),
    };
  } else {
    deltas = Object.fromEntries(['views', 'likes', 'reposts', 'replies'].map((key) => {
      const delta = metricDelta(current.metrics, previous.metrics, key);
      return [key, { delta, perHour: delta != null && intervalHours ? delta / intervalHours : null }];
    }));
  }
  return { candidateKey: candidateKeyText, snapshotKind, current, previous, intervalMs, intervalHours, deltas, reason: null };
}

function decodeEditorialRun(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    objective: row.objective,
    sourceSnapshot: json(row.source_snapshot_json, {}),
    context: json(row.context_json, {}),
    scan: json(row.scan_json, {}),
    aiExecution: json(row.ai_execution_json, {}),
    status: row.status,
    error: row.error || '',
    createdAt: Number(row.created_at),
    completedAt: row.completed_at == null ? null : Number(row.completed_at),
  };
}

export function createEditorialRun({ objective, sourceSnapshot = {}, context = {}, createdAt = Date.now() } = {}) {
  const selectedObjective = String(objective || '').trim();
  if (!selectedObjective) throw new Error('Editorial run objective is required.');
  const timestamp = Number(createdAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Editorial run createdAt must be a positive timestamp.');
  const result = db.prepare(`INSERT INTO editorial_runs(
    objective, source_snapshot_json, context_json, scan_json, ai_execution_json, status, error, created_at
  ) VALUES (?, ?, ?, '{}', '{}', 'building', '', ?)`).run(
    selectedObjective, JSON.stringify(sourceSnapshot || {}), JSON.stringify(context || {}), timestamp,
  );
  return getEditorialRun(Number(result.lastInsertRowid));
}

export function getEditorialRun(id) {
  return decodeEditorialRun(db.prepare('SELECT * FROM editorial_runs WHERE id = ?').get(Number(id)));
}

export function updateEditorialRun(id, changes = {}) {
  const current = getEditorialRun(id);
  if (!current) throw new Error(`Editorial run not found: ${id}`);
  const next = { ...current, ...changes };
  const status = String(next.status || 'building');
  if (!EDITORIAL_RUN_STATUS_SET.has(status)) throw new Error(`Unsupported editorial run status: ${status}.`);
  const completedAt = next.completedAt == null ? null : Number(next.completedAt);
  db.prepare(`UPDATE editorial_runs SET source_snapshot_json = ?, context_json = ?, scan_json = ?,
    ai_execution_json = ?, status = ?, error = ?, completed_at = ? WHERE id = ?`).run(
    JSON.stringify(next.sourceSnapshot || {}), JSON.stringify(next.context || {}), JSON.stringify(next.scan || {}),
    JSON.stringify(next.aiExecution || {}), status, String(next.error || ''), completedAt, current.id,
  );
  return getEditorialRun(current.id);
}

export function getLatestCompleteEditorialRun(objective) {
  const selectedObjective = String(objective || '').trim();
  return decodeEditorialRun(db.prepare(`SELECT * FROM editorial_runs
    WHERE objective = ? AND status = 'complete'
    ORDER BY completed_at DESC, id DESC LIMIT 1`).get(selectedObjective));
}

function decodeResearchEvidence(row) {
  if (!row) return null;
  return {
    id: Number(row.id), editorialRunId: Number(row.editorial_run_id), storyKey: row.story_key,
    candidateKey: row.candidate_key || null, claim: row.claim || '', claimType: row.claim_type,
    status: row.status, sourceKind: row.source_kind, sourceFamily: row.source_family,
    requestedUrl: row.requested_url, resolvedUrl: row.resolved_url, title: row.title || '', summary: row.summary || '',
    observedAt: Number(row.observed_at), metadata: json(row.metadata_json, {}),
  };
}

export function saveResearchEvidence(input = {}) {
  const runId = Number(input.editorialRunId);
  if (!getEditorialRun(runId)) throw new Error(`Editorial run not found: ${input.editorialRunId}`);
  const storyKey = String(input.storyKey || '').trim();
  if (!storyKey) throw new Error('Research evidence storyKey is required.');
  const claimType = String(input.claimType || 'other');
  if (!RESEARCH_CLAIM_TYPE_SET.has(claimType)) throw new Error(`Unsupported research claim type: ${claimType}.`);
  const status = String(input.status || 'unresolved');
  if (!RESEARCH_EVIDENCE_STATUS_SET.has(status)) throw new Error(`Unsupported research evidence status: ${status}.`);
  const sourceKind = String(input.sourceKind || '').trim();
  const sourceFamily = String(input.sourceFamily || '').trim();
  if (!sourceKind || !sourceFamily) throw new Error('Research evidence sourceKind and sourceFamily are required.');
  const observedAt = Number(input.observedAt || Date.now());
  const result = db.prepare(`INSERT INTO research_evidence(
    editorial_run_id, story_key, candidate_key, claim, claim_type, status, source_kind, source_family,
    requested_url, resolved_url, title, summary, observed_at, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    runId, storyKey, input.candidateKey || null, String(input.claim || ''), claimType, status, sourceKind, sourceFamily,
    String(input.requestedUrl || ''), String(input.resolvedUrl || input.requestedUrl || ''), String(input.title || ''),
    String(input.summary || ''), observedAt, JSON.stringify(input.metadata || {}),
  );
  return getResearchEvidence(Number(result.lastInsertRowid));
}

export function getResearchEvidence(id) {
  return decodeResearchEvidence(db.prepare('SELECT * FROM research_evidence WHERE id = ?').get(Number(id)));
}

export function listResearchEvidence({ editorialRunId, storyKey = null } = {}) {
  const where = [];
  const params = [];
  if (editorialRunId != null) { where.push('editorial_run_id = ?'); params.push(Number(editorialRunId)); }
  if (storyKey != null) { where.push('story_key = ?'); params.push(String(storyKey)); }
  return db.prepare(`SELECT * FROM research_evidence ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY id ASC`).all(...params).map(decodeResearchEvidence);
}

function decodeEditorialRecommendation(row) {
  if (!row) return null;
  const potentials = json(row.potentials_json, {});
  return {
    id: Number(row.id), editorialRunId: Number(row.editorial_run_id), storyKey: row.story_key, rank: Number(row.rank),
    decision: row.decision, pipeline: row.pipeline || null, objective: row.objective, title: row.title,
    thesis: row.thesis || '', whyNow: row.why_now || '', whyThisFormat: row.why_format || '',
    desiredReaderOutcome: row.desired_reader_outcome || '', candidateKeys: json(row.candidate_keys_json, []),
    potentials, targetCandidateKey: potentials.targetCandidateKey || null, authority: json(row.authority_json, {}),
    profileProof: json(row.profile_proof_json, {}), evidenceIds: json(row.evidence_ids_json, []),
    algorithmEvidence: json(row.algorithm_evidence_json, []), learnedContext: json(row.learned_context_json, {}),
    aiExecution: json(row.ai_execution_json, {}), risks: json(row.risks_json, []), alternatives: json(row.alternatives_json, []),
    researchQuestions: json(row.research_questions_json, []), status: row.status,
    selectedAt: row.selected_at == null ? null : Number(row.selected_at), dismissedAt: row.dismissed_at == null ? null : Number(row.dismissed_at),
    createdAt: Number(row.created_at),
  };
}

export function saveEditorialRecommendation(input = {}) {
  const runId = Number(input.editorialRunId);
  if (!getEditorialRun(runId)) throw new Error(`Editorial run not found: ${input.editorialRunId}`);
  const rank = Number(input.rank);
  if (!Number.isInteger(rank) || rank < 1) throw new Error('Editorial recommendation rank must be a positive integer.');
  const status = String(input.status || 'suggested');
  if (!EDITORIAL_RECOMMENDATION_STATUS_SET.has(status)) throw new Error(`Unsupported editorial recommendation status: ${status}.`);
  const potentials = { ...(input.potentials || {}), targetCandidateKey: input.targetCandidateKey || input.potentials?.targetCandidateKey || null };
  const result = db.prepare(`INSERT INTO editorial_recommendations(
    editorial_run_id, story_key, rank, decision, pipeline, objective, title, thesis, why_now, why_format,
    desired_reader_outcome, candidate_keys_json, potentials_json, authority_json, profile_proof_json,
    evidence_ids_json, algorithm_evidence_json, learned_context_json, ai_execution_json, risks_json,
    alternatives_json, research_questions_json, status, selected_at, dismissed_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    runId, String(input.storyKey || ''), rank, String(input.decision || ''), String(input.pipeline || ''), String(input.objective || ''),
    String(input.title || ''), String(input.thesis || ''), String(input.whyNow || ''), String(input.whyThisFormat || ''),
    String(input.desiredReaderOutcome || ''), JSON.stringify(input.candidateKeys || []), JSON.stringify(potentials),
    JSON.stringify(input.authority || {}), JSON.stringify(input.profileProof || {}), JSON.stringify(input.evidenceIds || []),
    JSON.stringify(input.algorithmEvidence || []), JSON.stringify(input.learnedContext || {}), JSON.stringify(input.aiExecution || {}),
    JSON.stringify(input.risks || []), JSON.stringify(input.alternatives || []), JSON.stringify(input.researchQuestions || []),
    status, input.selectedAt ?? null, input.dismissedAt ?? null, Number(input.createdAt || Date.now()),
  );
  return getEditorialRecommendation(Number(result.lastInsertRowid));
}

export function getEditorialRecommendation(id) {
  return decodeEditorialRecommendation(db.prepare('SELECT * FROM editorial_recommendations WHERE id = ?').get(Number(id)));
}

export function listEditorialRecommendations({ editorialRunId = null, objective = null, status = null, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (editorialRunId != null) { where.push('editorial_run_id = ?'); params.push(Number(editorialRunId)); }
  if (objective != null) { where.push('objective = ?'); params.push(String(objective)); }
  if (status != null) { where.push('status = ?'); params.push(String(status)); }
  params.push(Math.max(1, Math.min(500, Number(limit || 100))));
  return db.prepare(`SELECT * FROM editorial_recommendations ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY editorial_run_id DESC, rank ASC, id ASC LIMIT ?`).all(...params).map(decodeEditorialRecommendation);
}

export function setEditorialRecommendationStatus(id, status, { at = Date.now() } = {}) {
  const current = getEditorialRecommendation(id);
  if (!current) throw new Error(`Editorial recommendation not found: ${id}`);
  const nextStatus = String(status || '');
  if (!EDITORIAL_RECOMMENDATION_STATUS_SET.has(nextStatus)) throw new Error(`Unsupported editorial recommendation status: ${nextStatus}.`);
  if (current.status === nextStatus) return current;
  if (['selected', 'dismissed'].includes(current.status)) throw new Error(`Editorial recommendation ${id} is already ${current.status}.`);
  if (current.status === 'superseded') throw new Error(`Editorial recommendation ${id} is superseded and cannot transition to ${nextStatus}.`);
  const timestamp = Number(at);
  db.prepare(`UPDATE editorial_recommendations SET status = ?, selected_at = ?, dismissed_at = ? WHERE id = ?`).run(
    nextStatus,
    nextStatus === 'selected' ? timestamp : current.selectedAt,
    nextStatus === 'dismissed' ? timestamp : current.dismissedAt,
    current.id,
  );
  return getEditorialRecommendation(current.id);
}

export function supersedeSuggestedEditorialRecommendations(objective, { exceptRunId = null } = {}) {
  const params = [String(objective || '')];
  let exclusion = '';
  if (exceptRunId != null) { exclusion = ' AND editorial_run_id <> ?'; params.push(Number(exceptRunId)); }
  db.prepare(`UPDATE editorial_recommendations SET status = 'superseded'
    WHERE objective = ? AND status = 'suggested'${exclusion}`).run(...params);
}

export function getLatestEditorialPlan(objective) {
  const run = getLatestCompleteEditorialRun(objective);
  return run ? { run, recommendations: listEditorialRecommendations({ editorialRunId: run.id, limit: 10 }) } : null;
}

export function linkQueueSource(queueItemId, candidateKeyValue, role = 'supporting') {
  const queueItem = getQueueItem(queueItemId);
  if (!queueItem) throw new Error(`Queue item not found: ${queueItemId}`);
  const key = String(candidateKeyValue || '').trim();
  if (!getCandidate(key)) throw new Error(`Candidate not found: ${key}`);
  const sourceRole = String(role || 'supporting');
  if (!QUEUE_SOURCE_ROLE_SET.has(sourceRole)) throw new Error(`Unsupported queue source role: ${sourceRole}.`);
  if (sourceRole === 'primary') {
    const existingPrimary = db.prepare(`SELECT candidate_key FROM queue_sources WHERE queue_item_id = ? AND role = 'primary'`).get(queueItem.id);
    if (existingPrimary && existingPrimary.candidate_key !== key) throw new Error(`Queue item ${queueItem.id} already has primary source ${existingPrimary.candidate_key}.`);
  }
  db.prepare(`INSERT INTO queue_sources(queue_item_id, candidate_key, role) VALUES (?, ?, ?)
    ON CONFLICT(queue_item_id, candidate_key) DO UPDATE SET role = excluded.role`).run(queueItem.id, key, sourceRole);
  return listQueueSources(queueItem.id);
}

export function listQueueSources(queueItemId) {
  return db.prepare(`SELECT queue_item_id, candidate_key, role FROM queue_sources
    WHERE queue_item_id = ? ORDER BY CASE role WHEN 'primary' THEN 0 ELSE 1 END, candidate_key`).all(Number(queueItemId)).map((row) => ({
    queueItemId: Number(row.queue_item_id), candidateKey: row.candidate_key, role: row.role,
  }));
}

function decodeEditorialSelection(row) {
  return row ? {
    id: Number(row.id), editorialRecommendationId: Number(row.editorial_recommendation_id), queueItemId: Number(row.queue_item_id),
    selectedPipeline: row.selected_pipeline, selectedAt: Number(row.selected_at),
  } : null;
}

export function recordEditorialSelection({ editorialRecommendationId, queueItemId, selectedPipeline, selectedAt = Date.now() } = {}) {
  const recommendation = getEditorialRecommendation(editorialRecommendationId);
  if (!recommendation) throw new Error(`Editorial recommendation not found: ${editorialRecommendationId}`);
  if (!getQueueItem(queueItemId)) throw new Error(`Queue item not found: ${queueItemId}`);
  const existing = getEditorialSelectionByRecommendation(editorialRecommendationId);
  if (existing) return existing;
  db.prepare(`INSERT INTO editorial_selections(editorial_recommendation_id, queue_item_id, selected_pipeline, selected_at)
    VALUES (?, ?, ?, ?)`).run(Number(editorialRecommendationId), Number(queueItemId), String(selectedPipeline || ''), Number(selectedAt));
  return getEditorialSelectionByRecommendation(editorialRecommendationId);
}

export function getEditorialSelectionByRecommendation(editorialRecommendationId) {
  return decodeEditorialSelection(db.prepare('SELECT * FROM editorial_selections WHERE editorial_recommendation_id = ?').get(Number(editorialRecommendationId)));
}

export function getLatestEditorialSelectionForQueueItem(queueItemId) {
  return decodeEditorialSelection(db.prepare(`SELECT * FROM editorial_selections WHERE queue_item_id = ?
    ORDER BY selected_at DESC, id DESC LIMIT 1`).get(Number(queueItemId)));
}

export function ensureEditorialCandidate(recommendationId) {
  const recommendation = getEditorialRecommendation(recommendationId);
  if (!recommendation) throw new Error(`Editorial recommendation not found: ${recommendationId}`);
  const key = `editorial:${recommendation.id}`;
  const existing = getCandidate(key);
  if (existing) return existing;
  upsertCandidates([{
    key,
    source: 'editorial',
    title: recommendation.title,
    text: recommendation.thesis,
    url: key,
    score: Number(recommendation.potentials?.objectiveFit || 0),
    niche: { score: 0, tags: [], matches: [] },
    metrics: {},
    timestamp: recommendation.createdAt,
  }]);
  return getCandidate(key);
}

export function recordPerformanceSnapshot({ profile, posts = [], capturedAt = Date.now() }) {
  const timestamp = Number(capturedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Performance snapshot capturedAt must be a positive timestamp.');
  db.exec('BEGIN');
  try {
    if (profile) {
      db.prepare(`INSERT OR REPLACE INTO account_metrics(captured_at, followers, following, posts, likes)
        VALUES (?, ?, ?, ?, ?)`).run(
        timestamp,
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
        String(post.id), timestamp, post.text || '', Number(post.timestamp || 0) || null,
        Number(post.views || 0), Number(post.likes || 0), Number(post.retweets || 0), Number(post.replies || 0),
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return timestamp;
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

function requireAiEnum(value, allowed, label) {
  const normalized = String(value || '').trim();
  if (!allowed.has(normalized)) throw new Error(`Invalid ${label}: ${normalized || 'missing'}`);
  return normalized;
}

function normalizeAiProfileSettings(settings = {}) {
  if (settings == null) return {};
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('AI profile settings must be an object.');
  const normalized = {};
  for (const [key, value] of Object.entries(settings)) {
    if (!AI_PROFILE_SETTING_KEYS.has(key)) throw new Error(`Unsupported AI profile setting: ${key}`);
    if (key === 'catalogPath') {
      const pathValue = String(value || '').trim();
      if (!pathValue.startsWith('/')) throw new Error('AI catalogPath must start with /.');
      normalized.catalogPath = pathValue;
    } else if (key === 'structuredOutput') {
      const state = String(value || '').trim();
      if (!AI_STRUCTURED_OUTPUT_STATE_SET.has(state)) throw new Error(`Invalid AI structuredOutput state: ${state || 'missing'}`);
      normalized.structuredOutput = state;
    } else {
      normalized[key] = String(value || '').trim();
    }
  }
  return normalized;
}

function validateAiSecretRef(secretRef) {
  const value = String(secretRef || '').trim();
  if (!value) return '';
  if (/^file:[A-Za-z0-9._-]+$/.test(value)) return value;
  if (/^env:[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return value;
  throw new Error('AI secret_ref must be a file:<id> or env:<NAME> reference.');
}

function validateAiBaseUrl(baseUrl, { required = false } = {}) {
  const value = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!value) {
    if (required) throw new Error('AI baseUrl is required for openai_compatible profiles.');
    return '';
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('AI baseUrl must be a valid http(s) URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('AI baseUrl must use http or https.');
  return value;
}

function normalizeAiProfileInput(input = {}, current = null) {
  const merged = { ...(current || {}), ...(input || {}) };
  const name = String(merged.name || '').trim();
  if (!name) throw new Error('AI profile name is required.');
  const runtime = requireAiEnum(merged.runtime, AI_RUNTIME_SET, 'AI runtime');
  const providerKind = requireAiEnum(merged.providerKind, AI_PROVIDER_SET, 'AI provider kind');
  const protocol = requireAiEnum(merged.protocol, AI_PROTOCOL_SET, 'AI protocol');
  const isDirect = runtime === 'direct_api';
  if (isDirect && providerKind === 'runtime_managed') throw new Error('Direct API profiles require a direct provider kind.');
  if (!isDirect && providerKind !== 'runtime_managed') throw new Error(`${runtime} profiles must use provider_kind=runtime_managed.`);
  if (isDirect && protocol === 'runtime_native') throw new Error('Direct API profiles must use responses or chat_completions.');
  if (!isDirect && protocol !== 'runtime_native') throw new Error(`${runtime} profiles must use protocol=runtime_native.`);
  const model = String(merged.model || '').trim();
  if (!model) throw new Error('AI profile model is required; use "inherit" explicitly for runtime-managed inheritance.');
  if (isDirect && model === 'inherit') throw new Error('Direct API profiles require an explicit model ID.');
  const baseUrl = validateAiBaseUrl(merged.baseUrl, { required: isDirect && providerKind === 'openai_compatible' });
  const secretRef = validateAiSecretRef(merged.secretRef);
  if (isDirect && ['openai', 'openrouter'].includes(providerKind) && !secretRef) {
    throw new Error(`${providerKind} profiles require a secret_ref.`);
  }
  return {
    name,
    runtime,
    providerKind,
    baseUrl,
    protocol,
    model,
    reasoning: String(merged.reasoning || '').trim(),
    runtimeProfile: String(merged.runtimeProfile || '').trim(),
    secretRef,
    settings: normalizeAiProfileSettings(merged.settings || {}),
    enabled: merged.enabled !== false,
  };
}

function decodeAiProfile(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    runtime: row.runtime,
    providerKind: row.provider_kind,
    baseUrl: row.base_url,
    protocol: row.protocol,
    model: row.model,
    reasoning: row.reasoning,
    runtimeProfile: row.runtime_profile,
    secretRef: row.secret_ref,
    settings: json(row.settings_json, {}),
    enabled: Boolean(row.enabled),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function getAiProfile(id) {
  return decodeAiProfile(db.prepare('SELECT * FROM ai_profiles WHERE id = ?').get(Number(id)));
}

export function listAiProfiles({ enabled = null, limit = 200 } = {}) {
  const bounded = Math.max(1, Math.min(1000, Number(limit || 200)));
  if (enabled == null) {
    return db.prepare('SELECT * FROM ai_profiles ORDER BY enabled DESC, updated_at DESC, id DESC LIMIT ?').all(bounded).map(decodeAiProfile);
  }
  return db.prepare('SELECT * FROM ai_profiles WHERE enabled = ? ORDER BY updated_at DESC, id DESC LIMIT ?')
    .all(enabled ? 1 : 0, bounded).map(decodeAiProfile);
}

export function createAiProfile(profile = {}) {
  const normalized = normalizeAiProfileInput(profile);
  const now = Date.now();
  const inserted = db.prepare(`INSERT INTO ai_profiles(
    name, runtime, provider_kind, base_url, protocol, model, reasoning, runtime_profile,
    secret_ref, settings_json, enabled, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    normalized.name, normalized.runtime, normalized.providerKind, normalized.baseUrl, normalized.protocol,
    normalized.model, normalized.reasoning, normalized.runtimeProfile, normalized.secretRef,
    JSON.stringify(normalized.settings), normalized.enabled ? 1 : 0, now, now,
  );
  return getAiProfile(Number(inserted.lastInsertRowid));
}

export function updateAiProfile(id, changes = {}) {
  const current = getAiProfile(id);
  if (!current) throw new Error(`AI profile not found: ${id}`);
  const normalized = normalizeAiProfileInput(changes, current);
  const now = Date.now();
  db.prepare(`UPDATE ai_profiles SET
    name = ?, runtime = ?, provider_kind = ?, base_url = ?, protocol = ?, model = ?, reasoning = ?,
    runtime_profile = ?, secret_ref = ?, settings_json = ?, enabled = ?, updated_at = ? WHERE id = ?`).run(
    normalized.name, normalized.runtime, normalized.providerKind, normalized.baseUrl, normalized.protocol,
    normalized.model, normalized.reasoning, normalized.runtimeProfile, normalized.secretRef,
    JSON.stringify(normalized.settings), normalized.enabled ? 1 : 0, now, current.id,
  );
  return getAiProfile(current.id);
}

export function setAiProfileEnabled(id, enabled) {
  return updateAiProfile(id, { enabled: enabled === true });
}

export function countAiProfilesUsingSecretRef(secretRef, { excludeProfileId = null } = {}) {
  const ref = String(secretRef || '').trim();
  if (!ref) return 0;
  if (excludeProfileId == null) {
    return Number(db.prepare('SELECT COUNT(*) AS count FROM ai_profiles WHERE secret_ref = ?').get(ref)?.count || 0);
  }
  return Number(db.prepare('SELECT COUNT(*) AS count FROM ai_profiles WHERE secret_ref = ? AND id != ?')
    .get(ref, Number(excludeProfileId))?.count || 0);
}

export function deleteAiProfile(id) {
  const current = getAiProfile(id);
  if (!current) return null;
  const now = Date.now();
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE ai_runtime_settings SET default_profile_id = NULL, updated_at = ? WHERE id = 1 AND default_profile_id = ?')
      .run(now, current.id);
    db.prepare('UPDATE ai_role_bindings SET primary_profile_id = NULL, updated_at = ? WHERE primary_profile_id = ?').run(now, current.id);
    db.prepare('UPDATE ai_role_bindings SET fallback_profile_id = NULL, updated_at = ? WHERE fallback_profile_id = ?').run(now, current.id);
    db.prepare('DELETE FROM ai_role_bindings WHERE primary_profile_id IS NULL AND fallback_profile_id IS NULL').run();
    db.prepare('DELETE FROM ai_profiles WHERE id = ?').run(current.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return {
    profile: current,
    secretRefStillUsed: current.secretRef ? countAiProfilesUsingSecretRef(current.secretRef) > 0 : false,
  };
}

export function getAiRuntimeSettings() {
  const row = db.prepare('SELECT * FROM ai_runtime_settings WHERE id = 1').get();
  const defaultProfileId = row?.default_profile_id == null ? null : Number(row.default_profile_id);
  return {
    defaultProfileId,
    defaultProfile: defaultProfileId == null ? null : getAiProfile(defaultProfileId),
    updatedAt: Number(row?.updated_at || 0),
  };
}

export function getAiDefaultProfile() {
  return getAiRuntimeSettings().defaultProfile;
}

export function setAiDefaultProfile(profileId) {
  if (profileId == null) return clearAiDefaultProfile();
  const profile = getAiProfile(profileId);
  if (!profile) throw new Error(`AI profile not found: ${profileId}`);
  if (!profile.enabled) throw new Error(`AI profile is disabled: ${profileId}`);
  db.prepare('UPDATE ai_runtime_settings SET default_profile_id = ?, updated_at = ? WHERE id = 1').run(profile.id, Date.now());
  return getAiRuntimeSettings();
}

export function clearAiDefaultProfile() {
  db.prepare('UPDATE ai_runtime_settings SET default_profile_id = NULL, updated_at = ? WHERE id = 1').run(Date.now());
  return getAiRuntimeSettings();
}

function decodeAiRoleBinding(row) {
  if (!row) return null;
  const primaryProfileId = row.primary_profile_id == null ? null : Number(row.primary_profile_id);
  const fallbackProfileId = row.fallback_profile_id == null ? null : Number(row.fallback_profile_id);
  return {
    role: row.role,
    primaryProfileId,
    fallbackProfileId,
    primaryProfile: primaryProfileId == null ? null : getAiProfile(primaryProfileId),
    fallbackProfile: fallbackProfileId == null ? null : getAiProfile(fallbackProfileId),
    updatedAt: Number(row.updated_at),
  };
}

export function getAiRoleBinding(role) {
  const normalizedRole = requireAiEnum(role, AI_ROLE_SET, 'AI role');
  return decodeAiRoleBinding(db.prepare('SELECT * FROM ai_role_bindings WHERE role = ?').get(normalizedRole));
}

export function listAiRoleBindings() {
  return db.prepare('SELECT * FROM ai_role_bindings ORDER BY role ASC').all().map(decodeAiRoleBinding);
}

function requireEnabledAiProfile(profileId, label) {
  if (profileId == null) return null;
  const profile = getAiProfile(profileId);
  if (!profile) throw new Error(`${label} AI profile not found: ${profileId}`);
  if (!profile.enabled) throw new Error(`${label} AI profile is disabled: ${profileId}`);
  return profile;
}

export function setAiRoleBinding(role, { primaryProfileId = null, fallbackProfileId = null } = {}) {
  const normalizedRole = requireAiEnum(role, AI_ROLE_SET, 'AI role');
  if (primaryProfileId == null && fallbackProfileId == null) return clearAiRoleBinding(normalizedRole);
  const primary = requireEnabledAiProfile(primaryProfileId, 'Primary');
  const fallback = requireEnabledAiProfile(fallbackProfileId, 'Fallback');
  if (primary && fallback && primary.id === fallback.id) throw new Error('AI primary and fallback profiles must be different.');
  const now = Date.now();
  db.prepare(`INSERT INTO ai_role_bindings(role, primary_profile_id, fallback_profile_id, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(role) DO UPDATE SET primary_profile_id = excluded.primary_profile_id,
      fallback_profile_id = excluded.fallback_profile_id, updated_at = excluded.updated_at`)
    .run(normalizedRole, primary?.id ?? null, fallback?.id ?? null, now);
  return getAiRoleBinding(normalizedRole);
}

export function clearAiRoleBinding(role) {
  const normalizedRole = requireAiEnum(role, AI_ROLE_SET, 'AI role');
  db.prepare('DELETE FROM ai_role_bindings WHERE role = ?').run(normalizedRole);
  return null;
}

export function getAiCompatibilityProfile(role) {
  const normalizedRole = requireAiEnum(role, AI_ROLE_SET, 'AI role');
  if (normalizedRole !== 'writer') return null;
  return {
    id: null,
    name: 'Current Codex configuration',
    runtime: 'codex',
    providerKind: 'runtime_managed',
    baseUrl: '',
    protocol: 'runtime_native',
    model: 'inherit',
    reasoning: '',
    runtimeProfile: '',
    secretRef: '',
    settings: {},
    enabled: true,
    compatibility: true,
    createdAt: null,
    updatedAt: null,
  };
}

function resolveExplicitAiProfile(profile) {
  if (profile == null) return null;
  if (typeof profile === 'object' && !Array.isArray(profile)) {
    if (profile.id != null) {
      const persisted = getAiProfile(profile.id);
      if (!persisted) throw new Error(`AI profile not found: ${profile.id}`);
      return persisted;
    }
    return { id: null, ...normalizeAiProfileInput(profile), compatibility: false, createdAt: null, updatedAt: null };
  }
  const persisted = getAiProfile(profile);
  if (!persisted) throw new Error(`AI profile not found: ${profile}`);
  return persisted;
}

export function resolveAiProfileForRole(role, explicitProfile = null) {
  const normalizedRole = requireAiEnum(role, AI_ROLE_SET, 'AI role');
  const binding = getAiRoleBinding(normalizedRole);
  let profile = resolveExplicitAiProfile(explicitProfile);
  let source = profile ? 'explicit' : null;
  if (!profile && binding?.primaryProfileId != null) {
    profile = getAiProfile(binding.primaryProfileId);
    if (!profile) throw new Error(`Bound AI profile not found: ${binding.primaryProfileId}`);
    source = 'role';
  }
  if (!profile) {
    const settings = getAiRuntimeSettings();
    if (settings.defaultProfileId != null) {
      profile = settings.defaultProfile;
      if (!profile) throw new Error(`Default AI profile not found: ${settings.defaultProfileId}`);
      source = 'global';
    }
  }
  if (!profile) {
    profile = getAiCompatibilityProfile(normalizedRole);
    source = profile ? 'compatibility' : 'unconfigured';
  }
  const fallbackProfile = binding?.fallbackProfileId == null ? null : getAiProfile(binding.fallbackProfileId);
  if (binding?.fallbackProfileId != null && !fallbackProfile) {
    throw new Error(`Fallback AI profile not found: ${binding.fallbackProfileId}`);
  }
  return {
    role: normalizedRole,
    source,
    profile,
    fallbackProfile: fallbackProfile && fallbackProfile.id !== profile?.id ? fallbackProfile : null,
    binding,
  };
}

function normalizeAiRunMetadata(metadata = {}) {
  if (metadata == null) return {};
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('AI run metadata must be an object.');
  const isSensitiveKey = (key) => {
    const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalized.includes('prompt')
      || normalized.includes('apikey')
      || normalized.includes('secret')
      || normalized.includes('authorization')
      || normalized.includes('chainofthought')
      || normalized.includes('rawresponse')
      || normalized.includes('responsebody')
      || normalized === 'output'
      || normalized === 'outputtext'
      || normalized === 'result';
  };
  const visit = (value) => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (isSensitiveKey(key)) throw new Error(`AI run metadata cannot contain ${key}.`);
      result[key] = visit(child);
    }
    return result;
  };
  return visit(metadata);
}

function decodeAiRun(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    invocationId: row.invocation_id,
    attempt: Number(row.attempt),
    attemptKind: row.attempt_kind,
    role: row.role,
    profileId: row.profile_id == null ? null : Number(row.profile_id),
    runtime: row.runtime,
    providerKind: row.provider_kind,
    model: row.model,
    reasoning: row.reasoning,
    fallbackProfileId: row.fallback_profile_id == null ? null : Number(row.fallback_profile_id),
    fallbackUsed: Boolean(row.fallback_used),
    status: row.status,
    errorCode: row.error_code,
    startedAt: Number(row.started_at),
    completedAt: row.completed_at == null ? null : Number(row.completed_at),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    inputTokens: row.input_tokens == null ? null : Number(row.input_tokens),
    outputTokens: row.output_tokens == null ? null : Number(row.output_tokens),
    costUsd: row.cost_usd == null ? null : Number(row.cost_usd),
    metadata: json(row.metadata_json, {}),
  };
}

export function getAiRun(id) {
  return decodeAiRun(db.prepare('SELECT * FROM ai_runs WHERE id = ?').get(Number(id)));
}

export function createAiRunAttempt(input = {}) {
  const invocationId = String(input.invocationId || '').trim();
  if (!invocationId) throw new Error('AI run invocationId is required.');
  const attempt = Number(input.attempt || 1);
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error('AI run attempt must be a positive integer.');
  const attemptKind = requireAiEnum(input.attemptKind || 'primary', AI_ATTEMPT_KIND_SET, 'AI attempt kind');
  const role = requireAiEnum(input.role, AI_ROLE_SET, 'AI role');
  const runtime = requireAiEnum(input.runtime, AI_RUNTIME_SET, 'AI runtime');
  const providerKind = requireAiEnum(input.providerKind, AI_PROVIDER_SET, 'AI provider kind');
  const startedAt = Number(input.startedAt || Date.now());
  if (!Number.isFinite(startedAt) || startedAt <= 0) throw new Error('AI run startedAt must be a positive timestamp.');
  const inserted = db.prepare(`INSERT INTO ai_runs(
    invocation_id, attempt, attempt_kind, role, profile_id, runtime, provider_kind, model, reasoning,
    fallback_profile_id, fallback_used, status, error_code, started_at, completed_at, duration_ms,
    input_tokens, output_tokens, cost_usd, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', '', ?, NULL, NULL, NULL, NULL, NULL, ?)`).run(
    invocationId, attempt, attemptKind, role, input.profileId == null ? null : Number(input.profileId), runtime,
    providerKind, String(input.model || ''), String(input.reasoning || ''),
    input.fallbackProfileId == null ? null : Number(input.fallbackProfileId), input.fallbackUsed ? 1 : 0,
    startedAt, JSON.stringify(normalizeAiRunMetadata(input.metadata || {})),
  );
  return getAiRun(Number(inserted.lastInsertRowid));
}

export function finishAiRunAttempt(id, changes = {}) {
  const current = getAiRun(id);
  if (!current) throw new Error(`AI run not found: ${id}`);
  const status = requireAiEnum(changes.status || current.status, AI_RUN_STATUS_SET, 'AI run status');
  const completedAt = changes.completedAt == null ? (status === 'running' ? null : Date.now()) : Number(changes.completedAt);
  if (completedAt != null && (!Number.isFinite(completedAt) || completedAt < current.startedAt)) {
    throw new Error('AI run completedAt must be at or after startedAt.');
  }
  const nullableNumber = (value, label) => {
    if (value == null) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number.`);
    return number;
  };
  const metadata = normalizeAiRunMetadata({ ...current.metadata, ...(changes.metadata || {}) });
  const model = changes.model == null ? current.model : String(changes.model || '');
  const reasoning = changes.reasoning == null ? current.reasoning : String(changes.reasoning || '');
  db.prepare(`UPDATE ai_runs SET status = ?, error_code = ?, completed_at = ?, duration_ms = ?,
    model = ?, reasoning = ?, input_tokens = ?, output_tokens = ?, cost_usd = ?, metadata_json = ? WHERE id = ?`).run(
    status, String(changes.errorCode || ''), completedAt,
    completedAt == null ? null : Math.max(0, completedAt - current.startedAt), model, reasoning,
    nullableNumber(changes.inputTokens, 'AI inputTokens'), nullableNumber(changes.outputTokens, 'AI outputTokens'),
    nullableNumber(changes.costUsd, 'AI costUsd'), JSON.stringify(metadata), current.id,
  );
  return getAiRun(current.id);
}

export function listAiRuns({ role = null, profileId = null, invocationId = null, status = null, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (role != null) {
    where.push('role = ?');
    params.push(requireAiEnum(role, AI_ROLE_SET, 'AI role'));
  }
  if (profileId != null) {
    where.push('profile_id = ?');
    params.push(Number(profileId));
  }
  if (invocationId != null) {
    where.push('invocation_id = ?');
    params.push(String(invocationId));
  }
  if (status != null) {
    where.push('status = ?');
    params.push(requireAiEnum(status, AI_RUN_STATUS_SET, 'AI run status'));
  }
  params.push(Math.max(1, Math.min(1000, Number(limit || 100))));
  return db.prepare(`SELECT * FROM ai_runs ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY started_at DESC, id DESC LIMIT ?`).all(...params).map(decodeAiRun);
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
