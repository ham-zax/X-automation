import 'dotenv/config';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import {
  fetchAccountPerformance,
  fetchGitHubTrending,
  fetchHackerNews,
  fetchXNichePosts,
  fetchXViralPosts,
  generateMomentumPost,
  rankNews,
  rankXViralPosts,
} from './tech_news.js';
import { composeDraft, scoreDraft } from './drafting.js';
import { syncAudience } from './audience.js';
import { RELATIONSHIP_STAGES, TARGET_CLASSES } from './relationship.js';
import { NICHE_LABELS, isOpportunityCandidate, personalizeCandidates } from './strategy.js';
import {
  approveQueueItem,
  inspectWorkflow,
  refreshQueueRecommendation,
  requestQueueReview,
  routeCandidate,
  saveCandidateToWorkflow,
} from './pipeline.js';
import {
  candidateKey,
  countQueueItems,
  countSavedCandidates,
  getAudienceSummary,
  getCandidate,
  getDraft,
  getDraftByCandidate,
  getNextReadyDraft,
  getPerformanceSnapshot,
  getPreferenceProfile,
  getQueueItemByCandidate,
  getRelationshipSummary,
  listAudienceProfiles,
  listCandidateActions,
  listCandidates,
  listDrafts,
  listQueueItems,
  listRelationshipProfiles,
  recordPerformanceSnapshot,
  saveDraft,
  upsertCandidates,
} from './store.js';

const PORT = Number(process.env.WEB_PORT || 3030);
const NEWS_LIMIT = Number(process.env.NEWS_LIMIT || 8);
const AUTO_POST = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';
const ACCOUNT = process.env.X_ACCOUNT || 'ham_zax';

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

