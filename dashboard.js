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
import { composeDraft, scoreDraft, weightedPostLength } from './drafting.js';
import { refreshEngagementOpportunities } from './engagement.js';
import { syncAudience } from './audience.js';
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
  listRelationshipProfiles,
  recordAccountHealthObservation,
  recordPerformanceSnapshot,
  recordUnderTheHoodSnapshot,
  refreshLearnedRuleSuggestion,
  retireLearnedRule,
  saveDraft,
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
  ['results', 'performance', 'Results'],
  ['improve', 'experiments', 'Improve'],
  ['advanced', 'advanced', 'Advanced'],
];

const SOURCE_GROUPS = Object.freeze({
  today: 'today',
  x: 'discover', viral: 'discover', interesting: 'discover', opportunities: 'discover', github: 'discover', hn: 'discover', all: 'discover',
  engage: 'conversations', relationships: 'conversations', audience: 'conversations',
  queue: 'create', drafts: 'create',
  performance: 'results', health: 'results',
  experiments: 'improve', learning: 'improve',
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

function statusLabel(value) {
  return STATUS_LABELS[value] || relationshipLabel(value || 'unknown');
}

function pipelineLabel(value) {
  return PIPELINE_LABELS[value] || relationshipLabel(value || 'unknown');
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
    : `<form method="post" action="/draft/create" class="m-0"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="btn btn-primary btn-sm" type="submit">Create something</button></form>`;

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
      ${candidate.saved ? routeForm(queueItem, candidate.key, returnTo) : ''}
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
  return `<div class="d-flex gap-3 flex-wrap small my-2">
    <label><input class="form-check-input me-1" type="checkbox" name="factualityConfirmed" value="1"> Factuality confirmed</label>
    <label><input class="form-check-input me-1" type="checkbox" name="evidenceConfirmed" value="1"> Evidence confirmed when required</label>
  </div>`;
}

function gatePanel(gates = {}) {
  if (!Object.keys(gates).length) return '<div class="alert alert-secondary py-2">Checks have not been run for this version yet.</div>';
  const failures = (gates.failures || []).map((item) => `<li>${escapeHtml(item.message)}</li>`).join('');
  const warnings = (gates.warnings || []).map((item) => `<li>${escapeHtml(item.message)}</li>`).join('');
  const technical = [...(gates.failures || []), ...(gates.warnings || [])]
    .map((item) => `${item.code}: ${item.message}`).join('\n');
  return `<div class="alert ${gates.passed ? 'alert-success' : 'alert-warning'} py-2 mb-3"><strong>${gates.passed ? 'Ready for approval' : 'Fix before approval'}</strong>${failures ? `<ul class="mb-1 mt-2">${failures}</ul>` : ''}${warnings ? `<div class="small mt-2">Worth checking</div><ul class="mb-0">${warnings}</ul>` : ''}${technical ? `<details class="small mt-2"><summary>Technical check details</summary><pre class="text-wrap mb-0 mt-2">${escapeHtml(technical)}</pre></details>` : ''}</div>`;
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
  const analysis = scoreDraft(draft, candidate);
  const queueItem = getQueueItemByCandidate(candidate.key);
  const pipeline = CONTENT_PIPELINES.has(queueItem?.pipeline) ? queueItem.pipeline : 'original';
  const gatesPassed = draft.gates?.passed === true;
  const engagementReply = queueItem?.lane === 'engagement' && pipeline === 'reply';
  const canReview = CONTENT_PIPELINES.has(pipeline) && ['drafting', 'needs_review'].includes(queueItem?.status);
  const canApprove = queueItem?.status === 'needs_review' && MAIN_FEED_PIPELINES.has(pipeline) && draft.qualityScore >= 40 && gatesPassed;
  const canApproveSend = engagementReply && queueItem?.status === 'needs_review' && draft.qualityScore >= 40 && gatesPassed;
  const canSendApproved = engagementReply && queueItem?.status === 'approved' && Boolean(queueItem.humanApprovedAt) && Boolean(queueItem.approvedText);
  const media = draft.editor?.media || { required: false, type: 'none', reason: '', source: '', altText: '' };
  const editor = draft.editor || {};
  const threadParts = pipeline === 'thread' ? (draft.threadParts?.length ? draft.threadParts : ['', '']) : [];
  const publishEditor = pipeline === 'thread'
    ? threadParts.map((part, index) => `<div class="mb-3"><label class="form-label fw-semibold">Thread part ${index + 1} <span class="text-secondary fw-normal">${weightedPostLength(part)}/280</span></label><textarea class="form-control" rows="4" name="threadPart">${escapeHtml(part)}</textarea></div>`).join('')
    : `<div class="mb-3"><label class="form-label fw-semibold">Final ${escapeHtml(pipeline)} text <span class="text-secondary fw-normal">${weightedPostLength(draft.body)}/280</span></label><textarea class="form-control" rows="5" name="body">${escapeHtml(draft.body)}</textarea></div>`;
  return `<article class="card shadow-sm border-0 mb-4">
    <div class="card-body p-4">
      <div class="d-flex justify-content-between gap-3 flex-wrap mb-3"><div><div class="fw-semibold fs-5">${escapeHtml(candidate.title)}</div><div class="small text-secondary">Content type: <strong>${escapeHtml(pipelineLabel(pipeline))}</strong></div>${workflowBadges(queueItem)}</div><div class="d-flex gap-2 align-items-start"><span class="badge ${draft.qualityScore >= 40 && gatesPassed ? 'text-bg-success' : draft.qualityScore >= 30 ? 'text-bg-warning' : 'text-bg-secondary'} fs-6">Quality ${draft.qualityScore}/50</span><span class="badge text-bg-light border">${escapeHtml(statusLabel(queueItem?.status || draft.status))}</span></div></div>
      ${gatePanel(draft.gates)}
      <form method="post" action="/draft/save">
        <input type="hidden" name="id" value="${draft.id}">
        ${publishEditor}
        <details class="mb-3"><summary class="fw-semibold">Research/editor fields</summary><div class="mt-3"><div class="mb-3"><label class="form-label">Hook</label><textarea class="form-control" rows="2" name="hook">${escapeHtml(draft.hook)}</textarea></div><div class="mb-3"><label class="form-label">Insight</label><textarea class="form-control" rows="3" name="insight">${escapeHtml(draft.insight)}</textarea></div><div class="mb-3"><label class="form-label">Evidence</label><textarea class="form-control" rows="3" name="evidence">${escapeHtml(draft.evidence)}</textarea></div><div class="mb-3"><label class="form-label">Action</label><textarea class="form-control" rows="2" name="action">${escapeHtml(draft.action)}</textarea></div></div></details>
        <div class="card bg-light border-0 mb-3"><div class="card-body"><div class="fw-semibold mb-2">${escapeHtml(mediaLabel(media))}</div><div class="form-check mb-2"><input class="form-check-input" type="checkbox" name="mediaRequired" value="1" id="media-required-${draft.id}" ${media.required ? 'checked' : ''}><label class="form-check-label" for="media-required-${draft.id}">Required for the claim</label></div><div class="row g-2"><div class="col-md-3"><label class="form-label small">Type</label><select class="form-select" name="mediaType">${MEDIA_TYPES.map((type) => `<option value="${type}" ${media.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></div><div class="col-md-9"><label class="form-label small">Reason</label><input class="form-control" name="mediaReason" value="${escapeHtml(media.reason || '')}"></div><div class="col-md-6"><label class="form-label small">Source / local evidence ref</label><input class="form-control" name="mediaSource" value="${escapeHtml(media.source || '')}"></div><div class="col-md-6"><label class="form-label small">Alt text</label><input class="form-control" name="mediaAltText" value="${escapeHtml(media.altText || '')}"></div></div></div></div>
        <div class="small text-secondary mb-3"><strong>Semantic anchors:</strong> ${escapeHtml((editor.semanticAnchors || []).join(', ') || '—')} · <strong>Evidence used:</strong> ${escapeHtml((editor.evidenceUsed || []).join('; ') || '—')} · <strong>Discussion:</strong> ${escapeHtml(editor.discussionQuestion || '—')} · <strong>Follow reason:</strong> ${escapeHtml(editor.followReason || '—')} · <strong>Risk flags:</strong> ${escapeHtml((editor.riskFlags || []).join(', ') || '—')}</div>
        <div class="row g-3 align-items-end"><div class="col-md-5"><div class="small text-secondary">${engagementReply ? 'Engagement replies send immediately only after explicit approval; they are never scheduled.' : 'Main-feed timing is queue-owned after approval. Use Queue → Scheduler to set an explicit human override.'}</div></div><div class="col-md-7 d-flex gap-2 flex-wrap"><button class="btn btn-dark" type="submit">Save & score</button><a class="btn btn-outline-secondary" href="${escapeHtml(candidate.url)}" target="_blank">Source ↗</a></div></div>
      </form>
      ${pipeline === 'thread' ? `<div class="d-flex gap-2 mt-3"><form method="post" action="/draft/thread-parts"><input type="hidden" name="id" value="${draft.id}"><input type="hidden" name="op" value="add"><button class="btn btn-outline-secondary btn-sm" type="submit" ${threadParts.length >= 6 ? 'disabled' : ''}>Add part</button></form><form method="post" action="/draft/thread-parts"><input type="hidden" name="id" value="${draft.id}"><input type="hidden" name="op" value="remove"><button class="btn btn-outline-secondary btn-sm" type="submit" ${threadParts.length <= 2 ? 'disabled' : ''}>Remove last</button></form></div>` : ''}
      <div class="d-flex gap-3 flex-wrap mt-3 align-items-end">${canReview ? `<form method="post" action="/queue/review"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}">${confirmationFields()}<button class="btn btn-outline-primary btn-sm" type="submit">${queueItem.status === 'needs_review' ? 'Recheck hard gates' : 'Request review'}</button></form>` : ''}${canApprove ? `<form method="post" action="/queue/approve"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}">${confirmationFields()}<button class="btn btn-success btn-sm" type="submit">Approve for publishing</button></form>` : ''}${canApproveSend ? `<form method="post" action="/engage/approve-send"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}">${confirmationFields()}<button class="btn btn-success btn-sm" type="submit">Approve &amp; send exact reply</button></form>` : ''}${canSendApproved ? `<form method="post" action="/engage/send"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="btn btn-success btn-sm" type="submit">Send approved reply</button></form>` : ''}${queueItem?.status === 'approved' ? `<span class="badge text-bg-success align-self-center">${engagementReply ? 'Exact reply approved' : 'Approved · compatibility draft ready'}</span>` : ''}</div>
      ${queueItem?.status === 'needs_review' && (MAIN_FEED_PIPELINES.has(pipeline) || engagementReply) && !(canApprove || canApproveSend) ? `<div class="alert alert-warning py-2 mt-3 mb-0">Approval blocked until score is ≥40 and the saved hard-gate result passes. Recheck gates after explicit human confirmations or content edits.</div>` : ''}
      <hr><div class="small text-secondary">Rubric: niche ${analysis.breakdown.niche}/10 · hook ${analysis.breakdown.hook}/8 · insight ${analysis.breakdown.insight}/10 · evidence ${analysis.breakdown.evidence}/10 · action ${analysis.breakdown.action}/7 · originality ${analysis.breakdown.originality}/5. Hard-gate failures always override the numeric score.</div>
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

function audienceView(error = null) {
  if (error) return `<div class="alert alert-warning">Audience refresh failed: ${escapeHtml(error)}</div>`;
  const summary = getAudienceSummary();
  const targets = listAudienceProfiles({ youFollow: true, followsYou: false, minScore: 12, limit: 40 });
  const relevantFollowers = listAudienceProfiles({ followsYou: true, minScore: 12, limit: 20 });
  const stats = `<div class="row g-3 mb-4">
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Observed followers</div><div class="fs-3 fw-semibold">${formatNumber(summary.followers)}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Niche followers</div><div class="fs-3 fw-semibold">${formatNumber(summary.relevant_followers)}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Niche following</div><div class="fs-3 fw-semibold">${formatNumber(summary.relevant_following)}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Relevant followed accounts</div><div class="fs-3 fw-semibold">${formatNumber(summary.target_accounts)}</div></div></div></div>
  </div>`;
  const profileCards = (profiles, title, note) => `<h2 class="h5 mt-4">${escapeHtml(title)}</h2><p class="text-secondary small">${escapeHtml(note)}</p>${profiles.map((profile) => `<div class="card border-0 shadow-sm mb-2"><div class="card-body py-3">
    <div class="d-flex justify-content-between gap-3 flex-wrap"><div><div class="fw-semibold">${escapeHtml(profile.displayName || profile.username)} <span class="text-secondary">@${escapeHtml(profile.username)}</span></div><div class="small text-secondary">${escapeHtml(profile.bio)}</div></div><div class="d-flex gap-2 align-items-start flex-wrap"><span class="badge text-bg-primary">fit ${profile.relevanceScore}/50</span><a class="btn btn-outline-secondary btn-sm" href="https://x.com/${encodeURIComponent(profile.username)}" target="_blank">Open profile ↗</a></div></div>
    <div class="d-flex gap-1 flex-wrap mt-2">${profile.nicheTags.map((tag) => `<span class="badge text-bg-light border">${escapeHtml(NICHE_LABELS[tag] || tag)}</span>`).join('')}</div>
  </div></div>`).join('') || '<div class="alert alert-secondary">No matching profiles in the current snapshot.</div>'}`;
  return stats
    + profileCards(targets, 'Observed followed accounts', 'Raw audience observations for relevant accounts you follow that do not currently follow you. Strategic classes and stages live in Relationships.')
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

function experimentsView() {
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

function learningView(overview = getLearningOverview()) {
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
    ? reasons.map((reason) => `<li><strong>${escapeHtml(relationshipLabel(reason.code))}</strong> — ${escapeHtml(reason.message)} <span class="text-secondary">(${escapeHtml(reason.evidence || '')})</span></li>`).join('')
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
    ? `<div class="small text-secondary mt-2">${escapeHtml(opportunityLabel(profile.targetScore))} relationship fit · ${escapeHtml(relationshipLabel(profile.relationshipStage))}</div>`
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

function engageView(error = null) {
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
  return warning + healthBanner
    + group('Active conversations', 'Observed replies/quotes to our existing posts or replies are shown before cold opportunities.', active)
    + group('New opportunities', 'Fresh target posts and reply-suitable research candidates with a concrete proposed contribution.', cold);
}

const QUEUE_GROUPS = ['triage', 'researching', 'drafting', 'needs_review', 'approved', 'publishing', 'failed', 'published', 'watching'];

function queueCard(queueItem, scheduleContextValue) {
  if (!queueItem.recommendedPipeline) queueItem = refreshQueueRecommendation(queueItem.candidateKey).queueItem;
  const snapshot = inspectWorkflow(queueItem.candidateKey);
  const candidate = snapshot.candidate;
  const draft = snapshot.draft;
  const analysis = draft ? scoreDraft(draft, candidate) : null;
  const mainFeedReview = queueItem.status === 'needs_review' && [...MAIN_FEED_PIPELINES, 'repost'].includes(queueItem.pipeline);
  const canApprove = mainFeedReview && (queueItem.pipeline === 'repost' || (draft?.qualityScore >= 40 && draft?.gates?.passed === true));
  const canRequestReview = CONTENT_PIPELINES.has(queueItem.pipeline) && ['drafting', 'needs_review'].includes(queueItem.status);
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
  const primaryQueueAction = canApprove ? approveAction : canRequestReview ? reviewAction : draftAction;
  const secondaryDraftAction = (canApprove || canRequestReview) && draft ? `<a class="btn btn-outline-primary btn-sm" href="/?source=drafts&draft=${draft.id}">Edit draft</a>` : '';
  return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4">
    <div class="d-flex justify-content-between gap-3 flex-wrap">
      <div><div class="fw-semibold fs-5">${escapeHtml(candidate.title)}</div><div class="small text-secondary">${escapeHtml(candidate.source.toUpperCase())} · ${escapeHtml(pipelineLabel(queueItem.pipeline))} · ${escapeHtml(statusLabel(queueItem.status))}</div></div>
      <a class="btn btn-outline-secondary btn-sm align-self-start" href="${escapeHtml(candidate.url)}" target="_blank">Source ↗</a>
    </div>
    <p class="mt-3 mb-2 text-break">${escapeHtml(candidate.text)}</p>
    ${workflowBadges(queueItem)}
    <div class="small mt-2"><strong>Suggested use:</strong> ${escapeHtml(pipelineLabel(queueItem.recommendedPipeline || 'triage'))} <span class="text-secondary">— ${escapeHtml(queueItem.routingReason || 'No recommendation stored.')}</span></div>
    ${publicationState}
    ${routeForm(queueItem, candidate.key, returnTo)}
    ${draft ? gatePanel(draft.gates) : ''}
    ${schedulePanel(queueItem, scheduleContextValue)}
    ${primaryQueueAction ? `<div class="mt-3">${primaryQueueAction}</div>` : ''}
    <details class="small mt-3"><summary>Why this recommendation?</summary><div class="text-secondary mt-2">Reach: freshness ${breakdown.reach.freshness}, momentum ${breakdown.reach.momentum}, traction ${breakdown.reach.traction}, breadth ${breakdown.reach.breadth} · Follow: niche ${breakdown.follow.niche}, preference ${breakdown.follow.preference}, specificity ${breakdown.follow.specificity}, utility ${breakdown.follow.utility}, identity ${breakdown.follow.identity} · Conversation: discussion ${breakdown.conversation.discussion}, tradeoff ${breakdown.conversation.questionTradeoff}, freshness ${breakdown.conversation.freshness}, specificity ${breakdown.conversation.specificity} · Relationship: ${breakdown.relationship.available ? `relevance ${breakdown.relationship.relevance}, follows ${breakdown.relationship.followsYou}, following ${breakdown.relationship.youFollow}, mutual ${breakdown.relationship.mutual}, topic ${breakdown.relationship.topicOverlap}` : 'no observed relationship context'}</div></details>
    ${secondaryDraftAction ? `<details class="small mt-3"><summary>More actions</summary><div class="mt-2">${secondaryDraftAction}</div></details>` : ''}
    ${mainFeedReview && !canApprove ? `<div class="alert alert-warning py-2 mt-3 mb-0">Not ready for approval yet. ${draft ? 'Open the draft to fix the checks or complete the required confirmations.' : 'Create a draft first.'}</div>` : ''}
  </div></article>`;
}

function queueView() {
  const items = listQueueItems({ lane: 'main', limit: 250 });
  const context = schedulerContext();
  return QUEUE_GROUPS.map((status) => {
    const group = items.filter((item) => item.status === status);
    if (!group.length) return '';
    return `<h2 class="h5 mt-4">${escapeHtml(statusLabel(status))} <span class="badge text-bg-light border">${group.length}</span></h2>${group.map((item) => queueCard(item, context)).join('')}`;
  }).join('') || '<div class="alert alert-secondary">No active workflow items.</div>';
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
  return PRIMARY_NAV.map(([group, source, label]) => `<a class="btn btn-sm ${activeGroup === group ? 'btn-dark' : 'btn-outline-secondary'}" href="/?source=${source}">${escapeHtml(label)}</a>`).join('');
}

function secondaryNavigation(activeSource, savedCount) {
  const group = sourceGroup(activeSource);
  const items = {
    discover: [['x', 'For you'], ['viral', 'Trending'], ['interesting', `Saved (${savedCount})`], ['opportunities', 'Opportunities'], ['github', 'GitHub'], ['hn', 'Hacker News'], ['all', 'All sources']],
    conversations: [['engage', 'What needs a reply'], ['relationships', 'People & relationships'], ['audience', 'Audience']],
    create: [['queue', 'To review'], ['drafts', 'Drafts']],
    results: [['performance', 'Performance'], ['health', 'Account status']],
    improve: [['experiments', 'Tests'], ['learning', "What we've learned"]],
  }[group] || [];
  if (!items.length) return '';
  return `<div class="d-flex gap-2 flex-wrap mt-2">${items.map(([source, label]) => `<a class="btn btn-sm ${activeSource === source ? 'btn-primary' : 'btn-outline-primary'}" href="/?source=${source}">${escapeHtml(label)}</a>`).join('')}</div>`;
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

async function renderPage(activeSource = 'today', activeTag = '', forceRefresh = false, relationshipClass = '', relationshipStage = '') {
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
  const performance = activeSource === 'performance' ? getPerformanceSnapshot(30) : null;
  const accountHealth = ['today', 'health', 'engage'].includes(activeSource) ? getAccountHealthSummary() : null;
  const learningOverview = activeSource === 'learning' ? getLearningOverview() : null;

  let decision;
  if (refreshError) decision = `Research refresh failed: ${refreshError}`;
  else if (activeSource === 'today') decision = 'Your most important human decisions, in one place.';
  else if (activeSource === 'viral') decision = `${visible.length} viral/rising developer signals from the rolling last 24 hours.`;
  else if (activeSource === 'interesting') decision = `${visible.length} saved signals in your persistent research memory.`;
  else if (activeSource === 'queue') decision = `${countQueueItems({ status: 'triage', lane: 'main' })} need a content choice · ${countQueueItems({ status: 'needs_review', lane: 'main' })} need review · ${countQueueItems({ status: 'approved', lane: 'main' })} approved.`;
  else if (activeSource === 'drafts') decision = `${drafts.length} drafts · ${drafts.filter((draft) => draft.status === 'ready').length} approved.`;
  else if (activeSource === 'engage') {
    const engagementItems = listEngagementItems({ limit: 200 });
    const activeCount = engagementItems.filter((item) => item.engagementKind !== 'initial_reply').length;
    decision = engagementError ? `Engage refresh failed: ${engagementError}` : `${activeCount} active conversations · ${engagementItems.length - activeCount} new opportunities.`;
  }
  else if (activeSource === 'opportunities') decision = `${visible.length} job, builder, SaaS, and productization opportunities from recent research.`;
  else if (activeSource === 'performance') decision = `Recent account and post results for @${ACCOUNT}.`;
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
  const returnTo = `/?source=${encodeURIComponent(activeSource)}${activeTag ? `&tag=${encodeURIComponent(activeTag)}` : ''}${relationshipQuery}`;
  const filtersEnabled = ['x', 'viral', 'interesting', 'opportunities'].includes(activeSource);
  const nav = primaryNavigation(activeSource);
  const secondaryNav = secondaryNavigation(activeSource, savedCount);
  const [sectionTitle, sectionDescription] = sectionMeta(activeSource);

  let content;
  if (activeSource === 'today') content = todayView({ now: scheduleNow, nextScheduled, accountHealth });
  else if (activeSource === 'advanced') content = advancedView();
  else if (activeSource === 'queue') content = queueView();
  else if (activeSource === 'engage') content = engageView(engagementError);
  else if (activeSource === 'drafts') content = drafts.map(draftCard).join('') || '<div class="alert alert-secondary">No drafts yet. Route a saved source to Original, Quote, Thread, or Reply.</div>';
  else if (activeSource === 'performance') content = performanceView(performance, performanceError);
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
    <title>${escapeHtml(sectionTitle)} · Growth workspace</title><link rel="stylesheet" href="/assets/bootstrap.min.css">
  </head><body class="bg-body-tertiary">
    <div class="sticky-top bg-body-tertiary border-bottom shadow-sm"><div class="container py-3">
      <div class="d-flex justify-content-between gap-3 flex-wrap align-items-start mb-2">
        <div><div class="small text-secondary">Growth workspace</div><div class="fw-semibold">${escapeHtml(sectionTitle)}</div><div class="text-secondary small">${escapeHtml(sectionDescription)} ${escapeHtml(decision)}</div></div>
        <div class="d-flex gap-2 align-items-center flex-wrap">${refreshControl}<span class="badge ${AUTO_POST ? 'text-bg-danger' : 'text-bg-secondary'}">Main-feed automation ${AUTO_POST ? 'ON' : 'OFF'}</span>${nextScheduled ? `<span class="badge text-bg-success">Next post ${nextScheduled.recommendedAt <= scheduleNow ? 'ready now' : escapeHtml(new Date(nextScheduled.recommendedAt).toLocaleString())}</span>` : ''}</div>
      </div>
      <nav aria-label="Primary" class="d-flex gap-2 flex-wrap">${nav}</nav>
      ${secondaryNav ? `<nav aria-label="Section" class="border-top pt-2 mt-2">${secondaryNav}</nav>` : ''}
      ${filtersEnabled ? `<div class="d-flex gap-2 flex-wrap mt-2"><a class="badge rounded-pill ${!activeTag ? 'text-bg-dark' : 'text-bg-light border text-dark'} text-decoration-none" href="/?source=${escapeHtml(activeSource)}">All topics</a>${Object.entries(NICHE_LABELS).map(([tag, label]) => `<a class="badge rounded-pill ${activeTag === tag ? 'text-bg-primary' : 'text-bg-light border text-dark'} text-decoration-none" href="/?source=${escapeHtml(activeSource)}&tag=${encodeURIComponent(tag)}">${escapeHtml(label)}</a>`).join('')}</div>` : ''}
    </div></div>
    <main class="container py-4">${content}</main>
    <script src="/assets/bootstrap.bundle.min.js"></script>
  </body></html>`;
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
      res.writeHead(303, { location: queueItem?.lane === 'engagement' ? '/?source=engage' : '/?source=drafts' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/engage/draft') {
      const form = await readForm(req);
      const key = form.get('key');
      routeCandidate(key, 'reply', { actor: 'human' });
      const draft = getDraftByCandidate(key);
      res.writeHead(303, { location: draft ? `/?source=drafts&draft=${draft.id}` : '/?source=engage' }); res.end(); return;
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
      recordAccountHealthObservation({
        type,
        severity: String(form.get('severity') || 'info'),
        source,
        sourceRef,
        observedAt: Date.now(),
        metadata: { label: label || undefined, note: String(form.get('note') || '').trim() },
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
      createExperiment({
        name: form.get('name'),
        hypothesis: form.get('hypothesis'),
        dimension: form.get('dimension'),
        population,
        primaryMetric: form.get('primaryMetric'),
        secondaryMetrics: String(form.get('secondaryMetrics') || '').split(',').map((value) => value.trim()).filter(Boolean),
        variants: String(form.get('variants') || '').split(',').map((value) => value.trim()).filter(Boolean),
        minimumCompletedPerVariant: Number(form.get('minimumCompletedPerVariant')),
        status: form.get('status') || 'draft',
      });
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
      saveCandidateToWorkflow(candidate.key, true);
      let draft = getDraftByCandidate(candidate.key);
      const queueItem = getQueueItemByCandidate(candidate.key);
      if (!draft) {
        routeCandidate(candidate.key, queueItem?.pipeline && ['original', 'quote', 'thread', 'reply'].includes(queueItem.pipeline) ? queueItem.pipeline : 'original', { actor: 'human' });
        draft = getDraftByCandidate(candidate.key);
      }
      res.writeHead(303, { location: `/?source=drafts&draft=${draft.id}` }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/draft/save') {
      const form = await readForm(req);
      const current = getDraft(Number(form.get('id')));
      if (!current) throw new Error('Draft not found.');
      const candidate = getCandidate(current.candidateKey);
      if (!candidate) throw new Error('Draft source candidate not found.');
      let queueItem = getQueueItemByCandidate(candidate.key);
      if (!queueItem) queueItem = saveCandidateToWorkflow(candidate.key, true).queueItem;
      const pipeline = CONTENT_PIPELINES.has(queueItem.pipeline) ? queueItem.pipeline : 'original';
      const scheduledRaw = form.get('scheduledAt');
      const scheduledAt = scheduledRaw == null ? current.scheduledAt : (scheduledRaw ? Date.parse(scheduledRaw) : null);
      if (scheduledRaw && !Number.isFinite(scheduledAt)) throw new Error('Invalid schedule time.');
      const mediaType = form.get('mediaType') || 'none';
      if (!MEDIA_TYPES.includes(mediaType)) throw new Error(`Invalid media type: ${mediaType}`);
      const updated = {
        ...current,
        hook: form.get('hook') || '',
        insight: form.get('insight') || '',
        evidence: form.get('evidence') || '',
        action: form.get('action') || '',
        scheduledAt,
        gates: {},
        editor: {
          ...(current.editor || {}),
          pipeline,
          media: {
            required: form.get('mediaRequired') === '1',
            type: mediaType,
            reason: form.get('mediaReason') || '',
            source: form.get('mediaSource') || '',
            altText: form.get('mediaAltText') || '',
          },
        },
      };
      if (pipeline === 'thread') {
        updated.threadParts = form.getAll('threadPart').map((part) => String(part));
        updated.body = '';
        updated.editor.threadParts = [...updated.threadParts];
      } else {
        updated.body = form.get('body') ?? composeDraft(updated, { pipeline });
        updated.editor.finalText = updated.body;
      }
      const analysis = scoreDraft(updated, candidate);
      updated.qualityScore = analysis.score;
      updated.status = current.status === 'published' ? 'published' : 'draft';
      const saved = saveDraft(updated);
      if (current.status !== 'published') routeCandidate(candidate.key, pipeline, { actor: 'human' });
      res.writeHead(303, { location: `/?source=drafts&draft=${saved.id}` }); res.end(); return;
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

    const allowedSources = ['today', 'x', 'viral', 'interesting', 'queue', 'engage', 'drafts', 'opportunities', 'relationships', 'health', 'audience', 'performance', 'experiments', 'learning', 'github', 'hn', 'all', 'advanced'];
    const source = allowedSources.includes(requestUrl.searchParams.get('source')) ? requestUrl.searchParams.get('source') : 'today';
    const tag = Object.hasOwn(NICHE_LABELS, requestUrl.searchParams.get('tag')) ? requestUrl.searchParams.get('tag') : '';
    const relationshipClass = TARGET_CLASSES.includes(requestUrl.searchParams.get('class')) ? requestUrl.searchParams.get('class') : '';
    const relationshipStage = RELATIONSHIP_STAGES.includes(requestUrl.searchParams.get('stage')) ? requestUrl.searchParams.get('stage') : '';
    const html = await renderPage(source, tag, requestUrl.searchParams.get('refresh') === '1', relationshipClass, relationshipStage);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Dashboard failed: ${error.message}`);
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`[web] X research system: http://localhost:${PORT}`));
