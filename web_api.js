import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { ACCOUNT_PERFORMANCE_CAPABILITIES, fetchAccountPerformance } from './tech_news.js';
import { applyWriterOutput, buildWriterPacket, scoreDraft } from './drafting.js';
import { generateWriterOutput } from './writer_runtime.js';
import { calculateProfileProofCoverage } from './profile_proof.js';
import { matchResearchTopics } from './research_topics.js';
import {
  EDITORIAL_OBJECTIVES,
  dismissEditorialRecommendation,
  refreshEditorialPlan,
  selectEditorialRecommendation,
} from './editorial.js';
import { attachEditorialResearchSource } from './research.js';
import { normalizeSourceKind, refreshAllSourceSnapshots, refreshSourceSnapshot } from './source_refresh.js';
import {
  approveEngagementQueueItem,
  approveQueueItem,
  discardCandidateDraft,
  ensureCandidateWorkflow,
  inspectWorkflow,
  recordManualRepost,
  refreshCandidateRecommendations,
  refreshQueueRecommendation,
  rescoreCandidateRelevance,
  requestQueueReview,
  resolveEngagementItem,
  routeCandidate,
  setRelevanceDecision,
  setRoutingDecision,
  sendApprovedEngagementReply,
} from './pipeline.js';
import { rankMainFeedItems, recommendMainFeedSchedule } from './scheduler.js';
import {
  configureAutonomousReplyGrant,
  getAutonomousReplyReadModel,
  pauseAutonomousReplies,
  startAutonomousReplies,
  stopAutonomousReplies,
} from './autonomous_reply.js';
import { AUDIENCE_NICHE_LABELS, NICHE_GROUPS, NICHE_LABELS, assessStrategicRelevance, isOpportunityCandidate } from './strategy.js';
import { getAudienceAiReview, reviewAudienceFollowing, syncAudience, unfollowAudienceUser } from './audience.js';
import { CONTENT_METRICS, EXPERIMENT_DIMENSIONS, NETWORK_METRICS } from './experiments.js';
import {
  AI_ROLES,
  SOURCE_SNAPSHOT_KINDS,
  acceptLearnedRule,
  assignExperimentVariant,
  createExperiment,
  createAiProfile,
  clearAiDefaultProfile,
  configureFirst1000MainFeedMissionGrant,
  clearAiRoleBinding,
  countAiProfilesUsingSecretRef,
  deleteAiProfile,
  getAiProfile,
  getAiRuntimeSettings,
  getAiRoleBinding,
  getCandidate,
  getDraft,
  getDraftByCandidate,
  getEditorialRecommendation,
  getEditorialOutcomeSummary,
  getEditorialSelectionByRecommendation,
  getExperiment,
  getExperimentSummary,
  getFirst1000MainFeedMissionGrant,
  getLearningOverview,
  getMainFeedScheduleItem,
  getLatestEditorialSelectionForQueueItem,
  getLatestWritingStrategySelectionForQueueItem,
  getLatestEditorialPlan,
  getNewFollowerQuality,
  getNicheProfile,
  getPerformanceSnapshot,
  getPreferenceProfile,
  getQueueItem,
  getQueueItemByCandidate,
  getRelationshipProfile,
  getAudienceSummary,
  getAccountHealthSummary,
  getAutonomousReplyDecisionForTarget,
  getDiscoverSnapshot,
  getSourceMomentum,
  listAcceptedLearnedRules,
  listAiProfiles,
  listAiRuns,
  listApprovedMainFeedItems,
  listAudienceProfiles,
  listCandidateActions,
  listCandidates,
  listEngagementItems,
  listExperimentAssignments,
  listExperiments,
  listPublicationMeasurementSeries,
  listPublishedMainFeedContent,
  listQueueItems,
  listRecentMainFeedPublications,
  listRecentPublishedContent,
  listResearchEvidence,
  markCandidateSaved,
  recordPerformanceSnapshot,
  refreshLearnedRuleSuggestion,
  resetNicheProfile,
  retireLearnedRule,
  saveDraft,
  saveGrowthFocusObjective,
  saveNicheProfile,
  startFirst1000MainFeedMission,
  pauseFirst1000MainFeedMission,
  stopFirst1000MainFeedMission,
  setAiDefaultProfile,
  setAiProfileEnabled,
  setAiRoleBinding,
  setExperimentStatus,
  setMainFeedSchedule,
  updateAiProfile,
  resolveAiProfileForRole,
} from './store.js';
import { getAiSecretStatus, removeAiSecret, setAiSecret } from './ai_secrets.js';
import { checkAiProfileConnection, listAiCatalog, listAiRuntimeAvailability, testAiProfile } from './ai_runtime.js';
import { runViralSweep, VIRAL_SWEEP_THRESHOLDS } from './viral_style_sweep.js';
import { viralStyleIntent } from './viral_style_intent.js';
import { analyzeStoredDataset, writeStoredAnalysis } from './viral_style_analyze.js';
import {
  buildWritingStrategyGenerationProvenance,
  classifyPublishedContent,
  getWritingStrategyGenerationContext,
  getWritingStrategyPreview,
  recommendWritingStrategy,
  selectWritingStrategy,
  validateWritingStrategyGenerationContext,
} from './writing_strategy.js';
import { getWritingStrategyFeedbackReadModel, getWritingStrategyOutcomeSummary } from './strategy_outcomes.js';

const AUTO_POST = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';
const ACCOUNT = process.env.X_ACCOUNT || 'ham_zax';
const CONTENT_PIPELINES = new Set(['original', 'quote', 'thread', 'reply']);
const MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread']);
const SCHEDULABLE_MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread', 'repost']);
const MEDIA_TYPES = ['none', 'screenshot', 'chart', 'code', 'diagram'];
const DRAFT_MEDIA_DIR = path.resolve('.x-media');
const DRAFT_MEDIA_MIME = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
});
const MAX_DRAFT_MEDIA_BYTES = 5 * 1024 * 1024;
const DISCOVER_FEEDS = new Set(['for-you', 'x', 'trending', 'opportunities', 'github', 'hn', 'all', 'saved', 'handled']);
const DISCOVER_SOURCE_KINDS = Object.freeze({ x: 'x_latest', trending: 'x_momentum', github: 'github_trending', hn: 'hn_top' });
const AUDIENCE_UNFOLLOW_JOBS = new Map();
const AUDIENCE_UNFOLLOW_JOB_TTL_MS = 10 * 60_000;
const VIRAL_RESEARCH_WINDOWS = new Set([14, 21, 30]);
const VIRAL_RESEARCH_RUNTIME_TYPES = new Set(['codex', 'opencode', 'agy']);
let VIRAL_RESEARCH_JOB = null;

function setViralResearchCheckpoint(job, checkpoint, message, details = {}, progressPercent = null) {
  job.checkpoint = checkpoint;
  if (progressPercent != null && Number.isFinite(Number(progressPercent))) {
    job.progressPercent = Math.max(Number(job.progressPercent || 0), Math.min(100, Math.max(0, Math.round(Number(progressPercent)))));
  }
  const event = {
    at: Date.now(),
    checkpoint,
    message: String(message || ''),
    details: details && typeof details === 'object' && !Array.isArray(details) ? details : {},
  };
  const previous = job.events?.[job.events.length - 1];
  if (!previous || previous.checkpoint !== event.checkpoint || previous.message !== event.message) {
    job.events = [...(job.events || []), event].slice(-60);
  }
}

function viralCollectionProgressPercent(progress = {}) {
  const totalJobs = Math.max(1, Number(progress.totalJobs || 0));
  const completedJobs = Math.max(0, Math.min(totalJobs, Number(progress.completedJobs || 0)));
  let partial = 0;
  const candidate = progress.currentCandidate;
  if (candidate && Number(candidate.total) > 0) {
    partial = Math.max(0, Math.min(0.99, Number(candidate.completed || 0) / Number(candidate.total)));
  }
  return Math.min(70, 70 * ((completedJobs + partial) / totalJobs));
}

function formatViralResearchJob() {
  if (!VIRAL_RESEARCH_JOB) return null;
  const { stopRequested, ...job } = VIRAL_RESEARCH_JOB;
  return { ...job, stopRequested: stopRequested === true };
}

function normalizeViralResearchConfig(payload = {}) {
  const days = Number(payload.days || 21);
  if (!VIRAL_RESEARCH_WINDOWS.has(days)) throw new Error('Viral research window must be 14, 21, or 30 days.');

  const validNiches = new Set(NICHE_GROUPS.map((group) => group.tag));
  const niches = [...new Set((Array.isArray(payload.niches) ? payload.niches : NICHE_GROUPS.map((group) => group.tag)).map(String))]
    .filter((tag) => validNiches.has(tag));
  if (!niches.length) throw new Error('Select at least one viral research niche.');

  const thresholdNames = Object.keys(VIRAL_SWEEP_THRESHOLDS);
  const thresholds = [...new Set((Array.isArray(payload.thresholds) ? payload.thresholds : ['strong']).map(String))]
    .filter((name) => thresholdNames.includes(name));
  if (!thresholds.length) throw new Error('Select at least one viral research discovery floor.');

  const limitPerQuery = Math.max(1, Math.min(20, Number(payload.limitPerQuery || 5)));
  const controlsPerSeed = Math.max(0, Math.min(4, Number(payload.controlsPerSeed || 0)));
  const threads = payload.threads !== false;

  const rawIntent = payload.intent && typeof payload.intent === 'object' && !Array.isArray(payload.intent) ? payload.intent : {};
  const intent = { enabled: rawIntent.enabled === true, mode: String(rawIntent.mode || 'profile') };
  if (intent.enabled && intent.mode === 'profile') {
    const profile = assertAssignableAiProfile(requireAiProfile(rawIntent.profileId));
    intent.profileId = profile.id;
    intent.profileName = profile.name;
    intent.runtime = profile.runtime;
    intent.model = profile.model;
    intent.reasoning = profile.reasoning || '';
  } else if (intent.enabled && intent.mode === 'runtime') {
    const runtime = String(rawIntent.runtime || '').trim();
    const model = String(rawIntent.model || '').trim();
    const reasoning = String(rawIntent.reasoning || '').trim();
    if (!VIRAL_RESEARCH_RUNTIME_TYPES.has(runtime)) throw new Error('Select a supported structured runtime for viral intent analysis.');
    if (!model) throw new Error('Select an exact model for viral intent analysis.');
    Object.assign(intent, { runtime, model, reasoning });
  } else if (intent.enabled) {
    throw new Error('Viral intent mode must be profile or runtime.');
  }

  return { days, niches, thresholds, limitPerQuery, controlsPerSeed, threads, intent };
}

function viralIntentProfile(config) {
  if (!config.intent?.enabled) return null;
  if (config.intent.mode === 'profile') return String(config.intent.profileId);
  return {
    name: `Viral intent ${config.intent.runtime}/${config.intent.model}`,
    runtime: config.intent.runtime,
    providerKind: 'runtime_managed',
    baseUrl: '',
    protocol: 'runtime_native',
    model: config.intent.model,
    reasoning: config.intent.reasoning || '',
    runtimeProfile: '',
    secretRef: '',
    settings: {},
    enabled: true,
  };
}

function startViralResearchJob(config) {
  if (VIRAL_RESEARCH_JOB && ['running', 'stopping'].includes(VIRAL_RESEARCH_JOB.status)) {
    throw new Error('A viral research run is already active.');
  }
  const job = {
    id: randomUUID(),
    status: 'running',
    stage: 'collecting',
    checkpoint: 'queued',
    progressPercent: 0,
    events: [],
    startedAt: Date.now(),
    completedAt: null,
    config,
    progress: { totalJobs: 0, completedJobs: 0, totalSeeds: 0, totalErrors: 0, current: null },
    intentProgress: null,
    summary: null,
    error: null,
    stopRequested: false,
  };
  setViralResearchCheckpoint(job, 'queued', 'Research run queued. Preparing read-only X discovery.', {}, 0);
  VIRAL_RESEARCH_JOB = job;

  void (async () => {
    try {
      const sweep = await runViralSweep({
        days: config.days,
        niches: config.niches,
        thresholds: config.thresholds,
        limitPerQuery: config.limitPerQuery,
        controlsPerSeed: config.controlsPerSeed,
        threads: config.threads,
        shouldStop: () => job.stopRequested === true,
        onProgress: (progress) => {
          job.stage = 'collecting';
          job.progress = { ...job.progress, ...progress };
          const checkpoint = progress.checkpoint || 'discovering';
          const message = progress.currentCandidate?.message
            || (progress.current
              ? `${progress.current.nicheLabel} · ${progress.current.threshold} · ${progress.current.since} to ${progress.current.until}`
              : 'Preparing historical X discovery.');
          setViralResearchCheckpoint(job, checkpoint, message, {
            nicheTag: progress.current?.nicheTag || null,
            nicheLabel: progress.current?.nicheLabel || null,
            threshold: progress.current?.threshold || null,
            since: progress.current?.since || null,
            until: progress.current?.until || null,
            candidateId: progress.currentCandidate?.candidateId || null,
            completedCandidates: progress.currentCandidate?.completed ?? null,
            totalCandidates: progress.currentCandidate?.total ?? null,
          }, viralCollectionProgressPercent(progress));
        },
      });
      job.summary = { sweep: { totalSeeds: sweep.totalSeeds, totalErrors: sweep.totalErrors, stopped: sweep.stopped } };
      if (job.stopRequested || sweep.stopped) {
        job.status = 'stopped';
        job.stage = 'stopped';
        setViralResearchCheckpoint(job, 'stopped', 'Research stopped after the current bounded collection unit.');
        job.completedAt = Date.now();
        return;
      }

      if (config.intent.enabled) {
        job.stage = 'intent';
        setViralResearchCheckpoint(job, 'intent_ai', 'Starting structured AI intent classification.', {}, 70);
        const intentResult = await viralStyleIntent.enrich({
          days: config.days,
          profile: viralIntentProfile(config),
          shouldStop: () => job.stopRequested === true,
          onProgress: (progress) => {
            job.stage = 'intent';
            job.intentProgress = progress;
            const totalBatches = Math.max(1, Number(progress.totalBatches || 0));
            const completedBatches = Math.max(0, Math.min(totalBatches, Number(progress.completedBatches || 0)));
            const percent = 70 + 20 * (completedBatches / totalBatches);
            setViralResearchCheckpoint(job, 'intent_ai', `AI intent batch ${completedBatches}/${progress.totalBatches || 0}; ${progress.classified || 0} posts classified.`, {
              completedBatches,
              totalBatches: Number(progress.totalBatches || 0),
              classified: Number(progress.classified || 0),
              currentBatchSize: Number(progress.currentBatchSize || 0),
            }, percent);
          },
        });
        job.summary.intent = {
          eligible: intentResult.eligible,
          classified: intentResult.classified,
          skippedCached: intentResult.skippedCached,
          errorCount: intentResult.errors.length,
          stopped: intentResult.stopped === true,
        };
        if (job.stopRequested || intentResult.stopped) {
          job.status = 'stopped';
          job.stage = 'stopped';
          setViralResearchCheckpoint(job, 'stopped', 'Research stopped after the current AI intent batch.');
          job.completedAt = Date.now();
          return;
        }
      }

      job.stage = 'analyzing';
      setViralResearchCheckpoint(job, 'analyzing', 'Recomputing mature retrospective evidence.', {}, config.intent.enabled ? 92 : 75);
      const analysis = await writeStoredAnalysis({
        days: config.days,
        matureHours: 24,
        confidence: 0.90,
        onProgress: (progress) => {
          if (progress.checkpoint === 'exporting') {
            job.stage = 'exporting';
            setViralResearchCheckpoint(job, 'exporting', progress.message, {}, 97);
          } else {
            job.stage = 'analyzing';
            setViralResearchCheckpoint(job, 'analyzing', progress.message, {}, config.intent.enabled ? 92 : 75);
          }
        },
      });
      job.summary.analysis = {
        eligiblePosts: analysis.report.dataset.eligiblePosts,
        eligibleAuthors: analysis.report.dataset.eligibleAuthors,
        supportedGroups: analysis.report.supportedGroups.length,
        aiIntentLabeledPosts: analysis.report.dataset.aiIntentLabeledPosts,
      };
      job.status = 'complete';
      job.stage = 'complete';
      setViralResearchCheckpoint(job, 'complete', 'Research collection, intent enrichment, analysis, and exports are complete.', {}, 100);
      job.completedAt = Date.now();
    } catch (error) {
      job.status = 'failed';
      job.stage = 'failed';
      job.completedAt = Date.now();
      job.error = String(error?.message || error || 'Viral research failed.');
      setViralResearchCheckpoint(job, 'failed', job.error);
    }
  })();

  return formatViralResearchJob();
}

