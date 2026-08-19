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
  candidateKey,
  countQueueItems,
  countSavedCandidates,
  getAccountHealthSummary,
  getAudienceSummary,
  getCandidate,
  getDraft,
  getDraftByCandidate,
  getMainFeedScheduleItem,
  getPerformanceSnapshot,
  getPreferenceProfile,
  getQueueItemByCandidate,
  getRelationshipProfile,
  getRelationshipSummary,
  listAudienceProfiles,
  listCandidateActions,
  listCandidates,
  listDrafts,
  listEngagementItems,
  listApprovedMainFeedItems,
  listQueueItems,
  listRecentMainFeedPublications,
  listRelationshipProfiles,
  recordAccountHealthObservation,
  recordPerformanceSnapshot,
  recordUnderTheHoodSnapshot,
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
  return `${tags ? `<div class="d-flex flex-wrap gap-2 mb-2">${tags}<span class="badge text-bg-success">fit ${candidate.niche.score}/50</span></div>` : ''}${matches ? `<div class="d-flex flex-wrap gap-1 mb-3">${matches}</div>` : ''}`;
}

function viralBadges(candidate) {
  if (!candidate.viral) return '';
  const tierClass = candidate.viral.tier === 'breakout' ? 'text-bg-danger' : candidate.viral.tier === 'viral' ? 'text-bg-warning' : 'text-bg-info';
  return `<div class="d-flex flex-wrap gap-2 mb-3">
    <span class="badge ${tierClass}">${escapeHtml(candidate.viral.tier.toUpperCase())}</span>
    <span class="badge text-bg-light border">${candidate.viral.ageHours.toFixed(1)}h old</span>
    <span class="badge text-bg-light border">${formatNumber(Math.round(candidate.viral.viewsPerHour))} views/h</span>
    <span class="badge text-bg-light border">${candidate.viral.engagementsPerHour.toFixed(1)} engagement/h</span>
  </div>`;
}

const ROUTE_OPTIONS = [
  ['original', 'Original'], ['quote', 'Quote'], ['thread', 'Thread'], ['reply', 'Reply'],
  ['repost', 'Repost'], ['research', 'Research only'], ['watch', 'Watch'], ['ignore', 'Ignore'],
];

function workflowBadges(queueItem) {
  if (!queueItem) return '';
  return `<div class="d-flex gap-1 flex-wrap mt-2">
    <span class="badge text-bg-light border">Reach ${Math.round(queueItem.reachPotential)}</span>
    <span class="badge text-bg-light border">Follow ${Math.round(queueItem.followPotential)}</span>
    <span class="badge text-bg-light border">Conversation ${Math.round(queueItem.conversationPotential)}</span>
    <span class="badge text-bg-light border">Relationship ${Math.round(queueItem.relationshipPotential)}</span>
    <span class="badge text-bg-secondary">${escapeHtml(queueItem.pipeline)}</span>
    <span class="badge text-bg-light border">${escapeHtml(queueItem.status)}</span>
  </div>`;
}