function draftCard(draft) {
  const candidate = getCandidate(draft.candidateKey);
  if (!candidate) return '';
  const analysis = scoreDraft(draft, candidate);
  const queueItem = getQueueItemByCandidate(candidate.key);
  const canRequestReview = queueItem && ['original', 'quote', 'thread', 'reply'].includes(queueItem.pipeline) && queueItem.status === 'drafting';
  const canApprove = queueItem?.status === 'needs_review' && ['original', 'quote', 'thread'].includes(queueItem.pipeline) && analysis.publishable;
  return `<article class="card shadow-sm border-0 mb-4">
    <div class="card-body p-4">
      <div class="d-flex justify-content-between gap-3 flex-wrap mb-3">
        <div>
          <div class="fw-semibold fs-5">${escapeHtml(candidate.title)}</div>
          <div class="text-secondary small">${escapeHtml((candidate.niche?.tags || []).map((tag) => NICHE_LABELS[tag] || tag).join(' · '))}</div>
          ${workflowBadges(queueItem)}
        </div>
        <div class="d-flex gap-2 align-items-start">
          <span class="badge ${analysis.publishable ? 'text-bg-success' : analysis.score >= 30 ? 'text-bg-warning' : 'text-bg-secondary'} fs-6">${escapeHtml(analysis.quality)} ${analysis.score}/50</span>
          <span class="badge text-bg-light border">Draft ${escapeHtml(draft.status)}</span>
        </div>
      </div>
      <form method="post" action="/draft/save">
        <input type="hidden" name="id" value="${draft.id}">
        <div class="mb-3"><label class="form-label fw-semibold">Hook</label><textarea class="form-control" rows="2" name="hook">${escapeHtml(draft.hook)}</textarea></div>
        <div class="mb-3"><label class="form-label fw-semibold">Insight</label><textarea class="form-control" rows="3" name="insight">${escapeHtml(draft.insight)}</textarea></div>
        <div class="mb-3"><label class="form-label fw-semibold">Evidence</label><textarea class="form-control" rows="3" name="evidence">${escapeHtml(draft.evidence)}</textarea></div>
        <div class="mb-3"><label class="form-label fw-semibold">Action</label><textarea class="form-control" rows="2" name="action">${escapeHtml(draft.action)}</textarea></div>
        <div class="row g-3 align-items-end">
          <div class="col-md-5"><label class="form-label">Schedule</label><input class="form-control" type="datetime-local" name="scheduledAt" value="${escapeHtml(formatDateTime(draft.scheduledAt))}"></div>
          <div class="col-md-7 d-flex gap-2 flex-wrap"><button class="btn btn-dark" type="submit">Save & score</button><a class="btn btn-outline-secondary" href="${escapeHtml(candidate.url)}" target="_blank">Source ↗</a></div>
        </div>
      </form>
      <div class="d-flex gap-2 flex-wrap mt-3">
        ${canRequestReview ? `<form method="post" action="/queue/review"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="btn btn-outline-primary btn-sm" type="submit">Request review</button></form>` : ''}
        ${canApprove ? `<form method="post" action="/queue/approve"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="btn btn-success btn-sm" type="submit">Approve for publishing</button></form>` : ''}
        ${queueItem?.status === 'approved' ? '<span class="badge text-bg-success align-self-center">Approved · compatibility draft ready</span>' : ''}
      </div>
      ${queueItem?.status === 'needs_review' && !analysis.publishable && queueItem.pipeline !== 'reply' ? `<div class="alert alert-warning py-2 mt-3 mb-0">Needs review, but the current draft is not publishable (${analysis.score}/50).</div>` : ''}
      <hr>
      <div class="small text-secondary">Rubric: niche ${analysis.breakdown.niche}/10 · hook ${analysis.breakdown.hook}/8 · insight ${analysis.breakdown.insight}/10 · evidence ${analysis.breakdown.evidence}/10 · action ${analysis.breakdown.action}/7 · originality ${analysis.breakdown.originality}/5 · ${analysis.weightedLength}/280 weighted chars. Human approval requires ≥40/50, no placeholders, and ≤280 weighted chars.</div>
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

const QUEUE_GROUPS = ['triage', 'researching', 'drafting', 'needs_review', 'approved', 'watching'];

function queueCard(queueItem) {
  if (!queueItem.recommendedPipeline) queueItem = refreshQueueRecommendation(queueItem.candidateKey).queueItem;
  const snapshot = inspectWorkflow(queueItem.candidateKey);
  const candidate = snapshot.candidate;
  const draft = snapshot.draft;
  const analysis = draft ? scoreDraft(draft, candidate) : null;
  const mainFeedReview = queueItem.status === 'needs_review' && ['original', 'quote', 'thread', 'repost'].includes(queueItem.pipeline);
  const canApprove = mainFeedReview && (queueItem.pipeline === 'repost' || analysis?.publishable);
  const canRequestReview = queueItem.status === 'drafting' && ['original', 'quote', 'thread', 'reply'].includes(queueItem.pipeline);
  const breakdown = snapshot.scores.breakdown;
  const returnTo = '/?source=queue';
  return `<article class="card border-0 shadow-sm mb-3"><div class="card-body p-4">
    <div class="d-flex justify-content-between gap-3 flex-wrap">
      <div><div class="fw-semibold fs-5">${escapeHtml(candidate.title)}</div><div class="small text-secondary">${escapeHtml(candidate.source.toUpperCase())} · ${escapeHtml(queueItem.pipeline)} · ${escapeHtml(queueItem.status)}</div></div>
      <a class="btn btn-outline-secondary btn-sm align-self-start" href="${escapeHtml(candidate.url)}" target="_blank">Source ↗</a>
    </div>
    <p class="mt-3 mb-2 text-break">${escapeHtml(candidate.text)}</p>
    ${workflowBadges(queueItem)}
    <div class="small mt-2"><strong>AI recommendation:</strong> ${escapeHtml(queueItem.recommendedPipeline || 'none')} · <span class="text-secondary">${escapeHtml(queueItem.routingReason || 'No recommendation stored.')}</span></div>
    <div class="small text-secondary mt-2">Reach: freshness ${breakdown.reach.freshness}, momentum ${breakdown.reach.momentum}, traction ${breakdown.reach.traction}, breadth ${breakdown.reach.breadth} · Follow: niche ${breakdown.follow.niche}, preference ${breakdown.follow.preference}, specificity ${breakdown.follow.specificity}, utility ${breakdown.follow.utility}, identity ${breakdown.follow.identity} · Conversation: discussion ${breakdown.conversation.discussion}, tradeoff ${breakdown.conversation.questionTradeoff}, freshness ${breakdown.conversation.freshness}, specificity ${breakdown.conversation.specificity} · Relationship: ${breakdown.relationship.available ? `relevance ${breakdown.relationship.relevance}, follows ${breakdown.relationship.followsYou}, following ${breakdown.relationship.youFollow}, mutual ${breakdown.relationship.mutual}, topic ${breakdown.relationship.topicOverlap}` : 'no observed relationship context'}</div>
    ${routeForm(queueItem, candidate.key, returnTo)}
    <div class="d-flex gap-2 flex-wrap mt-3">
      ${draft ? `<a class="btn btn-outline-primary btn-sm" href="/?source=drafts&draft=${draft.id}">Draft ${draft.qualityScore}/50</a>` : ''}
      ${canRequestReview ? `<form method="post" action="/queue/review"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="btn btn-outline-primary btn-sm" type="submit">Request review</button></form>` : ''}
      ${canApprove ? `<form method="post" action="/queue/approve"><input type="hidden" name="key" value="${escapeHtml(candidate.key)}"><button class="btn btn-success btn-sm" type="submit">Approve for publishing</button></form>` : ''}
    </div>
    ${mainFeedReview && !canApprove ? `<div class="alert alert-warning py-2 mt-3 mb-0">Approval blocked: ${analysis ? `draft ${analysis.score}/50 is not publishable` : 'a draft is required'}.</div>` : ''}
  </div></article>`;
}

function queueView() {
  const items = listQueueItems({ limit: 250 });
  return QUEUE_GROUPS.map((status) => {
    const group = items.filter((item) => item.status === status);
    if (!group.length) return '';
    return `<h2 class="h5 mt-4 text-capitalize">${escapeHtml(status.replace('_', ' '))} <span class="badge text-bg-light border">${group.length}</span></h2>${group.map(queueCard).join('')}`;
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

  const savedCount = countSavedCandidates();
  const nextReady = getNextReadyDraft();
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

  let decision;
  if (refreshError) decision = `Research refresh failed: ${refreshError}`;
  else if (activeSource === 'viral') decision = `${visible.length} viral/rising developer signals from the rolling last 24 hours.`;
  else if (activeSource === 'interesting') decision = `${visible.length} saved signals in your persistent research memory.`;
  else if (activeSource === 'queue') decision = `${countQueueItems({ status: 'triage' })} items need routing · ${countQueueItems({ status: 'needs_review' })} need review.`;
  else if (activeSource === 'drafts') decision = `${drafts.length} drafts · ${drafts.filter((draft) => draft.status === 'ready').length} human-approved compatibility-ready.`;
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
    ['queue', `Queue (${countQueueItems({ status: 'triage' })})`],
    ['drafts', 'Drafts'],
    ['opportunities', 'Opportunities'],
    ['relationships', 'Relationships'],
    ['audience', 'Audience'],
    ['performance', 'Performance'],
    ['github', 'GitHub'],
    ['hn', 'Hacker News'],
    ['all', 'All'],
  ].map(([source, label]) => `<a class="btn btn-sm ${activeSource === source ? (source === 'viral' ? 'btn-danger' : 'btn-dark') : (source === 'viral' ? 'btn-outline-danger' : 'btn-outline-secondary')}" href="/?source=${source}">${escapeHtml(label)}</a>`).join('');

  let content;
  if (activeSource === 'queue') content = queueView();
  else if (activeSource === 'drafts') content = drafts.map(draftCard).join('') || '<div class="alert alert-secondary">No drafts yet. Route a saved source to Original, Quote, Thread, or Reply.</div>';
  else if (activeSource === 'performance') content = performanceView(performance, performanceError);
  else if (activeSource === 'relationships') content = relationshipsView(relationshipClass, relationshipStage);
  else if (activeSource === 'audience') content = audienceView(audienceError);
  else content = visible.slice(0, 50).map((item, index) => candidateCard(item, index, returnTo)).join('') || '<div class="alert alert-secondary">No candidates found for this view.</div>';

  return `<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>X Research System</title><link rel="stylesheet" href="/assets/bootstrap.min.css">
  </head><body class="bg-body-tertiary">
    <div class="sticky-top bg-body-tertiary border-bottom shadow-sm"><div class="container py-3">
      <div class="d-flex justify-content-between gap-3 flex-wrap align-items-start mb-2">
        <div><h1 class="h4 mb-1">X research & publishing system</h1><div class="text-secondary small">${escapeHtml(decision)}</div></div>
        <div class="d-flex gap-2 align-items-center flex-wrap"><a class="btn btn-dark btn-sm" href="${escapeHtml(returnTo)}${returnTo.includes('?') ? '&' : '?'}refresh=1">Refresh</a><span class="badge ${AUTO_POST ? 'text-bg-danger' : 'text-bg-secondary'}">AUTO_POST ${AUTO_POST ? 'ON' : 'OFF'}</span>${nextReady ? `<span class="badge text-bg-success">queue ready ${nextReady.qualityScore}/50</span>` : ''}</div>
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
      requestQueueReview(form.get('key'));
      res.writeHead(303, { location: '/?source=drafts' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/queue/approve') {
      const form = await readForm(req);
      approveQueueItem(form.get('key'));
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
      const scheduledRaw = form.get('scheduledAt');
      const scheduledAt = scheduledRaw ? Date.parse(scheduledRaw) : null;
      if (scheduledRaw && !Number.isFinite(scheduledAt)) throw new Error('Invalid schedule time.');
      const updated = {
        ...current,
        hook: form.get('hook') || '',
        insight: form.get('insight') || '',
        evidence: form.get('evidence') || '',
        action: form.get('action') || '',
        scheduledAt,
      };
      updated.body = composeDraft(updated);
      const analysis = scoreDraft(updated, candidate);
      updated.qualityScore = analysis.score;
      updated.status = current.status === 'published' ? 'published' : 'draft';
      const saved = saveDraft(updated);
      if (current.status !== 'published') {
        let queueItem = getQueueItemByCandidate(candidate.key);
        if (!queueItem) queueItem = saveCandidateToWorkflow(candidate.key, true).queueItem;
        const pipeline = ['original', 'quote', 'thread', 'reply'].includes(queueItem.pipeline) ? queueItem.pipeline : 'original';
        routeCandidate(candidate.key, pipeline, { actor: 'human' });
      }
      res.writeHead(303, { location: `/?source=drafts&draft=${saved.id}` }); res.end(); return;
    }

    const allowedSources = ['x', 'viral', 'interesting', 'queue', 'drafts', 'opportunities', 'relationships', 'audience', 'performance', 'github', 'hn', 'all'];
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