async function viralResearchView(days = 21, postLimit = 200) {
  const report = await analyzeStoredDataset({ days, matureHours: 24, confidence: 0.90 });
  const posts = report.rows
    .slice()
    .sort((left, right) => Number(right.viewsPerFollower || 0) - Number(left.viewsPerFollower || 0))
    .slice(0, postLimit);
  const { rows, ...summary } = report;
  return {
    options: {
      windows: [14, 21, 30],
      niches: NICHE_GROUPS.map((group) => ({ tag: group.tag, label: group.label })),
      thresholds: Object.values(VIRAL_SWEEP_THRESHOLDS),
      runtimeTypes: [...VIRAL_RESEARCH_RUNTIME_TYPES],
    },
    job: formatViralResearchJob(),
    report: { ...summary, posts },
  };
}

function findPendingAudienceUnfollowJob(username) {
  for (const job of AUDIENCE_UNFOLLOW_JOBS.values()) {
    if (job.username === username && job.status === 'pending') return job;
  }
  return null;
}

function startAudienceUnfollowJob(username) {
  const normalized = String(username || '').replace(/^@/, '').trim().toLowerCase();
  const existing = findPendingAudienceUnfollowJob(normalized);
  if (existing) return existing;

  const job = {
    id: randomUUID(),
    username: normalized,
    status: 'pending',
    startedAt: Date.now(),
    completedAt: null,
    profile: null,
    error: null,
  };
  AUDIENCE_UNFOLLOW_JOBS.set(job.id, job);

  void unfollowAudienceUser(normalized)
    .then((updated) => {
      job.status = 'success';
      job.completedAt = Date.now();
      job.profile = formatAudienceProfile(updated);
    })
    .catch((error) => {
      job.status = 'failed';
      job.completedAt = Date.now();
      job.error = String(error?.message || error || 'Unfollow failed.');
    })
    .finally(() => {
      const timer = setTimeout(() => AUDIENCE_UNFOLLOW_JOBS.delete(job.id), AUDIENCE_UNFOLLOW_JOB_TTL_MS);
      timer.unref?.();
    });

  return job;
}

export const STATUS_LABELS = Object.freeze({
  triage: 'Needs a decision',
  researching: 'Research suggested',
  drafting: 'Draft in progress',
  needs_review: 'Needs review',
  approved: 'Approved',
  publishing: 'Publishing',
  published: 'Published',
  watching: 'On hold',
  ignored: 'Skipped',
  expired: 'Expired',
  failed: 'Action failed',
});

export const PIPELINE_LABELS = Object.freeze({
  triage: 'Not chosen',
  original: 'Original post',
  quote: 'Quote post',
  thread: 'Thread',
  reply: 'Reply',
  repost: 'Repost',
  research: 'Research further',
  watch: 'Pause',
  ignore: 'Skip source',
});

export const EVIDENCE_LABELS = Object.freeze({
  insufficient: 'Not enough evidence',
  preliminary: 'Early signal',
  directional: 'Promising — needs more evidence',
  repeated: 'Consistent pattern — still observational',
});

export const EXPERIMENT_DIMENSION_LABELS = Object.freeze({
  style: 'Writing style', hook_type: 'Opening / hook', media_type: 'Media type', format: 'Content format', hashtag_count: 'Canonical hashtag count', timing_bucket: 'Publishing time',
  target_class: 'Type of person/account', target_score_bucket: 'Relationship fit', target_size_bucket: 'Account size', reply_age_bucket: 'How fresh the conversation is',
  conversation_saturation_bucket: 'Recent interaction level', reply_archetype: 'Reply style', relationship_stage: 'Relationship stage',
  interaction_volume_bucket: 'Interaction volume', target_concentration_bucket: 'Target concentration', archetype_repetition_bucket: 'Reply-style repetition',
});

export const EXPERIMENT_METRIC_LABELS = Object.freeze({
  views_per_hour: 'Views per hour', replies_per_1000_views: 'Replies per 1,000 views', reposts_per_1000_views: 'Reposts per 1,000 views',
  visible_engagement_per_1000_views: 'Visible engagement per 1,000 views', profile_visits_per_1000_views: 'Profile visits per 1,000 views',
  post_attributed_follows_per_1000_views: 'Post-attributed follows per 1,000 views', associated_follows_per_1000_views: 'Associated account follows per 1,000 views',
  author_response_rate: 'People who respond', conversation_continuation_rate: 'Conversations that continue', relationship_stage_progression: 'Relationship progression',
  connected_target_conversion: 'New connected relationships', recurring_relationship_conversion: 'New recurring relationships', mutual_relationship_count: 'New mutual relationships',
  interaction_yield: 'Useful outcomes per interaction', target_diversity: 'Target diversity', class_diversity: 'Audience-class diversity', topic_diversity: 'Topic diversity',
  top_target_concentration: 'Top-target concentration',
});

export const HEALTH_STATE_COPY = Object.freeze({
  healthy: 'Normal',
  watch: 'Watch',
  constrained: 'Limited',
});

export const QUALITY_SIGNAL_LABELS = Object.freeze({
  hook: { label: 'Opening', max: 8, description: 'Whether the first line quickly gives someone a reason to keep reading.' },
  insight: { label: 'Useful insight', max: 10, description: 'Whether the post adds a concrete implication instead of repeating the source.' },
  evidence: { label: 'Support', max: 10, description: 'Whether the draft uses useful source material, data, steps, or observed results.' },
  action: { label: 'Takeaway', max: 7, description: 'Whether the reader leaves with a useful next step, decision, or question.' },
  originality: { label: 'Original angle', max: 5, description: 'Whether the wording adds something distinct from the source.' },
});

function label(map, value) {
  return map[value] || String(value || 'unknown').replaceAll('_', ' ');
}

function queueStatusLabel(queueItem) {
  if (!queueItem) return 'Unknown';
  const engagement = queueItem.lane === 'engagement';
  if (queueItem.status === 'drafting') return engagement ? (queueItem.draftId ? 'Reply draft in progress' : 'Reply not drafted') : 'Draft in progress';
  if (queueItem.status === 'needs_review') return engagement ? 'Reply needs review' : 'Needs review';
  if (queueItem.status === 'approved') {
    if (engagement) return 'Approved · ready to send';
    if (queueItem.pipeline === 'repost') return 'Approved · repost manually';
    return 'Approved · awaiting publish';
  }
  if (queueItem.status === 'publishing') return engagement ? 'Sending now' : 'Publishing now';
  if (queueItem.status === 'published') {
    if (engagement) return 'Reply sent';
    if (queueItem.pipeline === 'repost') return 'Reposted';
    return 'Published';
  }
  if (queueItem.status === 'failed') return engagement ? 'Send failed' : 'Publish failed';
  return label(STATUS_LABELS, queueItem.status);
}

function candidateActionView(action, queueItem) {
  const type = String(action?.action || '');
  const occurredAt = Number(action?.created_at || action?.createdAt || 0) || null;
  const outputUrl = action?.output_url || action?.outputUrl || null;
  if (type === 'quote') return { action: type, label: 'Quoted', summary: 'You quoted this source.', outputUrl, occurredAt };
  if (type === 'reply') return { action: type, label: 'Replied', summary: 'You replied to this source.', outputUrl, occurredAt };
  if (type === 'repost') return { action: type, label: 'Reposted', summary: 'You reposted this source.', outputUrl, occurredAt };
  if (queueItem?.pipeline === 'thread') return { action: type, label: 'Published thread', summary: 'You published a thread from this source.', outputUrl, occurredAt };
  return { action: type || 'direct', label: 'Published post', summary: 'You published a post from this source.', outputUrl, occurredAt };
}

function opportunityLabel(score) {
  const value = Number(score || 0);
  if (value >= 80) return 'Strong';
  if (value >= 60) return 'Worth considering';
  if (value >= 40) return 'Possible';
  return 'Low priority';
}

function nicheTagLabel(tag) {
  return AUDIENCE_NICHE_LABELS[tag] || NICHE_LABELS[tag] || tag;
}

// ---------------------------------------------------------------------------
// Shared orchestration (used by /api routes and the legacy dashboard renderer)
// ---------------------------------------------------------------------------

export function schedulerContext(now = Date.now()) {
  const recentPosts = listRecentMainFeedPublications({ limit: 20 });
  return {
    now,
    recentPosts,
    lastMainFeedPostAt: recentPosts[0]?.publishedAt ?? null,
    learnedRules: listAcceptedLearnedRules({ limit: 500 }),
  };
}

export function evaluateDraftQuality(candidate, draft, pipeline, {
  relevanceOverride = null,
  growthObjective = null,
} = {}) {
  const queueItem = getQueueItemByCandidate(candidate.key);
  const strategySelection = queueItem ? getLatestWritingStrategySelectionForQueueItem(queueItem.id) : null;
  return scoreDraft(draft, candidate, {
    pipeline,
    recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidate.key }),
    recentReplies: pipeline === 'reply' ? listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidate.key }) : [],
    mediaReady: Boolean(draft?.editor?.media?.attachment?.localPath),
    mediaPublishingAvailable: true,
    relevanceOverride,
    growthObjective,
    strategyMode: strategySelection?.mode || null,
    strategySelectionId: strategySelection?.id ?? null,
    generationStrategySelectionId: draft?.editor?.generation?.strategySelectionId ?? null,
    generationStrategyMode: draft?.editor?.generation?.strategyMode ?? null,
    hasGenerationProvenance: Boolean(draft?.editor?.generation),
    strategyApproach: strategySelection?.guidance?.rationale || '',
  });
}

function writerEditorialContext(candidate, queueItem) {
  const selection = queueItem ? getLatestEditorialSelectionForQueueItem(queueItem.id) : null;
  if (selection) {
    const recommendation = getEditorialRecommendation(selection.editorialRecommendationId);
    if (!recommendation) throw new Error(`Editorial selection ${selection.id} references missing recommendation ${selection.editorialRecommendationId}.`);
    const storyEvidence = listResearchEvidence({ editorialRunId: recommendation.editorialRunId, storyKey: recommendation.storyKey });
    const linkedIds = new Set((recommendation.evidenceIds || []).map((id) => String(id)));
    return {
      recommendation,
      evidence: recommendation.decision === 'RESEARCH_MORE'
        ? storyEvidence
        : storyEvidence.filter((item) => linkedIds.has(String(item.id))),
      profileProof: recommendation.profileProof || {},
    };
  }

  const researchTopic = matchResearchTopics(candidate)[0] || null;
  return {
    recommendation: null,
    evidence: [],
    profileProof: calculateProfileProofCoverage({
      topic: researchTopic,
      semanticAnchors: researchTopic?.matchedAnchors || [],
      publishedMainFeedItems: listPublishedMainFeedContent({ limit: 30 }),
    }),
  };
}

