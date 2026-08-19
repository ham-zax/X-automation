import 'dotenv/config';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import {
  fetchAccountPerformance,
  fetchGitHubTrending,
  fetchHackerNews,
  fetchXUnderTheHoodReport,
  fetchXNichePosts,
  fetchXViralPosts,
  generateMomentumPost,
  rankNews,
  rankXViralPosts,
} from './tech_news.js';
import { applyWriterOutput, buildWriterPacket, composeDraft, scoreDraft, weightedPostLength } from './drafting.js';
import { generateWriterOutput } from './writer_runtime.js';
import { refreshEngagementOpportunities } from './engagement.js';
import { CONTENT_METRICS, EXPERIMENT_DIMENSIONS, NETWORK_METRICS } from './experiments.js';
import { syncAudience, unfollowAudienceUser } from './audience.js';
import { RELATIONSHIP_STAGES, TARGET_CLASSES } from './relationship.js';
import { rankMainFeedItems, recommendMainFeedSchedule } from './scheduler.js';
import { NICHE_LABELS, isOpportunityCandidate, personalizeCandidates } from './strategy.js';
import {
  approveEngagementQueueItem,
  approveQueueItem,
  inspectWorkflow,
  refreshQueueRecommendation,
  requestQueueReview,
  resolveEngagementItem,
  routeCandidate,
  saveCandidateToWorkflow,
  sendApprovedEngagementReply,
} from './pipeline.js';
import {
  ACCOUNT_HEALTH_OBSERVATION_TYPES,
  acceptLearnedRule,
  assignExperimentVariant,
  candidateKey,
  createExperiment,
  countQueueItems,
  countSavedCandidates,
  getAccountHealthSummary,
  getAudienceSummary,
  getCandidate,
  getDraft,
  getDraftByCandidate,
  getExperiment,
  getExperimentSummary,
  getLearningOverview,
  getMainFeedScheduleItem,
  getNewFollowerQuality,
  getPerformanceSnapshot,
  getPreferenceProfile,
  getQueueItemByCandidate,
  getRelationshipProfile,
  getRelationshipSummary,
  listAudienceProfiles,
  listAcceptedLearnedRules,
  listCandidateActions,
  listCandidates,
  listDrafts,
  listEngagementItems,
  listExperimentAssignments,
  listExperiments,
  listApprovedMainFeedItems,
  listPublicationMeasurementSeries,
  listQueueItems,
  listRecentMainFeedPublications,
  listRecentPublishedContent,
  listRelationshipProfiles,
  recordAccountHealthObservation,
  recordPerformanceSnapshot,
  recordUnderTheHoodSnapshot,
  refreshLearnedRuleSuggestion,
  retireLearnedRule,
  saveDraft,
  setExperimentStatus,
  setMainFeedSchedule,
  upsertCandidates,
} from './store.js';

const PORT = Number(process.env.WEB_PORT || 3030);
const NEWS_LIMIT = Number(process.env.NEWS_LIMIT || 8);
const AUTO_POST = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';
const ACCOUNT = process.env.X_ACCOUNT || 'ham_zax';
const CONTENT_PIPELINES = new Set(['original', 'quote', 'thread', 'reply']);
const MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread']);
const SCHEDULABLE_MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread', 'repost']);
const MEDIA_TYPES = ['none', 'screenshot', 'chart', 'code', 'diagram'];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(Number(value));
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function readForm(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 128_000) throw new Error('Request too large.');
  }
  return new URLSearchParams(body);
}


function draftEditorState(current, queueItem, form) {
  const pipeline = CONTENT_PIPELINES.has(queueItem?.pipeline) ? queueItem.pipeline : 'original';
  const mediaType = form.get('mediaType') || current.editor?.media?.type || 'none';
  if (!MEDIA_TYPES.includes(mediaType)) throw new Error(`Invalid media type: ${mediaType}`);
  const updated = {
    ...current,
    hook: form.has('hook') ? (form.get('hook') || '') : current.hook,
    insight: form.has('insight') ? (form.get('insight') || '') : current.insight,
    evidence: form.has('evidence') ? (form.get('evidence') || '') : current.evidence,
    action: form.has('action') ? (form.get('action') || '') : current.action,
    gates: {},
    editor: {
      ...(current.editor || {}),
      pipeline,
      media: {
        required: form.get('mediaRequired') === '1',
        type: mediaType,
        reason: form.get('mediaReason') || current.editor?.media?.reason || '',
        source: form.get('mediaSource') || current.editor?.media?.source || '',
        altText: form.get('mediaAltText') || current.editor?.media?.altText || '',
      },
    },
  };
  if (pipeline === 'thread') {
    updated.threadParts = form.getAll('threadPart').map((part) => String(part));
    updated.body = '';
    updated.editor.threadParts = [...updated.threadParts];
  } else {
    updated.body = form.get('body') ?? current.body ?? composeDraft(updated, { pipeline });
    updated.editor.finalText = updated.body;
  }
  return { updated, pipeline };
}

function dashboardDraftScore(candidate, draft, pipeline) {
  return scoreDraft(draft, candidate, {
    pipeline,
    recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidate.key }),
    recentReplies: pipeline === 'reply' ? listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidate.key }) : [],
    factualityConfirmed: false,
    evidenceConfirmed: false,
    mediaReady: !draft.editor?.media?.required,
  });
}


