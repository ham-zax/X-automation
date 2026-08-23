import 'dotenv/config';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fetchXUnderTheHoodReport } from './tech_news.js';
import { RELATIONSHIP_STAGES, TARGET_CLASSES } from './relationship.js';
import { rankMainFeedItems } from './scheduler.js';
import { NICHE_LABELS } from './strategy.js';
import { handleApi, schedulerContext } from './web_api.js';
import {
  ACCOUNT_HEALTH_OBSERVATION_TYPES,
  getAccountHealthSummary,
  getAudienceSummary,
  listApprovedMainFeedItems,
  getRelationshipSummary,
  listRelationshipProfiles,
  recordAccountHealthObservation,
  recordUnderTheHoodSnapshot,
} from './store.js';

const PORT = Number(process.env.WEB_PORT || 3030);
const HOST = String(process.env.WEB_HOST || '0.0.0.0');
const AUTO_POST = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';
const UI_DIST = path.resolve('ui/dist');

const LEGACY_SOURCES = Object.freeze(['relationships', 'health']);

// React client routes for the migrated journeys.
const PRIMARY_NAV = [
  ['/#/today', 'Today'],
  ['/#/discover', 'Discover'],
  ['/#/conversations', 'Conversations'],
  ['/#/create', 'Posts'],
  ['/#/results', 'Results'],
  ['/#/learn', 'Learn'],
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
    <button class="btn btn-dark btn-sm" type="submit">Apply filters</button><a class="btn btn-outline-secondary btn-sm" href="/legacy?source=relationships">Reset</a>
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

function sectionMeta(source) {
  return {
    relationships: ['People & relationships', 'Strategic relationship profiles, stages, and relationship-fit detail.'],
    health: ['Account status', 'Health evidence, repetition, saturation, and visibility provenance.'],
  }[source] || ['Settings', 'Detailed system views and diagnostics.'];
}

function secondaryNavigation(activeSource) {
  const items = activeSource === 'health'
    ? [['/#/results', 'Overview'], ['/#/results/audience', 'Audience quality'], [`/legacy?source=health`, 'Account status details']]
    : activeSource === 'relationships'
      ? [['/#/conversations', 'What needs a reply'], [`/legacy?source=relationships`, 'People & relationships']]
      : [];
  if (!items.length) return '';
  return `<nav aria-label="Section" class="app-subnav">${items.map(([href, label]) => `<a data-active="false" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('')}</nav>`;
}

function primaryNavigation() {
  return PRIMARY_NAV.map(([href, label]) => `<a data-active="false" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('');
}

async function renderPage(activeSource, relationshipClass = '', relationshipStage = '') {
  const scheduleNow = Date.now();
  const scheduleDecisions = rankMainFeedItems(listApprovedMainFeedItems({ automatedOnly: true, limit: 100 }), schedulerContext(scheduleNow));
  const nextScheduled = scheduleDecisions.find((item) => item.eligible) || null;

  let decision;
  if (activeSource === 'relationships') {
    const shownCount = listRelationshipProfiles({ className: relationshipClass || undefined, stage: relationshipStage || undefined, limit: 100 }).length;
    decision = `Showing ${shownCount} people for the current filters.`;
  } else if (activeSource === 'health') {
    const summary = getAccountHealthSummary();
    const stateCopy = summary.health.state === 'healthy' ? 'Everything looks normal.' : summary.health.state === 'watch' ? 'Something deserves attention.' : 'Some actions are temporarily limited.';
    decision = `${stateCopy} ${summary.interactionCounts.meaningfulInteractions7d} useful interactions in the last 7 days.`;
  }

  const [sectionTitle, sectionDescription] = sectionMeta(activeSource);
  const content = activeSource === 'relationships'
    ? relationshipsView(relationshipClass, relationshipStage)
    : accountHealthView();

  const nav = primaryNavigation();
  const secondaryNav = secondaryNavigation(activeSource);
  return `<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(sectionTitle)} · Growth workspace</title>
    <link rel="stylesheet" href="/assets/bootstrap.min.css">
    <link rel="stylesheet" href="/assets/dashboard.tailwind.css">
  </head><body><div class="app-shell">
    <header class="app-topbar"><div class="app-container py-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0"><div class="app-kicker">Growth workspace</div><div class="app-title">${escapeHtml(sectionTitle)}</div><div class="app-subtitle">${escapeHtml(sectionDescription)} ${escapeHtml(decision)}</div></div>
        <div class="flex flex-wrap items-center gap-2"><a class="btn btn-outline-dark btn-sm" href="/">Open workspace</a><a class="btn btn-dark btn-sm" href="/#/settings">Settings</a><span class="rounded-full px-3 py-1 text-xs font-semibold ${AUTO_POST ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}">Automation ${AUTO_POST ? 'on' : 'off'}</span>${nextScheduled ? `<span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Next post ${nextScheduled.recommendedAt <= scheduleNow ? 'ready now' : escapeHtml(new Date(nextScheduled.recommendedAt).toLocaleString())}</span>` : ''}</div>
      </div>
      <nav aria-label="Primary" class="app-nav mt-4">${nav}</nav>
      ${secondaryNav || ''}
    </div></header>
    <main class="app-container py-6 lg:py-8">${content}</main>
    <script src="/assets/bootstrap.bundle.min.js"></script>
  </div></body></html>`;
}