export async function generateDraftCandidate(current) {
  const candidate = getCandidate(current.candidateKey);
  if (!candidate) throw new Error('Draft source candidate not found.');
  const queueItem = getQueueItemByCandidate(candidate.key) || ensureCandidateWorkflow(candidate.key).queueItem;
  if (current.status === 'published' || queueItem.status === 'published' || queueItem.publishedAt || queueItem.outputTweetId) {
    throw new Error('Published text is historical record and cannot be regenerated.');
  }
  const pipeline = CONTENT_PIPELINES.has(queueItem.pipeline) ? queueItem.pipeline : 'original';
  const username = String(queueItem.targetUsername || candidate.username || candidate.authorUsername || candidate.author || '').replace(/^@/, '').trim();
  const editorialContext = writerEditorialContext(candidate, queueItem);
  const strategyGeneration = getWritingStrategyGenerationContext(queueItem.id);
  if (pipeline !== 'reply' && (!strategyGeneration.selectionId || !strategyGeneration.mode)) {
    throw new Error('Choose and save No influence, Advice only, or Use for this draft before generating.');
  }
  const packet = buildWriterPacket({
    candidate,
    queueItem,
    draft: current,
    evidence: editorialContext.evidence,
    profileProof: editorialContext.profileProof,
    editorialRecommendation: editorialContext.recommendation,
    relationship: username ? getRelationshipProfile(username) : null,
    recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidate.key }),
    recentReplies: listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidate.key }),
    health: getAccountHealthSummary().health,
    writingStrategy: strategyGeneration.writingStrategy,
  });
  const promptDocumentText = await fs.readFile(path.resolve(packet.promptDocument), 'utf8');
  const output = await generateWriterOutput(packet, promptDocumentText);
  if (output.pipeline !== pipeline) throw new Error(`AI returned ${output.pipeline}; expected ${pipeline}.`);
  const validatedStrategyGeneration = validateWritingStrategyGenerationContext(queueItem.id, strategyGeneration);
  const writerBase = current.editor?.pipeline && current.editor.pipeline !== pipeline
    ? { ...current, editor: Array.isArray(current.editor?.generationHistory) ? { generationHistory: [...current.editor.generationHistory] } : {} }
    : current;
  const generationProvenance = buildWritingStrategyGenerationProvenance(validatedStrategyGeneration, {
    writerAiExecution: output.execution || null,
    writerExecutionSource: 'writer_runtime',
  });
  const next = applyWriterOutput(writerBase, output, { generationProvenance });
  const analysis = evaluateDraftQuality(candidate, next, pipeline, {
    relevanceOverride: queueItem.relevance?.humanOverride || null,
  });
  const saved = saveDraft({ ...next, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
  if (queueItem.status !== 'drafting' || queueItem.pipeline !== pipeline) {
    routeCandidate(candidate.key, pipeline, { actor: 'agent' });
  }
  return { saved, queueItem: getQueueItemByCandidate(candidate.key), output, analysis };
}

function editorialObjective(value = null) {
  const objective = String(value || getNicheProfile().profile.defaultObjective || 'qualified_growth');
  if (!EDITORIAL_OBJECTIVES.includes(objective)) throw new Error(`Unsupported editorial objective: ${objective}.`);
  return objective;
}

function sourceFreshnessView() {
  return SOURCE_SNAPSHOT_KINDS.map((kind) => {
    const snapshot = getDiscoverSnapshot(kind);
    return {
      kind,
      fetchedAt: snapshot.fetchedAt,
      lastRefreshAttemptAt: snapshot.lastRefreshAttemptAt,
      error: snapshot.error,
      legacyFallback: snapshot.legacyFallback,
      candidateCount: snapshot.candidates.length,
    };
  });
}

function editorialEvidenceRows(recommendation) {
  const storyEvidence = listResearchEvidence({ editorialRunId: recommendation.editorialRunId, storyKey: recommendation.storyKey });
  if (recommendation.decision === 'RESEARCH_MORE') return storyEvidence;
  const referenced = new Set((recommendation.evidenceIds || []).map((id) => String(id)));
  return storyEvidence.filter((item) => referenced.has(String(item.id)));
}

function formatEditorialEvidence(item) {
  return {
    id: String(item.id),
    claim: item.claim,
    claimType: item.claimType,
    status: item.status,
    sourceKind: item.sourceKind,
    sourceFamily: item.sourceFamily,
    requestedUrl: item.requestedUrl,
    resolvedUrl: item.resolvedUrl,
    title: item.title,
    summary: item.summary,
    observedAt: item.observedAt,
  };
}

function formatEditorialRecommendationView(recommendation) {
  const evidence = editorialEvidenceRows(recommendation);
  const statusCounts = {};
  for (const item of evidence) statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
  const selection = getEditorialSelectionByRecommendation(recommendation.id);
  const queueItem = selection ? getQueueItem(selection.queueItemId) : null;
  return {
    id: recommendation.id,
    rank: recommendation.rank,
    decision: recommendation.decision,
    pipeline: recommendation.pipeline,
    objective: recommendation.objective,
    title: recommendation.title,
    thesis: recommendation.thesis,
    whyNow: recommendation.whyNow,
    whyThisFormat: recommendation.whyThisFormat,
    desiredReaderOutcome: recommendation.desiredReaderOutcome,
    candidateKeys: recommendation.candidateKeys,
    targetCandidateKey: recommendation.targetCandidateKey,
    potentials: recommendation.potentials || {},
    authority: recommendation.authority || {},
    profileProof: recommendation.profileProof || {},
    evidenceIds: (recommendation.evidenceIds || []).map(String),
    evidence: evidence.map(formatEditorialEvidence),
    evidenceState: {
      count: evidence.length,
      statuses: statusCounts,
      sourceFamilies: [...new Set(evidence.map((item) => item.sourceFamily).filter(Boolean))],
    },
    algorithmEvidence: recommendation.algorithmEvidence || [],
    learnedContext: recommendation.learnedContext || {},
    aiExecution: recommendation.aiExecution || {},
    risks: recommendation.risks || [],
    alternatives: recommendation.alternatives || [],
    researchQuestions: recommendation.researchQuestions || [],
    status: recommendation.status,
    selectedAt: recommendation.selectedAt,
    dismissedAt: recommendation.dismissedAt,
    createdAt: recommendation.createdAt,
    sources: (recommendation.candidateKeys || []).map((key) => getCandidate(key)).filter(Boolean).map((candidate) => ({
      key: candidate.key,
      source: candidate.source,
      title: candidate.title || '',
      text: candidate.text || '',
      url: candidate.url || '',
    })),
    selection: selection ? {
      id: selection.id,
      queueItemId: selection.queueItemId,
      selectedPipeline: selection.selectedPipeline,
      selectedAt: selection.selectedAt,
      candidateKey: queueItem?.candidateKey || null,
      draftId: queueItem?.draftId ?? null,
      queueStatus: queueItem?.status || null,
    } : null,
  };
}

function editorialPlanView(objective) {
  const selectedObjective = editorialObjective(objective);
  const plan = getLatestEditorialPlan(selectedObjective);
  const recommendations = plan ? plan.recommendations.map(formatEditorialRecommendationView) : [];
  return {
    objective: selectedObjective,
    hasPlan: Boolean(plan),
    run: plan ? {
      id: plan.run.id,
      status: plan.run.status,
      createdAt: plan.run.createdAt,
      completedAt: plan.run.completedAt,
      sourceSnapshot: plan.run.sourceSnapshot || {},
      aiExecution: plan.run.aiExecution || {},
    } : null,
    sourceFreshness: sourceFreshnessView(),
    recommendations,
    noStrongAction: Boolean(plan && recommendations.length === 0),
    noStrongActionReason: plan?.run?.context?.noStrongCurrentActionReason || '',
  };
}

export function requireEngagementSendAllowed() {
  const summary = getAccountHealthSummary();
  if (summary.health.state !== 'constrained') return summary;
  const reason = summary.health.reasons.find((item) => item.level === 'constrained');
  throw new Error(`Engagement send blocked by supported observed constraint: ${reason?.message || 'account health constrained'}`);
}

// ---------------------------------------------------------------------------
// Payload formatting helpers
// ---------------------------------------------------------------------------

function formatCandidate(candidate, { includeQueue = true, sourceKind = null, editorialRecommendation = null, objective = null } = {}) {
  const metrics = candidate.metrics || {};
  const niche = candidate.niche || {};
  let queueItem = includeQueue ? getQueueItemByCandidate(candidate.key) : null;
  if (includeQueue && candidate.saved && queueItem && !queueItem.recommendedPipeline) {
    queueItem = refreshQueueRecommendation(candidate.key).queueItem;
  }
  const workflow = includeQueue && queueItem ? inspectWorkflow(candidate.key) : null;
  const growthFit = assessStrategicRelevance(candidate, {
    objective,
    humanOverride: queueItem?.relevance?.humanOverride || null,
  });
  const draft = workflow?.draft || (includeQueue && queueItem?.draftId ? getDraft(queueItem.draftId) : null);
  const actions = includeQueue ? listCandidateActions(candidate.key) : [];
  const actionViews = actions.map((action) => candidateActionView(action, queueItem));
  const publishedWithoutAction = includeQueue && queueItem && (queueItem.status === 'published' || queueItem.publishedAt || queueItem.outputTweetId)
    ? candidateActionView({
        action: queueItem.pipeline === 'quote' ? 'quote' : queueItem.pipeline === 'reply' ? 'reply' : queueItem.pipeline === 'repost' ? 'repost' : 'direct',
        outputUrl: queueItem.outputUrl || null,
        createdAt: queueItem.publishedAt || null,
      }, queueItem)
    : null;
  const completion = actionViews[0] || publishedWithoutAction;
  const sourceMomentum = sourceKind ? getSourceMomentum(candidate.key, sourceKind) : null;
  return {
    key: candidate.key,
    title: candidate.title || candidate.text?.slice(0, 80) || 'Untitled',
    text: candidate.text || '',
    displayText: candidate.source === 'hn' && candidate.text === candidate.title ? '' : candidate.text,
    url: candidate.url || '',
    source: candidate.source || 'unknown',
    timestamp: candidate.timestamp || null,
    score: candidate.score || 0,
    saved: Boolean(candidate.saved),
    metrics: candidate.source === 'github'
      ? metrics.starsToday != null && metrics.rank != null
        ? {
            stars: metrics.stars,
            starsToday: metrics.starsToday,
            forks: metrics.forks,
            language: metrics.language,
            rank: metrics.rank,
            kind: 'github',
          }
        : { stars: metrics.stars, starsPerDay: metrics.starsPerDay, kind: 'github_legacy' }
      : candidate.source === 'hn'
        ? metrics.rank != null
          ? { points: metrics.points, comments: metrics.comments, by: metrics.by, rank: metrics.rank, hnUrl: metrics.hnUrl, kind: 'hn' }
          : { points: metrics.points, comments: metrics.comments, kind: 'hn_legacy' }
        : { views: metrics.views, likes: metrics.likes, retweets: metrics.retweets, replies: metrics.replies, kind: 'x' },
    niche: {
      tags: (niche.tags || []).map((tag) => ({ tag, label: NICHE_LABELS[tag] || tag })),
      matches: niche.matches || [],
      score: niche.score ?? null,
      status: niche.status || 'unclassified',
      profileRevision: niche.profileRevision ?? null,
      classifierVersion: niche.classifierVersion ?? null,
      classifiedAt: niche.classifiedAt ?? null,
    },
    growthFit,
    viral: candidate.viral
      ? {
          tier: candidate.viral.tier,
          label: candidate.viral.tier === 'breakout' ? 'Breaking out' : candidate.viral.tier === 'viral' ? 'Widely discussed' : 'Picking up',
          ageHours: candidate.viral.ageHours,
          viewsPerHour: Math.round(candidate.viral.viewsPerHour || 0),
          engagementsPerHour: candidate.viral.engagementsPerHour,
          score: candidate.viral.score,
        }
      : null,
    sourceMomentum: sourceMomentum?.current ? {
      snapshotKind: sourceMomentum.snapshotKind,
      current: sourceMomentum.current,
      previous: sourceMomentum.previous,
      intervalMs: sourceMomentum.intervalMs,
      intervalHours: sourceMomentum.intervalHours,
      deltas: sourceMomentum.deltas,
      reason: sourceMomentum.reason,
    } : null,
    editorialPlan: editorialRecommendation ? {
      recommendationId: editorialRecommendation.id,
      rank: editorialRecommendation.rank,
      decision: editorialRecommendation.decision,
      pipeline: editorialRecommendation.pipeline,
      status: editorialRecommendation.status,
      title: editorialRecommendation.title,
    } : null,
    queue: queueItem
      ? {
          id: queueItem.id,
          pipeline: queueItem.pipeline,
          pipelineLabel: label(PIPELINE_LABELS, queueItem.pipeline),
          status: queueItem.status,
          statusLabel: queueStatusLabel(queueItem),
          recommendedPipeline: queueItem.recommendedPipeline || null,
          recommendedPipelineLabel: queueItem.recommendedPipeline ? label(PIPELINE_LABELS, queueItem.recommendedPipeline) : null,
          routingReason: queueItem.routingReason || '',
          routingDecision: queueItem.routingDecision || {},
          draftId: queueItem.draftId ?? null,
          draftQualityScore: draft?.qualityScore ?? null,
          potentials: {
            reach: Math.round(workflow?.scores?.reachPotential ?? queueItem.reachPotential ?? 0),
            follow: Math.round(workflow?.scores?.followPotential ?? queueItem.followPotential ?? 0),
            conversation: Math.round(workflow?.scores?.conversationPotential ?? queueItem.conversationPotential ?? 0),
            relationship: Math.round(workflow?.scores?.relationshipPotential ?? queueItem.relationshipPotential ?? 0),
          },
        }
      : null,
    completion,
    actions: actionViews,
  };
}

function formatGates(gates = {}) {
  const failures = gates.failures || [];
  return {
    passed: gates.passed === true,
    approvalFailures: failures,
    warnings: gates.warnings || [],
  };
}

function formatDraft(draft, { analysis = null } = {}) {
  if (!draft) return null;
  const currentGates = analysis?.gates || draft.gates || {};
  const attachment = draft.editor?.media?.attachment;
  const editor = attachment
    ? {
        ...(draft.editor || {}),
        media: {
          ...(draft.editor?.media || {}),
          attachment: {
            fileName: attachment.fileName || '',
            mimeType: attachment.mimeType || '',
            size: Number(attachment.size || 0),
            attachedAt: Number(attachment.attachedAt || 0),
            provenance: attachment.provenance || '',
          },
        },
      }
    : (draft.editor || {});
  const payload = {
    id: draft.id,
    candidateKey: draft.candidateKey,
    hook: draft.hook || '',
    insight: draft.insight || '',
    evidence: draft.evidence || '',
    action: draft.action || '',
    body: draft.body || '',
    threadParts: draft.threadParts || [],
    editor,
    gates: currentGates,
    gatesView: formatGates(currentGates),
    growthPackaging: analysis?.growthPackaging || null,
    qualityScore: analysis?.score ?? draft.qualityScore ?? 0,
    status: draft.status,
    scheduledAt: draft.scheduledAt || null,
    publishedTweetId: draft.publishedTweetId || null,
    publishedAt: draft.publishedAt || null,
  };
  if (analysis) {
    payload.liveAnalysis = {
      score: analysis.score,
      gates: analysis.gates,
      gatesView: formatGates(analysis.gates),
      breakdown: analysis.breakdown || {},
      weightedLength: analysis.weightedLength ?? null,
      growthPackaging: analysis.growthPackaging || null,
    };
  }
  return payload;
}

function formatQueueItem(queueItem) {
  if (!queueItem) return null;
  const snapshot = inspectWorkflow(queueItem.candidateKey);
  const draft = queueItem.draftId ? getDraft(queueItem.draftId) : null;
  const candidate = snapshot.candidate;
  return {
    id: queueItem.id,
    candidateKey: queueItem.candidateKey,
    title: candidate?.title || queueItem.candidateKey,
    text: candidate?.text || '',
    url: candidate?.url || '',
    source: candidate?.source || '',
    pipeline: queueItem.pipeline,
    pipelineLabel: label(PIPELINE_LABELS, queueItem.pipeline),
    status: queueItem.status,
    statusLabel: queueStatusLabel(queueItem),
    lane: queueItem.lane,
    targetUsername: queueItem.targetUsername || null,
    draftId: queueItem.draftId ?? null,
    draft: formatDraft(draft, {
      analysis: draft
        && queueItem.status !== 'published'
        && !queueItem.publishedAt
        && !queueItem.outputTweetId
        && CONTENT_PIPELINES.has(queueItem.pipeline)
        ? evaluateDraftQuality(candidate, draft, queueItem.pipeline, {
            relevanceOverride: queueItem.relevance?.humanOverride || null,
          })
        : null,
    }),
    recommendedPipeline: queueItem.recommendedPipeline || null,
    recommendedPipelineLabel: queueItem.recommendedPipeline ? label(PIPELINE_LABELS, queueItem.recommendedPipeline) : null,
    routingReason: queueItem.routingReason || '',
    routingDecision: queueItem.routingDecision || {},
    expiresAt: queueItem.expiresAt || null,
    scheduledAt: queueItem.scheduledAt || null,
    scheduleUrgency: queueItem.scheduleUrgency || 'evergreen',
    scheduleSource: queueItem.scheduleSource || '',
    humanApprovedAt: queueItem.humanApprovedAt || null,
    approvedText: queueItem.approvedText || null,
    publishStartedAt: queueItem.publishStartedAt || null,
    publishedAt: queueItem.publishedAt || null,
    publishedTweetId: queueItem.publishedTweetId || queueItem.outputTweetId || null,
    outputUrl: queueItem.outputUrl || null,
    publishError: queueItem.publishError || null,
    growthFit: snapshot.growthFit,
    potentials: {
      reach: Math.round(queueItem.reachPotential || 0),
      follow: Math.round(queueItem.followPotential || 0),
      conversation: Math.round(queueItem.conversationPotential || 0),
      relationship: Math.round(queueItem.relationshipPotential || 0),
    },
  };
}

function draftEditorPayload(draftId) {
  const draft = getDraft(Number(draftId));
  if (!draft) return null;
  const candidate = getCandidate(draft.candidateKey);
  if (!candidate) return null;
  const queueItem = getQueueItemByCandidate(candidate.key);
  const pipeline = CONTENT_PIPELINES.has(queueItem?.pipeline) ? queueItem.pipeline : 'original';
  const growthFit = assessStrategicRelevance(candidate, { humanOverride: queueItem?.relevance?.humanOverride || null });
  const analysis = evaluateDraftQuality(candidate, draft, pipeline, {
    relevanceOverride: queueItem?.relevance?.humanOverride || null,
  });
  const engagementReply = queueItem?.lane === 'engagement' && pipeline === 'reply';
  const health = getAccountHealthSummary();
  const engagementConstrained = engagementReply && health.health.state === 'constrained';
  const gatesPassed = analysis.gates?.passed === true;
  const readOnly = draft.status === 'published' || queueItem?.status === 'published' || Boolean(queueItem?.publishedAt || queueItem?.outputTweetId);
  let schedule = null;
  if (queueItem?.status === 'approved' && ['main', 'main_feed'].includes(queueItem.lane) && SCHEDULABLE_MAIN_FEED_PIPELINES.has(queueItem.pipeline)) {
    const item = getMainFeedScheduleItem(queueItem.candidateKey);
    if (item) {
      const context = schedulerContext();
      const scheduleDecision = recommendMainFeedSchedule(item, context);
      schedule = {
        recommendedAt: scheduleDecision.recommendedAt ?? null,
        eligible: Boolean(scheduleDecision.eligible),
        reason: scheduleDecision.reason || '',
        blockers: scheduleDecision.blockers || [],
        warnings: scheduleDecision.warnings || [],
        conflicts: scheduleDecision.conflicts || [],
        priority: scheduleDecision.priority ?? null,
        manualOnly: queueItem.pipeline === 'repost',
        scheduledAt: queueItem.scheduledAt || null,
        expiresAt: queueItem.expiresAt || null,
        scheduleUrgency: queueItem.scheduleUrgency || 'evergreen',
        scheduleSource: queueItem.scheduleSource || '',
        automation: AUTO_POST,
      };
    }
  }
  const username = String(queueItem?.engagementTargetUsername || candidate.username || candidate.authorUsername || candidate.author || '').replace(/^@/, '').trim();
  const relationship = engagementReply && username ? getRelationshipProfile(username) : null;
  return {
    mode: engagementReply ? 'conversation' : 'create',
    draft: formatDraft(draft, { analysis: readOnly ? null : analysis }),
    candidate: {
      key: candidate.key,
      title: candidate.title,
      text: candidate.text,
      url: candidate.url,
      source: candidate.source,
    },
    pipeline,
    pipelineLabel: label(PIPELINE_LABELS, pipeline),
    queueItem: formatQueueItem(queueItem),
    growthFit,
    analysis: {
      score: analysis.score,
      gates: analysis.gates,
      gatesView: formatGates(analysis.gates),
      breakdown: analysis.breakdown || {},
      growthPackaging: analysis.growthPackaging || null,
    },
    flags: {
      engagementReply,
      engagementConstrained,
      readOnly,
      canReview: !readOnly && CONTENT_PIPELINES.has(pipeline) && ['drafting', 'needs_review'].includes(queueItem?.status),
      canApprove: queueItem?.status === 'needs_review' && MAIN_FEED_PIPELINES.has(pipeline) && analysis.score >= 40 && gatesPassed && analysis.growthPackaging?.ready === true,
      canApproveSend: engagementReply && !engagementConstrained && queueItem?.status === 'needs_review' && analysis.score >= 40 && gatesPassed && analysis.growthPackaging?.ready === true,
      canSendApproved: engagementReply && !engagementConstrained && queueItem?.status === 'approved' && Boolean(queueItem.humanApprovedAt) && Boolean(queueItem.approvedText),
      approvedMainFeed: !engagementReply && queueItem?.status === 'approved' && Boolean(queueItem.humanApprovedAt),
    },
    relationship: relationship
      ? {
          username: relationship.username,
          stage: relationship.relationshipStage,
          targetScore: Math.round(relationship.targetScore || 0),
          classes: relationship.classes || [],
          theirRepliesToUs: relationship.theirRepliesToUs || 0,
          meaningfulInteractions: relationship.meaningfulInteractions || 0,
        }
      : null,
    schedule,
  };
}

function formatConversationDetail(key) {
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem || queueItem.lane !== 'engagement') return null;
  const candidate = getCandidate(queueItem.candidateKey);
  const draft = getDraftByCandidate(key);
  const profile = queueItem.targetUsername ? getRelationshipProfile(queueItem.targetUsername) : null;
  const score = queueItem.engagement || {};
  const health = getAccountHealthSummary();
  const constrained = health.health.state === 'constrained';
  const payload = draftEditorPayload(draft?.id);
  const gatesPassed = payload?.analysis?.gates?.passed === true;
  return {
    key,
    targetUsername: queueItem.targetUsername || profile?.username || 'unknown',
    engagementKind: queueItem.engagementKind || 'initial_reply',
    engagementKindLabel: queueItem.engagementKind === 'initial_reply' ? 'New conversation' : 'Continue conversation',
    status: queueItem.status,
    statusLabel: queueStatusLabel(queueItem),
    priority: queueItem.priority,
    priorityLabel: opportunityLabel(queueItem.priority),
    contribution: queueItem.contributionSummary || score.contribution?.summary || '',
    replyArchetype: queueItem.replyArchetype || score.contribution?.archetype || '',
    expiresAt: queueItem.expiresAt || null,
    freshness: score.freshness || null,
    rejectionReasons: score.rejectionReasons || [],
    expiry: score.expiry || {},
    softPressure: score.explanation?.softPressure || null,
    saturationSummary: score.explanation?.saturationSummary || null,
    repetitionSummary: score.explanation?.repetitionSummary || null,
    learnedAdjustment: score.learnedAdjustment || score.explanation?.learning || null,
    components: score.components || {},
    candidate: candidate
      ? { key: candidate.key, title: candidate.title, text: candidate.text, url: candidate.url }
      : null,
    relationship: profile
      ? {
          username: profile.username,
          displayName: profile.displayName,
          stage: profile.relationshipStage,
          targetScore: Math.round(profile.targetScore || 0),
          targetScoreLabel: opportunityLabel(profile.targetScore),
          classes: profile.classes || [],
          theirRepliesToUs: profile.theirRepliesToUs || 0,
          meaningfulInteractions: profile.meaningfulInteractions || 0,
        }
      : null,
    editor: payload,
    health: {
      state: health.health.state,
      constrained,
    },
    autonomousDecision: queueItem.targetTweetId ? getAutonomousReplyDecisionForTarget(queueItem.targetTweetId) : null,
    flags: {
      canReview: Boolean(draft) && ['drafting', 'needs_review', 'failed'].includes(queueItem.status),
      canApproveSend: !constrained && queueItem.status === 'needs_review' && Number(payload?.analysis?.score || 0) >= 40 && gatesPassed,
      approved: !constrained && queueItem.status === 'approved' && Boolean(queueItem.humanApprovedAt) && Boolean(queueItem.approvedText),
    },
  };
}