function routeForm(queueItem, key, returnTo) {
  if (!queueItem) return '';
  const selected = queueItem.pipeline === 'triage' ? queueItem.recommendedPipeline : queueItem.pipeline;
  const options = ROUTE_OPTIONS.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  return `<form method="post" action="/queue/route" class="d-flex gap-2 align-items-center flex-wrap mt-3">
    <input type="hidden" name="key" value="${escapeHtml(key)}">
    <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
    <select class="form-select form-select-sm" style="width:auto" name="pipeline">${options}</select>
    <button class="btn btn-outline-dark btn-sm" type="submit">Route</button>
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
    ? `<div class="small mt-2"><strong>Recommended:</strong> ${escapeHtml(queueItem.recommendedPipeline)} · <span class="text-secondary">${escapeHtml(queueItem.routingReason)}</span></div>`
    : '';

  return `<article class="card shadow-sm border-0 mb-3">
    <div class="card-body p-4">
      <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
        <div>
          <div class="fw-semibold fs-5">#${index + 1} ${escapeHtml(candidate.title)}</div>
          <div class="text-secondary small">${escapeHtml(candidate.source.toUpperCase())}${candidate.timestamp ? ` · ${escapeHtml(new Date(candidate.timestamp).toLocaleString())}` : ''}</div>
        </div>
        <span class="badge text-bg-dark fs-6">${candidate.viral ? 'viral ' : ''}${Math.round(candidate.viral?.score ?? candidate.score)}/100</span>
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
          <form method="post" action="/candidate/save" class="m-0">
            <input type="hidden" name="key" value="${escapeHtml(candidate.key)}">
            <input type="hidden" name="saved" value="${candidate.saved ? '0' : '1'}">
            <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
            <button class="btn ${candidate.saved ? 'btn-outline-success' : 'btn-dark'} btn-sm" type="submit">${candidate.saved ? 'Unsave' : 'Save'}</button>
          </form>
          <form method="post" action="/draft/create" class="m-0">
            <input type="hidden" name="key" value="${escapeHtml(candidate.key)}">
            <button class="btn btn-outline-primary btn-sm" type="submit">${draft ? 'Open draft' : 'Create draft'}</button>
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
  if (!Object.keys(gates).length) return '<div class="alert alert-secondary py-2">Hard gates have not been reviewed for the current edit.</div>';
  const failures = (gates.failures || []).map((item) => `<li><strong>${escapeHtml(item.code)}</strong> — ${escapeHtml(item.message)}</li>`).join('');
  const warnings = (gates.warnings || []).map((item) => `<li><strong>${escapeHtml(item.code)}</strong> — ${escapeHtml(item.message)}</li>`).join('');
  return `<div class="alert ${gates.passed ? 'alert-success' : 'alert-warning'} py-2 mb-3"><strong>Hard gates: ${gates.passed ? 'pass' : 'blocked'}</strong>${failures ? `<ul class="mb-1 mt-2">${failures}</ul>` : ''}${warnings ? `<div class="small mt-2">Warnings</div><ul class="mb-0">${warnings}</ul>` : ''}</div>`;
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
  const recommended = decision.recommendedAt == null ? 'blocked' : new Date(decision.recommendedAt).toLocaleString();
  const manualOnly = queueItem.pipeline === 'repost'
    ? '<div class="alert alert-secondary py-2 mb-2">Repost is scheduler-visible but remains manual; daemon transport is not enabled for repost.</div>'
    : '';
  return `<div class="card bg-light border-0 mt-3"><div class="card-body">
    <div class="d-flex justify-content-between gap-2 flex-wrap mb-2"><div><strong>Scheduler</strong> · ${escapeHtml(recommended)}</div><span class="badge ${decision.eligible ? 'text-bg-primary' : 'text-bg-warning'}">priority ${escapeHtml(decision.priority)}</span></div>
    <div class="small mb-2">${escapeHtml(decision.reason)}</div>
    ${scheduleIssueList(decision.blockers)}${scheduleIssueList(decision.warnings)}${scheduleIssueList(decision.conflicts)}
    <div class="small text-secondary mb-2">Timing assumptions are <strong>EMPIRICAL_VARIABLE</strong> coverage heuristics, not X platform enforcement rules.</div>
    ${manualOnly}
    <form method="post" action="/queue/schedule" class="row g-2 align-items-end">
      <input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}">
      <div class="col-md-3"><label class="form-label small">Urgency</label><select class="form-select" name="scheduleUrgency">${['evergreen', 'timely', 'viral'].map((value) => `<option value="${value}" ${queueItem.scheduleUrgency === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
      <div class="col-md-3"><label class="form-label small">Expiry</label><input class="form-control" type="datetime-local" name="expiresAt" value="${escapeHtml(formatDateTime(queueItem.expiresAt))}"></div>
      <div class="col-md-4"><label class="form-label small">Human schedule override</label><input class="form-control" type="datetime-local" name="scheduledAt" value="${escapeHtml(formatDateTime(queueItem.scheduledAt))}"></div>
      <div class="col-md-2"><button class="btn btn-outline-primary w-100" type="submit">Save timing</button></div>
      <div class="col-12 small text-secondary">${queueItem.scheduleSource === 'human' ? 'Explicit human override stored. Clear the time to return timing to the scheduler.' : 'No human time override; scheduler recommendation is advisory.'}</div>
    </form>
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
      <div class="d-flex justify-content-between gap-3 flex-wrap mb-3"><div><div class="fw-semibold fs-5">${escapeHtml(candidate.title)}</div><div class="small text-secondary">Pipeline: <strong>${escapeHtml(pipeline)}</strong></div>${workflowBadges(queueItem)}</div><div class="d-flex gap-2 align-items-start"><span class="badge ${draft.qualityScore >= 40 && gatesPassed ? 'text-bg-success' : draft.qualityScore >= 30 ? 'text-bg-warning' : 'text-bg-secondary'} fs-6">${escapeHtml(analysis.quality)} ${draft.qualityScore}/50</span><span class="badge text-bg-light border">Draft ${escapeHtml(draft.status)}</span></div></div>
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
  return summary + (posts || '<div class="alert alert-secondary">No recent post metrics.</div>');
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
    return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4">
      <div class="d-flex justify-content-between gap-3 flex-wrap"><div><div class="fw-semibold fs-5">${escapeHtml(profile.displayName || profile.username)} <span class="text-secondary">@${escapeHtml(profile.username)}</span></div><div class="small text-secondary mt-1">${escapeHtml(profile.bio || '')}</div></div><div class="text-end"><div class="fs-4 fw-semibold">${Math.round(profile.targetScore)}</div><div class="small text-secondary">TargetScore</div></div></div>
      <div class="d-flex gap-1 flex-wrap mt-3">${profile.classes.map((value) => `<span class="badge text-bg-primary text-capitalize">${escapeHtml(relationshipLabel(value))}</span>`).join('') || '<span class="badge text-bg-light border">unclassified</span>'}<span class="badge text-bg-secondary text-capitalize">${escapeHtml(relationshipLabel(profile.relationshipStage))}</span><span class="badge text-bg-light border">${escapeHtml(followState)}</span></div>
      <div class="d-flex gap-1 flex-wrap mt-2">${relationshipComponentBadge(profile, 'topicFit', 'Topic')}${relationshipComponentBadge(profile, 'audienceOverlap', 'Audience')}${relationshipComponentBadge(profile, 'conversationQuality', 'Conversation')}${relationshipComponentBadge(profile, 'replyVisibility', 'Visibility')}${relationshipComponentBadge(profile, 'relationshipPotential', 'Relationship')}<span class="badge text-bg-light border">Reach ${profile.reachModifier >= 0 ? '+' : ''}${escapeHtml(profile.reachModifier)}</span></div>
      <div class="small text-secondary mt-2">${profile.meaningfulInteractions} meaningful outbound · ${profile.theirRepliesToUs} target replies · last response ${profile.lastResponseAt ? escapeHtml(formatDateTime(profile.lastResponseAt)) : 'none yet'}</div>
      ${topics.length ? `<div class="d-flex gap-1 flex-wrap mt-2">${topics.map((topic) => `<span class="badge text-bg-light border">${escapeHtml(topic)}</span>`).join('')}</div>` : ''}
      ${reasons.length ? `<div class="small mt-3"><strong>Why this target:</strong> ${escapeHtml(reasons.join(' '))}</div>` : ''}
      ${missing.length ? `<div class="small text-secondary mt-1">Missing score evidence: ${escapeHtml(missing.map(relationshipLabel).join(', '))}; available components are renormalized.</div>` : ''}
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
  const relationshipBadges = profile
    ? `<div class="d-flex gap-1 flex-wrap mt-2">${(profile.classes || []).map((value) => `<span class="badge text-bg-primary text-capitalize">${escapeHtml(relationshipLabel(value))}</span>`).join('')}<span class="badge text-bg-secondary text-capitalize">${escapeHtml(relationshipLabel(profile.relationshipStage))}</span><span class="badge text-bg-light border">TargetScore ${Math.round(profile.targetScore)}</span></div>`
    : '<div class="small text-secondary mt-2">Relationship profile unavailable.</div>';
  const canReview = draft && ['drafting', 'needs_review', 'failed'].includes(queueItem.status);
  const canApproveSend = !currentConstrained && queueItem.status === 'needs_review' && draft?.qualityScore >= 40 && draft?.gates?.passed === true;
  const approved = !currentConstrained && queueItem.status === 'approved' && Boolean(queueItem.humanApprovedAt) && Boolean(queueItem.approvedText);
  const contribution = queueItem.contributionSummary || score.contribution?.summary || '';
  const archetype = queueItem.replyArchetype || score.contribution?.archetype || '';
  const components = score.components || {};

  return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4">
    <div class="d-flex justify-content-between gap-3 flex-wrap"><div><div class="fw-semibold fs-5">@${escapeHtml(queueItem.targetUsername || profile?.username || 'unknown')} · ${escapeHtml(relationshipLabel(queueItem.engagementKind || 'initial_reply'))}</div><div class="small text-secondary">${escapeHtml(ageLabel)} · expires ${escapeHtml(expiryLabel)}${activeOverride ? ' · active conversation override' : ''} · ${escapeHtml(queueItem.status)}</div></div><div class="text-end"><div class="fs-4 fw-semibold">${Math.round(queueItem.priority)}</div><div class="small text-secondary">EngagePriority</div></div></div>
    ${relationshipBadges}
    <div class="d-flex gap-1 flex-wrap mt-2"><span class="badge text-bg-light border">Conversation ${Math.round(Number(queueItem.conversationPotential || components.conversationPotential || 0))}</span><span class="badge text-bg-light border">Relationship ${Math.round(Number(queueItem.relationshipPotential || components.relationshipPotential || 0))}</span><span class="badge text-bg-light border">Freshness ${Math.round(Number(components.freshness || 0))}</span><span class="badge text-bg-light border">Visibility ${Math.round(Number(components.replyVisibility || 0))}</span><span class="badge text-bg-light border">Contribution ${Math.round(Number(components.contributionStrength || 0))}</span></div>
    <div class="mt-3"><strong>Contribution:</strong> <span class="badge text-bg-info">${escapeHtml(relationshipLabel(archetype))}</span> ${escapeHtml(contribution || 'No contribution stored.')}</div>
    <div class="card bg-light border-0 mt-3"><div class="card-body"><div class="small text-secondary mb-1">Exact source</div><div class="text-break">${escapeHtml(candidate.text)}</div></div></div>
    ${draft ? `<div class="mt-3">${gatePanel(draft.gates)}<div class="small text-secondary">Draft ${draft.qualityScore}/50 · ${escapeHtml(draft.status)}</div><div class="mt-2 text-break">${escapeHtml(draft.body || '')}</div></div>` : ''}
    ${pressureWarning}
    ${repetitionWarning}
    ${hardHealthWarning}
    ${(score.rejectionReasons || []).length ? `<div class="alert alert-danger py-2 mt-3 mb-0">${escapeHtml(score.rejectionReasons.map((item) => item.code || item.reason).join(', '))}</div>` : ''}
    <div class="d-flex gap-2 flex-wrap mt-3 align-items-end">
      <form method="post" action="/engage/draft"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}"><button class="btn btn-outline-primary btn-sm" type="submit">${draft ? 'Edit reply' : 'Draft reply'}</button></form>
      ${canReview ? `<form method="post" action="/queue/review"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}">${confirmationFields()}<button class="btn btn-outline-primary btn-sm" type="submit">${queueItem.status === 'needs_review' ? 'Recheck review gates' : 'Request review'}</button></form>` : ''}
      ${canApproveSend ? `<form method="post" action="/engage/approve-send"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}">${confirmationFields()}<button class="btn btn-success btn-sm" type="submit">Approve &amp; send exact reply</button></form>` : ''}
      ${approved ? `<form method="post" action="/engage/send"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}"><button class="btn btn-success btn-sm" type="submit">Send approved reply</button></form>` : ''}
      ${queueItem.engagementKind === 'initial_reply' ? `<form method="post" action="/engage/quote"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}"><button class="btn btn-outline-secondary btn-sm" type="submit">Quote instead</button></form>` : ''}
      <form method="post" action="/engage/resolve"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}"><input type="hidden" name="action" value="ignore"><button class="btn btn-outline-secondary btn-sm" type="submit">Ignore</button></form>
      <form method="post" action="/engage/resolve"><input type="hidden" name="key" value="${escapeHtml(queueItem.candidateKey)}"><input type="hidden" name="action" value="expire"><button class="btn btn-outline-secondary btn-sm" type="submit">Expire</button></form>
      <a class="btn btn-outline-secondary btn-sm" href="${escapeHtml(candidate.url)}" target="_blank">Source ↗</a>
    </div>
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
    ? '<div class="alert alert-danger">Account Health is CONSTRAINED from supported observed evidence. New opportunities may be rejected and approval/send controls are disabled.</div>'
    : accountHealth.health.state === 'watch'
      ? '<div class="alert alert-warning">Account Health is WATCH. These are advisory efficiency/concentration/repetition diagnostics; useful human-reviewed actions remain available.</div>'
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
    ? `<div class="small mt-2"><strong>Publication:</strong> ${queueItem.publishStartedAt ? `started ${escapeHtml(new Date(queueItem.publishStartedAt).toLocaleString())}` : 'not started'}${queueItem.publishedAt ? ` · published ${escapeHtml(new Date(queueItem.publishedAt).toLocaleString())}` : ''}${queueItem.outputTweetId ? ` · tweet ${escapeHtml(queueItem.outputTweetId)}` : ''}${queueItem.publishError ? ` · <span class="text-danger">${escapeHtml(queueItem.publishError)}</span>` : ''}${queueItem.outputUrl ? ` · <a href="${escapeHtml(queueItem.outputUrl)}" target="_blank">output ↗</a>` : ''}</div>`
    : '';
  return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4">
    <div class="d-flex justify-content-between gap-3 flex-wrap">
      <div><div class="fw-semibold fs-5">${escapeHtml(candidate.title)}</div><div class="small text-secondary">${escapeHtml(candidate.source.toUpperCase())} · ${escapeHtml(queueItem.pipeline)} · ${escapeHtml(queueItem.status)}</div></div>
      <a class="btn btn-outline-secondary btn-sm align-self-start" href="${escapeHtml(candidate.url)}" target="_blank">Source ↗</a>
    </div>
    <p class="mt-3 mb-2 text-break">${escapeHtml(candidate.text)}</p>
    ${workflowBadges(queueItem)}
    <div class="small mt-2"><strong>AI recommendation:</strong> ${escapeHtml(queueItem.recommendedPipeline || 'none')} · <span class="text-secondary">${escapeHtml(queueItem.routingReason || 'No recommendation stored.')}</span></div>
    <div class="small text-secondary mt-2">Reach: freshness ${breakdown.reach.freshness}, momentum ${breakdown.reach.momentum}, traction ${breakdown.reach.traction}, breadth ${breakdown.reach.breadth} · Follow: niche ${breakdown.follow.niche}, preference ${breakdown.follow.preference}, specificity ${breakdown.follow.specificity}, utility ${breakdown.follow.utility}, identity ${breakdown.follow.identity} · Conversation: discussion ${breakdown.conversation.discussion}, tradeoff ${breakdown.conversation.questionTradeoff}, freshness ${breakdown.conversation.freshness}, specificity ${breakdown.conversation.specificity} · Relationship: ${breakdown.relationship.available ? `relevance ${breakdown.relationship.relevance}, follows ${breakdown.relationship.followsYou}, following ${breakdown.relationship.youFollow}, mutual ${breakdown.relationship.mutual}, topic ${breakdown.relationship.topicOverlap}` : 'no observed relationship context'}</div>
    ${publicationState}
    ${routeForm(queueItem, candidate.key, returnTo)}
    ${draft ? gatePanel(draft.gates) : ''}
    ${schedulePanel(queueItem, scheduleContextValue)}
    <div class="d-flex gap-3 flex-wrap mt-3 align-items-end">
      ${draft ? `<a class="btn btn-outline-primary btn-sm" href="/?source=drafts&draft=${draft.id}">Draft ${draft.qualityScore}/50</a>` : ''}
      ${canRequestReview ? `<form method="post" action="/queue/review"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}">${confirmationFields()}<button class="btn btn-outline-primary btn-sm" type="submit">${queueItem.status === 'needs_review' ? 'Recheck hard gates' : 'Request review'}</button></form>` : ''}
      ${canApprove && queueItem.pipeline !== 'repost' ? `<form method="post" action="/queue/approve"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}">${confirmationFields()}<button class="btn btn-success btn-sm" type="submit">Approve for publishing</button></form>` : ''}
      ${canApprove && queueItem.pipeline === 'repost' ? `<form method="post" action="/queue/approve"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="btn btn-success btn-sm" type="submit">Approve repost</button></form>` : ''}
    </div>
    ${mainFeedReview && !canApprove ? `<div class="alert alert-warning py-2 mt-3 mb-0">Approval blocked: ${draft ? `draft ${draft.qualityScore}/50 or saved hard gates do not pass` : 'a draft is required'}.</div>` : ''}
  </div></article>`;
}

function queueView() {
  const items = listQueueItems({ lane: 'main', limit: 250 });
  const context = schedulerContext();
  return QUEUE_GROUPS.map((status) => {
    const group = items.filter((item) => item.status === status);
    if (!group.length) return '';
    return `<h2 class="h5 mt-4 text-capitalize">${escapeHtml(status.replace('_', ' '))} <span class="badge text-bg-light border">${group.length}</span></h2>${group.map((item) => queueCard(item, context)).join('')}`;
  }).join('') || '<div class="alert alert-secondary">No active workflow items.</div>';
}

async function renderPage(activeSource = 'x', activeTag = '', forceRefresh = false, relationshipClass = '', relationshipStage = '') {
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
  const accountHealth = activeSource === 'health' || activeSource === 'engage' ? getAccountHealthSummary() : null;

  let decision;
  if (refreshError) decision = `Research refresh failed: ${refreshError}`;
  else if (activeSource === 'viral') decision = `${visible.length} viral/rising developer signals from the rolling last 24 hours.`;
  else if (activeSource === 'interesting') decision = `${visible.length} saved signals in your persistent research memory.`;
  else if (activeSource === 'queue') decision = `${countQueueItems({ status: 'triage', lane: 'main' })} items need routing · ${countQueueItems({ status: 'needs_review', lane: 'main' })} need review · ${countQueueItems({ status: 'approved', lane: 'main' })} approved for scheduler inspection.`;
  else if (activeSource === 'drafts') decision = `${drafts.length} drafts · ${drafts.filter((draft) => draft.status === 'ready').length} human-approved compatibility-ready.`;
  else if (activeSource === 'engage') {
    const engagementItems = listEngagementItems({ limit: 200 });
    const activeCount = engagementItems.filter((item) => item.engagementKind !== 'initial_reply').length;
    decision = engagementError ? `Engage refresh failed: ${engagementError}` : `${activeCount} active conversations · ${engagementItems.length - activeCount} new opportunities.`;
  }
  else if (activeSource === 'opportunities') decision = `${visible.length} job, builder, SaaS, and productization opportunities from recent research.`;
  else if (activeSource === 'performance') decision = `Latest @${ACCOUNT} performance snapshot and recent post outcomes.`;
  else if (activeSource === 'audience') {
    const summary = getAudienceSummary();
    decision = audienceError ? `Audience refresh failed: ${audienceError}` : `${summary.relevant_followers}/${summary.followers} observed followers are niche-aligned; ${summary.target_accounts} relevant followed accounts are raw audience observations.`;
  }
  else if (activeSource === 'relationships') {
    const shownCount = listRelationshipProfiles({ className: relationshipClass || undefined, stage: relationshipStage || undefined, limit: 100 }).length;
    decision = `Showing ${shownCount} top strategic relationship profiles for the current filters; Relationship Intelligence remains read-only in Phase 1B.`;
  }
  else if (activeSource === 'health') decision = `Account Health ${accountHealth.health.state.toUpperCase()} · ${accountHealth.interactionCounts.meaningfulInteractions7d} meaningful interactions in 7d · ${accountHealth.saturation.distribution.high} high-saturation target(s).`;
  else decision = `${visible.length} persisted candidates for this research view.`;

  const relationshipQuery = activeSource === 'relationships'
    ? `${relationshipClass ? `&class=${encodeURIComponent(relationshipClass)}` : ''}${relationshipStage ? `&stage=${encodeURIComponent(relationshipStage)}` : ''}`
    : '';
  const returnTo = `/?source=${encodeURIComponent(activeSource)}${activeTag ? `&tag=${encodeURIComponent(activeTag)}` : ''}${relationshipQuery}`;
  const filtersEnabled = ['x', 'viral', 'interesting', 'opportunities'].includes(activeSource);
  const nav = [
    ['x', 'X posts'],
    ['viral', 'Viral · 24h'],
    ['interesting', `Saved (${savedCount})`],
    ['queue', `Queue (${countQueueItems({ status: 'triage', lane: 'main' })})`],
    ['engage', `Engage Next (${listEngagementItems({ limit: 200 }).length})`],
    ['drafts', 'Drafts'],
    ['opportunities', 'Opportunities'],
    ['relationships', 'Relationships'],
    ['health', `Account Health${accountHealth ? ` · ${accountHealth.health.state.toUpperCase()}` : ''}`],
    ['audience', 'Audience'],
    ['performance', 'Performance'],
    ['github', 'GitHub'],
    ['hn', 'Hacker News'],
    ['all', 'All'],
  ].map(([source, label]) => `<a class="btn btn-sm ${activeSource === source ? (source === 'viral' ? 'btn-danger' : 'btn-dark') : (source === 'viral' ? 'btn-outline-danger' : 'btn-outline-secondary')}" href="/?source=${source}">${escapeHtml(label)}</a>`).join('');

  let content;
  if (activeSource === 'queue') content = queueView();
  else if (activeSource === 'engage') content = engageView(engagementError);
  else if (activeSource === 'drafts') content = drafts.map(draftCard).join('') || '<div class="alert alert-secondary">No drafts yet. Route a saved source to Original, Quote, Thread, or Reply.</div>';
  else if (activeSource === 'performance') content = performanceView(performance, performanceError);
  else if (activeSource === 'relationships') content = relationshipsView(relationshipClass, relationshipStage);
  else if (activeSource === 'health') content = accountHealthView();
  else if (activeSource === 'audience') content = audienceView(audienceError);
  else content = visible.slice(0, 50).map((item, index) => candidateCard(item, index, returnTo)).join('') || '<div class="alert alert-secondary">No candidates found for this view.</div>';

  return `<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>X Research System</title><link rel="stylesheet" href="/assets/bootstrap.min.css">
  </head><body class="bg-body-tertiary">
    <div class="sticky-top bg-body-tertiary border-bottom shadow-sm"><div class="container py-3">
      <div class="d-flex justify-content-between gap-3 flex-wrap align-items-start mb-2">
        <div><h1 class="h4 mb-1">X research & publishing system</h1><div class="text-secondary small">${escapeHtml(decision)}</div></div>
        <div class="d-flex gap-2 align-items-center flex-wrap"><a class="btn btn-dark btn-sm" href="${escapeHtml(returnTo)}${returnTo.includes('?') ? '&' : '?'}refresh=1">Refresh</a><span class="badge ${AUTO_POST ? 'text-bg-danger' : 'text-bg-secondary'}">AUTO_POST ${AUTO_POST ? 'ON' : 'OFF'}</span>${nextScheduled ? `<span class="badge text-bg-success">main feed ${nextScheduled.recommendedAt <= scheduleNow ? 'due now' : escapeHtml(new Date(nextScheduled.recommendedAt).toLocaleString())}</span>` : ''}</div>
      </div>
      <div class="d-flex gap-2 flex-wrap mb-2">${nav}</div>
      ${filtersEnabled ? `<div class="d-flex gap-2 flex-wrap"><a class="badge rounded-pill ${!activeTag ? 'text-bg-dark' : 'text-bg-light border text-dark'} text-decoration-none" href="/?source=${escapeHtml(activeSource)}">All niches</a>${Object.entries(NICHE_LABELS).map(([tag, label]) => `<a class="badge rounded-pill ${activeTag === tag ? 'text-bg-primary' : 'text-bg-light border text-dark'} text-decoration-none" href="/?source=${escapeHtml(activeSource)}&tag=${encodeURIComponent(tag)}">${escapeHtml(label)}</a>`).join('')}</div>` : ''}
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

    const allowedSources = ['x', 'viral', 'interesting', 'queue', 'engage', 'drafts', 'opportunities', 'relationships', 'health', 'audience', 'performance', 'github', 'hn', 'all'];
    const source = allowedSources.includes(requestUrl.searchParams.get('source')) ? requestUrl.searchParams.get('source') : 'x';
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