const MIME_TYPES = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

async function serveUiAsset(res, relativePath) {
  const target = path.resolve(UI_DIST, `.${relativePath}`);
  if (!target.startsWith(path.resolve(UI_DIST))) {
    res.writeHead(404); res.end(); return;
  }
  try {
    const file = await fs.readFile(target);
    res.writeHead(200, {
      'content-type': MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': path.extname(target) === '.html' ? 'no-store' : 'public, max-age=3600',
    });
    res.end(file);
  } catch {
    res.writeHead(404); res.end();
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (requestUrl.pathname.startsWith('/api/')) {
      return handleApi(req, res, requestUrl);
    }
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
      res.writeHead(303, { location: '/legacy?source=health' }); res.end(); return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/health/under-the-hood') {
      const report = await fetchXUnderTheHoodReport();
      if (report.available === true) recordUnderTheHoodSnapshot(report);
      res.writeHead(303, { location: '/legacy?source=health' }); res.end(); return;
    }

    // React client: the migrated workspace.
    if (req.method === 'GET' && requestUrl.pathname === '/') {
      const source = requestUrl.searchParams.get('source');
      if (source === 'advanced') {
        res.writeHead(302, { location: '/#/settings/advanced' });
        res.end();
        return;
      }
      if (source && LEGACY_SOURCES.includes(source)) {
        res.writeHead(302, { location: `/legacy?source=${encodeURIComponent(source)}` });
        res.end();
        return;
      }
      return serveUiAsset(res, '/index.html');
    }
    if (req.method === 'GET' && requestUrl.pathname.startsWith('/app/')) {
      return serveUiAsset(res, requestUrl.pathname.replace(/^\/app/, '') || '/index.html');
    }

    // Remaining legacy diagnostic views.
    if (req.method === 'GET' && requestUrl.pathname === '/legacy') {
      const source = requestUrl.searchParams.get('source');
      if (!LEGACY_SOURCES.includes(source)) {
        res.writeHead(302, { location: '/#/settings/advanced' });
        res.end();
        return;
      }
      const relationshipClass = TARGET_CLASSES.includes(requestUrl.searchParams.get('class')) ? requestUrl.searchParams.get('class') : '';
      const relationshipStage = RELATIONSHIP_STAGES.includes(requestUrl.searchParams.get('stage')) ? requestUrl.searchParams.get('stage') : '';
      const html = await renderPage(source, relationshipClass, relationshipStage);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html);
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Dashboard failed: ${error.message}`);
  }
});

server.listen(PORT, HOST, () => console.log(`[web] X research system: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