function formatMeasurementSeries(series, { latestOnly = false } = {}) {
  return series.map(({ queueItem, candidate, measurements }) => {
    if (latestOnly) {
      const latest = measurements.at(-1) || null;
      if (!latest) return null;
      const windowLabel = Number(latest.windowMinutes) === 1440 ? '24h' : Number(latest.windowMinutes) === 360 ? '6h' : Number(latest.windowMinutes) === 60 ? '1h' : `${latest.windowMinutes}m`;
      return {
        title: candidate?.title || queueItem.candidateKey,
        pipeline: queueItem.pipeline,
        publishedAt: queueItem.publishedAt || null,
        outputUrl: queueItem.outputUrl || null,
        windowLabel,
        latest,
      };
    }
    return {
      title: candidate?.title || queueItem.candidateKey,
      pipeline: queueItem.pipeline,
      publishedAt: queueItem.publishedAt || null,
      outputUrl: queueItem.outputUrl || null,
      measurements,
    };
  }).filter(Boolean);
}

function formatAudienceProfile(profile) {
  const signals = profile.fitBucket === 'outside_niche'
    ? (profile.exclusionMatches?.length
      ? { kind: 'exclusion', terms: profile.exclusionMatches.slice(0, 4) }
      : profile.deprioritizationMatches?.length
        ? { kind: 'deprioritized', terms: profile.deprioritizationMatches.slice(0, 4) }
        : { kind: 'none', terms: [] })
    : profile.fitBucket === 'uncertain'
      ? (profile.deprioritizationMatches?.length
        ? { kind: 'deprioritized', terms: profile.deprioritizationMatches.slice(0, 4) }
        : { kind: 'none', terms: [] })
      : { kind: 'niche', terms: (profile.nicheTags || []).map(nicheTagLabel) };
  return {
    username: profile.username,
    displayName: profile.displayName || profile.username,
    bio: profile.bio || '',
    followsYou: Boolean(profile.followsYou),
    youFollow: Boolean(profile.youFollow),
    fitBucket: profile.fitBucket || 'uncertain',
    relevanceScore: profile.relevanceScore || 0,
    nicheTags: (profile.nicheTags || []).map(nicheTagLabel),
    matchedKeywords: profile.matchedKeywords || [],
    exclusionMatches: profile.exclusionMatches || [],
    deprioritizationMatches: profile.deprioritizationMatches || [],
    signals,
    lastSeenAt: profile.lastSeenAt || null,
    firstSeenAt: profile.firstSeenAt || null,
  };
}

function formatExperimentSummary(summary) {
  if (!summary) return null;
  return {
    primaryMetric: summary.primaryMetric,
    primaryMetricLabel: label(EXPERIMENT_METRIC_LABELS, summary.primaryMetric),
    primaryMetricValues: summary.primaryMetricValues || {},
    completedByVariant: summary.completedByVariant || {},
    cohorts: summary.cohorts || {},
    evidence: summary.evidence ? { ...summary.evidence, label: label(EVIDENCE_LABELS, summary.evidence.state) } : null,
  };
}

function formatExperiment(experiment, { queueItems = [] } = {}) {
  const result = getExperimentSummary(experiment.id);
  const network = EXPERIMENT_DIMENSIONS.network.includes(experiment.dimension);
  const summaries = network
    ? [{ label: 'Conversation outcomes', summary: result.summary }]
    : Object.entries(result.byWindow || {}).map(([window, summary]) => ({ label: `${window}m window`, summary }));
  const assignedItems = listExperimentAssignments(experiment.id);
  const assignable = experiment.status === 'active'
    ? queueItems.filter((item) => {
        if (item.experimentVariantId != null || !['triage', 'researching', 'watching', 'drafting'].includes(item.status)) return false;
        return network ? item.lane === 'engagement' : ['main', 'main_feed'].includes(item.lane);
      })
    : [];
  return {
    id: experiment.id,
    name: experiment.name,
    hypothesis: experiment.hypothesis,
    dimension: experiment.dimension,
    dimensionLabel: label(EXPERIMENT_DIMENSION_LABELS, experiment.dimension),
    primaryMetric: experiment.primaryMetric,
    primaryMetricLabel: label(EXPERIMENT_METRIC_LABELS, experiment.primaryMetric),
    secondaryMetrics: experiment.secondaryMetrics || [],
    population: experiment.population || {},
    minimumCompletedPerVariant: experiment.minimumCompletedPerVariant,
    status: experiment.status,
    isNetwork: network,
    variants: (experiment.variants || []).map((variant) => variant.label),
    summaries: summaries.map(({ label: summaryLabel, summary }) => ({ label: summaryLabel, summary: formatExperimentSummary(summary) })),
    assignments: assignedItems.map(({ queueItem, variantLabel }) => ({
      candidateKey: queueItem.candidateKey,
      variantLabel,
      lane: queueItem.lane,
      pipeline: queueItem.pipeline,
      status: queueItem.status,
      statusLabel: queueStatusLabel(queueItem),
      assignedAt: queueItem.experimentAssignedAt || null,
    })),
    assignableItems: assignable.map((item) => {
      const candidate = getCandidate(item.candidateKey);
      const itemLabel = network && item.targetUsername ? `@${item.targetUsername}` : (candidate?.title || item.candidateKey);
      return { key: item.candidateKey, label: itemLabel, status: item.status, statusLabel: queueStatusLabel(item) };
    }),
  };
}

function formatLearnedRule(rule) {
  const adjustment = rule.adjustment || {};
  const evidence = rule.evidence || {};
  const review = rule.review || {};
  const comparison = rule.comparison || {};
  return {
    id: rule.id,
    ruleId: rule.ruleId,
    status: rule.status,
    statusLabel: rule.status === 'accepted' ? 'Accepted change' : rule.status === 'retired' ? 'Past learning' : 'Suggested change',
    scope: rule.scope,
    key: rule.key,
    finding: rule.finding || '',
    recommendation: rule.recommendation || '',
    primaryMetric: rule.primaryMetric || null,
    primaryMetricLabel: rule.primaryMetric ? label(EXPERIMENT_METRIC_LABELS, rule.primaryMetric) : null,
    evidence: {
      ...evidence,
      label: label(EVIDENCE_LABELS, evidence.state || 'insufficient'),
    },
    comparison,
    adjustment,
    match: rule.match || {},
    mechanismTags: rule.mechanismTags || [],
    acceptance: rule.acceptance || null,
    review,
  };
}

function aiProfileCapability(profile) {
  if (!profile) return 'unsupported';
  if (profile.runtime === 'codex' || profile.runtime === 'opencode' || profile.runtime === 'agy') return 'supported';
  if (profile.runtime !== 'direct_api') return 'unsupported';
  const configured = profile.settings?.structuredOutput;
  if (['supported', 'compatible_fallback', 'unknown', 'unsupported'].includes(configured)) return configured;
  return profile.providerKind === 'openai' ? 'supported' : 'compatible_fallback';
}

function aiProfileInput(payload = {}) {
  const input = {};
  for (const key of ['name', 'runtime', 'providerKind', 'baseUrl', 'protocol', 'model', 'reasoning', 'runtimeProfile', 'settings', 'enabled']) {
    if (payload[key] !== undefined) input[key] = payload[key];
  }
  return input;
}

async function formatAiProfile(profile) {
  if (!profile) return null;
  const secret = await getAiSecretStatus(profile.secretRef || '');
  return {
    id: profile.id,
    name: profile.name,
    runtime: profile.runtime,
    providerKind: profile.providerKind,
    baseUrl: profile.baseUrl,
    protocol: profile.protocol,
    model: profile.model,
    reasoning: profile.reasoning,
    runtimeProfile: profile.runtimeProfile,
    settings: profile.settings || {},
    enabled: profile.enabled !== false,
    compatibility: profile.compatibility === true,
    capability: aiProfileCapability(profile),
    secret: { source: secret.source, hasSecret: secret.hasSecret },
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

async function formatAiRole(role) {
  const binding = getAiRoleBinding(role);
  const resolved = resolveAiProfileForRole(role);
  return {
    role,
    activity: role === 'continuous_scan' ? 'not_active' : (resolved.profile ? 'configured' : 'unconfigured'),
    primaryProfileId: binding?.primaryProfileId ?? null,
    fallbackProfileId: binding?.fallbackProfileId ?? null,
    primaryProfile: binding?.primaryProfile ? await formatAiProfile(binding.primaryProfile) : null,
    fallbackProfile: binding?.fallbackProfile ? await formatAiProfile(binding.fallbackProfile) : null,
    resolvedProfile: resolved.profile ? await formatAiProfile(resolved.profile) : null,
    resolutionSource: resolved.source,
  };
}

async function aiSettingsView() {
  const profiles = await Promise.all(listAiProfiles({ limit: 500 }).map(formatAiProfile));
  const runtimeSettings = getAiRuntimeSettings();
  return {
    profiles,
    defaultProfileId: runtimeSettings.defaultProfileId,
    defaultProfile: runtimeSettings.defaultProfile ? await formatAiProfile(runtimeSettings.defaultProfile) : null,
    roles: await Promise.all(AI_ROLES.map(formatAiRole)),
  };
}

function requireAiProfile(id) {
  const profile = getAiProfile(Number(id));
  if (!profile) throw new Error(`AI profile not found: ${id}`);
  return profile;
}

function assertAssignableAiProfile(profile, { confirmUnknownCapability = false } = {}) {
  if (!profile.enabled) throw new Error(`AI profile is disabled: ${profile.id}`);
  const capability = aiProfileCapability(profile);
  if (capability === 'unsupported') throw new Error(`${profile.name} does not support the structured-output path required by AI roles.`);
  if (capability === 'unknown' && confirmUnknownCapability !== true) {
    throw new Error(`${profile.name} has unknown structured-output capability. Confirm the advanced assignment explicitly.`);
  }
  return profile;
}

async function cleanupUnreferencedAiSecret(secretRef) {
  if (!String(secretRef || '').startsWith('file:')) return;
  if (countAiProfilesUsingSecretRef(secretRef) > 0) return;
  await removeAiSecret(secretRef);
}

async function createAiProfileFromPayload(payload) {
  const input = aiProfileInput(payload);
  const apiKey = String(payload.apiKey || '').trim();
  const secretEnv = String(payload.secretEnv || '').trim();
  if (apiKey && secretEnv) throw new Error('Choose either a local API key or an environment-variable secret, not both.');
  if (input.runtime !== 'direct_api' && (apiKey || secretEnv)) {
    throw new Error('Runtime-managed profiles use runtime-managed credentials, not product API keys.');
  }

  let createdSecretRef = '';
  if (apiKey) {
    const secret = await setAiSecret(null, apiKey);
    input.secretRef = secret.secretRef;
    createdSecretRef = secret.secretRef;
  } else if (secretEnv) {
    input.secretRef = `env:${secretEnv}`;
  }

  try {
    return createAiProfile(input);
  } catch (error) {
    if (createdSecretRef) await cleanupUnreferencedAiSecret(createdSecretRef).catch(() => {});
    throw error;
  }
}

async function updateAiProfileFromPayload(id, payload) {
  const current = requireAiProfile(id);
  const input = aiProfileInput(payload);
  const nextRuntime = String(input.runtime ?? current.runtime);
  const apiKey = String(payload.apiKey || '').trim();
  const secretEnv = String(payload.secretEnv || '').trim();
  if (apiKey && secretEnv) throw new Error('Choose either a local API key or an environment-variable secret, not both.');
  if (nextRuntime !== 'direct_api' && (apiKey || secretEnv)) {
    throw new Error('Runtime-managed profiles use runtime-managed credentials, not product API keys.');
  }

  let nextSecretRef = current.secretRef;
  let createdSecretRef = '';
  if (nextRuntime !== 'direct_api') {
    nextSecretRef = '';
  } else if (apiKey) {
    const existingFileRef = String(current.secretRef || '').startsWith('file:') ? current.secretRef : null;
    const secret = await setAiSecret(existingFileRef, apiKey);
    nextSecretRef = secret.secretRef;
    if (!existingFileRef) createdSecretRef = secret.secretRef;
  } else if (secretEnv) {
    nextSecretRef = `env:${secretEnv}`;
  }
  if (nextSecretRef !== current.secretRef) input.secretRef = nextSecretRef;

  let updated;
  try {
    updated = updateAiProfile(current.id, input);
  } catch (error) {
    if (createdSecretRef) await cleanupUnreferencedAiSecret(createdSecretRef).catch(() => {});
    throw error;
  }
  if (current.secretRef && current.secretRef !== updated.secretRef) await cleanupUnreferencedAiSecret(current.secretRef);
  return updated;
}

function formatAiRun(run) {
  const profile = run.profileId == null ? null : getAiProfile(run.profileId);
  return {
    id: run.id,
    invocationId: run.invocationId,
    attempt: run.attempt,
    attemptKind: run.attemptKind,
    role: run.role,
    profileId: run.profileId,
    profileName: profile?.name || (run.metadata?.compatibilityProfile ? 'Current Codex configuration' : null),
    profileSource: run.metadata?.profileSource || null,
    runtime: run.runtime,
    providerKind: run.providerKind,
    model: run.model,
    reasoning: run.reasoning,
    fallbackProfileId: run.fallbackProfileId,
    fallbackUsed: run.fallbackUsed,
    status: run.status,
    errorCode: run.errorCode,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    durationMs: run.durationMs,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    costUsd: run.costUsd,
    requestCount: run.metadata?.requestCount ?? null,
    repairAttempted: run.metadata?.repairAttempted === true,
  };
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 128_000) throw new Error('Request too large.');
  }
  if (!body.trim()) return {};
  const parsed = JSON.parse(body);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Request body must be a JSON object.');
  return parsed;
}