async function generateDraftCandidate(current) {
  const candidate = getCandidate(current.candidateKey);
  if (!candidate) throw new Error('Draft source candidate not found.');
  const queueItem = getQueueItemByCandidate(candidate.key) || saveCandidateToWorkflow(candidate.key, true).queueItem;
  const pipeline = CONTENT_PIPELINES.has(queueItem.pipeline) ? queueItem.pipeline : 'original';
  const username = String(queueItem.engagementTargetUsername || candidate.username || candidate.authorUsername || candidate.author || '').replace(/^@/, '').trim();
  const packet = buildWriterPacket({
    candidate,
    queueItem,
    draft: current,
    relationship: username ? getRelationshipProfile(username) : null,
    recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidate.key }),
    recentReplies: listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidate.key }),
    health: getAccountHealthSummary().health,
  });
  const promptDocumentText = await fs.readFile(path.resolve(packet.promptDocument), 'utf8');
  const output = await generateWriterOutput(packet, promptDocumentText);
  if (output.pipeline !== pipeline) throw new Error(`AI returned ${output.pipeline}; expected ${pipeline}.`);
  const writerBase = current.editor?.pipeline && current.editor.pipeline !== pipeline ? { ...current, editor: {} } : current;
  const next = applyWriterOutput(writerBase, output);
  if (output.decision === 'DO_NOT_POST') {
    const priorText = pipeline === 'thread' ? (current.threadParts || []).join('\n') : String(current.body || '');
    if (/\[[^\]]+\]/.test(priorText)) {
      if (pipeline === 'thread') next.threadParts = ['', ''];
      else next.body = '';
    }
  }
  const analysis = dashboardDraftScore(candidate, next, pipeline);
  const saved = saveDraft({ ...next, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
  routeCandidate(candidate.key, pipeline, { actor: 'agent' });
  return { saved, queueItem: getQueueItemByCandidate(candidate.key), output, analysis };
}

async function collectResearch(source) {
  if (source === 'x') {
    const result = await fetchXNichePosts(Math.max(NEWS_LIMIT * 6, 48));
    const ranked = personalizeCandidates(rankNews({ xPosts: result.posts }), getPreferenceProfile());
    upsertCandidates(ranked);
    return result.error;
  }

  if (source === 'viral') {
    const result = await fetchXViralPosts(Math.max(NEWS_LIMIT * 10, 80));
    const ranked = personalizeCandidates(rankXViralPosts(result.posts), getPreferenceProfile());
    upsertCandidates(ranked);
    return result.error;
  }

  if (source === 'github') {
    const repos = await fetchGitHubTrending(Math.max(NEWS_LIMIT * 2, 16));
    if (!Array.isArray(repos)) return repos?.error || 'GitHub research failed.';
    upsertCandidates(personalizeCandidates(rankNews({ ghRepos: repos }), getPreferenceProfile()));
    return null;
  }

  if (source === 'hn') {
    const stories = await fetchHackerNews(Math.max(NEWS_LIMIT * 2, 16));
    if (!Array.isArray(stories)) return stories?.error || 'Hacker News research failed.';
    upsertCandidates(personalizeCandidates(rankNews({ hnStories: stories }), getPreferenceProfile()));
    return null;
  }

  if (source === 'all') {
    const [xResult, repos, stories] = await Promise.all([
      fetchXNichePosts(Math.max(NEWS_LIMIT * 4, 32)),
      fetchGitHubTrending(NEWS_LIMIT),
      fetchHackerNews(NEWS_LIMIT),
    ]);
    upsertCandidates(personalizeCandidates(rankNews({
      xPosts: xResult.posts,
      ghRepos: Array.isArray(repos) ? repos : [],
      hnStories: Array.isArray(stories) ? stories : [],
    }), getPreferenceProfile()));
    return xResult.error || (!Array.isArray(repos) ? repos?.error : null) || (!Array.isArray(stories) ? stories?.error : null);
  }

  return null;
}

function nicheBadges(candidate) {
  const tags = (candidate.niche?.tags || [])
    .map((tag) => `<span class="badge text-bg-primary">${escapeHtml(NICHE_LABELS[tag] || tag)}</span>`)
    .join(' ');
  const matches = (candidate.niche?.matches || [])
    .map((term) => `<span class="badge rounded-pill text-bg-light border">${escapeHtml(term)}</span>`)
    .join(' ');
  return `${tags ? `<div class="d-flex flex-wrap gap-2 mb-2">${tags}</div>` : ''}${(matches || candidate.niche?.score != null) ? `<details class="small mb-3"><summary class="text-secondary">Why it matches</summary><div class="d-flex flex-wrap gap-1 mt-2">${matches}<span class="badge text-bg-light border">Internal topic fit ${escapeHtml(candidate.niche?.score ?? 'n/a')}/50</span></div></details>` : ''}`;
}

function viralBadges(candidate) {
  if (!candidate.viral) return '';
  const tierClass = candidate.viral.tier === 'breakout' ? 'text-bg-danger' : candidate.viral.tier === 'viral' ? 'text-bg-warning' : 'text-bg-info';
  const tierLabel = candidate.viral.tier === 'breakout' ? 'Breaking out' : candidate.viral.tier === 'viral' ? 'Widely discussed' : 'Picking up';
  return `<div class="d-flex flex-wrap gap-2 mb-3"><span class="badge ${tierClass}">${escapeHtml(tierLabel)}</span><span class="badge text-bg-light border">${candidate.viral.ageHours.toFixed(1)}h old</span></div>
    <details class="small mb-3"><summary class="text-secondary">Trend details</summary><div class="d-flex flex-wrap gap-2 mt-2"><span class="badge text-bg-light border">${formatNumber(Math.round(candidate.viral.viewsPerHour))} views/h</span><span class="badge text-bg-light border">${candidate.viral.engagementsPerHour.toFixed(1)} engagement/h</span><span class="badge text-bg-light border">Internal signal ${Math.round(candidate.viral.score)}/100</span></div></details>`;
}

const ROUTE_OPTIONS = [
  ['original', 'Original'], ['quote', 'Quote'], ['thread', 'Thread'], ['reply', 'Reply'],
  ['repost', 'Repost'], ['research', 'Research only'], ['watch', 'Watch'], ['ignore', 'Ignore'],
];

const PRIMARY_NAV = [
  ['today', 'today', 'Today'],
  ['discover', 'x', 'Discover'],
  ['conversations', 'engage', 'Conversations'],
  ['create', 'queue', 'Create'],
  ['results', 'results', 'Results'],
  ['improve', 'improve', 'Improve'],
  ['advanced', 'advanced', 'Advanced'],
];

const SOURCE_GROUPS = Object.freeze({
  today: 'today',
  x: 'discover', viral: 'discover', interesting: 'discover', opportunities: 'discover', github: 'discover', hn: 'discover', all: 'discover',
  engage: 'conversations', relationships: 'conversations',
  queue: 'create', drafts: 'create',
  results: 'results', performance: 'results', health: 'results', audience: 'results',
  improve: 'improve', experiments: 'improve', learning: 'improve',
  advanced: 'advanced',
});

const STATUS_LABELS = Object.freeze({
  triage: 'Needs a decision',
  researching: 'Researching',
  drafting: 'In progress',
  needs_review: 'Needs review',
  approved: 'Approved — waiting',
  publishing: 'Publishing now',
  published: 'Published',
  watching: 'Saved for later',
  ignored: 'Ignored',
  expired: 'Expired',
  failed: 'Needs attention',
});

const PIPELINE_LABELS = Object.freeze({
  triage: 'Not chosen',
  original: 'Original post',
  quote: 'Quote post',
  thread: 'Thread',
  reply: 'Reply',
  repost: 'Repost',
  research: 'Research only',
  watch: 'Save for later',
  ignore: 'Ignore',
});

const EXPERIMENT_DIMENSION_LABELS = Object.freeze({
  style: 'Writing style', hook_type: 'Opening / hook', media_type: 'Media type', format: 'Content format', timing_bucket: 'Publishing time',
  target_class: 'Type of person/account', target_score_bucket: 'Relationship fit', target_size_bucket: 'Account size', reply_age_bucket: 'How fresh the conversation is',
  conversation_saturation_bucket: 'Recent interaction level', reply_archetype: 'Reply style', relationship_stage: 'Relationship stage',
  interaction_volume_bucket: 'Interaction volume', target_concentration_bucket: 'Target concentration', archetype_repetition_bucket: 'Reply-style repetition',
});

const EXPERIMENT_METRIC_LABELS = Object.freeze({
  views_per_hour: 'Views per hour', replies_per_1000_views: 'Replies per 1,000 views', reposts_per_1000_views: 'Reposts per 1,000 views',
  visible_engagement_per_1000_views: 'Visible engagement per 1,000 views', associated_follows_per_1000_views: 'Associated follows per 1,000 views',
  author_response_rate: 'People who respond', conversation_continuation_rate: 'Conversations that continue', relationship_stage_progression: 'Relationship progression',
  connected_target_conversion: 'New connected relationships', recurring_relationship_conversion: 'New recurring relationships', mutual_relationship_count: 'New mutual relationships',
  interaction_yield: 'Useful outcomes per interaction', target_diversity: 'Target diversity', class_diversity: 'Audience-class diversity', topic_diversity: 'Topic diversity',
  top_target_concentration: 'Top-target concentration',
});

const EVIDENCE_LABELS = Object.freeze({
  insufficient: 'Not enough evidence', preliminary: 'Early signal', directional: 'Promising — needs more evidence', repeated: 'Consistent pattern — still observational',
});

function statusLabel(value) {
  return STATUS_LABELS[value] || relationshipLabel(value || 'unknown');
}

function pipelineLabel(value) {
  return PIPELINE_LABELS[value] || relationshipLabel(value || 'unknown');
}

function experimentDimensionLabel(value) {
  return EXPERIMENT_DIMENSION_LABELS[value] || relationshipLabel(value || 'unknown');
}

function experimentMetricLabel(value) {
  return EXPERIMENT_METRIC_LABELS[value] || relationshipLabel(value || 'unknown');
}

function evidenceLabel(value) {
  return EVIDENCE_LABELS[value] || relationshipLabel(value || 'unknown');
}

function sourceGroup(source) {
  return SOURCE_GROUPS[source] || 'discover';
}

function opportunityLabel(score) {
  const value = Number(score || 0);
  if (value >= 80) return 'Strong';
  if (value >= 60) return 'Worth considering';
  if (value >= 40) return 'Possible';
  return 'Low priority';
}

function workflowBadges(queueItem) {
  if (!queueItem) return '';
  return `<div class="d-flex gap-1 flex-wrap mt-2">
    <span class="badge text-bg-secondary">${escapeHtml(pipelineLabel(queueItem.pipeline))}</span>
    <span class="badge text-bg-light border">${escapeHtml(statusLabel(queueItem.status))}</span>
  </div>
  <details class="small mt-2"><summary class="text-secondary">Recommendation details</summary><div class="d-flex gap-1 flex-wrap mt-2">
    <span class="badge text-bg-light border">Reach ${Math.round(queueItem.reachPotential)}</span>
    <span class="badge text-bg-light border">Follow ${Math.round(queueItem.followPotential)}</span>
    <span class="badge text-bg-light border">Conversation ${Math.round(queueItem.conversationPotential)}</span>
    <span class="badge text-bg-light border">Relationship ${Math.round(queueItem.relationshipPotential)}</span>
  </div></details>`;
}

function routeForm(queueItem, key, returnTo) {
  if (!queueItem) return '';
  const selected = queueItem.pipeline === 'triage' ? queueItem.recommendedPipeline : queueItem.pipeline;
  const options = ROUTE_OPTIONS.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  return `<form method="post" action="/queue/route" class="d-flex gap-2 align-items-center flex-wrap mt-3">
    <input type="hidden" name="key" value="${escapeHtml(key)}">
    <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
    <span class="small fw-semibold">Use this as</span>
    <select class="form-select form-select-sm" style="width:auto" name="pipeline">${options}</select>
    <button class="btn btn-outline-dark btn-sm" type="submit">Apply choice</button>
  </form>`;
}

function candidateCard(candidate, index, returnTo) {
  const isX = candidate.source === 'x';
  const draft = getDraftByCandidate(candidate.key);
  let queueItem = getQueueItemByCandidate(candidate.key);
  if (candidate.saved && queueItem && !queueItem.recommendedPipeline) queueItem = refreshQueueRecommendation(candidate.key).queueItem;
  const actions = listCandidateActions(candidate.key);
  const actionBadges = actions.map((action) => action.output_url
    ? `<a class="badge text-bg-info text-decoration-none" href="${escapeHtml(action.output_url)}" target="_blank">${escapeHtml(action.action.toUpperCase())} ↗</a>`
    : `<span class="badge text-bg-info">${escapeHtml(action.action.toUpperCase())}</span>`).join(' ');
  const renderedText = isX ? candidate.text : generateMomentumPost(candidate);
  const metrics = candidate.metrics || {};
  const metricLine = isX
    ? `${formatNumber(metrics.views)} views · ${formatNumber(metrics.likes)} likes · ${formatNumber(metrics.retweets)} reposts · ${formatNumber(metrics.replies)} replies`
    : candidate.source === 'github'
      ? `${formatNumber(metrics.stars)} stars · ~${formatNumber(metrics.starsPerDay)} stars/day`
      : `${formatNumber(metrics.points)} points · ${formatNumber(metrics.comments)} comments`;
  const recommendation = queueItem?.recommendedPipeline
    ? `<div class="small mt-2"><strong>Suggested use:</strong> ${escapeHtml(pipelineLabel(queueItem.recommendedPipeline))} <span class="text-secondary">— ${escapeHtml(queueItem.routingReason)}</span></div>`
    : '';
  const primaryAction = draft
    ? `<a class="btn btn-primary btn-sm" href="/?source=drafts&draft=${draft.id}">Continue draft</a>`
    : `<form method="post" action="/draft/create" class="d-flex gap-2 align-items-center flex-wrap m-0">
        <input type="hidden" name="key" value="${escapeHtml(candidate.key)}">
        <label class="visually-hidden" for="create-type-${index}">What do you want to make?</label>
        <select class="form-select form-select-sm" id="create-type-${index}" name="pipeline" style="width:auto">
          <option value="original">Original post</option>
          ${isX ? '<option value="quote">Quote post</option>' : ''}
          <option value="thread">Thread</option>
        </select>
        <button class="btn btn-primary btn-sm" type="submit">Create</button>
      </form>`;

  return `<article class="card shadow-sm border-0 mb-3">
    <div class="card-body p-4">
      <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
        <div>
          <div class="fw-semibold fs-5">#${index + 1} ${escapeHtml(candidate.title)}</div>
          <div class="text-secondary small">${escapeHtml(candidate.source.toUpperCase())}${candidate.timestamp ? ` · ${escapeHtml(new Date(candidate.timestamp).toLocaleString())}` : ''}</div>
        </div>
        <span class="badge text-bg-dark fs-6">${candidate.viral ? 'Trending signal' : isX ? 'Relevant signal' : 'Research signal'}</span>
      </div>
      ${isX ? nicheBadges(candidate) : ''}
      ${viralBadges(candidate)}
      <p class="card-text fs-6 lh-base text-break">${escapeHtml(renderedText)}</p>
      <div class="text-secondary small mb-2">${escapeHtml(metricLine)}</div>
      ${workflowBadges(queueItem)}
      ${recommendation}
      <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap mt-3">
        <div class="d-flex gap-2 flex-wrap">
          ${candidate.saved ? '<span class="badge text-bg-success">Saved</span>' : ''}
          ${actionBadges}
          ${draft ? `<span class="badge text-bg-secondary">Draft ${draft.qualityScore}/50 · ${escapeHtml(draft.status)}</span>` : ''}
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          ${primaryAction}
          <form method="post" action="/candidate/save" class="m-0">
            <input type="hidden" name="key" value="${escapeHtml(candidate.key)}">
            <input type="hidden" name="saved" value="${candidate.saved ? '0' : '1'}">
            <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
            <button class="btn ${candidate.saved ? 'btn-outline-success' : 'btn-outline-secondary'} btn-sm" type="submit">${candidate.saved ? 'Saved' : 'Save for later'}</button>
          </form>
          <a class="btn btn-outline-secondary btn-sm" href="${escapeHtml(candidate.url)}" target="_blank" rel="noreferrer">Open source ↗</a>
        </div>
      </div>
    </div>
  </article>`;
}

function confirmationFields() {
  return `<div class="my-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
    <label class="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><input class="mt-0.5" type="checkbox" name="factualityConfirmed" value="1"> <span><strong>I checked the facts</strong><br><span class="text-xs text-slate-500">The final wording matches the source and context I reviewed.</span></span></label>
    <label class="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><input class="mt-0.5" type="checkbox" name="evidenceConfirmed" value="1"> <span><strong>I checked the supporting proof</strong><br><span class="text-xs text-slate-500">Any benchmark, result, or capability claim has real support.</span></span></label>
  </div>`;
}

function gatePanel(gates = {}, { live = false } = {}) {
  if (!Object.keys(gates).length) return '<div class="editor-checks editor-checks-warn" data-live-checks><div class="font-semibold text-amber-950">Checks update as you edit.</div><div class="mt-1 text-sm text-amber-900">Generate or change the draft to see the current approval blockers.</div></div>';
  const humanCodes = new Set(['FACTUALITY_UNCONFIRMED', 'EVIDENCE_UNCONFIRMED']);
  const allFailures = gates.failures || [];
  const writingFailures = allFailures.filter((item) => !humanCodes.has(item.code));
  const humanConfirmations = allFailures.filter((item) => humanCodes.has(item.code));
  const failures = writingFailures.map((item) => `<li>${escapeHtml(item.message)}</li>`).join('');
  const warnings = (gates.warnings || []).map((item) => `<li>${escapeHtml(item.message)}</li>`).join('');
  const ready = writingFailures.length === 0;
  return `<div class="editor-checks ${ready ? 'editor-checks-ok' : 'editor-checks-warn'}" ${live ? 'data-live-checks' : ''}><strong>${ready ? 'Writing checks passed' : 'Fix before approval'}</strong>${failures ? `<ul class="mt-2 mb-0">${failures}</ul>` : ''}${warnings ? `<div class="small mt-2">Worth checking</div><ul class="mb-0">${warnings}</ul>` : ''}${humanConfirmations.length ? '<div class="mt-2 text-sm text-sky-800">Before you approve, review the finished post and tick the two confirmation boxes below. You do not need to add any extra text.</div>' : ''}</div>`;
}

const QUALITY_SIGNAL_LABELS = {
  niche: ['Topic fit', 10, 'How closely this matches your AI/dev/builder focus.'],
  hook: ['Opening', 8, 'Whether the first line quickly gives someone a reason to keep reading.'],
  insight: ['Useful insight', 10, 'Whether the post adds a concrete implication instead of repeating the source.'],
  evidence: ['Support', 10, 'Whether claims are backed by source material, data, steps, or observed results.'],
  action: ['Takeaway', 7, 'Whether the reader leaves with a useful next step, decision, or question.'],
  originality: ['Original angle', 5, 'Whether the wording adds something distinct from the source.'],
};

function qualityBreakdownHtml(breakdown = {}) {
  return Object.entries(QUALITY_SIGNAL_LABELS).map(([key, [label, max, description]]) => `<div class="editor-score-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(breakdown[key] ?? 0)}<span class="text-xs font-medium text-slate-400">/${max}</span></dd><div class="mt-1 text-xs text-slate-500">${escapeHtml(description)}</div></div>`).join('');
}

function mediaTypeOptions(selected = 'none') {
  const labels = {
    none: 'No visual',
    screenshot: 'Screenshot',
    chart: 'Chart',
    code: 'Code sample',
    diagram: 'Diagram',
  };
  return MEDIA_TYPES.map((type) => `<option value="${type}" ${selected === type ? 'selected' : ''}>${escapeHtml(labels[type] || type)}</option>`).join('');
}

function mediaLabel(media = {}) {
  if (media.required) return 'Media required · blocked until a real attachment readiness path exists';
  if (media.type && media.type !== 'none') return `Media recommended · ${media.type}`;
  return 'Media: none';
}

function schedulerContext(now = Date.now()) {
  const recentPosts = listRecentMainFeedPublications({ limit: 20 });
  return {
    now,
    recentPosts,
    lastMainFeedPostAt: recentPosts[0]?.publishedAt ?? null,
    learnedRules: listAcceptedLearnedRules({ limit: 500 }),
  };
}

function scheduleIssueList(items = []) {
  if (!items.length) return '';
  return `<ul class="small mb-2">${items.map((item) => `<li><strong>${escapeHtml(item.code || 'SCHEDULE')}</strong> — ${escapeHtml(item.message || '')}</li>`).join('')}</ul>`;
}

function schedulePanel(queueItem, context) {
  if (queueItem.status !== 'approved' || !['main', 'main_feed'].includes(queueItem.lane) || !SCHEDULABLE_MAIN_FEED_PIPELINES.has(queueItem.pipeline)) return '';
  const item = getMainFeedScheduleItem(queueItem.candidateKey);
  if (!item) return '';
  const decision = recommendMainFeedSchedule(item, context);
  const recommended = decision.recommendedAt == null
    ? 'Not ready to publish yet'
    : decision.recommendedAt <= Number(context.now)
      ? 'Publish when you are ready'
      : `Around ${new Date(decision.recommendedAt).toLocaleString()}`;
  const manualOnly = queueItem.pipeline === 'repost'
    ? '<div class="alert alert-secondary py-2 mb-2">Reposts remain manual.</div>'
    : '';
  return `<div class="card bg-light border-0 mt-3"><div class="card-body">
    <div class="d-flex justify-content-between gap-2 flex-wrap mb-2"><div><strong>Publishing plan</strong><div class="small text-secondary">${escapeHtml(recommended)}</div></div><span class="badge ${decision.eligible ? 'text-bg-success' : 'text-bg-warning'}">${decision.eligible ? 'Ready' : 'Needs attention'}</span></div>
    ${manualOnly}
    <form method="post" action="/queue/schedule" class="row g-2 align-items-end">
      <input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}">
      <div class="col-md-3"><label class="form-label small">How urgent is this?</label><select class="form-select" name="scheduleUrgency">${['evergreen', 'timely', 'viral'].map((value) => `<option value="${value}" ${queueItem.scheduleUrgency === value ? 'selected' : ''}>${value === 'evergreen' ? 'Can wait' : value === 'timely' ? 'Timely' : 'Time-sensitive'}</option>`).join('')}</select></div>
      <div class="col-md-3"><label class="form-label small">Useful until</label><input class="form-control" type="datetime-local" name="expiresAt" value="${escapeHtml(formatDateTime(queueItem.expiresAt))}"></div>
      <div class="col-md-4"><label class="form-label small">Choose a different time</label><input class="form-control" type="datetime-local" name="scheduledAt" value="${escapeHtml(formatDateTime(queueItem.scheduledAt))}"></div>
      <div class="col-md-2"><button class="btn btn-outline-primary w-100" type="submit">Save plan</button></div>
      <div class="col-12 small text-secondary">${queueItem.scheduleSource === 'human' ? 'You chose the publishing time. Clear it to return to the recommendation.' : 'The recommended time is advisory and does not approve or publish the post.'}</div>
    </form>
    <details class="small mt-3"><summary>Why this time?</summary><div class="mt-2">${escapeHtml(decision.reason)}</div>${scheduleIssueList(decision.blockers)}${scheduleIssueList(decision.warnings)}${scheduleIssueList(decision.conflicts)}<div class="text-secondary">Internal scheduler priority ${escapeHtml(decision.priority)}. Timing is an editorial coverage heuristic, not an X platform rule.</div></details>
  </div></div>`;
}

function draftCard(draft) {
  const candidate = getCandidate(draft.candidateKey);
  if (!candidate) return '';
  const queueItem = getQueueItemByCandidate(candidate.key);
  const pipeline = CONTENT_PIPELINES.has(queueItem?.pipeline) ? queueItem.pipeline : 'original';
  const media = draft.editor?.media || { required: false, type: 'none', reason: '', source: '', altText: '' };
  const analysis = dashboardDraftScore(candidate, draft, pipeline);
  const gatesPassed = draft.gates?.passed === true;
  const engagementReply = queueItem?.lane === 'engagement' && pipeline === 'reply';
  const engagementConstrained = engagementReply && getAccountHealthSummary().health.state === 'constrained';
  const canReview = CONTENT_PIPELINES.has(pipeline) && ['drafting', 'needs_review'].includes(queueItem?.status);
  const canApprove = queueItem?.status === 'needs_review' && MAIN_FEED_PIPELINES.has(pipeline) && draft.qualityScore >= 40 && gatesPassed;
  const canApproveSend = engagementReply && !engagementConstrained && queueItem?.status === 'needs_review' && draft.qualityScore >= 40 && gatesPassed;
  const canSendApproved = engagementReply && !engagementConstrained && queueItem?.status === 'approved' && Boolean(queueItem.humanApprovedAt) && Boolean(queueItem.approvedText);
  const approvedMainFeed = !engagementReply && queueItem?.status === 'approved' && Boolean(queueItem.humanApprovedAt);
  const editor = draft.editor || {};
  const threadParts = pipeline === 'thread' ? (draft.threadParts?.length ? draft.threadParts : ['', '']) : [];
  const hasDraftContent = pipeline === 'thread'
    ? threadParts.some((part) => String(part || '').trim())
    : Boolean(String(draft.body || '').trim());
  const qualityClass = analysis.score >= 40 && analysis.gates?.failures?.filter((item) => !['FACTUALITY_UNCONFIRMED', 'EVIDENCE_UNCONFIRMED'].includes(item.code)).length === 0
    ? 'quality-good'
    : analysis.score >= 30 ? 'quality-warn' : 'quality-low';
  const publishEditor = pipeline === 'thread'
    ? threadParts.map((part, index) => `<div class="mb-5"><label class="editor-label">Thread part ${index + 1}<span class="text-xs font-medium text-slate-400">${weightedPostLength(part)}/280</span></label><textarea class="editor-textarea editor-textarea-thread" rows="4" name="threadPart">${escapeHtml(part)}</textarea></div>`).join('')
    : `<div class="mb-5"><label class="editor-label">${engagementReply ? 'Reply text' : 'Post text'} <span class="text-xs font-medium text-slate-400" data-live-weighted-length>${weightedPostLength(draft.body)}/280</span></label><textarea class="editor-textarea" rows="7" name="body" placeholder="Generate a draft or edit the final text here.">${escapeHtml(draft.body)}</textarea></div>`;
  const workflowAction = canApproveSend
    ? `<form method="post" action="/engage/approve-send">${confirmationFields()}<input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="editor-btn editor-btn-primary" type="submit">Approve &amp; send exact reply</button></form>`
    : canSendApproved
      ? `<form method="post" action="/engage/send"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="editor-btn editor-btn-primary" type="submit">Send approved reply</button></form>`
      : canApprove
        ? `<form method="post" action="/queue/approve">${confirmationFields()}<input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="editor-btn editor-btn-primary" type="submit">Approve for publishing</button></form>`
        : approvedMainFeed
          ? '<a class="editor-btn editor-btn-primary" href="/?source=queue">Review publishing plan</a>'
          : canReview
            ? `<form method="post" action="/queue/review">${confirmationFields()}<input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="editor-btn editor-btn-primary" type="submit">${queueItem.status === 'needs_review' ? 'Review readiness again' : 'Review readiness'}</button><div class="mt-2 text-xs text-slate-500">This checks whether the current draft is ready for human approval. It does not publish anything.</div></form>`
            : '';
  const aiNote = editor.decision === 'DO_NOT_POST'
    ? `<div class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>AI recommends not posting this source.</strong><div class="mt-1">${escapeHtml((editor.riskFlags || []).join(' · ') || 'There is not enough verified additive value in the current packet.')}</div><div class="mt-2 text-xs text-amber-800">You do not need to fill a scaffold. Add stronger evidence/source context, or move on.</div></div>`
    : editor.finalText || editor.threadParts?.length
      ? '<div class="mt-2 text-sm text-slate-500">AI prepared this candidate. Your job is to review the exact text and confirm facts/evidence before approval—not fill a scaffold.</div>'
      : '';
  return `<article class="editor-card mb-6">
    <div class="editor-header">
      <div class="min-w-0"><div class="app-kicker">${engagementReply ? 'Conversation reply' : 'Create'}</div><h1 class="editor-title mt-1">${escapeHtml(candidate.title)}</h1><div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500"><span>${escapeHtml(pipelineLabel(pipeline))}</span><span>·</span><span>${escapeHtml(statusLabel(queueItem?.status || draft.status))}</span></div>${aiNote}</div>
      <div class="flex flex-wrap items-center gap-2"><span class="quality-pill ${qualityClass}" data-live-quality-score>${analysis.score}/50</span><form method="post" action="/draft/generate"><input type="hidden" name="id" value="${draft.id}"><button class="editor-btn editor-btn-ai" type="submit">Generate with AI</button></form><a class="editor-btn editor-btn-secondary" href="${escapeHtml(candidate.url)}" target="_blank">Open source ↗</a></div>
    </div>
    <div class="editor-body">
      <div class="mb-5">
        ${gatePanel(analysis.gates, { live: true })}
        <div class="human-confirm mt-3"><strong>Your final step:</strong> read the finished text, check the facts and supporting proof, then approve when you are satisfied. The AI writes the draft; you make the publishing decision.</div>
      </div>
      <form method="post" action="/draft/save" data-live-draft-editor>
        <input type="hidden" name="id" value="${draft.id}">
        ${publishEditor}
        <div class="mb-5"><div class="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Writing quality</div>${hasDraftContent ? `<dl class="editor-score-grid" data-live-breakdown>${qualityBreakdownHtml(analysis.breakdown)}</dl>` : '<div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600" data-live-breakdown>Quality feedback will appear after AI writes a draft or you start typing.</div>'}<div class="mt-2 text-xs text-slate-500">This feedback updates from the exact text you are editing. It helps improve the draft; the approval checks above decide whether it is ready.</div></div>
        ${engagementReply ? '<input type="hidden" name="mediaType" value="none">' : `<details class="muted-panel mb-5"><summary class="font-semibold text-slate-700">Add a visual or see AI context</summary><div class="mt-4"><label class="flex items-center gap-2 text-sm"><input type="checkbox" name="mediaRequired" value="1" ${media.required ? 'checked' : ''}> This post needs a visual before publishing</label><div class="mt-3 grid gap-3 md:grid-cols-2"><label class="text-sm text-slate-600">Visual type<select class="form-select mt-1" name="mediaType">${mediaTypeOptions(media.type)}</select></label><label class="text-sm text-slate-600">Why add it?<input class="form-control mt-1" name="mediaReason" value="${escapeHtml(media.reason || '')}"></label><label class="text-sm text-slate-600">Source or file reference<input class="form-control mt-1" name="mediaSource" value="${escapeHtml(media.source || '')}"></label><label class="text-sm text-slate-600">Description for accessibility<input class="form-control mt-1" name="mediaAltText" value="${escapeHtml(media.altText || '')}"></label></div><details class="mt-4 text-xs text-slate-500"><summary>How AI built this draft</summary><div class="mt-2"><strong>Key topics:</strong> ${escapeHtml((editor.semanticAnchors || []).join(', ') || 'None recorded')}</div><div class="mt-1"><strong>Source material used:</strong> ${escapeHtml((editor.evidenceUsed || []).join('; ') || 'None recorded')}</div></details></div></details>`}
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><div class="max-w-2xl text-sm text-slate-500">${engagementReply ? 'This exact reply sends only after explicit approval. It is never scheduled.' : 'Saving does not publish. Approval and the publishing plan remain separate decisions.'}</div><div class="editor-toolbar"><button class="editor-btn editor-btn-secondary" type="submit">Save changes</button></div></div>
      </form>
      ${pipeline === 'thread' ? `<div class="editor-toolbar mt-4"><form method="post" action="/draft/thread-parts"><input type="hidden" name="id" value="${draft.id}"><input type="hidden" name="op" value="add"><button class="editor-btn editor-btn-secondary" type="submit" ${threadParts.length >= 6 ? 'disabled' : ''}>Add part</button></form><form method="post" action="/draft/thread-parts"><input type="hidden" name="id" value="${draft.id}"><input type="hidden" name="op" value="remove"><button class="editor-btn editor-btn-secondary" type="submit" ${threadParts.length <= 2 ? 'disabled' : ''}>Remove last</button></form></div>` : ''}
      ${workflowAction ? `<div class="mt-5 border-t border-slate-100 pt-5">${workflowAction}</div>` : ''}
      ${engagementConstrained ? '<div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"><strong>Sending is temporarily unavailable.</strong> Supported account evidence is currently limiting reply approval/sending.</div>' : ''}
      ${approvedMainFeed ? '<div class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><strong>Approved — not published yet.</strong> The publishing plan remains a separate decision in Create.</div>' : ''}
    </div>
  </article>`;
}

function performanceView(snapshot, error) {
  if (error) return `<div class="alert alert-warning">Performance refresh failed: ${escapeHtml(error)}</div>`;
  if (!snapshot.account) return '<div class="alert alert-secondary">No performance snapshot yet.</div>';
  const account = snapshot.account;
  const previous = snapshot.previousAccount;
  const followerDelta = previous ? Number(account.followers) - Number(previous.followers) : null;
  const summary = `<div class="row g-3 mb-4">
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Followers</div><div class="fs-3 fw-semibold">${formatNumber(account.followers)}</div><div class="small ${followerDelta > 0 ? 'text-success' : 'text-secondary'}">${followerDelta == null ? 'first snapshot' : `${followerDelta >= 0 ? '+' : ''}${followerDelta} since prior snapshot`}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Following</div><div class="fs-3 fw-semibold">${formatNumber(account.following)}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Posts</div><div class="fs-3 fw-semibold">${formatNumber(account.posts)}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Likes given</div><div class="fs-3 fw-semibold">${formatNumber(account.likes)}</div></div></div></div>
  </div>`;
  const posts = snapshot.posts.map((post) => {
    const engagement = Number(post.likes) + Number(post.reposts) + Number(post.replies);
    const rate = Number(post.views) > 0 ? (engagement / Number(post.views)) * 100 : 0;
    return `<div class="card border-0 shadow-sm mb-3"><div class="card-body">
      <p class="mb-2">${escapeHtml(post.text)}</p>
      <div class="d-flex gap-2 flex-wrap small text-secondary">
        <span>${formatNumber(post.views)} views</span><span>${formatNumber(post.likes)} likes</span><span>${formatNumber(post.reposts)} reposts</span><span>${formatNumber(post.replies)} replies</span><span>${rate.toFixed(2)}% visible engagement</span>
      </div>
    </div></div>`;
  }).join('');
  const series = listPublicationMeasurementSeries({ limit: 20 });
  const measurementCards = series.map(({ queueItem, candidate, measurements }) => {
    if (!measurements.length) return '';
    const rows = measurements.map((measurement) => `<tr><td>${measurement.windowMinutes}m</td><td>${escapeHtml(new Date(measurement.capturedAt).toLocaleString())}</td><td>${formatNumber(measurement.views)}</td><td>${measurement.viewsPerHour == null ? 'n/a' : escapeHtml(measurement.viewsPerHour)}</td><td>${measurement.repliesPer1000Views == null ? 'n/a' : escapeHtml(measurement.repliesPer1000Views)}</td><td>${measurement.repostsPer1000Views == null ? 'n/a' : escapeHtml(measurement.repostsPer1000Views)}</td><td>${measurement.associatedFollowsPer1000Views == null ? 'n/a' : escapeHtml(measurement.associatedFollowsPer1000Views)}</td><td>${measurement.followerDelta >= 0 ? '+' : ''}${escapeHtml(measurement.followerDelta)}</td><td>${escapeHtml(measurement.attributionConfidence)}</td><td>${escapeHtml(measurement.metadata?.health?.state || 'unknown')}</td></tr>`).join('');
    return `<div class="card border-0 shadow-sm mb-3"><div class="card-body"><div class="fw-semibold">${escapeHtml(candidate?.title || queueItem.candidateKey)}</div><div class="small text-secondary mb-2">${escapeHtml(queueItem.pipeline)} · published ${escapeHtml(new Date(queueItem.publishedAt).toLocaleString())}</div><div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th>Window</th><th>Captured</th><th>Views</th><th>Views/h</th><th>Replies/1k</th><th>Reposts/1k</th><th>Assoc follows/1k</th><th>Assoc Δ followers</th><th>Confidence</th><th>Health context</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
  }).join('');
  const followerQuality = getNewFollowerQuality({ since: Date.now() - 24 * 3_600_000 });
  const phase4 = `<h2 class="h5 mt-4">Fixed-window publication measurements</h2><p class="small text-secondary">15m / 1h / 6h / 24h snapshots use actual capture time. Follower deltas are associated with the measurement period and carry attribution confidence; they are not causal post attribution.</p>${measurementCards || '<div class="alert alert-secondary">No fixed-window publication measurements yet.</div>'}<div class="card border-0 shadow-sm mt-4"><div class="card-body"><h2 class="h5">New-follower quality · observed last 24h</h2><div class="fs-4 fw-semibold">${followerQuality.nicheAlignedNewFollowers} / ${followerQuality.newlyObservedFollowers}</div><div class="small text-secondary">Niche-aligned newly observed followers · period association only, not one-to-one post attribution.</div></div></div>`;
  return summary + (posts || '<div class="alert alert-secondary">No recent post metrics.</div>') + phase4;
}

function resultsView(snapshot, accountHealth) {
  const audience = getAudienceSummary();
  const followerQuality = getNewFollowerQuality({ since: Date.now() - 24 * 3_600_000 });
  const account = snapshot?.account || null;
  const previous = snapshot?.previousAccount || null;
  const followerDelta = account && previous ? Number(account.followers || 0) - Number(previous.followers || 0) : null;
  const network = accountHealth?.networkQuality?.components || {};
  const responseRate = network.authorResponseRate?.rate;
  const continuationRate = network.conversationContinuationRate?.rate;
  const healthState = accountHealth?.health?.state || 'healthy';
  const healthCopy = healthState === 'healthy'
    ? 'Everything looks normal.'
    : healthState === 'watch'
      ? 'Something deserves attention, but normal human-reviewed work can continue.'
      : 'Some actions are temporarily limited until observed account evidence is resolved.';
  const healthClass = healthState === 'healthy' ? 'success' : healthState === 'watch' ? 'warning' : 'danger';
  const measured = listPublicationMeasurementSeries({ limit: 8 })
    .map((series) => ({ ...series, latest: series.measurements.at(-1) || null }))
    .filter((series) => series.latest)
    .slice(0, 4);
  const measuredCards = measured.map(({ queueItem, candidate, latest }) => {
    const windowLabel = Number(latest.windowMinutes) === 1440 ? '24h' : Number(latest.windowMinutes) === 360 ? '6h' : Number(latest.windowMinutes) === 60 ? '1h' : `${latest.windowMinutes}m`;
    const followerText = Number.isFinite(Number(latest.followerDelta))
      ? `${Number(latest.followerDelta) >= 0 ? '+' : ''}${Number(latest.followerDelta)} associated follower change`
      : 'Follower change unavailable';
    return `<article class="card border-0 shadow-sm mb-3"><div class="card-body"><div class="d-flex justify-content-between gap-3 flex-wrap"><div><div class="fw-semibold">${escapeHtml(candidate?.title || queueItem.candidateKey)}</div><div class="small text-secondary">Latest available measurement · ${escapeHtml(windowLabel)}</div></div>${queueItem.outputUrl ? `<a class="btn btn-outline-secondary btn-sm" href="${escapeHtml(queueItem.outputUrl)}" target="_blank">View post ↗</a>` : ''}</div><div class="d-flex gap-3 flex-wrap mt-3"><span><strong>${formatNumber(latest.views)}</strong> views</span><span><strong>${formatNumber(latest.replies)}</strong> replies</span><span><strong>${formatNumber(latest.reposts)}</strong> reposts</span></div><div class="small text-secondary mt-2">${escapeHtml(followerText)} · isolation confidence ${escapeHtml(latest.attributionConfidence || 'unknown')}. This is associated account-level change, not direct post causality.</div></div></article>`;
  }).join('');
  const followerLine = account
    ? `${formatNumber(account.followers)} followers${followerDelta == null ? '' : ` · ${followerDelta >= 0 ? '+' : ''}${followerDelta} since the previous snapshot`}`
    : 'No recent account snapshot yet.';
  const conversationLine = responseRate == null
    ? 'Not enough conversation history for a response rate yet.'
    : `${escapeHtml(responseRate)}% of measured initial conversations received a response${continuationRate == null ? '' : ` · ${escapeHtml(continuationRate)}% continued`}.`;
  const attention = healthState === 'healthy'
    ? '<div class="alert alert-success"><strong>No account intervention is currently indicated.</strong> Keep using the human-reviewed workflow and judge patterns over repeated outcomes.</div>'
    : `<div class="alert alert-${healthClass}"><strong>${escapeHtml(healthCopy)}</strong> <a class="alert-link" href="/?source=health">Review account status</a>.</div>`;
  return `<div class="mb-4"><h1 class="h3 mb-1">Results</h1><div class="text-secondary">A plain-language view of recent outcomes. Detailed measurements remain available when you need them.</div></div>
    <div class="row g-3 mb-4">
      <div class="col-md-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Audience</div><div class="fw-semibold fs-5 mt-1">${escapeHtml(followerLine)}</div><div class="small text-secondary mt-2">${formatNumber(audience.relevant_followers || 0)} observed followers currently match the target AI/developer audience.</div></div></div></div>
      <div class="col-md-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">New follower quality · 24h</div><div class="fw-semibold fs-5 mt-1">${followerQuality.nicheAlignedNewFollowers} relevant / ${followerQuality.newlyObservedFollowers} newly observed</div><div class="small text-secondary mt-2">First-observed follower quality, not a claimed causal follow event.</div></div></div></div>
      <div class="col-md-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Conversations</div><div class="fw-semibold fs-5 mt-1">${accountHealth?.interactionCounts?.meaningfulInteractions7d || 0} useful interactions · 7d</div><div class="small text-secondary mt-2">${conversationLine}</div></div></div></div>
      <div class="col-md-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Account status</div><div class="fw-semibold fs-5 mt-1">${escapeHtml(healthCopy)}</div><div class="small text-secondary mt-2">Internal efficiency warnings remain separate from observed platform constraints.</div></div></div></div>
    </div>
    ${attention}
    <div class="d-flex justify-content-between gap-3 flex-wrap align-items-end mt-5 mb-3"><div><h2 class="h5 mb-1">Recent measured posts</h2><div class="small text-secondary">Latest available window for each recent publication.</div></div><a class="btn btn-outline-primary btn-sm" href="/?source=performance">Detailed content measurements</a></div>
    ${measuredCards || '<div class="alert alert-secondary">No fixed-window publication measurements yet.</div>'}
    <div class="d-flex gap-2 flex-wrap mt-4"><a class="btn btn-outline-secondary btn-sm" href="/?source=audience">Audience quality</a><a class="btn btn-outline-secondary btn-sm" href="/?source=health">Account status details</a><a class="btn btn-outline-secondary btn-sm" href="/?source=performance">Raw performance details</a></div>`;
}

function audienceView(error = null) {
  if (error) return `<div class="alert alert-warning">Audience refresh failed: ${escapeHtml(error)}</div>`;
  const summary = getAudienceSummary();
  const nicheThreshold = 12;
  const allFollowing = listAudienceProfiles({ youFollow: true, minScore: 0, limit: Math.max(100, summary.following + 20) });
  const outsideFollowing = allFollowing
    .filter((profile) => profile.relevanceScore < nicheThreshold)
    .sort((left, right) => Number(left.followsYou) - Number(right.followsYou) || left.relevanceScore - right.relevanceScore || left.username.localeCompare(right.username));
  const targets = listAudienceProfiles({ youFollow: true, followsYou: false, minScore: 12, limit: 40 });
  const relevantFollowers = listAudienceProfiles({ followsYou: true, minScore: 12, limit: 20 });
  const stats = `<div class="row g-3 mb-4">
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Observed followers</div><div class="fs-3 fw-semibold">${formatNumber(summary.followers)}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Niche followers</div><div class="fs-3 fw-semibold">${formatNumber(summary.relevant_followers)}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Niche following</div><div class="fs-3 fw-semibold">${formatNumber(summary.relevant_following)}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Outside-niche following</div><div class="fs-3 fw-semibold">${formatNumber(outsideFollowing.length)}</div></div></div></div>
  </div>`;
  const profileCards = (profiles, title, note) => `<h2 class="h5 mt-4">${escapeHtml(title)}</h2><p class="text-secondary small">${escapeHtml(note)}</p>${profiles.map((profile) => `<div class="card border-0 shadow-sm mb-2"><div class="card-body py-3">
    <div class="d-flex justify-content-between gap-3 flex-wrap"><div><div class="fw-semibold">${escapeHtml(profile.displayName || profile.username)} <span class="text-secondary">@${escapeHtml(profile.username)}</span></div><div class="small text-secondary">${escapeHtml(profile.bio)}</div></div><div class="d-flex gap-2 align-items-start flex-wrap"><span class="badge text-bg-primary">fit ${profile.relevanceScore}/50</span><a class="btn btn-outline-secondary btn-sm" href="https://x.com/${encodeURIComponent(profile.username)}" target="_blank">Open profile ↗</a></div></div>
    <div class="d-flex gap-1 flex-wrap mt-2">${profile.nicheTags.map((tag) => `<span class="badge text-bg-light border">${escapeHtml(NICHE_LABELS[tag] || tag)}</span>`).join('')}</div>
  </div></div>`).join('') || '<div class="alert alert-secondary">No matching profiles in the current snapshot.</div>'}`;
  const outsideRow = (profile) => {
    const relationship = profile.followsYou ? '<span class="badge text-bg-warning">follows you too</span>' : '<span class="text-secondary">one-way follow</span>';
    const signals = profile.nicheTags.length
      ? profile.nicheTags.map((tag) => NICHE_LABELS[tag] || tag).join(', ')
      : profile.matchedKeywords.length
        ? profile.matchedKeywords.slice(0, 4).join(', ')
        : 'No current AI/dev/builder signal';
    const fitLabel = profile.relevanceScore <= 3 ? 'Very low fit' : profile.relevanceScore < nicheThreshold ? 'Outside current niche' : 'In niche';
    return `<tr>
      <td><div class="fw-semibold">${escapeHtml(profile.displayName || profile.username)}</div><div class="small text-secondary">@${escapeHtml(profile.username)}</div><div class="small text-secondary text-break">${escapeHtml(profile.bio || 'No bio observed.')}</div></td>
      <td><span class="badge ${profile.relevanceScore <= 3 ? 'text-bg-secondary' : 'text-bg-light border'}">${escapeHtml(fitLabel)} · ${profile.relevanceScore}/50</span></td>
      <td>${relationship}</td>
      <td class="small text-secondary">${escapeHtml(signals)}</td>
      <td class="small text-secondary">${profile.lastSeenAt ? escapeHtml(new Date(profile.lastSeenAt).toLocaleDateString()) : 'unknown'}</td>
      <td><div class="d-flex gap-2 flex-wrap"><form method="post" action="/audience/unfollow" class="m-0"><input type="hidden" name="username" value="${escapeHtml(profile.username)}"><input type="hidden" name="confirmUnfollow" value="1"><button class="btn btn-danger btn-sm" type="submit">Unfollow</button></form><a class="btn btn-outline-secondary btn-sm" href="https://x.com/${encodeURIComponent(profile.username)}" target="_blank" rel="noopener">View profile ↗</a></div></td>
    </tr>`;
  };
  const cleanupBatch = outsideFollowing.slice(0, 10);
  const cleanupRows = cleanupBatch.map(outsideRow).join('');
  const remainingRows = outsideFollowing.slice(10).map(outsideRow).join('');
  const outsideSection = `<section class="mt-4 mb-5"><div class="d-flex justify-content-between gap-3 flex-wrap align-items-end"><div><h2 class="h5 mb-1">Accounts you follow outside your niche <span class="badge text-bg-light border">${outsideFollowing.length}</span></h2><p class="text-secondary small mb-0">Review the lowest-fit accounts one at a time. Unfollow acts immediately for that one account; there is no bulk unfollow action.</p></div></div>
    ${outsideFollowing.length ? `<div class="alert alert-light border mt-3 mb-0"><strong>Cleanup review: 10 at a time.</strong> Each Unfollow button performs one explicit XActions unfollow immediately. Accounts that follow you back are flagged for extra review.</div><div class="table-responsive mt-3"><table class="table table-hover align-middle"><thead><tr><th>Account</th><th>Niche fit</th><th>Relationship</th><th>Observed signals</th><th>Last seen</th><th></th></tr></thead><tbody>${cleanupRows}</tbody></table></div>${remainingRows ? `<details class="mt-3"><summary class="text-secondary">Show remaining ${outsideFollowing.length - cleanupBatch.length} review candidates</summary><div class="table-responsive mt-3"><table class="table table-hover align-middle"><thead><tr><th>Account</th><th>Niche fit</th><th>Relationship</th><th>Observed signals</th><th>Last seen</th><th></th></tr></thead><tbody>${remainingRows}</tbody></table></div></details>` : ''}` : '<div class="alert alert-success mt-3">No observed accounts you follow are currently below the niche threshold.</div>'}
  </section>`;
  return stats
    + outsideSection
    + profileCards(targets, 'In-niche accounts you follow', 'Relevant accounts you follow that do not currently follow you. Strategic classes and stages live in Relationships.')
    + profileCards(relevantFollowers, 'Niche-aligned followers', 'Current followers already close to the AI/developer/builder audience we want more of.');
}

function experimentSummaryCard(result, label) {
  const summary = result?.summary;
  if (!summary) return '';
  const primary = Object.entries(summary.primaryMetricValues || {}).map(([variant, value]) => `${variant}: ${value == null ? 'n/a' : value}`).join(' · ');
  const confounders = Object.fromEntries(Object.entries(summary.cohorts || {}).map(([variant, cohort]) => [variant, cohort.confounders || {}]));
  const contexts = Object.fromEntries(Object.entries(summary.cohorts || {}).map(([variant, cohort]) => [variant, cohort.context || {}]));
  return `<div class="border rounded p-3 mb-2"><div class="d-flex justify-content-between gap-2 flex-wrap"><strong>${escapeHtml(label)}</strong><span class="badge text-bg-${summary.evidence?.state === 'repeated' ? 'success' : summary.evidence?.state === 'directional' ? 'primary' : 'secondary'}">${escapeHtml(summary.evidence?.state || 'insufficient')}</span></div><div class="small mt-1">${escapeHtml(summary.primaryMetric)} · ${escapeHtml(primary || 'no completed observations')}</div><div class="small text-secondary">Samples: ${escapeHtml(JSON.stringify(summary.completedByVariant || {}))}. No automatic winner/causal label.</div><details class="mt-2"><summary class="small">Confounders &amp; health/network context</summary><pre class="small text-wrap mt-2 mb-0">${escapeHtml(JSON.stringify({ confounders, contexts }, null, 2))}</pre></details></div>`;
}

function technicalExperimentsView() {
  const experiments = listExperiments({ limit: 100 });
  const cards = experiments.map((experiment) => {
    const result = getExperimentSummary(experiment.id);
    const summaries = result.kind === 'network'
      ? experimentSummaryCard(result, 'Network cohort')
      : Object.entries(result.byWindow || {}).map(([window, summary]) => experimentSummaryCard({ summary }, `${window}m`)).join('');
    const assignedItems = listExperimentAssignments(experiment.id);
    const assignedHtml = assignedItems.length
      ? `<div class="table-responsive mt-3"><table class="table table-sm"><thead><tr><th>Candidate</th><th>Variant</th><th>Lane / pipeline</th><th>Status</th><th>Assigned</th></tr></thead><tbody>${assignedItems.map(({ queueItem, variantLabel }) => `<tr><td>${escapeHtml(queueItem.candidateKey)}</td><td>${escapeHtml(variantLabel)}</td><td>${escapeHtml(queueItem.lane)} / ${escapeHtml(queueItem.pipeline)}</td><td>${escapeHtml(queueItem.status)}</td><td>${queueItem.experimentAssignedAt ? escapeHtml(new Date(queueItem.experimentAssignedAt).toLocaleString()) : 'n/a'}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="small text-secondary mt-3">No items assigned yet.</div>';
    const assignment = `<form method="post" action="/experiment/assign" class="row g-2 align-items-end mt-3"><input type="hidden" name="experimentId" value="${experiment.id}"><div class="col-md-4"><label class="form-label small">Queue candidate key</label><input class="form-control form-control-sm" name="key" required></div><div class="col-md-3"><label class="form-label small">Variant</label><select class="form-select form-select-sm" name="variant">${experiment.variants.map((variant) => `<option value="${escapeHtml(variant.label)}">${escapeHtml(variant.label)}</option>`).join('')}</select></div><div class="col-md-3"><label class="form-label small">Context JSON</label><input class="form-control form-control-sm" name="contextJson" value="{}"></div><div class="col-md-2"><button class="btn btn-outline-primary btn-sm w-100" type="submit">Assign explicitly</button></div>${experiment.dimension === 'timing_bucket' ? '<div class="col-12"><label class="small"><input class="form-check-input me-1" type="checkbox" name="timingHistorySufficient" value="1"> I confirm sufficient schedule history for this timing experiment.</label></div>' : ''}</form>`;
    return `<article class="card border-0 shadow-sm mb-4"><div class="card-body"><div class="d-flex justify-content-between gap-2 flex-wrap"><div><h2 class="h5 mb-1">${escapeHtml(experiment.name)}</h2><div class="small text-secondary">${escapeHtml(experiment.dimension)} · primary ${escapeHtml(experiment.primaryMetric)}</div></div><span class="badge text-bg-light border">${escapeHtml(experiment.status)}</span></div><p class="mt-2 mb-2">${escapeHtml(experiment.hypothesis)}</p><div class="small mb-3">Population: ${escapeHtml(JSON.stringify(experiment.population))} · variants: ${escapeHtml(experiment.variants.map((variant) => variant.label).join(', '))} · minimum ${experiment.minimumCompletedPerVariant}/variant</div>${summaries}${assignedHtml}${assignment}</div></article>`;
  }).join('');
  const create = `<form method="post" action="/experiment/create" class="card border-0 shadow-sm mb-4"><div class="card-body"><h2 class="h5">Create experiment</h2><div class="row g-2"><div class="col-md-4"><label class="form-label small">Name</label><input class="form-control form-control-sm" name="name" required></div><div class="col-md-4"><label class="form-label small">Dimension</label><input class="form-control form-control-sm" name="dimension" placeholder="format or reply_archetype" required></div><div class="col-md-4"><label class="form-label small">Primary metric</label><input class="form-control form-control-sm" name="primaryMetric" required></div><div class="col-12"><label class="form-label small">Hypothesis</label><input class="form-control form-control-sm" name="hypothesis" required></div><div class="col-md-6"><label class="form-label small">Population JSON</label><input class="form-control form-control-sm" name="populationJson" value="{}"></div><div class="col-md-6"><label class="form-label small">Variants (comma-separated)</label><input class="form-control form-control-sm" name="variants" required></div><div class="col-md-6"><label class="form-label small">Secondary metrics (comma-separated)</label><input class="form-control form-control-sm" name="secondaryMetrics"></div><div class="col-md-3"><label class="form-label small">Minimum / variant</label><input class="form-control form-control-sm" type="number" min="1" name="minimumCompletedPerVariant" value="5"></div><div class="col-md-3"><label class="form-label small">Status</label><select class="form-select form-select-sm" name="status"><option>draft</option><option>active</option></select></div></div><button class="btn btn-dark btn-sm mt-3" type="submit">Create declared experiment</button><div class="small text-secondary mt-2">Creation and assignment are explicit. The system does not randomize variants or create duplicate/near-duplicate A/B posts.</div></div></form>`;
  return create + (cards || '<div class="alert alert-secondary">No experiments declared yet.</div>');
}

function experimentsView() {
  const experiments = listExperiments({ limit: 100 });
  const queueItems = listQueueItems({ limit: 250 });
  const dimensionOptions = [
    ['Content', [...EXPERIMENT_DIMENSIONS.content, ...EXPERIMENT_DIMENSIONS.timing]],
    ['Conversations & relationships', EXPERIMENT_DIMENSIONS.network],
  ].map(([label, dimensions]) => `<optgroup label="${escapeHtml(label)}">${dimensions.map((dimension) => `<option value="${escapeHtml(dimension)}" data-kind="${EXPERIMENT_DIMENSIONS.network.includes(dimension) ? 'network' : 'content'}">${escapeHtml(experimentDimensionLabel(dimension))}</option>`).join('')}</optgroup>`).join('');
  const metricOptions = [
    ...CONTENT_METRICS.map((metric) => `<option value="${escapeHtml(metric)}" data-kind="content">${escapeHtml(experimentMetricLabel(metric))}</option>`),
    ...NETWORK_METRICS.map((metric) => `<option value="${escapeHtml(metric)}" data-kind="network">${escapeHtml(experimentMetricLabel(metric))}</option>`),
  ].join('');
  const create = `<form method="post" action="/experiment/create" class="card border-0 shadow-sm mb-4"><div class="card-body p-4"><h1 class="h3 mb-1">Tests</h1><p class="text-secondary">Compare one choice at a time. Creating a test does not assign, approve, schedule, or publish anything.</p><div class="row g-3 mt-1"><div class="col-md-6"><label class="form-label">Test name</label><input class="form-control" name="name" placeholder="Reply style: implementation detail vs question" required></div><div class="col-md-6"><label class="form-label">What are you changing?</label><select class="form-select" id="test-dimension" name="dimension" required>${dimensionOptions}</select></div><div class="col-12"><label class="form-label">What do you want to learn?</label><input class="form-control" name="hypothesis" placeholder="Implementation-detail replies may continue more conversations." required></div><div class="col-md-6"><label class="form-label">Option A</label><input class="form-control" name="variantA" required></div><div class="col-md-6"><label class="form-label">Option B</label><input class="form-control" name="variantB" required></div><div class="col-md-6"><label class="form-label">Success looks like</label><select class="form-select" id="test-primary-metric" name="primaryMetric" required>${metricOptions}</select></div><div class="col-md-6"><label class="form-label">Test state</label><select class="form-select" name="status"><option value="draft">Draft — set up only</option><option value="active">Active — ready for explicit assignments</option></select></div></div><details class="mt-3"><summary>Advanced setup</summary><div class="row g-3 mt-1"><div class="col-md-6"><label class="form-label small">Applies when (population JSON)</label><input class="form-control form-control-sm" name="populationJson" value="{}"></div><div class="col-md-4"><label class="form-label small">Secondary metrics</label><input class="form-control form-control-sm" name="secondaryMetrics" placeholder="comma-separated"></div><div class="col-md-2"><label class="form-label small">Minimum / option</label><input class="form-control form-control-sm" type="number" min="1" name="minimumCompletedPerVariant" value="5"></div></div></details><button class="btn btn-dark mt-3" type="submit">Create test</button><div class="small text-secondary mt-2">Assignments remain explicit and non-random. The system never creates duplicate A/B posts automatically.</div></div></form>`;
  const cards = experiments.map((experiment) => {
    const result = getExperimentSummary(experiment.id);
    const network = EXPERIMENT_DIMENSIONS.network.includes(experiment.dimension);
    const summaries = network ? [['Conversation outcomes', result.summary]] : Object.entries(result.byWindow || {}).map(([window, summary]) => [`${window}m window`, summary]);
    const evidence = summaries.map(([label, summary]) => summary ? `<span class="badge text-bg-light border">${escapeHtml(label)} · ${escapeHtml(evidenceLabel(summary.evidence?.state || 'insufficient'))}</span>` : '').join(' ');
    const assignedItems = listExperimentAssignments(experiment.id);
    const candidates = experiment.status === 'active' ? queueItems.filter((item) => {
      if (item.experimentVariantId != null || !['triage', 'researching', 'watching', 'drafting'].includes(item.status)) return false;
      return network ? item.lane === 'engagement' : ['main', 'main_feed'].includes(item.lane);
    }) : [];
    const candidateOptions = candidates.map((item) => {
      const candidate = getCandidate(item.candidateKey);
      const label = network && item.targetUsername ? `@${item.targetUsername}` : (candidate?.title || item.candidateKey);
      return `<option value="${escapeHtml(item.candidateKey)}">${escapeHtml(label)} · ${escapeHtml(statusLabel(item.status))}</option>`;
    }).join('');
    const assignment = experiment.status === 'draft'
      ? `<form method="post" action="/experiment/status" class="mt-3"><input type="hidden" name="experimentId" value="${experiment.id}"><input type="hidden" name="status" value="active"><button class="btn btn-outline-primary btn-sm" type="submit">Activate test</button><span class="small text-secondary ms-2">Draft tests cannot be assigned until activated.</span></form>`
      : experiment.status === 'completed'
        ? '<div class="small text-secondary mt-3">This test is complete and cannot receive new assignments.</div>'
        : candidates.length
          ? `<form method="post" action="/experiment/assign" class="row g-2 align-items-end mt-3"><input type="hidden" name="experimentId" value="${experiment.id}"><div class="col-md-6"><label class="form-label small">Use this test on</label><select class="form-select form-select-sm" name="key">${candidateOptions}</select></div><div class="col-md-4"><label class="form-label small">Use option</label><select class="form-select form-select-sm" name="variant">${experiment.variants.map((variant) => `<option value="${escapeHtml(variant.label)}">${escapeHtml(variant.label)}</option>`).join('')}</select></div><div class="col-md-2"><button class="btn btn-outline-primary btn-sm w-100" type="submit">Assign option</button></div>${experiment.dimension === 'timing_bucket' ? '<div class="col-12"><label class="small"><input class="form-check-input me-1" type="checkbox" name="timingHistorySufficient" value="1"> I have enough prior timing history to use this timing test.</label></div>' : ''}<details class="col-12"><summary class="small">Advanced assignment context</summary><input class="form-control form-control-sm mt-2" name="contextJson" value="{}"></details></form>`
          : '<div class="small text-secondary mt-3">No unassigned pre-review items are available for this test.</div>';
    const lifecycleAction = experiment.status === 'active'
      ? `<form method="post" action="/experiment/status" class="mt-3"><input type="hidden" name="experimentId" value="${experiment.id}"><input type="hidden" name="status" value="completed"><button class="btn btn-outline-secondary btn-sm" type="submit" onclick="return confirm('Complete this test? It will stop accepting new assignments.')">Complete test</button></form>`
      : '';
    const technicalSummaries = summaries.map(([label, summary]) => experimentSummaryCard({ summary }, label)).join('');
    return `<article class="card border-0 shadow-sm mb-4"><div class="card-body p-4"><div class="d-flex justify-content-between gap-3 flex-wrap"><div><h2 class="h5 mb-1">${escapeHtml(experiment.name)}</h2><div class="small text-secondary">Testing ${escapeHtml(experimentDimensionLabel(experiment.dimension))} · success measured by ${escapeHtml(experimentMetricLabel(experiment.primaryMetric))}</div></div><span class="badge text-bg-light border">${escapeHtml(experiment.status)}</span></div><p class="mt-3 mb-2">${escapeHtml(experiment.hypothesis)}</p><div class="d-flex gap-2 flex-wrap">${evidence || '<span class="badge text-bg-light border">Not enough evidence yet</span>'}</div><div class="small text-secondary mt-2">${assignedItems.length} item${assignedItems.length === 1 ? '' : 's'} assigned. No automatic winner or causal claim is produced.</div>${assignment}${lifecycleAction}<details class="mt-3"><summary>Technical evidence and exact configuration</summary><div class="small mt-3">Dimension <code>${escapeHtml(experiment.dimension)}</code> · metric <code>${escapeHtml(experiment.primaryMetric)}</code> · population <code>${escapeHtml(JSON.stringify(experiment.population))}</code> · minimum ${experiment.minimumCompletedPerVariant}/option</div><div class="mt-3">${technicalSummaries || '<div class="text-secondary small">No completed cohort summary yet.</div>'}</div></details></div></article>`;
  }).join('');
  return create + (cards || '<div class="alert alert-secondary">No tests yet. Create one when you have a specific question worth comparing.</div>') + `<details class="mt-5"><summary class="text-secondary">Legacy advanced experiment controls</summary><div class="mt-3">${technicalExperimentsView()}</div></details><script>(()=>{const d=document.getElementById('test-dimension');const m=document.getElementById('test-primary-metric');if(!d||!m)return;const sync=()=>{const selected=d.options[d.selectedIndex];const kind=selected?.dataset?.kind||'content';let first=null;for(const option of m.options){const show=option.dataset.kind===kind;option.hidden=!show;option.disabled=!show;if(show&&first==null)first=option;}if(m.selectedOptions[0]?.disabled&&first)first.selected=true;};d.addEventListener('change',sync);sync();})();</script>`;
}

function learnedRuleCard(rule) {
  const adjustment = rule.adjustment || {};
  const evidence = rule.evidence || {};
  const review = rule.review || {};
  const comparison = rule.comparison || {};
  const statusClass = rule.status === 'accepted' ? 'success' : rule.status === 'retired' ? 'secondary' : 'primary';
  const reviewReasons = (review.reasons || []).map((reason) => `<li><strong>${escapeHtml(reason.code)}</strong> — ${escapeHtml(reason.message)}</li>`).join('');
  const mechanismTags = (rule.mechanismTags || []).length
    ? rule.mechanismTags.map((tag) => `<span class="badge text-bg-light border">${escapeHtml(tag)}</span>`).join(' ')
    : '<span class="text-secondary">none</span>';
  const contribution = Number(adjustment.effective || 0);
  const action = rule.status === 'suggested'
    ? (rule.acceptance?.eligible
      ? `<form method="post" action="/learning/accept"><input type="hidden" name="id" value="${rule.id}"><button class="btn btn-success btn-sm" type="submit">Accept bounded rule</button></form>`
      : '<span class="small text-secondary">Directional or repeated qualified evidence is required before acceptance.</span>')
    : rule.status === 'accepted'
      ? `<form method="post" action="/learning/retire" class="d-flex gap-2"><input type="hidden" name="id" value="${rule.id}"><input class="form-control form-control-sm" name="reason" placeholder="Retirement reason"><button class="btn btn-outline-danger btn-sm" type="submit">Retire</button></form>`
      : '<span class="small text-secondary">Retired rules have zero production effect and are retained for history.</span>';
  return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4">
    <div class="d-flex justify-content-between gap-3 flex-wrap"><div><div class="fw-semibold">${escapeHtml(rule.scope)} · ${escapeHtml(rule.key)}</div><div class="small text-secondary">${escapeHtml(rule.primaryMetric || 'metric unavailable')} · ${escapeHtml(evidence.state || 'insufficient')} · sample ${escapeHtml(evidence.sampleSize || 0)}</div></div><div class="d-flex gap-2 align-items-start"><span class="badge text-bg-${statusClass}">${escapeHtml(rule.status)}</span>${review.reviewRequired ? '<span class="badge text-bg-warning">review</span>' : ''}</div></div>
    <div class="mt-3"><strong>Finding:</strong> ${escapeHtml(rule.finding || '')}</div>
    <div class="mt-2"><strong>Recommendation:</strong> ${escapeHtml(rule.recommendation || '')}</div>
    <div class="row g-2 mt-2 small"><div class="col-md-4"><strong>Comparison</strong><br>${escapeHtml(comparison.baselineLabel || 'baseline')} ${escapeHtml(comparison.baselineValue ?? 'n/a')} → ${escapeHtml(comparison.comparisonLabel || 'comparison')} ${escapeHtml(comparison.comparisonValue ?? 'n/a')}</div><div class="col-md-4"><strong>Adjustment</strong><br>${escapeHtml(adjustment.target || 'none')}${adjustment.component ? ` · ${escapeHtml(adjustment.component)}` : ''} · proposed ${escapeHtml(adjustment.proposed ?? 0)} · effective ${contribution >= 0 ? '+' : ''}${escapeHtml(contribution)}</div><div class="col-md-4"><strong>Match context</strong><br><code>${escapeHtml(JSON.stringify(rule.match || {}))}</code></div></div>
    <div class="small mt-3"><strong>Mechanism tags:</strong> ${mechanismTags}</div>
    ${reviewReasons ? `<div class="alert alert-warning py-2 mt-3 mb-0"><strong>Review signals</strong><ul class="mb-0 mt-1">${reviewReasons}</ul></div>` : ''}
    <div class="mt-3">${action}</div>
  </div></article>`;
}

function technicalLearningView(overview = getLearningOverview()) {
  const experiments = listExperiments({ limit: 100 });
  const refreshForms = experiments.map((experiment) => {
    const variants = experiment.variants || [];
    if (variants.length < 2) return '';
    const options = variants.map((variant, index) => `<option value="${escapeHtml(variant.label)}" ${index === 0 ? 'selected' : ''}>${escapeHtml(variant.label)}</option>`).join('');
    const comparisonOptions = variants.map((variant, index) => `<option value="${escapeHtml(variant.label)}" ${index === 1 ? 'selected' : ''}>${escapeHtml(variant.label)}</option>`).join('');
    const network = ['target_class', 'target_score_bucket', 'target_size_bucket', 'reply_age_bucket', 'conversation_saturation_bucket', 'reply_archetype', 'relationship_stage', 'interaction_volume_bucket', 'target_concentration_bucket', 'archetype_repetition_bucket'].includes(experiment.dimension);
    return `<form method="post" action="/learning/refresh" class="border rounded p-3 mb-2"><input type="hidden" name="experimentId" value="${experiment.id}"><div class="fw-semibold">${escapeHtml(experiment.name)}</div><div class="small text-secondary mb-2">${escapeHtml(experiment.dimension)} · ${escapeHtml(experiment.primaryMetric)} · suggestions remain zero-effect until explicit acceptance.</div><div class="row g-2 align-items-end"><div class="col-md-3"><label class="form-label small">Baseline</label><select class="form-select form-select-sm" name="baselineLabel">${options}</select></div><div class="col-md-3"><label class="form-label small">Comparison</label><select class="form-select form-select-sm" name="comparisonLabel">${comparisonOptions}</select></div>${network ? '' : `<div class="col-md-2"><label class="form-label small">Window</label><select class="form-select form-select-sm" name="windowMinutes">${[15, 60, 360, 1440].map((value) => `<option value="${value}" ${value === 60 ? 'selected' : ''}>${value}m</option>`).join('')}</select></div>`}<div class="col-md-${network ? '4' : '2'}"><label class="form-label small">Mechanism tags</label><input class="form-control form-control-sm" name="mechanismTags" placeholder="optional, comma-separated"></div><div class="col-md-2"><button class="btn btn-outline-primary btn-sm w-100" type="submit">Refresh suggestion</button></div></div></form>`;
  }).join('');
  const rules = overview.rules.map(learnedRuleCard).join('');
  return `<div class="row g-3 mb-4"><div class="col-4"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Suggested</div><div class="fs-3 fw-semibold">${overview.suggested}</div></div></div></div><div class="col-4"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Accepted</div><div class="fs-3 fw-semibold">${overview.accepted}</div></div></div></div><div class="col-4"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Retired</div><div class="fs-3 fw-semibold">${overview.retired}</div></div></div></div></div>
    <div class="alert alert-light border">Learned strategy is account-specific and observational. Refresh computes suggestions only; accepted rules are bounded additions after transparent base scoring. Hard gates, expiry, human approval, and explicit manual routing/scheduling always win.</div>
    <h2 class="h5 mt-4">Refresh suggestions from declared experiments</h2>${refreshForms || '<div class="alert alert-secondary">No experiment with at least two variants is available.</div>'}
    <h2 class="h5 mt-4">Learned rules</h2>${rules || '<div class="alert alert-secondary">No learned-rule suggestions yet.</div>'}`;
}

function learnedAdjustmentLabel(target) {
  return ({
    target_score_component: 'relationship-fit component', engage_priority: 'reply priority', saturation_pressure: 'recent-interaction pressure', health_watch_modifier: 'advisory account-status pressure',
    reach_potential: 'reach potential', follow_potential: 'follow potential', conversation_potential: 'conversation potential', scheduler_timing_preference: 'publishing-time preference',
    content_preference: 'content preference', format_preference: 'format preference', topic_preference: 'topic preference',
  })[target] || relationshipLabel(target || 'recommendation');
}

function plainLearnedRuleCard(rule) {
  const adjustment = rule.adjustment || {};
  const evidence = rule.evidence || {};
  const review = rule.review || {};
  const comparison = rule.comparison || {};
  const statusLabelText = rule.status === 'accepted' ? 'Accepted change' : rule.status === 'retired' ? 'Past learning' : 'Suggested change';
  const statusClass = rule.status === 'accepted' ? 'success' : rule.status === 'retired' ? 'secondary' : 'primary';
  const proposed = Number(adjustment.proposed || 0);
  const effective = Number(adjustment.effective || 0);
  const adjustmentAmount = rule.status === 'accepted' ? effective : proposed;
  const changeCopy = adjustmentAmount === 0
    ? 'No production priority changes yet.'
    : `Future matching recommendations may adjust ${learnedAdjustmentLabel(adjustment.target)} by ${adjustmentAmount >= 0 ? '+' : ''}${adjustmentAmount}, within the existing bound.`;
  const reviewReasons = (review.reasons || []).map((reason) => `<li><strong>${escapeHtml(reason.code)}</strong> — ${escapeHtml(reason.message)}</li>`).join('');
  let action = '';
  if (rule.status === 'suggested') {
    action = rule.acceptance?.eligible
      ? `<div class="d-flex gap-2 flex-wrap"><form method="post" action="/learning/accept"><input type="hidden" name="id" value="${rule.id}"><button class="btn btn-success" type="submit">Accept change</button></form><a class="btn btn-outline-secondary" href="/?source=learning">Not now</a></div>`
      : '<div class="small text-secondary">More evidence is required before this suggestion can affect recommendations.</div>';
  } else if (rule.status === 'accepted') {
    action = `<details class="mt-3"><summary>Manage accepted change</summary><form method="post" action="/learning/retire" class="d-flex gap-2 mt-2"><input type="hidden" name="id" value="${rule.id}"><input class="form-control form-control-sm" name="reason" placeholder="Why are you retiring it?"><button class="btn btn-outline-danger btn-sm" type="submit">Retire change</button></form></details>`;
  } else {
    action = '<div class="small text-secondary">This learning is kept for history and has zero production effect.</div>';
  }
  return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4"><div class="d-flex justify-content-between gap-3 flex-wrap align-items-start"><div><div class="small text-secondary text-uppercase fw-semibold">We noticed something</div><h2 class="h5 mb-1 mt-1">${escapeHtml(rule.finding || rule.key || 'Observed pattern')}</h2><div class="small text-secondary">${escapeHtml(evidenceLabel(evidence.state || 'insufficient'))} · ${escapeHtml(evidence.sampleSize || 0)} example${Number(evidence.sampleSize || 0) === 1 ? '' : 's'}</div></div><div class="d-flex gap-2"><span class="badge text-bg-${statusClass}">${escapeHtml(statusLabelText)}</span>${review.reviewRequired ? '<span class="badge text-bg-warning">Needs review</span>' : ''}</div></div><div class="mt-3"><div class="small text-secondary">Suggested change</div><div class="fw-semibold">${escapeHtml(rule.recommendation || 'Keep watching this pattern.')}</div></div><div class="card bg-light border-0 mt-3"><div class="card-body"><div class="small text-secondary">${rule.status === 'suggested' ? 'What will change if accepted' : 'What this changes'}</div><div>${escapeHtml(changeCopy)}</div><div class="small text-secondary mt-2">This never sends content, bypasses approval, ignores expiry, or overrides a manual route/schedule.</div></div></div>${reviewReasons ? `<div class="alert alert-warning py-2 mt-3"><strong>Review before relying on this change.</strong><ul class="mb-0 mt-1">${reviewReasons}</ul></div>` : ''}<div class="mt-3">${action}</div><details class="mt-3"><summary>Why?</summary><div class="small mt-2"><strong>Measured:</strong> ${escapeHtml(experimentMetricLabel(rule.primaryMetric || 'unknown'))}<br><strong>Comparison:</strong> ${escapeHtml(comparison.baselineLabel || 'baseline')} ${escapeHtml(comparison.baselineValue ?? 'n/a')} → ${escapeHtml(comparison.comparisonLabel || 'comparison')} ${escapeHtml(comparison.comparisonValue ?? 'n/a')}<br><strong>Evidence state:</strong> <code>${escapeHtml(evidence.state || 'insufficient')}</code><br><strong>Adjustment:</strong> <code>${escapeHtml(adjustment.target || 'none')}</code>${adjustment.component ? ` / <code>${escapeHtml(adjustment.component)}</code>` : ''} · proposed ${escapeHtml(adjustment.proposed ?? 0)} · effective ${effective >= 0 ? '+' : ''}${escapeHtml(effective)}<br><strong>Match context:</strong> <code>${escapeHtml(JSON.stringify(rule.match || {}))}</code><br><strong>Mechanism tags:</strong> ${escapeHtml((rule.mechanismTags || []).join(', ') || 'none')}</div></details></div></article>`;
}

function learningView(overview = getLearningOverview()) {
  const experiments = listExperiments({ limit: 100 });
  const refreshForms = experiments.map((experiment) => {
    const variants = experiment.variants || [];
    if (variants.length < 2) return '';
    const options = variants.map((variant, index) => `<option value="${escapeHtml(variant.label)}" ${index === 0 ? 'selected' : ''}>${escapeHtml(variant.label)}</option>`).join('');
    const comparisonOptions = variants.map((variant, index) => `<option value="${escapeHtml(variant.label)}" ${index === 1 ? 'selected' : ''}>${escapeHtml(variant.label)}</option>`).join('');
    const network = EXPERIMENT_DIMENSIONS.network.includes(experiment.dimension);
    return `<form method="post" action="/learning/refresh" class="border rounded p-3 mb-2"><input type="hidden" name="experimentId" value="${experiment.id}"><div class="fw-semibold">${escapeHtml(experiment.name)}</div><div class="small text-secondary mb-2">Look for a pattern in ${escapeHtml(experimentMetricLabel(experiment.primaryMetric))}. This creates a suggestion only; it changes nothing until you accept it.</div><div class="row g-2 align-items-end"><div class="col-md-3"><label class="form-label small">Compare</label><select class="form-select form-select-sm" name="baselineLabel">${options}</select></div><div class="col-md-3"><label class="form-label small">Against</label><select class="form-select form-select-sm" name="comparisonLabel">${comparisonOptions}</select></div>${network ? '' : `<div class="col-md-2"><label class="form-label small">Measurement point</label><select class="form-select form-select-sm" name="windowMinutes"><option value="15">15 minutes</option><option value="60" selected>1 hour</option><option value="360">6 hours</option><option value="1440">24 hours</option></select></div>`}<div class="col-md-${network ? '4' : '2'}"><button class="btn btn-outline-primary btn-sm w-100" type="submit">Check for a pattern</button></div><details class="col-12"><summary class="small">Advanced evidence links</summary><label class="form-label small mt-2">Mechanism tags</label><input class="form-control form-control-sm" name="mechanismTags" placeholder="optional, comma-separated"></details></div></form>`;
  }).join('');
  const rules = overview.rules.map(plainLearnedRuleCard).join('');
  return `<div class="mb-4"><h1 class="h3 mb-1">What we've learned</h1><div class="text-secondary">Patterns from your own measured work. Suggestions stay inert until you explicitly accept them.</div></div><div class="row g-3 mb-4"><div class="col-4"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Suggested changes</div><div class="fs-3 fw-semibold">${overview.suggested}</div></div></div></div><div class="col-4"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Accepted changes</div><div class="fs-3 fw-semibold">${overview.accepted}</div></div></div></div><div class="col-4"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Past learnings</div><div class="fs-3 fw-semibold">${overview.retired}</div></div></div></div></div><div class="alert alert-light border"><strong>You stay in control.</strong> Accepting a change can only make a bounded adjustment to future recommendations. It cannot send content or bypass approval, expiry, account restrictions, or a manual choice.</div><h2 class="h5 mt-4">Patterns and changes</h2>${rules || '<div class="alert alert-secondary">No learning suggestions yet. Run tests and collect measured outcomes first.</div>'}<h2 class="h5 mt-5">Look for a new pattern</h2>${refreshForms || '<div class="alert alert-secondary">No test with at least two options is available yet.</div>'}<details class="mt-5"><summary class="text-secondary">Legacy advanced learned-strategy controls</summary><div class="mt-3">${technicalLearningView(overview)}</div></details>`;
}

function relationshipLabel(value) {
  return String(value || '').replaceAll('_', ' ');
}

function relationshipComponentBadge(profile, key, label) {
  const missing = new Set(profile.scoreExplanation?.missingComponents || []);
  const value = missing.has(key) ? 'n/a' : Math.round(Number(profile[key] || 0));
  return `<span class="badge text-bg-light border">${escapeHtml(label)} ${escapeHtml(value)}</span>`;
}

function relationshipsView(className = '', stage = '') {
  const summaryCounts = getRelationshipSummary();
  const profiles = listRelationshipProfiles({ className: className || undefined, stage: stage || undefined, limit: 100 });
  const stageCounts = summaryCounts.stages;
  const classCounts = summaryCounts.classes;
  const summary = `<div class="card border-0 shadow-sm mb-4"><div class="card-body">
    <div class="d-flex gap-2 flex-wrap align-items-center mb-2"><span class="fw-semibold">Stages</span>${RELATIONSHIP_STAGES.map((value) => `<span class="badge text-bg-light border text-capitalize">${escapeHtml(relationshipLabel(value))} ${stageCounts[value]}</span>`).join('')}</div>
    <div class="d-flex gap-2 flex-wrap align-items-center"><span class="fw-semibold">Target classes</span>${TARGET_CLASSES.map((value) => `<span class="badge text-bg-light border text-capitalize">${escapeHtml(relationshipLabel(value))} ${classCounts[value]}</span>`).join('')}</div>
  </div></div>`;
  const filters = `<form method="get" class="card border-0 shadow-sm mb-4"><div class="card-body d-flex gap-2 flex-wrap align-items-end">
    <input type="hidden" name="source" value="relationships">
    <div><label class="form-label small mb-1" for="relationship-class">Target class</label><select class="form-select form-select-sm" id="relationship-class" name="class"><option value="">All classes</option>${TARGET_CLASSES.map((value) => `<option value="${escapeHtml(value)}" ${className === value ? 'selected' : ''}>${escapeHtml(relationshipLabel(value))}</option>`).join('')}</select></div>
    <div><label class="form-label small mb-1" for="relationship-stage">Stage</label><select class="form-select form-select-sm" id="relationship-stage" name="stage"><option value="">All stages</option>${RELATIONSHIP_STAGES.map((value) => `<option value="${escapeHtml(value)}" ${stage === value ? 'selected' : ''}>${escapeHtml(relationshipLabel(value))}</option>`).join('')}</select></div>
    <button class="btn btn-dark btn-sm" type="submit">Apply filters</button><a class="btn btn-outline-secondary btn-sm" href="/?source=relationships">Reset</a>
  </div></form>`;
  const cards = profiles.map((profile) => {
    const reasons = Object.values(profile.scoreExplanation?.classReasons || {}).filter(Boolean);
    const missing = profile.scoreExplanation?.missingComponents || [];
    const topics = (profile.primaryTopics || []).map((tag) => NICHE_LABELS[tag] || tag);
    const followState = profile.mutual ? 'mutual' : profile.followsYou ? 'follows you' : profile.youFollow ? 'you follow' : 'no follow link';
    const learnedComponents = Object.entries(profile.scoreExplanation?.learning || {})
      .filter(([, value]) => Number(value?.learnedAdjustment || 0) !== 0)
      .map(([name, value]) => `${relationshipLabel(name)} ${value.baseValue}→${value.finalValue} (${Number(value.learnedAdjustment) >= 0 ? '+' : ''}${value.learnedAdjustment})`);
    return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4">
      <div class="d-flex justify-content-between gap-3 flex-wrap"><div><div class="fw-semibold fs-5">${escapeHtml(profile.displayName || profile.username)} <span class="text-secondary">@${escapeHtml(profile.username)}</span></div><div class="small text-secondary mt-1">${escapeHtml(profile.bio || '')}</div></div><div class="text-end"><div class="fs-4 fw-semibold">${Math.round(profile.targetScore)}</div><div class="small text-secondary">TargetScore</div></div></div>
      <div class="d-flex gap-1 flex-wrap mt-3">${profile.classes.map((value) => `<span class="badge text-bg-primary text-capitalize">${escapeHtml(relationshipLabel(value))}</span>`).join('') || '<span class="badge text-bg-light border">unclassified</span>'}<span class="badge text-bg-secondary text-capitalize">${escapeHtml(relationshipLabel(profile.relationshipStage))}</span><span class="badge text-bg-light border">${escapeHtml(followState)}</span></div>
      <div class="d-flex gap-1 flex-wrap mt-2">${relationshipComponentBadge(profile, 'topicFit', 'Topic')}${relationshipComponentBadge(profile, 'audienceOverlap', 'Audience')}${relationshipComponentBadge(profile, 'conversationQuality', 'Conversation')}${relationshipComponentBadge(profile, 'replyVisibility', 'Visibility')}${relationshipComponentBadge(profile, 'relationshipPotential', 'Relationship')}<span class="badge text-bg-light border">Reach ${profile.reachModifier >= 0 ? '+' : ''}${escapeHtml(profile.reachModifier)}</span></div>
      <div class="small text-secondary mt-2">${profile.meaningfulInteractions} meaningful outbound · ${profile.theirRepliesToUs} target replies · last response ${profile.lastResponseAt ? escapeHtml(formatDateTime(profile.lastResponseAt)) : 'none yet'}</div>
      ${topics.length ? `<div class="d-flex gap-1 flex-wrap mt-2">${topics.map((topic) => `<span class="badge text-bg-light border">${escapeHtml(topic)}</span>`).join('')}</div>` : ''}
      ${reasons.length ? `<div class="small mt-3"><strong>Why this target:</strong> ${escapeHtml(reasons.join(' '))}</div>` : ''}
      ${missing.length ? `<div class="small text-secondary mt-1">Missing score evidence: ${escapeHtml(missing.map(relationshipLabel).join(', '))}; available components are renormalized.</div>` : ''}
      ${learnedComponents.length ? `<div class="small text-primary mt-2"><strong>Accepted learned contribution:</strong> ${escapeHtml(learnedComponents.join(' · '))}</div>` : '<div class="small text-secondary mt-2">TargetScore currently reflects base evidence only; no accepted learned component matched.</div>'}
      <div class="mt-3"><a class="btn btn-outline-secondary btn-sm" href="https://x.com/${encodeURIComponent(profile.username)}" target="_blank">Open profile ↗</a></div>
    </div></article>`;
  }).join('');
  return summary + filters + (cards || '<div class="alert alert-secondary">No relationship profiles match these filters.</div>');
}

function accountHealthView() {
  const summary = getAccountHealthSummary();
  const state = summary.health.state;
  const stateClass = state === 'constrained' ? 'text-bg-danger' : state === 'watch' ? 'text-bg-warning' : 'text-bg-success';
  const components = summary.networkQuality.components || {};
  const responseRate = components.authorResponseRate || {};
  const continuationRate = components.conversationContinuationRate || {};
  const concentration = components.topTargetConcentration || {};
  const yieldComponents = summary.interactionYield.components || {};
  const audience = getAudienceSummary();
  const latest = summary.latestUnderTheHood;
  const latestLabels = latest
    ? [...(latest.metadata?.accountLabels || []), ...(latest.metadata?.postLabels || [])]
    : [];
  const reasons = summary.health.reasons || [];
  const observations = summary.observations.slice(0, 20);
  const manualTypes = ACCOUNT_HEALTH_OBSERVATION_TYPES.filter((type) => type !== 'under_the_hood_snapshot');
  const reasonHtml = reasons.length
    ? reasons.map((reason) => {
      const provenance = reason.provenance || {};
      const canResolve = ['platform_challenge_observed', 'platform_restriction_observed'].includes(reason.code)
        && provenance.source && provenance.sourceRef;
      const resolveAction = canResolve
        ? `<form method="post" action="/health/observe" class="d-inline ms-2"><input type="hidden" name="type" value="${escapeHtml(reason.code)}"><input type="hidden" name="severity" value="info"><input type="hidden" name="source" value="${escapeHtml(provenance.source)}"><input type="hidden" name="sourceRef" value="${escapeHtml(provenance.sourceRef)}"><input type="hidden" name="label" value="${escapeHtml(provenance.metadata?.label || '')}"><input type="hidden" name="resolved" value="1"><button class="btn btn-outline-success btn-sm" type="submit">Mark resolved</button></form>`
        : '';
      return `<li><strong>${escapeHtml(relationshipLabel(reason.code))}</strong> — ${escapeHtml(reason.message)} <span class="text-secondary">(${escapeHtml(reason.evidence || '')})</span>${resolveAction}</li>`;
    }).join('')
    : '<li>No current health reasons.</li>';
  const observationHtml = observations.length
    ? observations.map((observation) => `<tr><td>${escapeHtml(new Date(observation.observedAt).toLocaleString())}</td><td>${escapeHtml(relationshipLabel(observation.type))}</td><td>${escapeHtml(observation.severity)}</td><td>${escapeHtml(observation.source)}</td><td>${escapeHtml(observation.sourceRef || '')}</td></tr>`).join('')
    : '<tr><td colspan="5" class="text-secondary">No recorded health observations.</td></tr>';
  const topSaturation = summary.saturation.targets.slice(0, 8).map((target) => `<tr><td>@${escapeHtml(target.username)}</td><td>${escapeHtml(target.pressure)}</td><td>${escapeHtml(target.band)}</td><td>${escapeHtml(target.overrideReasons.join(', ') || 'none')}</td></tr>`).join('');
  const repetitionWarnings = summary.repetition.warnings.length
    ? summary.repetition.warnings.map((warning) => `<span class="badge text-bg-warning me-1">${escapeHtml(relationshipLabel(warning.code))}</span>`).join('')
    : '<span class="text-secondary">none</span>';

  return `<div class="d-flex justify-content-between gap-3 flex-wrap align-items-start mb-4"><div><h2 class="h4 mb-1">Account Health <span class="badge ${stateClass} text-uppercase">${escapeHtml(state)}</span></h2><div class="text-secondary">${escapeHtml(summary.health.explanation)}</div></div><div class="small text-secondary">Derived ${escapeHtml(new Date(summary.generatedAt).toLocaleString())}</div></div>
    <div class="card border-0 shadow-sm mb-4"><div class="card-body"><h3 class="h5">State reasons &amp; provenance</h3><ul class="mb-0">${reasonHtml}</ul></div></div>
    <div class="row g-3 mb-4">
      <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Meaningful interactions</div><div class="fs-4 fw-semibold">${summary.interactionCounts.meaningfulInteractions7d} / ${summary.interactionCounts.meaningfulInteractions30d}</div><div class="small text-secondary">7d / 30d</div></div></div></div>
      <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Author response rate</div><div class="fs-4 fw-semibold">${responseRate.rate == null ? 'n/a' : `${escapeHtml(responseRate.rate)}%`}</div><div class="small text-secondary">${escapeHtml(responseRate.targetsWhoReplied || 0)} responders / ${escapeHtml(responseRate.meaningfulInitialReplies || 0)} initial replies</div></div></div></div>
      <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Continuation rate</div><div class="fs-4 fw-semibold">${continuationRate.rate == null ? 'n/a' : `${escapeHtml(continuationRate.rate)}%`}</div><div class="small text-secondary">${escapeHtml(continuationRate.interactionsWithFollowUp || 0)} continued / ${escapeHtml(continuationRate.meaningfulInitialReplies || 0)} initial replies</div></div></div></div>
      <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">InteractionYield</div><div class="fs-4 fw-semibold">${Number(summary.interactionYield.value || 0).toFixed(2)}</div><div class="small text-secondary">${escapeHtml(summary.interactionYield.numerator)} weighted outcomes / ${escapeHtml(summary.interactionYield.denominator)} interactions</div></div></div></div>
    </div>
    <div class="row g-3 mb-4"><div class="col-lg-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><h3 class="h5">Network Quality</h3><div class="small">Targets ${escapeHtml(components.targetDiversity?.uniqueTargets || 0)} · classes ${escapeHtml(components.classDiversity?.uniqueClasses || 0)} · topics ${escapeHtml(components.topicDiversity?.uniqueTopics || 0)}</div><div class="small mt-2">Recurring ${escapeHtml(components.recurringRelationshipCount || 0)} · connected ${escapeHtml(components.connectedTargetCount || 0)} · mutual ${escapeHtml(components.mutualTargetCount || 0)}</div><div class="small mt-2">Top-target concentration ${escapeHtml(concentration.rate || 0)}%${concentration.username ? ` at @${escapeHtml(concentration.username)}` : ''}</div><div class="small mt-2">Niche-aligned followers ${escapeHtml(audience.relevant_followers || 0)} / ${escapeHtml(audience.followers || 0)} observed followers</div><div class="small text-secondary mt-2">Components remain authoritative; no hidden reputation/network score is assigned.</div></div></div></div>
    <div class="col-lg-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><h3 class="h5">InteractionYield components</h3><div class="small">Author responses ${escapeHtml(yieldComponents.authorResponses || 0)} · continued conversations ${escapeHtml(yieldComponents.continuedConversations || 0)} · new recurring relationships ${escapeHtml(yieldComponents.newRecurringRelationships || 0)} · relevant target follows ${escapeHtml(yieldComponents.relevantTargetFollows || 0)} · new mutuals ${escapeHtml(yieldComponents.newMutualConnections || 0)}</div><div class="small text-secondary mt-2">Internal comparative diagnostic, not an X score.</div></div></div></div></div>
    <div class="card border-0 shadow-sm mb-4"><div class="card-body"><h3 class="h5">Saturation &amp; reply repetition</h3><div class="d-flex gap-2 flex-wrap mb-3">${Object.entries(summary.saturation.distribution).map(([band, count]) => `<span class="badge text-bg-light border">${escapeHtml(band)} ${escapeHtml(count)}</span>`).join('')}<span class="badge text-bg-light border">archetype concentration ${escapeHtml(summary.repetition.archetypeConcentration)}%</span><span class="badge text-bg-light border">phrase similarity ${escapeHtml(summary.repetition.phraseSimilarity)}%</span></div><div class="small mb-3">Repetition warnings: ${repetitionWarnings}</div><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Target</th><th>Pressure</th><th>Band</th><th>Overrides</th></tr></thead><tbody>${topSaturation || '<tr><td colspan="4" class="text-secondary">No target interaction pressure yet.</td></tr>'}</tbody></table></div><div class="small text-secondary">Saturation and archetype/style repetition are EMPIRICAL_VARIABLE advisory diagnostics; active/direct/new-evidence context can neutralize their Engage Next penalty.</div></div></div>
    <div class="card border-0 shadow-sm mb-4"><div class="card-body"><div class="d-flex justify-content-between gap-3 flex-wrap"><div><h3 class="h5 mb-1">Visibility observations</h3><div class="small text-secondary">Actual platform evidence is kept separate from internal efficiency diagnostics.</div></div><form method="post" action="/health/under-the-hood"><button class="btn btn-outline-primary btn-sm" type="submit">Read Under the Hood</button></form></div>${latest ? `<div class="alert alert-light border mt-3 mb-0"><strong>Latest Under the Hood:</strong> ${escapeHtml(new Date(latest.observedAt).toLocaleString())} · ${latestLabels.length} observable label(s)${latest.metadata?.period?.label ? ` · ${escapeHtml(latest.metadata.period.label)}` : ''}</div>` : '<div class="alert alert-secondary mt-3 mb-0">No observable Under-the-Hood snapshot recorded.</div>'}<div class="table-responsive mt-3"><table class="table table-sm"><thead><tr><th>Observed</th><th>Type</th><th>Severity</th><th>Source</th><th>Source ref</th></tr></thead><tbody>${observationHtml}</tbody></table></div></div></div>
    <form method="post" action="/health/observe" class="card border-0 shadow-sm mb-4"><div class="card-body"><h3 class="h5">Record observed evidence</h3><div class="row g-2"><div class="col-md-4"><label class="form-label small">Type</label><select class="form-select form-select-sm" name="type">${manualTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(relationshipLabel(type))}</option>`).join('')}</select></div><div class="col-md-2"><label class="form-label small">Severity</label><select class="form-select form-select-sm" name="severity"><option>info</option><option>warning</option><option>constraint</option></select></div><div class="col-md-3"><label class="form-label small">Source</label><input class="form-control form-control-sm" name="source" required></div><div class="col-md-3"><label class="form-label small">Source ref / path</label><input class="form-control form-control-sm" name="sourceRef" required></div><div class="col-md-4"><label class="form-label small">Label/name when applicable</label><input class="form-control form-control-sm" name="label"></div><div class="col-md-8"><label class="form-label small">Operator note</label><input class="form-control form-control-sm" name="note"></div></div><button class="btn btn-dark btn-sm mt-3" type="submit">Record observation</button><div class="small text-secondary mt-2">Only directly observed evidence belongs here; missing reach, activity, timing, or guessed shadowban/bot/reputation theories are not observations.</div></div></form>`;
}

function assertEngagementHealthAllowsSend() {
  const summary = getAccountHealthSummary();
  if (summary.health.state !== 'constrained') return summary;
  const reason = summary.health.reasons.find((item) => item.level === 'constrained');
  throw new Error(`Engagement send blocked by supported observed constraint: ${reason?.message || 'account health constrained'}`);
}

function engagementCard(queueItem, accountHealth = getAccountHealthSummary()) {
  const candidate = getCandidate(queueItem.candidateKey);
  if (!candidate) return '';
  const draft = getDraftByCandidate(queueItem.candidateKey);
  const profile = queueItem.targetUsername ? getRelationshipProfile(queueItem.targetUsername) : null;
  const score = queueItem.engagement || {};
  const ageMinutes = Number(score.freshness?.ageMinutes);
  const ageLabel = Number.isFinite(ageMinutes)
    ? ageMinutes < 60 ? `${Math.round(ageMinutes)}m old` : `${(ageMinutes / 60).toFixed(1)}h old`
    : 'age unavailable';
  const expiry = score.expiry || {};
  const expiryLabel = queueItem.expiresAt ? new Date(queueItem.expiresAt).toLocaleString() : 'unavailable';
  const activeOverride = expiry.activeConversationOverride === true;
  const pressure = score.explanation?.softPressure;
  const saturationSummary = score.explanation?.saturationSummary;
  const repetitionSummary = score.explanation?.repetitionSummary;
  const currentConstrained = accountHealth.health.state === 'constrained';
  const pressureWarning = Number(pressure?.rawModifier || 0) < 0
    ? `<div class="alert alert-warning py-2 mt-3 mb-0">Soft health adjustment ${escapeHtml(pressure.rawModifier)}${pressure.appliedModifier === 0 ? ' · neutralized by active/direct-response/new-evidence context' : ''}. Saturation ${escapeHtml(saturationSummary?.pressure ?? pressure?.saturation ?? 0)}/100; repetition ${escapeHtml(pressure?.repetition ?? 0)}/100. WATCH is advisory and does not remove human review.</div>`
    : '';
  const repetitionWarning = repetitionSummary?.warnings?.length
    ? `<div class="small text-warning-emphasis mt-2">Repetition context: ${escapeHtml(repetitionSummary.warnings.map((warning) => relationshipLabel(warning.code)).join(', '))}. Historical archetype/style concentration is warning-level; the Phase-2 gate checks the actual draft for exact/near duplication.</div>`
    : '';
  const hardHealthWarning = currentConstrained
    ? `<div class="alert alert-danger py-2 mt-3 mb-0">Current Account Health is CONSTRAINED from supported observed evidence. Drafting/review may continue, but approval/send is unavailable until the hard evidence is cleared/resolved.</div>`
    : '';
  const relationshipSummary = profile
    ? `<div class="small text-secondary mt-2">${escapeHtml(opportunityLabel(profile.targetScore))} relationship fit · ${escapeHtml(relationshipLabel(profile.relationshipStage))} · ${escapeHtml(profile.theirRepliesToUs || 0)} prior repl${Number(profile.theirRepliesToUs || 0) === 1 ? 'y' : 'ies'} · ${escapeHtml(profile.meaningfulInteractions || 0)} useful interaction${Number(profile.meaningfulInteractions || 0) === 1 ? '' : 's'}</div>`
    : '<div class="small text-secondary mt-2">Relationship context is still limited.</div>';
  const relationshipTechnical = profile
    ? `<div class="d-flex gap-1 flex-wrap mt-2">${(profile.classes || []).map((value) => `<span class="badge text-bg-primary text-capitalize">${escapeHtml(relationshipLabel(value))}</span>`).join('')}<span class="badge text-bg-secondary text-capitalize">${escapeHtml(relationshipLabel(profile.relationshipStage))}</span><span class="badge text-bg-light border">TargetScore ${Math.round(profile.targetScore)}</span></div>`
    : '';
  const canReview = draft && ['drafting', 'needs_review', 'failed'].includes(queueItem.status);
  const canApproveSend = !currentConstrained && queueItem.status === 'needs_review' && draft?.qualityScore >= 40 && draft?.gates?.passed === true;
  const approved = !currentConstrained && queueItem.status === 'approved' && Boolean(queueItem.humanApprovedAt) && Boolean(queueItem.approvedText);
  const contribution = queueItem.contributionSummary || score.contribution?.summary || '';
  const archetype = queueItem.replyArchetype || score.contribution?.archetype || '';
  const components = score.components || {};
  const learnedPriority = score.learnedAdjustment || score.explanation?.learning || null;
  const learnedPriorityLine = Number(learnedPriority?.learnedAdjustment || 0) !== 0
    ? `<div class="small text-primary mt-2"><strong>Accepted learned contribution:</strong> EngagePriority ${escapeHtml(score.preLearnedPriority ?? score.basePriority ?? 0)} → ${escapeHtml(score.engagePriority ?? queueItem.priority)} (${Number(learnedPriority.learnedAdjustment) >= 0 ? '+' : ''}${escapeHtml(learnedPriority.learnedAdjustment)}).</div>`
    : '<div class="small text-secondary mt-2">No accepted learned adjustment matched this conversation.</div>';
  const editReplyAction = `<form method="post" action="/engage/draft"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}"><button class="btn btn-primary btn-sm" type="submit">${draft ? 'Edit reply' : 'Review reply'}</button></form>`;
  const primaryReplyAction = approved
    ? `<form method="post" action="/engage/send"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}"><button class="btn btn-success btn-sm" type="submit">Send approved reply</button></form>`
    : canApproveSend
      ? `<form method="post" action="/engage/approve-send"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}">${confirmationFields()}<button class="btn btn-success btn-sm" type="submit">Approve &amp; send exact reply</button></form>`
      : editReplyAction;
  const secondaryEdit = (approved || canApproveSend) ? editReplyAction : '';

  return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4">
    <div class="d-flex justify-content-between gap-3 flex-wrap"><div><div class="fw-semibold fs-5">@${escapeHtml(queueItem.targetUsername || profile?.username || 'unknown')} · ${escapeHtml(queueItem.engagementKind === 'initial_reply' ? 'New conversation' : 'Continue conversation')}</div><div class="small text-secondary">${escapeHtml(ageLabel)}${activeOverride ? ' · active conversation' : ''} · ${escapeHtml(statusLabel(queueItem.status))}</div></div><div class="text-end"><div class="fw-semibold">${escapeHtml(opportunityLabel(queueItem.priority))}</div><div class="small text-secondary">Reply priority</div></div></div>
    ${relationshipSummary}
    <div class="mt-3"><strong>What you can add:</strong> ${escapeHtml(contribution || 'Review the source and decide whether you have a concrete contribution.')}</div>
    <div class="card bg-light border-0 mt-3"><div class="card-body"><div class="small text-secondary mb-1">Exact source</div><div class="text-break">${escapeHtml(candidate.text)}</div></div></div>
    ${draft ? `<div class="mt-3">${gatePanel(draft.gates)}<div class="small text-secondary">Draft ${draft.qualityScore}/50 · ${escapeHtml(draft.status)}</div><div class="mt-2 text-break">${escapeHtml(draft.body || '')}</div></div>` : ''}
    ${pressureWarning}
    ${repetitionWarning}
    ${hardHealthWarning}
    ${(score.rejectionReasons || []).length ? `<div class="alert alert-danger py-2 mt-3 mb-0">This opportunity is currently unavailable. <details class="small mt-2"><summary>Why?</summary>${escapeHtml(score.rejectionReasons.map((item) => item.code || item.reason).join(', '))}</details></div>` : ''}
    <details class="small mt-3"><summary>Why this recommendation?</summary><div class="mt-2">${relationshipTechnical}<div class="d-flex gap-1 flex-wrap mt-2"><span class="badge text-bg-light border">Conversation ${Math.round(Number(queueItem.conversationPotential || components.conversationPotential || 0))}</span><span class="badge text-bg-light border">Relationship ${Math.round(Number(queueItem.relationshipPotential || components.relationshipPotential || 0))}</span><span class="badge text-bg-light border">Freshness ${Math.round(Number(components.freshness || 0))}</span><span class="badge text-bg-light border">Visibility ${Math.round(Number(components.replyVisibility || 0))}</span><span class="badge text-bg-light border">Contribution ${Math.round(Number(components.contributionStrength || 0))}</span><span class="badge text-bg-light border">Internal priority ${Math.round(queueItem.priority)}</span></div>${learnedPriorityLine}<div class="text-secondary mt-2">Useful until ${escapeHtml(expiryLabel)}.</div></div></details>
    <div class="mt-3">${primaryReplyAction}</div>
    <details class="small mt-3"><summary>More actions</summary><div class="d-flex gap-2 flex-wrap mt-2 align-items-end">
      ${secondaryEdit}
      ${canReview ? `<form method="post" action="/queue/review"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}">${confirmationFields()}<button class="btn btn-outline-primary btn-sm" type="submit">${queueItem.status === 'needs_review' ? 'Recheck approval checks' : 'Run approval checks'}</button></form>` : ''}
      ${queueItem.engagementKind === 'initial_reply' ? `<form method="post" action="/engage/quote"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}"><button class="btn btn-outline-secondary btn-sm" type="submit">Make a quote post instead</button></form>` : ''}
      <form method="post" action="/engage/resolve"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}"><input type="hidden" name="action" value="ignore"><button class="btn btn-outline-secondary btn-sm" type="submit">Not now</button></form>
      <form method="post" action="/engage/resolve"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}"><input type="hidden" name="action" value="expire"><button class="btn btn-outline-secondary btn-sm" type="submit">No longer useful</button></form>
      <a class="btn btn-outline-secondary btn-sm" href="${escapeHtml(candidate.url)}" target="_blank">Open source ↗</a>
    </div></details>
  </div></article>`;
}

function focusedDraftView(draftId, { mode = 'create' } = {}) {
  const draft = getDraft(Number(draftId));
  if (!draft) return '<div class="alert alert-warning">That draft is no longer available.</div>';
  const queueItem = getQueueItemByCandidate(draft.candidateKey);
  if (mode === 'conversation' && queueItem?.lane !== 'engagement') return '<div class="alert alert-warning">That draft does not belong to a conversation.</div>';
  const backHref = mode === 'conversation' ? '/?source=engage' : '/?source=queue';
  const backLabel = mode === 'conversation' ? 'Back to conversations' : 'Back to Create';
  const title = mode === 'conversation' ? 'Review reply' : 'Review draft';
  const note = mode === 'conversation'
    ? 'Edit the exact reply, run the same approval checks, and send only after explicit human approval.'
    : 'Edit the content, run approval checks, then return to Create for the publishing plan.';
  return `<div class="mb-4"><a class="btn btn-outline-secondary btn-sm mb-3" href="${backHref}">← ${escapeHtml(backLabel)}</a><h1 class="h3 mb-1">${escapeHtml(title)}</h1><div class="text-secondary">${escapeHtml(note)}</div></div>${draftCard(draft)}`;
}

function draftsView(drafts, activeDraftId = null) {
  if (activeDraftId) return focusedDraftView(activeDraftId, { mode: 'create' });
  const content = drafts.map(draftCard).join('') || '<div class="alert alert-secondary">No drafts yet. Start from Discover or choose an idea in Create.</div>';
  return `<div class="d-flex justify-content-between gap-3 flex-wrap align-items-start mb-4"><div><h1 class="h3 mb-1">All drafts</h1><div class="text-secondary">Draft editor history. Day-to-day work should normally start from Create.</div></div><a class="btn btn-outline-primary btn-sm" href="/?source=queue">Back to Create</a></div>${content}`;
}

function engageView(error = null, activeDraftId = null) {
  if (activeDraftId) return focusedDraftView(activeDraftId, { mode: 'conversation' });
  const items = listEngagementItems({ limit: 200 });
  const accountHealth = getAccountHealthSummary();
  const active = items.filter((item) => item.engagementKind !== 'initial_reply');
  const cold = items.filter((item) => item.engagementKind === 'initial_reply');
  const warning = error ? `<div class="alert alert-warning">Engage refresh failed: ${escapeHtml(error)}</div>` : '';
  const group = (title, note, rows) => `<h2 class="h5 mt-4">${escapeHtml(title)} <span class="badge text-bg-light border">${rows.length}</span></h2><p class="small text-secondary">${escapeHtml(note)}</p>${rows.map((item) => engagementCard(item, accountHealth)).join('') || '<div class="alert alert-secondary">No items in this group.</div>'}`;
  const healthBanner = accountHealth.health.state === 'constrained'
    ? '<div class="alert alert-danger"><strong>Some actions are temporarily limited.</strong> Supported account evidence is blocking reply approval/sending until it is resolved. <a href="/?source=health" class="alert-link">Review account status</a>.</div>'
    : accountHealth.health.state === 'watch'
      ? '<div class="alert alert-warning"><strong>Something deserves attention.</strong> You can keep working normally; the warning is advisory. <a href="/?source=health" class="alert-link">See why</a>.</div>'
      : '';
  const overview = `<div class="mb-4"><h1 class="h3 mb-1">Conversations</h1><div class="text-secondary">Continue existing conversations first, then consider new ones where you have something concrete to add.</div></div><div class="row g-3 mb-4"><div class="col-6"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Active conversations</div><div class="fs-3 fw-semibold">${active.length}</div></div></div></div><div class="col-6"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">New opportunities</div><div class="fs-3 fw-semibold">${cold.length}</div></div></div></div></div>`;
  return overview + warning + healthBanner
    + group('Active conversations', 'Observed replies/quotes to our existing posts or replies are shown before cold opportunities.', active)
    + group('New opportunities', 'Fresh target posts and reply-suitable research candidates with a concrete proposed contribution.', cold);
}

const CREATE_LIFECYCLE = [
  { title: 'Ideas', note: 'Choose what each source should become before drafting.', statuses: ['triage', 'researching', 'watching'] },
  { title: 'Drafting', note: 'Content currently being written or edited.', statuses: ['drafting'] },
  { title: 'Needs review', note: 'Your factuality/evidence confirmation or approval decision is required.', statuses: ['needs_review'] },
  { title: 'Ready to publish', note: 'Approved content waiting for its publishing plan or currently publishing.', statuses: ['approved', 'publishing'] },
  { title: 'Needs attention', note: 'A prior publishing attempt failed and requires a human decision.', statuses: ['failed'] },
  { title: 'Published', note: 'Completed main-feed work retained for context.', statuses: ['published'] },
];

function queueCard(queueItem, scheduleContextValue) {
  if (!queueItem.recommendedPipeline) queueItem = refreshQueueRecommendation(queueItem.candidateKey).queueItem;
  const snapshot = inspectWorkflow(queueItem.candidateKey);
  const candidate = snapshot.candidate;
  const draft = snapshot.draft;
  const mainFeedReview = queueItem.status === 'needs_review' && [...MAIN_FEED_PIPELINES, 'repost'].includes(queueItem.pipeline);
  const canApprove = mainFeedReview && (queueItem.pipeline === 'repost' || (draft?.qualityScore >= 40 && draft?.gates?.passed === true));
  const canRequestReview = CONTENT_PIPELINES.has(queueItem.pipeline) && ['drafting', 'needs_review'].includes(queueItem.status);
  const choosingType = ['triage', 'researching', 'watching'].includes(queueItem.status);
  const canChangeType = !['publishing', 'published'].includes(queueItem.status);
  const breakdown = snapshot.scores.breakdown;
  const returnTo = '/?source=queue';
  const publicationState = queueItem.publishStartedAt || queueItem.publishedAt || queueItem.publishError
    ? `<div class="small mt-2"><strong>Publishing:</strong> ${queueItem.publishStartedAt ? `started ${escapeHtml(new Date(queueItem.publishStartedAt).toLocaleString())}` : 'not started'}${queueItem.publishedAt ? ` · published ${escapeHtml(new Date(queueItem.publishedAt).toLocaleString())}` : ''}${queueItem.publishError ? ` · <span class="text-danger">${escapeHtml(queueItem.publishError)}</span>` : ''}${queueItem.outputUrl ? ` · <a href="${escapeHtml(queueItem.outputUrl)}" target="_blank">view post ↗</a>` : ''}</div>`
    : '';
  const draftAction = draft ? `<a class="btn btn-primary btn-sm" href="/?source=drafts&draft=${draft.id}">${queueItem.status === 'drafting' ? 'Continue draft' : 'Review draft'}</a>` : '';
  const reviewAction = canRequestReview ? `<form method="post" action="/queue/review"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}">${confirmationFields()}<button class="btn btn-primary btn-sm" type="submit">${queueItem.status === 'needs_review' ? 'Recheck approval checks' : 'Run approval checks'}</button></form>` : '';
  const approveAction = canApprove && queueItem.pipeline !== 'repost'
    ? `<form method="post" action="/queue/approve"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}">${confirmationFields()}<button class="btn btn-success btn-sm" type="submit">Approve for publishing</button></form>`
    : canApprove
      ? `<form method="post" action="/queue/approve"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="btn btn-success btn-sm" type="submit">Approve repost</button></form>`
      : '';
  const primaryQueueAction = choosingType
    ? routeForm(queueItem, candidate.key, returnTo)
    : canApprove
      ? approveAction
      : queueItem.status === 'drafting'
        ? draftAction
        : queueItem.status === 'needs_review'
          ? (draftAction || reviewAction)
          : ['approved', 'publishing', 'published'].includes(queueItem.status)
            ? ''
            : draftAction;
  const secondaryDraftAction = canApprove && draft ? `<a class="btn btn-outline-primary btn-sm" href="/?source=drafts&draft=${draft.id}">Edit draft</a>` : '';
  const secondaryTypeAction = !choosingType && canChangeType ? routeForm(queueItem, candidate.key, returnTo) : '';
  return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4">
    <div class="d-flex justify-content-between gap-3 flex-wrap">
      <div><div class="fw-semibold fs-5">${escapeHtml(candidate.title)}</div><div class="small text-secondary">${escapeHtml(candidate.source.toUpperCase())} · ${escapeHtml(pipelineLabel(queueItem.pipeline))} · ${escapeHtml(statusLabel(queueItem.status))}</div></div>
      <a class="btn btn-outline-secondary btn-sm align-self-start" href="${escapeHtml(candidate.url)}" target="_blank">Source ↗</a>
    </div>
    <p class="mt-3 mb-2 text-break">${escapeHtml(candidate.text)}</p>
    ${workflowBadges(queueItem)}
    <div class="small mt-2"><strong>Suggested use:</strong> ${escapeHtml(pipelineLabel(queueItem.recommendedPipeline || 'triage'))} <span class="text-secondary">— ${escapeHtml(queueItem.routingReason || 'No recommendation stored.')}</span></div>
    ${publicationState}
    ${draft ? gatePanel(draft.gates) : ''}
    ${schedulePanel(queueItem, scheduleContextValue)}
    ${primaryQueueAction ? `<div class="mt-3">${primaryQueueAction}</div>` : ''}
    <details class="small mt-3"><summary>Why this recommendation?</summary><div class="text-secondary mt-2">Reach: freshness ${breakdown.reach.freshness}, momentum ${breakdown.reach.momentum}, traction ${breakdown.reach.traction}, breadth ${breakdown.reach.breadth} · Follow: niche ${breakdown.follow.niche}, preference ${breakdown.follow.preference}, specificity ${breakdown.follow.specificity}, utility ${breakdown.follow.utility}, identity ${breakdown.follow.identity} · Conversation: discussion ${breakdown.conversation.discussion}, tradeoff ${breakdown.conversation.questionTradeoff}, freshness ${breakdown.conversation.freshness}, specificity ${breakdown.conversation.specificity} · Relationship: ${breakdown.relationship.available ? `relevance ${breakdown.relationship.relevance}, follows ${breakdown.relationship.followsYou}, following ${breakdown.relationship.youFollow}, mutual ${breakdown.relationship.mutual}, topic ${breakdown.relationship.topicOverlap}` : 'no observed relationship context'}</div></details>
    ${(secondaryDraftAction || secondaryTypeAction) ? `<details class="small mt-3"><summary>More actions</summary><div class="d-flex gap-2 flex-wrap mt-2 align-items-end">${secondaryDraftAction}${secondaryTypeAction}</div></details>` : ''}
    ${mainFeedReview && !canApprove ? `<div class="alert alert-warning py-2 mt-3 mb-0">Not ready for approval yet. ${draft ? 'Open the draft to fix the checks or complete the required confirmations.' : 'Create a draft first.'}</div>` : ''}
  </div></article>`;
}

function queueView() {
  const items = listQueueItems({ lane: 'main', limit: 250 });
  const context = schedulerContext();
  const counts = {
    ideas: items.filter((item) => ['triage', 'researching', 'watching'].includes(item.status)).length,
    drafting: items.filter((item) => item.status === 'drafting').length,
    review: items.filter((item) => item.status === 'needs_review').length,
    ready: items.filter((item) => ['approved', 'publishing'].includes(item.status)).length,
  };
  const summary = `<div class="row g-3 mb-4">
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Ideas</div><div class="fs-3 fw-semibold">${counts.ideas}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Drafting</div><div class="fs-3 fw-semibold">${counts.drafting}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Needs review</div><div class="fs-3 fw-semibold">${counts.review}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="small text-secondary">Ready to publish</div><div class="fs-3 fw-semibold">${counts.ready}</div></div></div></div>
  </div>`;
  const sections = CREATE_LIFECYCLE.map(({ title, note, statuses }) => {
    const group = items.filter((item) => statuses.includes(item.status));
    if (!group.length) return '';
    return `<section class="mb-5"><div class="d-flex justify-content-between gap-3 flex-wrap align-items-end mb-2"><div><h2 class="h5 mb-1">${escapeHtml(title)}</h2><div class="small text-secondary">${escapeHtml(note)}</div></div><span class="badge text-bg-light border">${group.length}</span></div>${group.map((item) => queueCard(item, context)).join('')}</section>`;
  }).join('');
  return `<div class="mb-4"><h1 class="h3 mb-1">Create</h1><div class="text-secondary">Move an idea from source to draft, review, approval, and publishing without learning the underlying queue states.</div></div>${summary}${sections || '<div class="alert alert-secondary">No active creation work.</div>'}`;
}

function todayActionCard({ eyebrow, title, body, note = '', href, action, tone = 'primary' }) {
  return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4">
    <div class="small text-secondary text-uppercase fw-semibold mb-1">${escapeHtml(eyebrow)}</div>
    <div class="d-flex justify-content-between gap-3 flex-wrap align-items-start">
      <div class="flex-grow-1"><h2 class="h5 mb-2">${escapeHtml(title)}</h2><p class="mb-1">${escapeHtml(body)}</p>${note ? `<div class="small text-secondary">${escapeHtml(note)}</div>` : ''}</div>
      <a class="btn btn-${tone} btn-sm" href="${escapeHtml(href)}">${escapeHtml(action)}</a>
    </div>
  </div></article>`;
}

function todayView({ now = Date.now(), nextScheduled = null, accountHealth = getAccountHealthSummary() } = {}) {
  const engagementItems = listEngagementItems({ limit: 100 });
  const activeConversations = engagementItems.filter((item) => item.engagementKind !== 'initial_reply');
  const newOpportunities = engagementItems.filter((item) => item.engagementKind === 'initial_reply');
  const reviewItems = listQueueItems({ lane: 'main', status: 'needs_review', limit: 20 });
  const followerQuality = getNewFollowerQuality({ since: Number(now) - 24 * 3_600_000 });
  const actions = [];

  if (accountHealth.health.state === 'constrained') {
    actions.push(todayActionCard({
      eyebrow: 'Needs attention',
      title: 'Some actions are temporarily limited',
      body: accountHealth.health.explanation || 'Observed account evidence is limiting some actions until it is resolved.',
      href: '/?source=health', action: 'Review account status', tone: 'danger',
    }));
  }

  const conversation = activeConversations[0];
  if (conversation) {
    const candidate = getCandidate(conversation.candidateKey);
    const profile = conversation.targetUsername ? getRelationshipProfile(conversation.targetUsername) : null;
    const contribution = conversation.contributionSummary || conversation.engagement?.contribution?.summary || 'Review the conversation and decide whether you have something useful to add.';
    actions.push(todayActionCard({
      eyebrow: 'Continue a conversation',
      title: `@${conversation.targetUsername || profile?.username || 'conversation'} has new activity`,
      body: contribution,
      note: candidate?.text ? `Source: ${candidate.text.slice(0, 140)}${candidate.text.length > 140 ? '…' : ''}` : '',
      href: '/?source=engage', action: 'Review reply', tone: 'primary',
    }));
  }

  const reviewItem = reviewItems[0];
  if (reviewItem) {
    const draft = getDraftByCandidate(reviewItem.candidateKey);
    const candidate = getCandidate(reviewItem.candidateKey);
    const ready = Boolean(draft && draft.qualityScore >= 40 && draft.gates?.passed === true);
    actions.push(todayActionCard({
      eyebrow: 'Review a post',
      title: candidate?.title || 'A draft needs your decision',
      body: ready ? 'The draft passed its checks and is ready for your approval.' : 'The draft still needs a fix or confirmation before it can be approved.',
      note: draft ? `Quality ${draft.qualityScore}/50 · ${pipelineLabel(reviewItem.pipeline)}` : pipelineLabel(reviewItem.pipeline),
      href: draft ? `/?source=drafts&draft=${draft.id}` : '/?source=queue',
      action: 'Review draft', tone: ready ? 'success' : 'warning',
    }));
  }

  if (nextScheduled?.item) {
    const candidate = nextScheduled.item.candidate || getCandidate(nextScheduled.item.candidateKey);
    const dueNow = Number(nextScheduled.recommendedAt) <= Number(now);
    actions.push(todayActionCard({
      eyebrow: 'Next post',
      title: candidate?.title || 'An approved post is ready',
      body: dueNow ? 'Approved and ready to publish when your publishing mode allows it.' : `Approved and recommended for around ${new Date(nextScheduled.recommendedAt).toLocaleString()}.`,
      note: AUTO_POST ? 'Main-feed automation is enabled.' : 'Main-feed automation is off. Nothing is auto-published from this recommendation.',
      href: '/?source=queue', action: 'View publishing plan', tone: 'primary',
    }));
  }

  if (!activeConversations.length && newOpportunities[0]) {
    const item = newOpportunities[0];
    actions.push(todayActionCard({
      eyebrow: 'Worth considering',
      title: `A conversation with @${item.targetUsername || 'this account'} looks useful`,
      body: item.contributionSummary || 'There is a fresh conversation opportunity with a concrete contribution available.',
      href: '/?source=engage', action: 'See conversation', tone: 'outline-primary',
    }));
  }

  const healthCopy = accountHealth.health.state === 'healthy'
    ? 'Everything looks normal.'
    : accountHealth.health.state === 'watch'
      ? 'Something deserves attention, but normal human-reviewed work can continue.'
      : 'Some actions are temporarily limited by observed evidence.';
  const taskCount = actions.length;
  const summary = `<div class="d-flex justify-content-between gap-3 flex-wrap align-items-start mb-4"><div><h1 class="h3 mb-1">Today</h1><div class="text-secondary">${taskCount ? `${taskCount} thing${taskCount === 1 ? '' : 's'} worth looking at.` : 'You are caught up. Nothing requires a decision right now.'}</div></div><a class="btn btn-outline-primary btn-sm" href="/?source=x&refresh=1">Find new signals</a></div>`;
  const stats = `<div class="row g-3 mb-4">
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Active conversations</div><div class="fs-3 fw-semibold">${activeConversations.length}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Waiting for review</div><div class="fs-3 fw-semibold">${reviewItems.length}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">Useful interactions · 7d</div><div class="fs-3 fw-semibold">${accountHealth.interactionCounts.meaningfulInteractions7d}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">New relevant followers · 24h</div><div class="fs-3 fw-semibold">${followerQuality.nicheAlignedNewFollowers}</div><div class="small text-secondary">of ${followerQuality.newlyObservedFollowers} newly observed</div></div></div></div>
  </div>`;
  const actionSection = actions.length
    ? `<h2 class="h5 mb-3">Needs your attention</h2>${actions.join('')}`
    : '<div class="alert alert-success">No immediate decisions are waiting. Discover a new signal or check recent results when you are ready.</div>';
  const status = `<div class="card border-0 shadow-sm mt-4"><div class="card-body d-flex justify-content-between gap-3 flex-wrap align-items-center"><div><div class="small text-secondary">Account status</div><div class="fw-semibold">${escapeHtml(healthCopy)}</div></div><a class="btn btn-outline-secondary btn-sm" href="/?source=health">Details</a></div></div>`;
  return summary + stats + actionSection + status;
}

function improveView(overview = getLearningOverview()) {
  const tests = listExperiments({ limit: 100 });
  const activeTests = tests.filter((test) => test.status === 'active');
  const suggestedRules = (overview.rules || []).filter((rule) => rule.status === 'suggested');
  const acceptedRules = (overview.rules || []).filter((rule) => rule.status === 'accepted');
  const decisionRule = suggestedRules.find((rule) => rule.acceptance?.eligible) || suggestedRules[0] || null;
  const decisionCard = decisionRule
    ? `<div class="card border-0 shadow-sm mt-4"><div class="card-body p-4"><div class="small text-secondary text-uppercase fw-semibold">Needs a human decision</div><h2 class="h5 mt-1">${escapeHtml(decisionRule.finding || 'A measured pattern is ready to review')}</h2><div class="small text-secondary">${escapeHtml(evidenceLabel(decisionRule.evidence?.state || 'insufficient'))} · ${escapeHtml(decisionRule.evidence?.sampleSize || 0)} examples</div><p class="mt-3 mb-3">${escapeHtml(decisionRule.recommendation || 'Review the evidence before deciding whether anything should change.')}</p><a class="btn btn-primary btn-sm" href="/?source=learning">Review suggested change</a></div></div>`
    : '<div class="alert alert-light border mt-4"><strong>No strategy decision is waiting right now.</strong> Keep collecting measured outcomes or create a focused test when you have a question worth comparing.</div>';
  return `<div class="mb-4"><h1 class="h3 mb-1">Improve</h1><div class="text-secondary">Use measured outcomes to ask focused questions, then decide whether any recommendation should change.</div></div>
    <div class="row g-3">
      <div class="col-md-6"><div class="card border-0 shadow-sm h-100"><div class="card-body p-4"><div class="small text-secondary">Tests</div><div class="fs-3 fw-semibold">${tests.length}</div><div class="small text-secondary mb-3">${activeTests.length} active. Assignments are explicit and never randomized.</div><a class="btn btn-outline-primary btn-sm" href="/?source=experiments">View or create tests</a></div></div></div>
      <div class="col-md-6"><div class="card border-0 shadow-sm h-100"><div class="card-body p-4"><div class="small text-secondary">What we've learned</div><div class="fs-3 fw-semibold">${overview.suggested}</div><div class="small text-secondary mb-3">suggested · ${acceptedRules.length} accepted. Suggestions have zero effect until you accept them.</div><a class="btn btn-outline-primary btn-sm" href="/?source=learning">Review learnings</a></div></div></div>
    </div>
    ${decisionCard}
    <div class="card bg-light border-0 mt-4"><div class="card-body"><strong>Nothing here publishes by itself.</strong><div class="small text-secondary mt-1">Tests only attach explicit comparison context. Learned suggestions stay inert until human acceptance, and accepted changes remain bounded by the existing approval, expiry, account-status, and manual-choice rules.</div></div></div>`;
}

function sectionMeta(source) {
  const group = sourceGroup(source);
  return {
    today: ['Today', 'What deserves your attention right now.'],
    discover: ['Discover', 'Find useful things worth talking about.'],
    conversations: ['Conversations', 'Continue useful discussions and find the next worthwhile reply.'],
    create: ['Create', 'Turn ideas into reviewed, approved content.'],
    results: ['Results', 'Understand what happened and whether anything needs attention.'],
    improve: ['Improve', 'Run simple tests and decide what the system should learn.'],
    advanced: ['Advanced', 'Detailed system views and diagnostics for when you need them.'],
  }[group];
}

function primaryNavigation(activeSource) {
  const activeGroup = sourceGroup(activeSource);
  return PRIMARY_NAV.map(([group, source, label]) => `<a data-active="${activeGroup === group ? 'true' : 'false'}" href="/?source=${source}">${escapeHtml(label)}</a>`).join('');
}

function secondaryNavigation(activeSource, savedCount) {
  const group = sourceGroup(activeSource);
  const items = {
    discover: [['x', 'For you'], ['viral', 'Trending'], ['interesting', `Saved (${savedCount})`], ['opportunities', 'Opportunities'], ['github', 'GitHub'], ['hn', 'Hacker News'], ['all', 'All sources']],
    conversations: [['engage', 'What needs a reply'], ['relationships', 'People & relationships']],
    create: [['queue', 'Create lifecycle'], ['drafts', 'All drafts']],
    results: [['results', 'Overview'], ['performance', 'Content results'], ['audience', 'Audience quality'], ['health', 'Account status']],
    improve: [['improve', 'Overview'], ['experiments', 'Tests'], ['learning', "What we've learned"]],
  }[group] || [];
  if (!items.length) return '';
  return `<nav aria-label="Section" class="app-subnav">${items.map(([source, label]) => `<a data-active="${activeSource === source ? 'true' : 'false'}" href="/?source=${source}">${escapeHtml(label)}</a>`).join('')}</nav>`;
}

function advancedView() {
  const links = [
    ['relationships', 'Relationships', 'Strategic relationship profiles, stages, and TargetScore detail.'],
    ['audience', 'Audience', 'Raw follower/following observations and niche alignment.'],
    ['health', 'Account status', 'Health evidence, repetition, saturation, and visibility provenance.'],
    ['performance', 'Performance', 'Raw fixed-window post and account measurements.'],
    ['experiments', 'Tests', 'Experiment definitions, assignments, cohorts, and confounders.'],
    ['learning', "What we've learned", 'Learned-rule evidence, match context, adjustments, and retirement controls.'],
    ['all', 'All research sources', 'Combined raw research feed across connected discovery sources.'],
  ];
  return `<div class="alert alert-light border mb-4">Most daily work should start from Today, Discover, Conversations, Create, Results, or Improve. These detailed views remain available for inspection and advanced operation.</div>
    <div class="row g-3">${links.map(([source, title, body]) => `<div class="col-md-6"><a class="card border-0 shadow-sm h-100 text-decoration-none text-dark" href="/?source=${source}"><div class="card-body"><div class="fw-semibold mb-1">${escapeHtml(title)}</div><div class="small text-secondary">${escapeHtml(body)}</div></div></a></div>`).join('')}</div>`;
}

async function renderPage(activeSource = 'today', activeTag = '', forceRefresh = false, relationshipClass = '', relationshipStage = '', activeDraftId = null) {
  let refreshError = null;
  const researchEmpty = activeSource === 'x'
    ? listCandidates({ source: 'x', withinHours: 72, limit: 1 }).length === 0
    : activeSource === 'viral'
      ? listCandidates({ source: 'x', viralOnly: true, withinHours: 24, limit: 1 }).length === 0
      : activeSource === 'github'
        ? listCandidates({ source: 'github', withinHours: 168, limit: 1 }).length === 0
        : activeSource === 'hn'
          ? listCandidates({ source: 'hn', withinHours: 168, limit: 1 }).length === 0
          : activeSource === 'all'
            ? listCandidates({ withinHours: 168, limit: 1 }).length === 0
            : false;
  if (['x', 'viral', 'github', 'hn', 'all'].includes(activeSource) && (forceRefresh || researchEmpty)) {
    refreshError = await collectResearch(activeSource);
  }

  let performanceError = null;
  if (activeSource === 'performance' && (forceRefresh || !getPerformanceSnapshot(1).account)) {
    const result = await fetchAccountPerformance(ACCOUNT, 20);
    performanceError = result.error;
    if (!result.error) recordPerformanceSnapshot(result);
  }

  let audienceError = null;
  if (activeSource === 'audience' && (forceRefresh || getAudienceSummary().following === 0)) {
    try {
      await syncAudience(ACCOUNT);
    } catch (error) {
      audienceError = error.message;
    }
  }

  let engagementError = null;
  if (activeSource === 'engage' && (forceRefresh || listEngagementItems({ limit: 1 }).length === 0)) {
    try {
      await refreshEngagementOpportunities();
    } catch (error) {
      engagementError = error.message;
    }
  }

  const savedCount = countSavedCandidates();
  const scheduleNow = Date.now();
  const scheduleContextValue = schedulerContext(scheduleNow);
  const scheduleDecisions = rankMainFeedItems(listApprovedMainFeedItems({ automatedOnly: true, limit: 100 }), scheduleContextValue);
  const nextScheduled = scheduleDecisions.find((item) => item.eligible) || null;
  let visible = [];
  if (activeSource === 'x') visible = listCandidates({ source: 'x', withinHours: 72, limit: 120 });
  else if (activeSource === 'viral') visible = listCandidates({ source: 'x', viralOnly: true, withinHours: 24, limit: 100 });
  else if (activeSource === 'interesting') visible = listCandidates({ saved: true, limit: 150 });
  else if (activeSource === 'github') visible = listCandidates({ source: 'github', withinHours: 168, limit: 100 });
  else if (activeSource === 'hn') visible = listCandidates({ source: 'hn', withinHours: 168, limit: 100 });
  else if (activeSource === 'all') visible = listCandidates({ withinHours: 168, limit: 150 });
  else if (activeSource === 'opportunities') visible = listCandidates({ source: 'x', withinHours: 168, limit: 250 }).filter(isOpportunityCandidate);

  if (activeTag) visible = visible.filter((item) => item.niche?.tags?.includes(activeTag));

  const drafts = activeSource === 'drafts' ? listDrafts({ limit: 100 }) : [];
  const performance = ['results', 'performance'].includes(activeSource) ? getPerformanceSnapshot(30) : null;
  const accountHealth = ['today', 'results', 'health', 'engage'].includes(activeSource) ? getAccountHealthSummary() : null;
  const learningOverview = ['improve', 'learning'].includes(activeSource) ? getLearningOverview() : null;

  let decision;
  if (refreshError) decision = `Research refresh failed: ${refreshError}`;
  else if (activeSource === 'today') decision = 'Your most important human decisions, in one place.';
  else if (activeSource === 'viral') decision = `${visible.length} viral/rising developer signals from the rolling last 24 hours.`;
  else if (activeSource === 'interesting') decision = `${visible.length} saved signals in your persistent research memory.`;
  else if (activeSource === 'queue') decision = `${countQueueItems({ status: 'triage', lane: 'main' })} need a content choice · ${countQueueItems({ status: 'needs_review', lane: 'main' })} need review · ${countQueueItems({ status: 'approved', lane: 'main' })} approved.`;
  else if (activeSource === 'drafts') decision = activeDraftId ? 'Editing one draft in the Create journey.' : `${drafts.length} drafts · ${drafts.filter((draft) => draft.status === 'ready').length} approved.`;
  else if (activeSource === 'engage') {
    const engagementItems = listEngagementItems({ limit: 200 });
    const activeCount = engagementItems.filter((item) => item.engagementKind !== 'initial_reply').length;
    decision = engagementError ? `Engage refresh failed: ${engagementError}` : `${activeCount} active conversations · ${engagementItems.length - activeCount} new opportunities.`;
  }
  else if (activeSource === 'opportunities') decision = `${visible.length} job, builder, SaaS, and productization opportunities from recent research.`;
  else if (activeSource === 'results') decision = 'Recent outcomes, account status, and what deserves attention.';
  else if (activeSource === 'performance') decision = `Detailed account and post measurements for @${ACCOUNT}.`;
  else if (activeSource === 'improve') decision = `${listExperiments({ limit: 500 }).length} tests · ${learningOverview.suggested} suggested changes waiting for evidence or a human decision.`;
  else if (activeSource === 'experiments') decision = `${listExperiments({ limit: 500 }).length} tests · nothing is randomly assigned or posted just for a test.`;
  else if (activeSource === 'learning') decision = `${learningOverview.suggested} suggested changes · ${learningOverview.accepted} accepted · ${learningOverview.retired} retired. Only accepted changes affect future recommendations.`;
  else if (activeSource === 'audience') {
    const summary = getAudienceSummary();
    decision = audienceError ? `Audience refresh failed: ${audienceError}` : `${summary.relevant_followers}/${summary.followers} observed followers are niche-aligned; ${summary.target_accounts} relevant followed accounts are raw audience observations.`;
  }
  else if (activeSource === 'relationships') {
    const shownCount = listRelationshipProfiles({ className: relationshipClass || undefined, stage: relationshipStage || undefined, limit: 100 }).length;
    decision = `Showing ${shownCount} people for the current filters.`;
  }
  else if (activeSource === 'health') {
    const stateCopy = accountHealth.health.state === 'healthy' ? 'Everything looks normal.' : accountHealth.health.state === 'watch' ? 'Something deserves attention.' : 'Some actions are temporarily limited.';
    decision = `${stateCopy} ${accountHealth.interactionCounts.meaningfulInteractions7d} useful interactions in the last 7 days.`;
  }
  else if (activeSource === 'advanced') decision = 'Detailed system views and diagnostics.';
  else decision = `${visible.length} items in this view.`;

  const relationshipQuery = activeSource === 'relationships'
    ? `${relationshipClass ? `&class=${encodeURIComponent(relationshipClass)}` : ''}${relationshipStage ? `&stage=${encodeURIComponent(relationshipStage)}` : ''}`
    : '';
  const draftQuery = activeDraftId ? `&draft=${encodeURIComponent(activeDraftId)}` : '';
  const returnTo = `/?source=${encodeURIComponent(activeSource)}${activeTag ? `&tag=${encodeURIComponent(activeTag)}` : ''}${relationshipQuery}${draftQuery}`;
  const filtersEnabled = ['x', 'viral', 'interesting', 'opportunities'].includes(activeSource);
  const nav = primaryNavigation(activeSource);
  const secondaryNav = secondaryNavigation(activeSource, savedCount);
  const [sectionTitle, sectionDescription] = sectionMeta(activeSource);

  let content;
  if (activeSource === 'today') content = todayView({ now: scheduleNow, nextScheduled, accountHealth });
  else if (activeSource === 'advanced') content = advancedView();
  else if (activeSource === 'queue') content = queueView();
  else if (activeSource === 'engage') content = engageView(engagementError, activeDraftId);
  else if (activeSource === 'drafts') content = draftsView(drafts, activeDraftId);
  else if (activeSource === 'results') content = resultsView(performance, accountHealth);
  else if (activeSource === 'performance') content = performanceView(performance, performanceError);
  else if (activeSource === 'improve') content = improveView(learningOverview);
  else if (activeSource === 'experiments') content = experimentsView();
  else if (activeSource === 'learning') content = learningView(learningOverview);
  else if (activeSource === 'relationships') content = relationshipsView(relationshipClass, relationshipStage);
  else if (activeSource === 'health') content = accountHealthView();
  else if (activeSource === 'audience') content = audienceView(audienceError);
  else content = visible.slice(0, 50).map((item, index) => candidateCard(item, index, returnTo)).join('') || '<div class="alert alert-secondary">No candidates found for this view.</div>';

  const refreshControl = activeSource === 'today'
    ? ''
    : `<a class="btn btn-outline-dark btn-sm" href="${escapeHtml(returnTo)}${returnTo.includes('?') ? '&' : '?'}refresh=1">Refresh</a>`;
  return `<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(sectionTitle)} · Growth workspace</title>
    <link rel="stylesheet" href="/assets/bootstrap.min.css">
    <link rel="stylesheet" href="/assets/dashboard.tailwind.css">
  </head><body><div class="app-shell">
    <header class="app-topbar"><div class="app-container py-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0"><div class="app-kicker">Growth workspace</div><div class="app-title">${escapeHtml(sectionTitle)}</div><div class="app-subtitle">${escapeHtml(sectionDescription)} ${escapeHtml(decision)}</div></div>
        <div class="flex flex-wrap items-center gap-2">${refreshControl}<span class="rounded-full px-3 py-1 text-xs font-semibold ${AUTO_POST ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}">Automation ${AUTO_POST ? 'on' : 'off'}</span>${nextScheduled ? `<span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Next post ${nextScheduled.recommendedAt <= scheduleNow ? 'ready now' : escapeHtml(new Date(nextScheduled.recommendedAt).toLocaleString())}</span>` : ''}</div>
      </div>
      <nav aria-label="Primary" class="app-nav mt-4">${nav}</nav>
      ${secondaryNav || ''}
      ${filtersEnabled ? `<div class="mt-3 flex flex-wrap gap-2"><a class="rounded-full px-3 py-1.5 text-xs font-semibold no-underline ${!activeTag ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}" href="/?source=${escapeHtml(activeSource)}">All topics</a>${Object.entries(NICHE_LABELS).map(([tag, label]) => `<a class="rounded-full px-3 py-1.5 text-xs font-semibold no-underline ${activeTag === tag ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}" href="/?source=${escapeHtml(activeSource)}&tag=${encodeURIComponent(tag)}">${escapeHtml(label)}</a>`).join('')}</div>` : ''}
    </div></header>
    <main class="app-container py-6 lg:py-8">${content}</main>
    <script defer src="/assets/dashboard-client.js"></script>
    <script src="/assets/bootstrap.bundle.min.js"></script>
  </div></body></html>`;
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && requestUrl.pathname === '/assets/bootstrap.min.css') {
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      res.end(await fs.readFile(path.resolve('node_modules/bootstrap/dist/css/bootstrap.min.css')));
      return;
    }
    if (req.method === 'GET' && requestUrl.pathname === '/assets/bootstrap.bundle.min.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(await fs.readFile(path.resolve('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js')));
      return;
    }
    if (req.method === 'GET' && requestUrl.pathname === '/assets/dashboard.tailwind.css') {
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      res.end(await fs.readFile(path.resolve('dashboard.tailwind.generated.css')));
      return;
    }
    if (req.method === 'GET' && requestUrl.pathname === '/assets/dashboard-client.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(await fs.readFile(path.resolve('dashboard-client.js')));
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/audience/unfollow') {
      const form = await readForm(req);
      if (form.get('confirmUnfollow') !== '1') throw new Error('Explicit unfollow confirmation is required.');
      await unfollowAudienceUser(form.get('username'));
      res.writeHead(303, { location: '/?source=audience' }); res.end(); return;
    }

    if (req.method === 'POST' && ['/candidate/save', '/interesting'].includes(requestUrl.pathname)) {
      const form = await readForm(req);
      const key = form.get('key');
      const candidate = getCandidate(key);
      if (!candidate) throw new Error('Candidate not found. Refresh research first.');
      saveCandidateToWorkflow(key, form.get('saved') !== '0');
      res.writeHead(303, { location: form.get('returnTo') || '/?source=interesting' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/queue/route') {
      const form = await readForm(req);
      routeCandidate(form.get('key'), form.get('pipeline'), { actor: 'human' });
      res.writeHead(303, { location: form.get('returnTo') || '/?source=queue' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/queue/review') {
      const form = await readForm(req);
      const key = form.get('key');
      const queueItem = getQueueItemByCandidate(key);
      requestQueueReview(key, {
        factualityConfirmed: form.get('factualityConfirmed') === '1',
        evidenceConfirmed: form.get('evidenceConfirmed') === '1',
      });
      const draft = getDraftByCandidate(key);
      const location = queueItem?.lane === 'engagement'
        ? (draft ? `/?source=engage&draft=${draft.id}` : '/?source=engage')
        : (draft ? `/?source=drafts&draft=${draft.id}` : '/?source=queue');
      res.writeHead(303, { location }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/engage/draft') {
      const form = await readForm(req);
      const key = form.get('key');
      let draft = getDraftByCandidate(key);
      const needsInitialGeneration = !draft;
      routeCandidate(key, 'reply', { actor: 'human' });
      draft = getDraftByCandidate(key);
      if (needsInitialGeneration && draft) draft = (await generateDraftCandidate(draft)).saved;
      res.writeHead(303, { location: draft ? `/?source=engage&draft=${draft.id}` : '/?source=engage' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/engage/resolve') {
      const form = await readForm(req);
      resolveEngagementItem(form.get('key'), form.get('action'), form.get('reason') || '');
      res.writeHead(303, { location: '/?source=engage' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/engage/quote') {
      const form = await readForm(req);
      const key = form.get('key');
      routeCandidate(key, 'quote', { actor: 'human', reason: 'Operator chose Quote instead from Engage Next.' });
      const draft = getDraftByCandidate(key);
      res.writeHead(303, { location: draft ? `/?source=drafts&draft=${draft.id}` : '/?source=queue' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/engage/approve-send') {
      const form = await readForm(req);
      const key = form.get('key');
      assertEngagementHealthAllowsSend();
      approveEngagementQueueItem(key, {
        factualityConfirmed: form.get('factualityConfirmed') === '1',
        evidenceConfirmed: form.get('evidenceConfirmed') === '1',
      }, { actor: 'human' });
      await sendApprovedEngagementReply(key);
      res.writeHead(303, { location: '/?source=engage' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/engage/send') {
      const form = await readForm(req);
      assertEngagementHealthAllowsSend();
      await sendApprovedEngagementReply(form.get('key'));
      res.writeHead(303, { location: '/?source=engage' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/health/observe') {
      const form = await readForm(req);
      const type = String(form.get('type') || '');
      if (!ACCOUNT_HEALTH_OBSERVATION_TYPES.includes(type) || type === 'under_the_hood_snapshot') throw new Error(`Unsupported manual health observation type: ${type || 'missing'}.`);
      const source = String(form.get('source') || '').trim();
      const sourceRef = String(form.get('sourceRef') || '').trim();
      if (!source || !sourceRef) throw new Error('Health observations require source and sourceRef provenance.');
      const label = String(form.get('label') || '').trim();
      if (['visibility_label_observed', 'visibility_label_cleared'].includes(type) && !label) throw new Error(`${type} requires the observed label name.`);
      const resolved = form.get('resolved') === '1';
      recordAccountHealthObservation({
        type,
        severity: String(form.get('severity') || 'info'),
        source,
        sourceRef,
        observedAt: Date.now(),
        metadata: {
          label: label || undefined,
          note: String(form.get('note') || '').trim(),
          ...(resolved ? { resolved: true, active: false } : {}),
        },
      });
      res.writeHead(303, { location: '/?source=health' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/health/under-the-hood') {
      const report = await fetchXUnderTheHoodReport();
      if (report.available === true) recordUnderTheHoodSnapshot(report);
      res.writeHead(303, { location: '/?source=health' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/queue/approve') {
      const form = await readForm(req);
      approveQueueItem(form.get('key'), {
        factualityConfirmed: form.get('factualityConfirmed') === '1',
        evidenceConfirmed: form.get('evidenceConfirmed') === '1',
      });
      res.writeHead(303, { location: '/?source=queue' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/experiment/create') {
      const form = await readForm(req);
      const population = JSON.parse(String(form.get('populationJson') || '{}'));
      if (!population || typeof population !== 'object' || Array.isArray(population)) throw new Error('Experiment population JSON must be an object.');
      const guidedVariants = [form.get('variantA'), form.get('variantB')].map((value) => String(value || '').trim()).filter(Boolean);
      const variants = guidedVariants.length >= 2
        ? guidedVariants
        : String(form.get('variants') || '').split(',').map((value) => value.trim()).filter(Boolean);
      createExperiment({
        name: form.get('name'),
        hypothesis: form.get('hypothesis'),
        dimension: form.get('dimension'),
        population,
        primaryMetric: form.get('primaryMetric'),
        secondaryMetrics: String(form.get('secondaryMetrics') || '').split(',').map((value) => value.trim()).filter(Boolean),
        variants,
        minimumCompletedPerVariant: Number(form.get('minimumCompletedPerVariant')),
        status: form.get('status') || 'draft',
      });
      res.writeHead(303, { location: '/?source=experiments' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/experiment/status') {
      const form = await readForm(req);
      const experimentId = Number(form.get('experimentId'));
      const status = String(form.get('status') || '');
      const experiment = getExperiment(experimentId);
      if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);
      setExperimentStatus(experiment.id, status);
      res.writeHead(303, { location: '/?source=experiments' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/experiment/assign') {
      const form = await readForm(req);
      const context = JSON.parse(String(form.get('contextJson') || '{}'));
      if (!context || typeof context !== 'object' || Array.isArray(context)) throw new Error('Experiment assignment context JSON must be an object.');
      assignExperimentVariant(form.get('key'), Number(form.get('experimentId')), form.get('variant'), {
        context,
        timingHistorySufficient: form.get('timingHistorySufficient') === '1',
      });
      res.writeHead(303, { location: '/?source=experiments' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/learning/refresh') {
      const form = await readForm(req);
      refreshLearnedRuleSuggestion({
        experimentId: Number(form.get('experimentId')),
        baselineLabel: form.get('baselineLabel'),
        comparisonLabel: form.get('comparisonLabel'),
        windowMinutes: form.get('windowMinutes') ? Number(form.get('windowMinutes')) : null,
        mechanismTags: String(form.get('mechanismTags') || '').split(',').map((value) => value.trim()).filter(Boolean),
      });
      res.writeHead(303, { location: '/?source=learning' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/learning/accept') {
      const form = await readForm(req);
      acceptLearnedRule(Number(form.get('id')));
      res.writeHead(303, { location: '/?source=learning' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/learning/retire') {
      const form = await readForm(req);
      retireLearnedRule(Number(form.get('id')), { reason: String(form.get('reason') || '').trim() });
      res.writeHead(303, { location: '/?source=learning' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/queue/schedule') {
      const form = await readForm(req);
      const scheduledRaw = form.get('scheduledAt');
      const expiresRaw = form.get('expiresAt');
      const scheduledAt = scheduledRaw ? Date.parse(scheduledRaw) : null;
      const expiresAt = expiresRaw ? Date.parse(expiresRaw) : null;
      if (scheduledRaw && !Number.isFinite(scheduledAt)) throw new Error('Invalid main-feed schedule override.');
      if (expiresRaw && !Number.isFinite(expiresAt)) throw new Error('Invalid main-feed expiry.');
      setMainFeedSchedule(form.get('key'), {
        scheduledAt,
        expiresAt,
        scheduleUrgency: form.get('scheduleUrgency') || 'evergreen',
      }, { actor: 'human' });
      res.writeHead(303, { location: '/?source=queue' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/draft/create') {
      const form = await readForm(req);
      const candidate = getCandidate(form.get('key'));
      if (!candidate) throw new Error('Candidate not found.');
      const requestedPipeline = String(form.get('pipeline') || 'original');
      const pipeline = ['original', 'quote', 'thread'].includes(requestedPipeline) ? requestedPipeline : 'original';
      if (pipeline === 'quote' && candidate.source !== 'x') throw new Error('Quote posts require an X source.');
      saveCandidateToWorkflow(candidate.key, true);
      let draft = getDraftByCandidate(candidate.key);
      const needsInitialGeneration = !draft;
      if (!draft) {
        routeCandidate(candidate.key, pipeline, { actor: 'human' });
        draft = getDraftByCandidate(candidate.key);
      }
      if (needsInitialGeneration && draft) draft = (await generateDraftCandidate(draft)).saved;
      res.writeHead(303, { location: `/?source=drafts&draft=${draft.id}` }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/draft/generate') {
      const form = await readForm(req);
      const current = getDraft(Number(form.get('id')));
      if (!current) throw new Error('Draft not found.');
      const { saved, queueItem } = await generateDraftCandidate(current);
      res.writeHead(303, { location: queueItem?.lane === 'engagement' ? `/?source=engage&draft=${saved.id}` : `/?source=drafts&draft=${saved.id}` }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/draft/preview') {
      const form = await readForm(req);
      const current = getDraft(Number(form.get('id')));
      if (!current) throw new Error('Draft not found.');
      const candidate = getCandidate(current.candidateKey);
      if (!candidate) throw new Error('Draft source candidate not found.');
      const queueItem = getQueueItemByCandidate(candidate.key);
      if (!queueItem) throw new Error('Draft queue item not found.');
      const { updated, pipeline } = draftEditorState(current, queueItem, form);
      const analysis = dashboardDraftScore(candidate, updated, pipeline);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({
        score: analysis.score,
        quality: analysis.quality,
        breakdown: analysis.breakdown,
        weightedLength: analysis.weightedLength,
        gates: analysis.gates,
      }));
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/draft/save') {
      const form = await readForm(req);
      const current = getDraft(Number(form.get('id')));
      if (!current) throw new Error('Draft not found.');
      const candidate = getCandidate(current.candidateKey);
      if (!candidate) throw new Error('Draft source candidate not found.');
      let queueItem = getQueueItemByCandidate(candidate.key);
      if (!queueItem) queueItem = saveCandidateToWorkflow(candidate.key, true).queueItem;
      const { updated, pipeline } = draftEditorState(current, queueItem, form);
      const scheduledRaw = form.get('scheduledAt');
      const scheduledAt = scheduledRaw == null ? current.scheduledAt : (scheduledRaw ? Date.parse(scheduledRaw) : null);
      if (scheduledRaw && !Number.isFinite(scheduledAt)) throw new Error('Invalid schedule time.');
      updated.scheduledAt = scheduledAt;
      const analysis = dashboardDraftScore(candidate, updated, pipeline);
      updated.gates = analysis.gates;
      updated.qualityScore = analysis.score;
      updated.status = current.status === 'published' ? 'published' : 'draft';
      const saved = saveDraft(updated);
      if (current.status !== 'published') routeCandidate(candidate.key, pipeline, { actor: 'human' });
      const nextQueueItem = getQueueItemByCandidate(candidate.key);
      res.writeHead(303, { location: nextQueueItem?.lane === 'engagement' ? `/?source=engage&draft=${saved.id}` : `/?source=drafts&draft=${saved.id}` }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/draft/thread-parts') {
      const form = await readForm(req);
      const current = getDraft(Number(form.get('id')));
      if (!current) throw new Error('Draft not found.');
      const queueItem = getQueueItemByCandidate(current.candidateKey);
      if (queueItem?.pipeline !== 'thread') throw new Error('Thread controls require the thread pipeline.');
      const parts = current.threadParts?.length ? [...current.threadParts] : ['', ''];
      while (parts.length < 2) parts.push('');
      if (form.get('op') === 'add' && parts.length < 6) parts.push('');
      if (form.get('op') === 'remove' && parts.length > 2) parts.pop();
      const saved = saveDraft({
        ...current,
        threadParts: parts,
        editor: { ...(current.editor || {}), pipeline: 'thread', threadParts: [...parts] },
        gates: {},
        status: 'draft',
      });
      routeCandidate(current.candidateKey, 'thread', { actor: 'human' });
      res.writeHead(303, { location: `/?source=drafts&draft=${saved.id}` }); res.end(); return;
    }

    const allowedSources = ['today', 'x', 'viral', 'interesting', 'queue', 'engage', 'drafts', 'opportunities', 'relationships', 'results', 'health', 'audience', 'performance', 'improve', 'experiments', 'learning', 'github', 'hn', 'all', 'advanced'];
    const source = allowedSources.includes(requestUrl.searchParams.get('source')) ? requestUrl.searchParams.get('source') : 'today';
    const tag = Object.hasOwn(NICHE_LABELS, requestUrl.searchParams.get('tag')) ? requestUrl.searchParams.get('tag') : '';
    const relationshipClass = TARGET_CLASSES.includes(requestUrl.searchParams.get('class')) ? requestUrl.searchParams.get('class') : '';
    const relationshipStage = RELATIONSHIP_STAGES.includes(requestUrl.searchParams.get('stage')) ? requestUrl.searchParams.get('stage') : '';
    const draftParam = Number(requestUrl.searchParams.get('draft'));
    const activeDraftId = Number.isInteger(draftParam) && draftParam > 0 ? draftParam : null;
    const html = await renderPage(source, tag, requestUrl.searchParams.get('refresh') === '1', relationshipClass, relationshipStage, activeDraftId);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Dashboard failed: ${error.message}`);
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`[web] X research system: http://localhost:${PORT}`));