async function readBinary(req, maxBytes = MAX_DRAFT_MEDIA_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error(`Image exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
    chunks.push(chunk);
  }
  if (!size) throw new Error('Image upload is empty.');
  return Buffer.concat(chunks, size);
}

function draftMediaAttachment(draft) {
  const attachment = draft?.editor?.media?.attachment;
  if (!attachment || typeof attachment !== 'object') return null;
  const localPath = path.resolve(String(attachment.localPath || ''));
  if (!localPath.startsWith(`${DRAFT_MEDIA_DIR}${path.sep}`)) return null;
  return { ...attachment, localPath };
}

async function persistDraftMedia(draft, req) {
  const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const extension = DRAFT_MEDIA_MIME[mimeType];
  if (!extension) throw new Error('Attach a JPEG, PNG, WebP, or GIF image.');
  const buffer = await readBinary(req);
  await fs.mkdir(DRAFT_MEDIA_DIR, { recursive: true, mode: 0o700 });
  const rawName = String(req.headers['x-file-name'] || 'image');
  let fileName = rawName;
  try { fileName = decodeURIComponent(rawName); } catch {}
  fileName = path.basename(fileName).slice(0, 180) || `draft-${draft.id}.${extension}`;
  const localPath = path.join(DRAFT_MEDIA_DIR, `draft-${draft.id}-${Date.now()}.${extension}`);
  await fs.writeFile(localPath, buffer, { mode: 0o600 });

  const previous = draftMediaAttachment(draft);
  const media = {
    ...(draft.editor?.media || {}),
    required: true,
    attachment: {
      localPath,
      fileName,
      mimeType,
      size: buffer.length,
      attachedAt: Date.now(),
      provenance: 'operator_upload',
    },
  };
  try {
    const saved = saveDraft({ ...draft, editor: { ...(draft.editor || {}), media }, gates: {}, status: 'draft' });
    if (previous?.localPath && previous.localPath !== localPath) await fs.rm(previous.localPath, { force: true }).catch(() => {});
    return saved;
  } catch (error) {
    await fs.rm(localPath, { force: true }).catch(() => {});
    throw error;
  }
}

function first1000MissionView() {
  return {
    grant: getFirst1000MainFeedMissionGrant(),
    autoPost: AUTO_POST,
  };
}

// ---------------------------------------------------------------------------
// API entrypoint
// ---------------------------------------------------------------------------

export async function handleApi(req, res, requestUrl) {
  const sendJson = (status, payload) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  };
  const sendSuccess = (data) => sendJson(200, { state: 'success', data });
  const sendNotFound = (message = 'API route not found') => sendJson(404, { state: 'error', code: 'NOT_FOUND', message });

  try {
    const segments = requestUrl.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const method = req.method;
    const query = requestUrl.searchParams;
    let body = null;
    const readBody = async () => (body ??= await readJson(req));

    if (method === 'GET' && segments.length === 1 && segments[0] === 'session') {
      const now = Date.now();
      const health = getAccountHealthSummary();
      const decisions = rankMainFeedItems(listApprovedMainFeedItems({ automatedOnly: true, limit: 100 }), schedulerContext(now));
      const nextScheduled = decisions.find((item) => item.eligible) || null;
      return sendSuccess({
        automation: AUTO_POST,
        account: ACCOUNT,
        health: {
          state: health.health.state,
          label: label(HEALTH_STATE_COPY, health.health.state),
          explanation: health.health.explanation || '',
        },
        nextScheduled: nextScheduled
          ? { recommendedAt: nextScheduled.recommendedAt, title: nextScheduled.item.candidate?.title || nextScheduled.item.candidateKey }
          : null,
        labels: {
          statuses: STATUS_LABELS,
          pipelines: PIPELINE_LABELS,
          evidence: EVIDENCE_LABELS,
          dimensions: EXPERIMENT_DIMENSION_LABELS,
          metrics: EXPERIMENT_METRIC_LABELS,
          healthStates: HEALTH_STATE_COPY,
          qualitySignals: QUALITY_SIGNAL_LABELS,
          dimensionGroups: {
            content: [...EXPERIMENT_DIMENSIONS.content, ...EXPERIMENT_DIMENSIONS.timing],
            network: EXPERIMENT_DIMENSIONS.network,
          },
          metricsByKind: { content: CONTENT_METRICS, network: NETWORK_METRICS },
        },
      });
    }

    if (method === 'GET' && segments.length === 2 && segments[0] === 'ai' && segments[1] === 'settings') {
      return sendSuccess(await aiSettingsView());
    }

    if (method === 'GET' && segments.length === 2 && segments[0] === 'ai' && segments[1] === 'profiles') {
      return sendSuccess({ profiles: await Promise.all(listAiProfiles({ limit: 500 }).map(formatAiProfile)) });
    }

    if (method === 'GET' && segments.length === 3 && segments[0] === 'ai' && segments[1] === 'profiles') {
      return sendSuccess({ profile: await formatAiProfile(requireAiProfile(segments[2])) });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'ai' && segments[1] === 'profiles') {
      const profile = await createAiProfileFromPayload(await readBody());
      return sendSuccess({ profile: await formatAiProfile(profile) });
    }

    if (method === 'POST' && segments.length === 3 && segments[0] === 'ai' && segments[1] === 'profiles') {
      const profile = await updateAiProfileFromPayload(segments[2], await readBody());
      return sendSuccess({ profile: await formatAiProfile(profile) });
    }

    if (method === 'POST' && segments.length === 4 && segments[0] === 'ai' && segments[1] === 'profiles' && segments[3] === 'enabled') {
      const payload = await readBody();
      const profile = setAiProfileEnabled(Number(segments[2]), payload.enabled === true);
      return sendSuccess({ profile: await formatAiProfile(profile) });
    }

    if (method === 'POST' && segments.length === 4 && segments[0] === 'ai' && segments[1] === 'profiles' && segments[3] === 'delete') {
      const deleted = deleteAiProfile(Number(segments[2]));
      if (!deleted) throw new Error(`AI profile not found: ${segments[2]}`);
      if (deleted.profile.secretRef && !deleted.secretRefStillUsed) await cleanupUnreferencedAiSecret(deleted.profile.secretRef);
      return sendSuccess({ deletedProfileId: deleted.profile.id });
    }

    if (method === 'POST' && segments.length === 4 && segments[0] === 'ai' && segments[1] === 'profiles' && segments[3] === 'secret') {
      const current = requireAiProfile(segments[2]);
      if (current.runtime !== 'direct_api') throw new Error('Runtime-managed profiles do not use product-managed API keys.');
      const payload = await readBody();
      const apiKey = String(payload.apiKey || '').trim();
      if (!apiKey) throw new Error('Replace key requires a non-empty API key.');
      const existingFileRef = String(current.secretRef || '').startsWith('file:') ? current.secretRef : null;
      const secret = await setAiSecret(existingFileRef, apiKey);
      const profile = secret.secretRef === current.secretRef ? current : updateAiProfile(current.id, { secretRef: secret.secretRef });
      return sendSuccess({ profile: await formatAiProfile(profile) });
    }

    if (method === 'POST' && segments.length === 5 && segments[0] === 'ai' && segments[1] === 'profiles' && segments[3] === 'secret' && segments[4] === 'remove') {
      const current = requireAiProfile(segments[2]);
      if (!current.secretRef) return sendSuccess({ profile: await formatAiProfile(current) });
      const oldSecretRef = current.secretRef;
      const profile = updateAiProfile(current.id, { secretRef: '' });
      await cleanupUnreferencedAiSecret(oldSecretRef);
      return sendSuccess({ profile: await formatAiProfile(profile) });
    }

    if (method === 'GET' && segments.length === 2 && segments[0] === 'ai' && segments[1] === 'default') {
      const settings = getAiRuntimeSettings();
      return sendSuccess({
        defaultProfileId: settings.defaultProfileId,
        defaultProfile: settings.defaultProfile ? await formatAiProfile(settings.defaultProfile) : null,
      });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'ai' && segments[1] === 'default') {
      const payload = await readBody();
      const profile = assertAssignableAiProfile(requireAiProfile(payload.profileId), {
        confirmUnknownCapability: payload.confirmUnknownCapability === true,
      });
      const settings = setAiDefaultProfile(profile.id);
      return sendSuccess({ defaultProfileId: settings.defaultProfileId, defaultProfile: await formatAiProfile(settings.defaultProfile) });
    }

    if (method === 'POST' && segments.length === 3 && segments[0] === 'ai' && segments[1] === 'default' && segments[2] === 'clear') {
      const settings = clearAiDefaultProfile();
      return sendSuccess({ defaultProfileId: settings.defaultProfileId, defaultProfile: null });
    }

    if (method === 'GET' && segments.length === 2 && segments[0] === 'ai' && segments[1] === 'roles') {
      return sendSuccess({ roles: await Promise.all(AI_ROLES.map(formatAiRole)) });
    }

    if (method === 'POST' && segments.length === 3 && segments[0] === 'ai' && segments[1] === 'roles') {
      const role = segments[2];
      if (!AI_ROLES.includes(role)) throw new Error(`Invalid AI role: ${role}`);
      const payload = await readBody();
      const confirmUnknownCapability = payload.confirmUnknownCapability === true;
      const primaryProfileId = payload.primaryProfileId == null || payload.primaryProfileId === '' ? null : Number(payload.primaryProfileId);
      const fallbackProfileId = payload.fallbackProfileId == null || payload.fallbackProfileId === '' ? null : Number(payload.fallbackProfileId);
      if (primaryProfileId != null) assertAssignableAiProfile(requireAiProfile(primaryProfileId), { confirmUnknownCapability });
      if (fallbackProfileId != null) assertAssignableAiProfile(requireAiProfile(fallbackProfileId), { confirmUnknownCapability });
      setAiRoleBinding(role, { primaryProfileId, fallbackProfileId });
      return sendSuccess({ role: await formatAiRole(role) });
    }

    if (method === 'POST' && segments.length === 4 && segments[0] === 'ai' && segments[1] === 'roles' && segments[3] === 'clear') {
      const role = segments[2];
      if (!AI_ROLES.includes(role)) throw new Error(`Invalid AI role: ${role}`);
      clearAiRoleBinding(role);
      return sendSuccess({ role: await formatAiRole(role) });
    }

    if (method === 'GET' && segments.length === 2 && segments[0] === 'ai' && segments[1] === 'runtimes') {
      return sendSuccess({ runtimes: await listAiRuntimeAvailability() });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'ai' && segments[1] === 'catalog-preview') {
      const payload = await readBody();
      const runtime = String(payload.runtime || '').trim();
      if (!['codex', 'opencode', 'agy'].includes(runtime)) {
        throw new Error('Catalog preview before saving is supported for Codex, OpenCode, and AGY runtime profiles.');
      }
      const profile = {
        id: null,
        name: 'Catalog preview',
        runtime,
        providerKind: 'runtime_managed',
        baseUrl: '',
        protocol: 'runtime_native',
        model: runtime === 'codex' ? 'inherit' : 'catalog-preview',
        reasoning: '',
        runtimeProfile: runtime === 'codex' ? String(payload.runtimeProfile || '').trim() : '',
        secretRef: '',
        settings: {},
        enabled: true,
      };
      return sendSuccess(await listAiCatalog(profile, { refresh: true }));
    }

    if (method === 'GET' && segments.length === 4 && segments[0] === 'ai' && segments[1] === 'profiles' && segments[3] === 'catalog') {
      const profile = requireAiProfile(segments[2]);
      return sendSuccess(await listAiCatalog(profile, { refresh: query.get('refresh') === '1' || query.get('refresh') === 'true' }));
    }

    if (method === 'POST' && segments.length === 4 && segments[0] === 'ai' && segments[1] === 'profiles' && segments[3] === 'catalog') {
      const profile = requireAiProfile(segments[2]);
      return sendSuccess(await listAiCatalog(profile, { refresh: true }));
    }

    if (method === 'POST' && segments.length === 4 && segments[0] === 'ai' && segments[1] === 'profiles' && segments[3] === 'check') {
      const profile = requireAiProfile(segments[2]);
      return sendSuccess(await checkAiProfileConnection(profile));
    }

    if (method === 'POST' && segments.length === 4 && segments[0] === 'ai' && segments[1] === 'profiles' && segments[3] === 'test') {
      const profile = requireAiProfile(segments[2]);
      return sendSuccess(await testAiProfile(profile));
    }

    if (method === 'GET' && segments.length === 2 && segments[0] === 'ai' && segments[1] === 'runs') {
      const options = { limit: Math.max(1, Math.min(200, Number(query.get('limit') || 50))) };
      if (query.get('role')) options.role = query.get('role');
      if (query.get('profileId')) options.profileId = Number(query.get('profileId'));
      if (query.get('invocationId')) options.invocationId = query.get('invocationId');
      if (query.get('status')) options.status = query.get('status');
      return sendSuccess({ runs: listAiRuns(options).map(formatAiRun) });
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'viral-research') {
      const days = Number(query.get('days') || 21);
      if (!VIRAL_RESEARCH_WINDOWS.has(days)) throw new Error('Viral research window must be 14, 21, or 30 days.');
      const postLimit = Math.max(20, Math.min(500, Number(query.get('limit') || 200)));
      return sendSuccess(await viralResearchView(days, postLimit));
    }

    if (method === 'GET' && segments.length === 2 && segments[0] === 'viral-research' && segments[1] === 'status') {
      return sendSuccess({ job: formatViralResearchJob() });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'viral-research' && segments[1] === 'run') {
      const config = normalizeViralResearchConfig(await readBody());
      return sendSuccess({ job: startViralResearchJob(config) });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'viral-research' && segments[1] === 'stop') {
      if (VIRAL_RESEARCH_JOB && ['running', 'stopping'].includes(VIRAL_RESEARCH_JOB.status)) {
        VIRAL_RESEARCH_JOB.stopRequested = true;
        VIRAL_RESEARCH_JOB.status = 'stopping';
      }
      return sendSuccess({ job: formatViralResearchJob() });
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'writing-strategy') {
      const queueItemId = Number(query.get('queueItemId'));
      if (!Number.isInteger(queueItemId) || queueItemId < 1) throw new Error('writing-strategy requires queueItemId.');
      return sendSuccess(await getWritingStrategyPreview(queueItemId));
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'writing-strategy' && segments[1] === 'recommend') {
      const payload = await readBody();
      const queueItemId = Number(payload.queueItemId);
      if (!Number.isInteger(queueItemId) || queueItemId < 1) throw new Error('writing-strategy recommend requires queueItemId.');
      return sendSuccess(await recommendWritingStrategy(queueItemId, { profile: payload.profileId ?? null }));
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'writing-strategy' && segments[1] === 'select') {
      const payload = await readBody();
      return sendSuccess({ selection: await selectWritingStrategy(payload) });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'learn' && segments[1] === 'classify-published') {
      const payload = await readBody();
      return sendSuccess(await classifyPublishedContent({
        queueItemIds: payload.queueItemIds || [],
        limit: payload.limit,
        profile: payload.profileId ?? null,
      }));
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'editorial') {
      return sendSuccess(editorialPlanView(query.get('objective')));
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'editorial' && segments[1] === 'refresh') {
      const payload = await readBody();
      const objective = editorialObjective(payload.objective);
      await refreshEditorialPlan({ objective, refreshSources: payload.refreshSources === true });
      return sendSuccess(editorialPlanView(objective));
    }

    if (method === 'GET' && segments.length === 3 && segments[0] === 'editorial' && segments[1] === 'recommendations') {
      const recommendation = getEditorialRecommendation(Number(segments[2]));
      if (!recommendation) return sendNotFound(`Editorial recommendation not found: ${segments[2]}`);
      return sendSuccess({ recommendation: formatEditorialRecommendationView(recommendation) });
    }

    if (method === 'POST' && segments.length === 4 && segments[0] === 'editorial' && segments[1] === 'recommendations' && segments[3] === 'select') {
      const payload = await readBody();
      const selected = selectEditorialRecommendation(Number(segments[2]), {
        pipelineOverride: payload.pipelineOverride == null || payload.pipelineOverride === '' ? null : String(payload.pipelineOverride),
      });
      return sendSuccess({
        recommendation: formatEditorialRecommendationView(selected.recommendation),
        selection: selected.selection,
        queueItem: formatQueueItem(selected.queueItem),
        candidateKey: selected.queueItem.candidateKey,
        draftId: selected.queueItem.draftId ?? null,
        research: selected.research || null,
        idempotent: selected.idempotent === true,
      });
    }

    if (method === 'POST' && segments.length === 4 && segments[0] === 'editorial' && segments[1] === 'recommendations' && segments[3] === 'dismiss') {
      const recommendation = dismissEditorialRecommendation(Number(segments[2]));
      return sendSuccess({ recommendation: formatEditorialRecommendationView(recommendation) });
    }

    if (method === 'POST' && segments.length === 4 && segments[0] === 'editorial' && segments[1] === 'recommendations' && segments[3] === 'research-source') {
      const payload = await readBody();
      const evidence = await attachEditorialResearchSource(Number(segments[2]), {
        url: payload.url,
        claim: payload.claim,
        claimType: payload.claimType || 'other',
      });
      const recommendation = getEditorialRecommendation(Number(segments[2]));
      return sendSuccess({ evidence: formatEditorialEvidence(evidence), recommendation: formatEditorialRecommendationView(recommendation) });
    }

    if (method === 'GET' && segments.length === 2 && segments[0] === 'editorial' && segments[1] === 'outcomes') {
      return sendSuccess({
        outcomes: getEditorialOutcomeSummary({
          windowMinutes: Number(query.get('windowMinutes') || 1440),
          limit: Math.max(1, Math.min(200, Number(query.get('limit') || 200))),
        }),
      });
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'today') {
      const now = Date.now();
      const engagementItems = listEngagementItems({ limit: 100 });
      const activeConversations = engagementItems.filter((item) => item.engagementKind !== 'initial_reply');
      const newOpportunities = engagementItems.filter((item) => item.engagementKind === 'initial_reply');
      const reviewItems = listQueueItems({ lane: 'main', status: 'needs_review', limit: 20 });
      const followerQuality = getNewFollowerQuality({ since: Number(now) - 24 * 3_600_000 });
      const accountHealth = getAccountHealthSummary();
      const decisions = rankMainFeedItems(listApprovedMainFeedItems({ automatedOnly: true, limit: 100 }), schedulerContext(now));
      const nextScheduled = decisions.find((item) => item.eligible) || null;

      const actions = [];

      if (accountHealth?.health?.state === 'constrained') {
        actions.push({
          eyebrow: 'Account limitation',
          title: 'Some actions are temporarily limited',
          body: accountHealth.health.explanation || 'Observed account evidence is limiting some actions until it is resolved.',
          href: '/legacy?source=health',
          action: 'Review account status',
          tone: 'danger',
        });
      }

      const conversation = activeConversations[0];
      if (conversation) {
        const candidate = getCandidate(conversation.candidateKey);
        const profile = conversation.targetUsername ? getRelationshipProfile(conversation.targetUsername) : null;
        const contribution = conversation.contributionSummary || conversation.engagement?.contribution?.summary || 'Review the conversation and decide whether you have something useful to add.';
        actions.push({
          eyebrow: 'Continue a conversation',
          title: `@${conversation.targetUsername || profile?.username || 'conversation'} has new activity`,
          body: contribution,
          note: candidate?.text ? `Source: ${candidate.text.slice(0, 140)}${candidate.text.length > 140 ? '…' : ''}` : '',
          href: `#/conversations/${encodeURIComponent(conversation.candidateKey)}`,
          action: 'Open conversation',
          tone: 'primary',
        });
      }

      const reviewItem = reviewItems[0];
      if (reviewItem) {
        const draft = getDraftByCandidate(reviewItem.candidateKey);
        const candidate = getCandidate(reviewItem.candidateKey);
        const analysis = draft && candidate && CONTENT_PIPELINES.has(reviewItem.pipeline)
          ? evaluateDraftQuality(candidate, draft, reviewItem.pipeline, {
              relevanceOverride: reviewItem.relevance?.humanOverride || null,
            })
          : null;
        const ready = Boolean(analysis && analysis.score >= 40 && analysis.gates?.passed === true);
        actions.push({
          eyebrow: 'Review a post',
          title: candidate?.title || 'A draft needs your decision',
          body: ready ? 'The draft passed its checks and is ready for your approval.' : 'The draft still needs a fix or confirmation before it can be approved.',
          note: draft ? `Quality ${analysis?.score ?? draft.qualityScore}/50 · ${label(PIPELINE_LABELS, reviewItem.pipeline)}` : label(PIPELINE_LABELS, reviewItem.pipeline),
          href: draft ? `#/draft/${draft.id}` : '#/create',
          action: 'Review draft',
          tone: ready ? 'success' : 'warning',
        });
      }

      if (nextScheduled?.item) {
        const candidate = nextScheduled.item.candidate || getCandidate(nextScheduled.item.candidateKey);
        const dueNow = Number(nextScheduled.recommendedAt) <= Number(now);
        actions.push({
          eyebrow: 'Next post',
          title: candidate?.title || 'An approved post is ready',
          body: dueNow ? 'Approved and ready to publish when your publishing mode allows it.' : `Approved and recommended for around ${new Date(nextScheduled.recommendedAt).toLocaleString()}.`,
          note: AUTO_POST ? 'Main-feed automation is enabled.' : 'Main-feed automation is off. Nothing is auto-published from this recommendation.',
          href: '#/create',
          action: 'View publishing plan',
          tone: 'primary',
        });
      }

      if (!activeConversations.length && newOpportunities[0]) {
        const item = newOpportunities[0];
        actions.push({
          eyebrow: 'Worth considering',
          title: `A conversation with @${item.targetUsername || 'this account'} looks useful`,
          body: item.contributionSummary || 'There is a fresh conversation opportunity with a concrete contribution available.',
          href: `#/conversations/${encodeURIComponent(item.candidateKey)}`,
          action: 'Review opportunity',
          tone: 'primary',
        });
      }

      return sendSuccess({
        taskCount: actions.length,
        actions,
        stats: {
          activeConversations: activeConversations.length,
          waitingForReview: reviewItems.length,
          meaningfulInteractions7d: accountHealth.interactionCounts?.meaningfulInteractions7d || 0,
          newRelevantFollowers24h: followerQuality.nicheAlignedNewFollowers,
          newlyObservedFollowers24h: followerQuality.newlyObservedFollowers,
        },
        accountHealth: {
          state: accountHealth.health.state,
          label: label(HEALTH_STATE_COPY, accountHealth.health.state),
        },
        nextScheduled: nextScheduled
          ? { recommendedAt: nextScheduled.recommendedAt, item: { candidateKey: nextScheduled.item.candidateKey, title: nextScheduled.item.candidate?.title } }
          : null,
        automation: AUTO_POST,
      });
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'discover') {
      const feed = DISCOVER_FEEDS.has(query.get('feed')) ? query.get('feed') : 'for-you';
      const tag = query.get('tag') || '';
      const objective = editorialObjective(query.get('objective'));
      const currentPlan = getLatestEditorialPlan(objective);
      const editorialByCandidate = new Map();
      for (const recommendation of currentPlan?.recommendations || []) {
        for (const candidateKey of recommendation.candidateKeys || []) {
          if (!editorialByCandidate.has(candidateKey)) editorialByCandidate.set(candidateKey, recommendation);
        }
      }
      let candidates;
      let snapshotAt = null;
      let lastRefreshAttemptAt = null;
      let sourceError = null;
      let legacyFallback = false;
      const sourceKind = DISCOVER_SOURCE_KINDS[feed] || null;
      switch (feed) {
        case 'x': {
          const snapshot = getDiscoverSnapshot('x_latest');
          candidates = snapshot.candidates;
          snapshotAt = snapshot.fetchedAt;
          lastRefreshAttemptAt = snapshot.lastRefreshAttemptAt;
          sourceError = snapshot.error;
          legacyFallback = snapshot.legacyFallback;
          break;
        }
        case 'trending': {
          const snapshot = getDiscoverSnapshot('x_momentum');
          candidates = snapshot.candidates;
          snapshotAt = snapshot.fetchedAt;
          lastRefreshAttemptAt = snapshot.lastRefreshAttemptAt;
          sourceError = snapshot.error;
          legacyFallback = snapshot.legacyFallback;
          break;
        }
        case 'opportunities':
          candidates = listCandidates({ source: 'x', withinHours: 168, resolution: 'actionable', limit: 250 }).filter(isOpportunityCandidate);
          break;
        case 'github': {
          const snapshot = getDiscoverSnapshot('github_trending');
          candidates = snapshot.candidates;
          snapshotAt = snapshot.fetchedAt;
          lastRefreshAttemptAt = snapshot.lastRefreshAttemptAt;
          sourceError = snapshot.error;
          legacyFallback = snapshot.legacyFallback;
          break;
        }
        case 'hn': {
          const snapshot = getDiscoverSnapshot('hn_top');
          candidates = snapshot.candidates;
          snapshotAt = snapshot.fetchedAt;
          lastRefreshAttemptAt = snapshot.lastRefreshAttemptAt;
          sourceError = snapshot.error;
          legacyFallback = snapshot.legacyFallback;
          break;
        }
        case 'all':
          candidates = listCandidates({ limit: 150 });
          break;
        case 'saved':
          candidates = listCandidates({ saved: true, limit: 150 });
          break;
        case 'handled':
          candidates = listCandidates({ resolution: 'handled', limit: 150 });
          break;
        default:
          candidates = listCandidates({ resolution: 'actionable', limit: 500 })
            .filter((candidate) => candidate.source !== 'github' || candidate.metrics?.starsToday != null)
            .slice(0, 250);
      }
      if (tag) candidates = candidates.filter((item) => item.niche?.tags?.includes(tag));
      const visible = candidates.slice(0, 60).map((candidate) => formatCandidate(candidate, {
        sourceKind,
        editorialRecommendation: editorialByCandidate.get(candidate.key) || null,
        objective,
      }));
      const refreshable = feed === 'x' ? 'x' : feed === 'trending' ? 'viral' : ['github', 'hn'].includes(feed) ? feed : null;
      return sendSuccess({
        feed,
        refreshable,
        sourceKind,
        snapshotAt,
        lastRefreshAttemptAt,
        sourceError,
        legacyFallback,
        editorialObjective: objective,
        topicFilters: Object.entries(NICHE_LABELS).map(([value, labelText]) => ({ value, label: labelText })),
        candidates: visible,
        total: candidates.length,
      });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'discover' && segments[1] === 'refresh') {
      const payload = await readBody();
      const requested = String(payload.feed || 'x');
      const kind = normalizeSourceKind(requested);
      const refresh = kind === 'all' ? await refreshAllSourceSnapshots() : await refreshSourceSnapshot(kind);
      return sendSuccess({ refreshedFeed: requested, refresh });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'discover' && segments[1] === 'triage') {
      const payload = await readBody();
      const key = String(payload.key || '');
      const action = String(payload.action || '');
      const candidate = getCandidate(key);
      if (!candidate) throw new Error('Candidate not found. Refresh research first.');

      if (action === 'save') {
        const candidate = markCandidateSaved(key, true);
        return sendSuccess({ action, candidate: { key: candidate.key, saved: candidate.saved }, queueItem: formatQueueItem(getQueueItemByCandidate(key)) });
      }
      if (action === 'unsave') {
        const candidate = markCandidateSaved(key, false);
        return sendSuccess({ action, candidate: { key: candidate.key, saved: candidate.saved }, queueItem: formatQueueItem(getQueueItemByCandidate(key)) });
      }
      if (action === 'discard') {
        const queueItem = discardCandidateDraft(key);
        return sendSuccess({ action, queueItem: formatQueueItem(queueItem), draftId: null });
      }
      if (['original', 'quote', 'thread', 'repost', 'research', 'watch'].includes(action)) {
        if (action === 'quote' && candidate.source !== 'x') throw new Error('Quote posts require an X source.');
        ensureCandidateWorkflow(key);
        routeCandidate(key, action, { actor: 'human' });
        const draft = getDraftByCandidate(key);
        const queueItem = getQueueItemByCandidate(key);
        return sendSuccess({
          action,
          generated: false,
          draftId: draft?.id ?? null,
          queueItem: formatQueueItem(queueItem),
        });
      }
      if (action === 'reply') {
        routeCandidate(key, 'reply', { actor: 'human' });
        const draft = getDraftByCandidate(key);
        const queueItem = getQueueItemByCandidate(key);
        return sendSuccess({ action, generated: false, draftId: draft?.id ?? null, queueItem: formatQueueItem(queueItem) });
      }
      if (action === 'ignore') {
        const queueItem = routeCandidate(key, 'ignore', { actor: 'human', reason: 'Operator ignored this candidate from Discover.' });
        return sendSuccess({ action, queueItem: formatQueueItem(queueItem) });
      }
      throw new Error(`Unknown triage action: ${action || '(missing)'}`);
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'first-1000-mission') {
      return sendSuccess(first1000MissionView());
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'first-1000-mission') {
      const action = segments[1];
      const payload = await readBody();
      if (action === 'configure') configureFirst1000MainFeedMissionGrant(payload, { actor: 'human' });
      else if (action === 'start') startFirst1000MainFeedMission({ actor: 'human' });
      else if (action === 'pause') pauseFirst1000MainFeedMission({ actor: 'human' });
      else if (action === 'stop') stopFirst1000MainFeedMission({ actor: 'human' });
      else throw new Error(`Unknown First-1,000 mission action: ${action}.`);
      return sendSuccess(first1000MissionView());
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'autonomous-replies') {
      return sendSuccess(getAutonomousReplyReadModel({ limit: 100 }));
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'autonomous-replies') {
      const action = segments[1];
      const payload = await readBody();
      if (action === 'configure') configureAutonomousReplyGrant(payload, { actor: 'human' });
      else if (action === 'start') startAutonomousReplies({ actor: 'human' });
      else if (action === 'pause') pauseAutonomousReplies({ actor: 'human' });
      else if (action === 'stop') stopAutonomousReplies({ actor: 'human' });
      else throw new Error(`Unknown autonomous reply action: ${action}.`);
      return sendSuccess(getAutonomousReplyReadModel({ limit: 100 }));
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'conversations') {
      const items = listEngagementItems({ limit: 200 });
      const health = getAccountHealthSummary();
      const autonomous = getAutonomousReplyReadModel({ limit: 100 });
      const autonomousByTarget = new Map(autonomous.recentDecisions.map((decision) => [decision.targetTweetId, decision]));
      const formatItem = (item) => {
        const candidate = getCandidate(item.candidateKey);
        const profile = item.targetUsername ? getRelationshipProfile(item.targetUsername) : null;
        const draft = getDraftByCandidate(item.candidateKey);
        const draftAnalysis = draft && candidate && CONTENT_PIPELINES.has(item.pipeline)
          ? evaluateDraftQuality(candidate, draft, item.pipeline, {
              relevanceOverride: item.relevance?.humanOverride || null,
            })
          : null;
        const score = item.engagement || {};
        return {
          key: item.candidateKey,
          targetUsername: item.targetUsername || profile?.username || 'unknown',
          engagementKind: item.engagementKind || 'initial_reply',
          engagementKindLabel: item.engagementKind === 'initial_reply' ? 'New conversation' : 'Continue conversation',
          status: item.status,
          statusLabel: queueStatusLabel(item),
          priority: item.priority,
          priorityLabel: opportunityLabel(item.priority),
          contribution: item.contributionSummary || score.contribution?.summary || 'Review the conversation',
          sourceText: candidate?.text?.slice(0, 240) || '',
          sourceUrl: candidate?.url || '',
          draftId: draft?.id ?? null,
          draftQualityScore: draftAnalysis?.score ?? draft?.qualityScore ?? null,
          expiresAt: item.expiresAt || null,
          autonomousDecision: autonomousByTarget.get(item.targetTweetId) || null,
          relationship: profile
            ? {
                stage: profile.relationshipStage,
                targetScore: Math.round(profile.targetScore || 0),
                theirRepliesToUs: profile.theirRepliesToUs || 0,
                meaningfulInteractions: profile.meaningfulInteractions || 0,
              }
            : null,
        };
      };
      const active = items.filter((item) => item.engagementKind !== 'initial_reply').map(formatItem);
      const cold = items.filter((item) => item.engagementKind === 'initial_reply').map(formatItem);
      return sendSuccess({
        activeConversations: active,
        newOpportunities: cold.slice(0, 20),
        health: {
          state: health.health.state,
          label: label(HEALTH_STATE_COPY, health.health.state),
          explanation: health.health.explanation || '',
        },
        autonomous: {
          grant: autonomous.grant,
          runtime: autonomous.runtime,
          recentDecisions: autonomous.recentDecisions.slice(0, 20),
        },
      });
    }

    if (method === 'GET' && segments.length === 2 && segments[0] === 'conversations') {
      const key = decodeURIComponent(segments[1]);
      const detail = formatConversationDetail(key);
      if (!detail) return sendNotFound(`Conversation not found: ${key}`);
      return sendSuccess(detail);
    }

    if (method === 'POST' && segments.length === 3 && segments[0] === 'conversations') {
      const key = decodeURIComponent(segments[1]);
      const action = segments[2];
      const payload = await readBody();

      if (action === 'draft') {
        let draft = getDraftByCandidate(key);
        const needsInitialGeneration = !draft;
        routeCandidate(key, 'reply', { actor: 'human' });
        draft = getDraftByCandidate(key);
        if (needsInitialGeneration && draft) draft = (await generateDraftCandidate(draft)).saved;
        if (!draft) throw new Error('Reply draft could not be created.');
        return sendSuccess({ draftId: draft.id, editor: draftEditorPayload(draft.id) });
      }

      if (action === 'review') {
        const result = requestQueueReview(key);
        return sendSuccess({ queueItem: formatQueueItem(result.queueItem), editor: draftEditorPayload(result.draft.id) });
      }

      if (action === 'approve-send') {
        requireEngagementSendAllowed();
        approveEngagementQueueItem(key, { actor: 'human' });
        const sent = await sendApprovedEngagementReply(key);
        return sendSuccess({
          queueItem: formatQueueItem(sent.queueItem),
          draft: formatDraft(sent.draft),
          tweetId: sent.tweetId,
          url: sent.url,
          sent: true,
        });
      }

      if (action === 'send') {
        requireEngagementSendAllowed();
        const sent = await sendApprovedEngagementReply(key);
        return sendSuccess({
          queueItem: formatQueueItem(sent.queueItem),
          draft: formatDraft(sent.draft),
          tweetId: sent.tweetId,
          url: sent.url,
          sent: true,
        });
      }

      if (action === 'resolve') {
        const resolution = String(payload.action || '');
        if (!['ignore', 'expire'].includes(resolution)) throw new Error(`Invalid resolution: ${resolution || '(missing)'}`);
        const queueItem = resolveEngagementItem(key, resolution, String(payload.reason || ''));
        return sendSuccess({ queueItem: formatQueueItem(queueItem) });
      }

      if (action === 'quote') {
        routeCandidate(key, 'quote', { actor: 'human', reason: 'Operator chose Quote instead from Conversations.' });
        const draft = getDraftByCandidate(key);
        return sendSuccess({ draftId: draft?.id ?? null, queueItem: formatQueueItem(getQueueItemByCandidate(key)) });
      }

      throw new Error(`Unknown conversation action: ${action}`);
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'create') {
      const items = listQueueItems({ lane: 'main', limit: 250 });
      const context = schedulerContext();
      const groups = [
        { id: 'ideas', title: 'Sources to decide', note: 'Choose a drafting route, research further, pause, or skip.', statuses: ['triage'] },
        { id: 'research', title: 'Research suggested', note: 'Sources you deliberately held for additional context or a later decision.', statuses: ['researching'] },
        { id: 'onHold', title: 'On hold', note: 'Sources you paused so they do not compete with active decisions.', statuses: ['watching'] },
        { id: 'drafting', title: 'Drafts in progress', note: 'Posts currently being written or edited.', statuses: ['drafting'] },
        { id: 'needsReview', title: 'Needs review', note: 'Required review confirmations or your approval decision are still pending.', statuses: ['needs_review'] },
        { id: 'approved', title: 'Approved', note: 'Approved posts await publication; approved reposts await your manual repost.', statuses: ['approved'] },
        { id: 'publishing', title: 'Publishing', note: 'A publish action is currently in progress.', statuses: ['publishing'] },
        { id: 'failed', title: 'Publish failed', note: 'A publishing attempt failed and requires your decision.', statuses: ['failed'] },
        { id: 'published', title: 'Published', note: 'Completed main-feed work retained for context.', statuses: ['published'] },
      ];
      const schedulePlans = new Map();
      for (const item of items) {
        if (item.status === 'approved' && ['main', 'main_feed'].includes(item.lane) && SCHEDULABLE_MAIN_FEED_PIPELINES.has(item.pipeline)) {
          const scheduleItem = getMainFeedScheduleItem(item.candidateKey);
          if (scheduleItem) {
            const decision = recommendMainFeedSchedule(scheduleItem, context);
            schedulePlans.set(item.candidateKey, {
              recommendedAt: decision.recommendedAt ?? null,
              eligible: Boolean(decision.eligible),
              reason: decision.reason || '',
              scheduledAt: item.scheduledAt || null,
              expiresAt: item.expiresAt || null,
              scheduleUrgency: item.scheduleUrgency || 'evergreen',
              scheduleSource: item.scheduleSource || '',
              manualOnly: item.pipeline === 'repost',
            });
          }
        }
      }
      const formatted = items.map((item) => {
        const formattedItem = formatQueueItem(item);
        return { ...formattedItem, schedule: schedulePlans.get(item.candidateKey) || null };
      });
      return sendSuccess({
        sections: groups.map((group) => ({
          ...group,
          items: formatted.filter((item) => group.statuses.includes(item.status)),
        })).filter((group) => group.items.length > 0),
        counts: {
          ideas: items.filter((item) => item.status === 'triage').length,
          drafting: items.filter((item) => item.status === 'drafting').length,
          review: items.filter((item) => item.status === 'needs_review').length,
          approvedWaiting: items.filter((item) => item.status === 'approved').length,
        },
        automation: AUTO_POST,
      });
    }

    if (method === 'GET' && segments.length === 2 && segments[0] === 'drafts') {
      const payload = draftEditorPayload(Number(segments[1]));
      if (!payload) return sendNotFound(`Draft not found: ${segments[1]}`);
      return sendSuccess(payload);
    }

    if (segments.length === 3 && segments[0] === 'drafts' && segments[2] === 'media') {
      const draftId = Number(segments[1]);
      const draft = getDraft(draftId);
      if (!draft) throw new Error(`Draft not found: ${draftId}`);
      const queueItem = getQueueItemByCandidate(draft.candidateKey);
      const readOnly = draft.status === 'published' || queueItem?.status === 'published' || Boolean(queueItem?.publishedAt || queueItem?.outputTweetId);

      if (method === 'GET') {
        const attachment = draftMediaAttachment(draft);
        if (!attachment) return sendNotFound('Draft has no attached image.');
        let image;
        try { image = await fs.readFile(attachment.localPath); } catch { return sendNotFound('Attached image file is unavailable.'); }
        res.writeHead(200, {
          'content-type': attachment.mimeType || 'application/octet-stream',
          'content-length': image.length,
          'cache-control': 'no-store',
          'content-disposition': `inline; filename="${String(attachment.fileName || 'image').replace(/["\\\r\n]/g, '_')}"`,
        });
        res.end(image);
        return;
      }

      if (method === 'POST') {
        if (readOnly) throw new Error('Published text is historical record and cannot accept a new attachment.');
        const saved = await persistDraftMedia(draft, req);
        return sendSuccess({ draft: formatDraft(saved), editor: draftEditorPayload(saved.id) });
      }

      if (method === 'DELETE') {
        if (readOnly) throw new Error('Published text is historical record and cannot remove its attachment.');
        const attachment = draftMediaAttachment(draft);
        const media = { ...(draft.editor?.media || {}) };
        delete media.attachment;
        const saved = saveDraft({ ...draft, editor: { ...(draft.editor || {}), media }, gates: {}, status: 'draft' });
        if (attachment?.localPath) await fs.rm(attachment.localPath, { force: true }).catch(() => {});
        return sendSuccess({ draft: formatDraft(saved), editor: draftEditorPayload(saved.id) });
      }
    }

    if (method === 'POST' && segments.length === 3 && segments[0] === 'drafts' && segments[1] !== undefined) {
      const draftId = Number(segments[1]);
      const action = segments[2];
      const payload = await readBody();
      const current = getDraft(draftId);
      if (!current) throw new Error(`Draft not found: ${draftId}`);
      const candidate = getCandidate(current.candidateKey);
      if (!candidate) throw new Error('Draft source candidate not found.');
      const queueItem = getQueueItemByCandidate(candidate.key);
      const pipeline = CONTENT_PIPELINES.has(queueItem?.pipeline) ? queueItem.pipeline : 'original';
      const readOnly = current.status === 'published' || queueItem?.status === 'published' || Boolean(queueItem?.publishedAt || queueItem?.outputTweetId);
      if (readOnly && ['save', 'generate', 'thread-parts'].includes(action)) {
        throw new Error('Published text is historical record and cannot be edited.');
      }

      if (action === 'preview') {
        const updated = applyEditorPayload(current, payload);
        const analysis = evaluateDraftQuality(candidate, updated, pipeline, {
          relevanceOverride: queueItem?.relevance?.humanOverride || null,
        });
        return sendSuccess({
          score: analysis.score,
          gates: analysis.gates,
          gatesView: formatGates(analysis.gates),
          breakdown: analysis.breakdown || {},
          weightedLength: analysis.weightedLength ?? null,
          growthPackaging: analysis.growthPackaging || null,
        });
      }

      if (action === 'save') {
        let queue = queueItem || ensureCandidateWorkflow(candidate.key).queueItem;
        const updated = applyEditorPayload(current, payload);
        const scheduledRaw = payload.scheduledAt;
        const scheduledAt = scheduledRaw === undefined ? current.scheduledAt : (scheduledRaw === null ? null : Number(scheduledRaw));
        if (scheduledRaw != null && !Number.isFinite(scheduledAt)) throw new Error('Invalid schedule time.');
        updated.scheduledAt = scheduledAt;
        const analysis = evaluateDraftQuality(candidate, updated, CONTENT_PIPELINES.has(queue.pipeline) ? queue.pipeline : 'original', {
          relevanceOverride: queue.relevance?.humanOverride || null,
        });
        updated.gates = analysis.gates;
        updated.qualityScore = analysis.score;
        updated.status = current.status === 'published' ? 'published' : 'draft';
        const saved = saveDraft(updated);
        if (current.status !== 'published') routeCandidate(candidate.key, queue.pipeline, { actor: 'human' });
        queue = getQueueItemByCandidate(candidate.key);
        return sendSuccess({ draft: formatDraft(saved), queueItem: formatQueueItem(queue), editor: draftEditorPayload(saved.id) });
      }

      if (action === 'generate') {
        const result = await generateDraftCandidate(current);
        return sendSuccess({ draft: formatDraft(result.saved), output: { decision: result.output.decision, riskFlags: result.output.riskFlags || [] }, editor: draftEditorPayload(result.saved.id) });
      }

      if (action === 'thread-parts') {
        if (queueItem?.pipeline !== 'thread') throw new Error('Thread controls require the thread pipeline.');
        const parts = current.threadParts?.length ? [...current.threadParts] : ['', ''];
        while (parts.length < 2) parts.push('');
        const op = String(payload.op || '');
        if (op === 'add' && parts.length < 6) parts.push('');
        if (op === 'remove' && parts.length > 2) parts.pop();
        if (!['add', 'remove'].includes(op)) throw new Error(`Unknown thread operation: ${op || '(missing)'}`);
        const saved = saveDraft({
          ...current,
          threadParts: parts,
          editor: { ...(current.editor || {}), pipeline: 'thread', threadParts: [...parts] },
          gates: {},
          status: 'draft',
        });
        routeCandidate(current.candidateKey, 'thread', { actor: 'human' });
        return sendSuccess({ draft: formatDraft(saved), editor: draftEditorPayload(saved.id) });
      }

      throw new Error(`Unknown draft action: ${action}`);
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'work' && segments[1] === 'relevance-decision') {
      const payload = await readBody();
      const queueItem = payload.queueItemId == null ? null : getQueueItem(Number(payload.queueItemId));
      const key = queueItem?.candidateKey || String(payload.key || '');
      if (!key) throw new Error('Growth Focus decision requires queueItemId or candidate key.');
      const result = setRelevanceDecision(key, {
        decision: String(payload.decision || ''),
        reason: String(payload.reason || ''),
        actor: 'human',
      });
      return sendSuccess({
        queueItem: formatQueueItem(result.queueItem),
        growthFit: result.growthFit,
      });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'work' && segments[1] === 'routing-decision') {
      const payload = await readBody();
      const queueItem = payload.queueItemId == null ? null : getQueueItem(Number(payload.queueItemId));
      const key = queueItem?.candidateKey || String(payload.key || '');
      if (!key) throw new Error('Routing decision requires queueItemId or candidate key.');
      const saved = setRoutingDecision(key, {
        decision: String(payload.decision || ''),
        reason: String(payload.reason || ''),
        actor: 'human',
      });
      return sendSuccess({ queueItem: formatQueueItem(saved) });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'queue') {
      const action = segments[1];
      const payload = await readBody();
      const key = String(payload.key || '');

      if (action === 'route') {
        const pipeline = String(payload.pipeline || '');
        if (!['original', 'quote', 'thread', 'reply', 'repost', 'research', 'watch', 'ignore'].includes(pipeline)) {
          throw new Error(`Invalid pipeline: ${pipeline || '(missing)'}`);
        }
        const candidate = getCandidate(key);
        if (!candidate) throw new Error('Candidate not found.');
        const queueItem = routeCandidate(key, pipeline, { actor: 'human' });
        return sendSuccess({ queueItem: formatQueueItem(queueItem), draftId: queueItem.draftId ?? null });
      }

      if (action === 'review') {
        const result = requestQueueReview(key);
        return sendSuccess({ queueItem: formatQueueItem(result.queueItem), draft: formatDraft(result.draft) });
      }

      if (action === 'approve') {
        const result = approveQueueItem(key);
        return sendSuccess({ queueItem: formatQueueItem(result.queueItem), draft: formatDraft(result.draft) });
      }

      if (action === 'complete-repost') {
        if (payload.confirmCompleted !== true) throw new Error('Confirm that you already reposted this source on X.');
        const result = recordManualRepost(key, { actor: 'human' });
        return sendSuccess({ queueItem: formatQueueItem(result.queueItem), action: result.action });
      }

      if (action === 'schedule') {
        const scheduledAt = payload.scheduledAt === undefined ? undefined : (payload.scheduledAt === null ? null : Number(payload.scheduledAt));
        const expiresAt = payload.expiresAt === undefined ? undefined : (payload.expiresAt === null ? null : Number(payload.expiresAt));
        if (scheduledAt != null && !Number.isFinite(scheduledAt)) throw new Error('Invalid main-feed schedule override.');
        if (expiresAt != null && !Number.isFinite(expiresAt)) throw new Error('Invalid main-feed expiry.');
        const queueItem = setMainFeedSchedule(key, {
          scheduledAt,
          expiresAt,
          scheduleUrgency: payload.scheduleUrgency,
        }, { actor: 'human' });
        const scheduleItem = getMainFeedScheduleItem(key);
        const decision = scheduleItem ? recommendMainFeedSchedule(scheduleItem, schedulerContext()) : null;
        return sendSuccess({
          queueItem: formatQueueItem(queueItem),
          schedule: decision
            ? { recommendedAt: decision.recommendedAt ?? null, eligible: Boolean(decision.eligible), reason: decision.reason || '' }
            : null,
        });
      }

      if (action === 'discard') {
        const queueItem = discardCandidateDraft(key);
        return sendSuccess({ queueItem: formatQueueItem(queueItem), draftId: null });
      }

      throw new Error(`Unknown queue action: ${action}`);
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'results') {
      const snapshot = getPerformanceSnapshot(30);
      const audience = getAudienceSummary();
      const followerQuality = getNewFollowerQuality({ since: Date.now() - 24 * 3_600_000 });
      const accountHealth = getAccountHealthSummary();
      const account = snapshot.account;
      const previous = snapshot.previousAccount;
      const followerDelta = account && previous ? Number(account.followers || 0) - Number(previous.followers || 0) : null;
      const network = accountHealth?.networkQuality?.components || {};
      const measured = formatMeasurementSeries(listPublicationMeasurementSeries({ limit: 8 }), { latestOnly: true }).slice(0, 4);
      const technical = formatMeasurementSeries(listPublicationMeasurementSeries({ limit: 20 }));
      const editorialOutcomes = getEditorialOutcomeSummary({ windowMinutes: 1440, limit: 200 });
      const writingStrategyOutcomes = getWritingStrategyOutcomeSummary({ windowMinutes: 1440, limit: 200 });
      const writingStrategyFeedback = await getWritingStrategyFeedbackReadModel({
        windowMinutes: 1440,
        limit: 200,
        outcomes: writingStrategyOutcomes,
      });
      return sendSuccess({
        account: account
          ? {
              followers: account.followers,
              following: account.following,
              posts: account.posts,
              likes: account.likes,
              followerDelta,
              capturedAt: account.capturedAt || null,
              postsList: (snapshot.posts || []).slice(0, 20).map((post) => ({
                text: post.text,
                views: post.views,
                likes: post.likes,
                reposts: post.reposts,
                replies: post.replies,
                publishedAt: post.published_at || post.publishedAt || null,
              })),
            }
          : null,
        audience: {
          followers: audience.followers,
          relevantFollowers: audience.relevant_followers || 0,
        },
        followerQuality,
        conversations: {
          meaningfulInteractions7d: accountHealth?.interactionCounts?.meaningfulInteractions7d || 0,
          responseRate: network.authorResponseRate?.rate ?? null,
          continuationRate: network.conversationContinuationRate?.rate ?? null,
        },
        accountHealth: {
          state: accountHealth.health.state,
          label: label(HEALTH_STATE_COPY, accountHealth.health.state),
          explanation: accountHealth.health.explanation || '',
        },
        measuredPosts: measured,
        technical,
        editorialOutcomes,
        writingStrategyOutcomes,
        writingStrategyEvidence: {
          windowMinutes: writingStrategyFeedback.windowMinutes,
          externalEvidence: writingStrategyFeedback.externalEvidence,
          experimentEvidence: writingStrategyFeedback.experimentEvidence,
          comparisons: writingStrategyFeedback.comparisons,
          agreementInterpretation: writingStrategyFeedback.agreementInterpretation,
          limitations: writingStrategyFeedback.limitations,
        },
        measurementCapabilities: ACCOUNT_PERFORMANCE_CAPABILITIES,
      });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'results' && segments[1] === 'refresh-performance') {
      const result = await fetchAccountPerformance(ACCOUNT, 20);
      if (!result.error) recordPerformanceSnapshot(result);
      const snapshot = getPerformanceSnapshot(30);
      return sendSuccess({ error: result.error || null, account: snapshot.account || null });
    }

    if (method === 'GET' && segments.length === 1 && ['growth-focus', 'niche'].includes(segments[0])) {
      return sendSuccess(getNicheProfile());
    }

    if (method === 'POST' && segments.length === 1 && ['growth-focus', 'niche'].includes(segments[0])) {
      const payload = await readBody();
      const saved = saveNicheProfile(payload.profile || payload);
      return sendSuccess({ ...saved, queueRecommendationsRefreshed: refreshCandidateRecommendations().refreshed });
    }

    if (method === 'POST' && segments.length === 2 && ['growth-focus', 'niche'].includes(segments[0]) && segments[1] === 'reset') {
      const reset = resetNicheProfile();
      return sendSuccess({ ...reset, queueRecommendationsRefreshed: refreshCandidateRecommendations().refreshed });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'growth-focus' && segments[1] === 'objective') {
      const payload = await readBody();
      return sendSuccess(saveGrowthFocusObjective(editorialObjective(payload.objective)));
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'growth-focus' && segments[1] === 'rescore-candidates') {
      return sendSuccess(rescoreCandidateRelevance());
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'audience') {
      const summary = getAudienceSummary();
      const following = listAudienceProfiles({ youFollow: true, minScore: 0, limit: Math.max(100, summary.following + 20) });
      const followers = listAudienceProfiles({ followsYou: true, minScore: 0, limit: Math.max(100, summary.followers + 20) });
      const outsideFollowing = following
        .filter((profile) => profile.fitBucket === 'outside_niche')
        .sort((left, right) => Number(left.followsYou) - Number(right.followsYou) || left.username.localeCompare(right.username));
      const uncertainFollowing = following
        .filter((profile) => profile.fitBucket === 'uncertain')
        .sort((left, right) => Number(left.followsYou) - Number(right.followsYou) || left.username.localeCompare(right.username));
      const inNicheFollowing = following.filter((profile) => profile.fitBucket === 'in_niche');
      const inNicheFollowers = followers.filter((profile) => profile.fitBucket === 'in_niche');
      return sendSuccess({
        summary: {
          followers: summary.followers,
          following: summary.following,
          relevantFollowers: summary.relevant_followers || 0,
          relevantFollowing: summary.relevant_following || 0,
          targetAccounts: summary.target_accounts || 0,
        },
        counts: {
          outsideFollowing: outsideFollowing.length,
          uncertainFollowing: uncertainFollowing.length,
          inNicheFollowing: inNicheFollowing.length,
          inNicheFollowers: inNicheFollowers.length,
        },
        outsideFollowing: outsideFollowing.map(formatAudienceProfile),
        uncertainFollowing: uncertainFollowing.map(formatAudienceProfile),
        targets: inNicheFollowing.filter((profile) => !profile.followsYou).slice(0, 40).map(formatAudienceProfile),
        relevantFollowers: inNicheFollowers.slice(0, 20).map(formatAudienceProfile),
        aiReview: (() => {
          const review = getAudienceAiReview();
          if (!review) return null;
          return {
            ...review,
            suggestions: (review.suggestions || []).map((suggestion) => ({
              ...suggestion,
              profile: formatAudienceProfile(suggestion.profile),
            })),
          };
        })(),
      });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'audience' && segments[1] === 'review') {
      const review = await reviewAudienceFollowing();
      return sendSuccess({
        ...review,
        suggestions: (review.suggestions || []).map((suggestion) => ({
          ...suggestion,
          profile: formatAudienceProfile(suggestion.profile),
        })),
      });
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'audience' && segments[1] === 'unfollow') {
      const payload = await readBody();
      if (payload.confirmUnfollow !== true) throw new Error('Explicit unfollow confirmation is required.');
      const username = String(payload.username || '').replace(/^@/, '').trim().toLowerCase();
      if (!username) throw new Error('Username is required.');
      const job = startAudienceUnfollowJob(username);
      return sendJson(202, { state: 'success', data: { jobId: job.id, username: job.username, status: job.status } });
    }

    if (method === 'GET' && segments.length === 3 && segments[0] === 'audience' && segments[1] === 'unfollow') {
      const job = AUDIENCE_UNFOLLOW_JOBS.get(segments[2]);
      if (!job) return sendNotFound('Unfollow job not found.');
      return sendSuccess({
        jobId: job.id,
        username: job.username,
        status: job.status,
        profile: job.profile,
        error: job.error,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      });
    }

    if (method === 'GET' && segments.length === 1 && segments[0] === 'improve') {
      const queueItems = listQueueItems({ limit: 250 });
      const experiments = listExperiments({ limit: 100 });
      const overview = getLearningOverview();
      const tests = experiments.map((experiment) => formatExperiment(experiment, { queueItems }));
      return sendSuccess({
        tests,
        learning: {
          suggested: overview.suggested,
          accepted: overview.accepted,
          retired: overview.retired,
          rules: (overview.rules || []).map(formatLearnedRule),
        },
      });
    }

    if (method === 'POST' && segments.length === 1 && segments[0] === 'tests') {
      const payload = await readBody();
      const guidedVariants = [payload.variantA, payload.variantB].map((value) => String(value || '').trim()).filter(Boolean);
      const variants = guidedVariants.length >= 2
        ? guidedVariants
        : String(payload.variants || '').split(',').map((value) => value.trim()).filter(Boolean);
      const population = payload.population && typeof payload.population === 'object' && !Array.isArray(payload.population)
        ? payload.population
        : {};
      const experiment = createExperiment({
        name: payload.name,
        hypothesis: payload.hypothesis,
        dimension: payload.dimension,
        population,
        primaryMetric: payload.primaryMetric,
        secondaryMetrics: Array.isArray(payload.secondaryMetrics) ? payload.secondaryMetrics : [],
        variants,
        minimumCompletedPerVariant: Number(payload.minimumCompletedPerVariant || 5),
        status: payload.status || 'draft',
      });
      return sendSuccess({ test: formatExperiment(experiment) });
    }

    if (method === 'POST' && segments.length === 3 && segments[0] === 'tests') {
      const experimentId = Number(segments[1]);
      const action = segments[2];
      const payload = await readBody();
      if (action === 'status') {
        const experiment = setExperimentStatus(experimentId, String(payload.status || ''));
        return sendSuccess({ test: formatExperiment(experiment) });
      }
      if (action === 'assign') {
        const context = payload.context && typeof payload.context === 'object' && !Array.isArray(payload.context)
          ? payload.context
          : {};
        const assignment = assignExperimentVariant(String(payload.key || ''), experimentId, String(payload.variant || ''), {
          context,
          timingHistorySufficient: payload.timingHistorySufficient === true,
        });
        return sendSuccess({ assignment: { candidateKey: assignment.queueItem?.candidateKey, variantLabel: assignment.variantLabel ?? payload.variant } });
      }
      throw new Error(`Unknown test action: ${action}`);
    }

    if (method === 'POST' && segments.length === 2 && segments[0] === 'learning') {
      const action = segments[1];
      const payload = await readBody();
      if (action === 'refresh') {
        const result = refreshLearnedRuleSuggestion({
          experimentId: Number(payload.experimentId),
          baselineLabel: payload.baselineLabel,
          comparisonLabel: payload.comparisonLabel,
          windowMinutes: payload.windowMinutes == null || payload.windowMinutes === '' ? null : Number(payload.windowMinutes),
          mechanismTags: Array.isArray(payload.mechanismTags) ? payload.mechanismTags : [],
        });
        return sendSuccess({
          created: Boolean(result.candidate?.created),
          persisted: result.persisted ? formatLearnedRule(result.persisted) : null,
        });
      }
      if (action === 'accept') {
        const rule = acceptLearnedRule(Number(payload.id));
        return sendSuccess({ rule: formatLearnedRule(rule) });
      }
      if (action === 'retire') {
        const rule = retireLearnedRule(Number(payload.id), { reason: String(payload.reason || '').trim() });
        return sendSuccess({ rule: formatLearnedRule(rule) });
      }
      throw new Error(`Unknown learning action: ${action}`);
    }

    return sendNotFound();
  } catch (err) {
    if (err instanceof SyntaxError) {
      return sendJson(400, { state: 'error', code: 'BAD_REQUEST', message: 'Invalid JSON body.' });
    }
    const status = err?.code === 'NOT_FOUND_ERROR' ? 404 : 400;
    return sendJson(status, {
      state: 'error',
      code: 'ACTION_REJECTED',
      message: err.message || 'Unknown error',
    });
  }
}

function applyEditorPayload(current, payload) {
  const updated = { ...current };
  if (payload.operatorContext !== undefined) {
    updated.editor = {
      ...(updated.editor || {}),
      operatorContext: String(payload.operatorContext || '').trim().slice(0, 12_000),
    };
  }
  if (payload.body !== undefined) {
    updated.body = String(payload.body ?? '');
    updated.editor = { ...(updated.editor || {}), finalText: updated.body };
  }
  if (Array.isArray(payload.threadParts)) {
    updated.threadParts = payload.threadParts.map((part) => String(part ?? ''));
    updated.body = '';
    updated.editor = { ...(updated.editor || {}), threadParts: [...updated.threadParts], pipeline: 'thread' };
  }
  if (payload.mediaType !== undefined) {
    const mediaType = String(payload.mediaType || 'none');
    if (!MEDIA_TYPES.includes(mediaType)) throw new Error(`Invalid media type: ${mediaType}`);
    const media = {
      ...(updated.editor?.media || {}),
      type: mediaType,
      required: payload.mediaRequired === true || (updated.editor?.media?.required && payload.mediaRequired === undefined),
    };
    if (payload.mediaReason !== undefined) media.reason = String(payload.mediaReason || '');
    if (payload.mediaSource !== undefined) media.source = String(payload.mediaSource || '');
    if (payload.mediaAltText !== undefined) media.altText = String(payload.mediaAltText || '');
    updated.editor = { ...(updated.editor || {}), media };
  }
  return updated;
}
