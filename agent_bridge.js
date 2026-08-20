import 'dotenv/config';
import { applyWriterOutput, buildWriterPacket, composeDraft, scoreDraft } from './drafting.js';
import { refreshEngagementOpportunities } from './engagement.js';
import { syncAudience } from './audience.js';
import { fetchXUnderTheHoodReport } from './tech_news.js';
import { rankMainFeedItems, recommendMainFeedSchedule } from './scheduler.js';
import { classifyNiche, recommendDistributionAction } from './strategy.js';
import {
  EDITORIAL_OBJECTIVES,
  dismissEditorialRecommendation,
  refreshEditorialPlan,
  selectEditorialRecommendation,
} from './editorial.js';
import { attachEditorialResearchSource } from './research.js';
import {
  ensureCandidateWorkflow,
  inspectWorkflow,
  requestQueueReview,
  resolveEngagementItem,
  routeCandidate,
  saveCandidateToWorkflow,
  sendApprovedEngagementReply,
} from './pipeline.js';
import {
  ACCOUNT_HEALTH_OBSERVATION_TYPES,
  AI_ROLES,
  SOURCE_SNAPSHOT_KINDS,
  acceptLearnedRule,
  assignExperimentVariant,
  candidateKey,
  createExperiment,
  clearAiDefaultProfile,
  clearAiRoleBinding,
  getAccountHealthSummary,
  getAiProfile,
  getAiRuntimeSettings,
  getAudienceSummary,
  getCandidate,
  getDraft,
  getDraftByCandidate,
  getDiscoverSnapshot,
  getEditorialOutcomeSummary,
  getEditorialRecommendation,
  getEditorialSelectionByRecommendation,
  getExperiment,
  getExperimentSummary,
  getLearningOverview,
  getLatestEditorialPlan,
  getNextReadyDraft,
  getMainFeedScheduleItem,
  getNewFollowerQuality,
  getPublicationMeasurements,
  getPerformanceSnapshot,
  getQueueItem,
  getRelationshipProfile,
  hasCandidateAction,
  listAudienceProfiles,
  listAcceptedLearnedRules,
  listAiProfiles,
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
  listResearchEvidence,
  listRelationshipEvents,
  listRelationshipProfiles,
  recordAccountHealthObservation,
  recordCandidateAction,
  recordUnderTheHoodSnapshot,
  refreshLearnedRuleSuggestion,
  retireLearnedRule,
  saveDraft,
  setAiDefaultProfile,
  setAiRoleBinding,
  upsertCandidates,
  resolveAiProfileForRole,
} from './store.js';
import { listAiRuntimeAvailability } from './ai_runtime.js';

async function readInput() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  if (!input.trim()) return {};
  return JSON.parse(input);
}

function requireCandidate(key) {
  const candidate = getCandidate(key);
  if (!candidate) throw new Error(`Candidate not found: ${key}`);
  return candidate;
}

function requireDraft(id) {
  const draft = getDraft(Number(id));
  if (!draft) throw new Error(`Draft not found: ${id}`);
  return draft;
}

function sourceUsername(candidate) {
  if (candidate?.source !== 'x') return '';
  const title = String(candidate.title || '').trim();
  if (title.startsWith('@')) return title.slice(1).toLowerCase();
  const match = String(candidate.url || '').match(/x\.com\/([^/]+)/i);
  return match?.[1]?.toLowerCase() || '';
}

function manualCandidate(payload) {
  const text = String(payload.text || '').trim();
  const url = String(payload.url || '').trim();
  if (!text) throw new Error('ingest requires text.');
  if (!url) throw new Error('ingest requires url.');
  const niche = classifyNiche(text);
  return {
    key: payload.key || url,
    source: payload.source || 'x',
    title: payload.author || payload.title || '@manual',
    text,
    url,
    timestamp: payload.timestamp ? Number(payload.timestamp) : 0,
    score: Number(payload.score || niche.score),
    niche,
    metrics: {
      views: Number(payload.metrics?.views || 0),
      likes: Number(payload.metrics?.likes || 0),
      retweets: Number(payload.metrics?.retweets || payload.metrics?.reposts || 0),
      replies: Number(payload.metrics?.replies || 0),
    },
  };
}

function result(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function engagementPacket(queueItem) {
  const candidate = getCandidate(queueItem.candidateKey);
  const draft = getDraftByCandidate(queueItem.candidateKey);
  const relationship = queueItem.targetUsername ? getRelationshipProfile(queueItem.targetUsername) : null;
  return { queueItem, candidate, draft, relationship };
}

function schedulerContext(now) {
  const recentPosts = listRecentMainFeedPublications({ limit: 20 });
  return {
    now,
    recentPosts,
    lastMainFeedPostAt: recentPosts[0]?.publishedAt ?? null,
    learnedRules: listAcceptedLearnedRules({ limit: 500 }),
  };
}

function aiProfileCapability(profile) {
  if (!profile) return 'unsupported';
  if (profile.runtime === 'codex') return 'supported';
  if (profile.runtime !== 'direct_api') return 'unsupported';
  const configured = profile.settings?.structuredOutput;
  if (['supported', 'compatible_fallback', 'unknown', 'unsupported'].includes(configured)) return configured;
  return profile.providerKind === 'openai' ? 'supported' : 'compatible_fallback';
}

function safeAiProfile(profile) {
  if (!profile) return null;
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
  };
}

function safeAiRole(role) {
  const resolved = resolveAiProfileForRole(role);
  return {
    role,
    activity: role === 'continuous_scan' ? 'not_active' : (resolved.profile ? 'configured' : 'unconfigured'),
    primaryProfileId: resolved.binding?.primaryProfileId ?? null,
    fallbackProfileId: resolved.binding?.fallbackProfileId ?? null,
    resolvedProfile: safeAiProfile(resolved.profile),
    fallbackProfile: safeAiProfile(resolved.fallbackProfile),
    resolutionSource: resolved.source,
  };
}

function safeAiConfig() {
  const settings = getAiRuntimeSettings();
  return {
    profiles: listAiProfiles({ limit: 500 }).map(safeAiProfile),
    defaultProfileId: settings.defaultProfileId,
    defaultProfile: safeAiProfile(settings.defaultProfile),
    roles: AI_ROLES.map(safeAiRole),
  };
}

function requireAssignableAiProfile(id, { confirmUnknownCapability = false } = {}) {
  const profile = getAiProfile(Number(id));
  if (!profile) throw new Error(`AI profile not found: ${id}`);
  if (!profile.enabled) throw new Error(`AI profile is disabled: ${profile.id}`);
  const capability = aiProfileCapability(profile);
  if (capability === 'unsupported') throw new Error(`${profile.name} does not support the structured-output path required by AI roles.`);
  if (capability === 'unknown' && confirmUnknownCapability !== true) {
    throw new Error(`${profile.name} has unknown structured-output capability. Confirm the advanced assignment explicitly.`);
  }
  return profile;
}

function bridgeEditorialObjective(value = 'qualified_growth') {
  const objective = String(value || 'qualified_growth');
  if (!EDITORIAL_OBJECTIVES.includes(objective)) throw new Error(`Unsupported editorial objective: ${objective}.`);
  return objective;
}

function bridgeEditorialRecommendation(recommendation) {
  if (!recommendation) return null;
  const storyEvidence = listResearchEvidence({ editorialRunId: recommendation.editorialRunId, storyKey: recommendation.storyKey });
  const referenced = new Set((recommendation.evidenceIds || []).map((id) => String(id)));
  const evidence = recommendation.decision === 'RESEARCH_MORE'
    ? storyEvidence
    : storyEvidence.filter((item) => referenced.has(String(item.id)));
  const selection = getEditorialSelectionByRecommendation(recommendation.id);
  const queueItem = selection ? getQueueItem(selection.queueItemId) : null;
  return {
    ...recommendation,
    evidence,
    selection: selection ? {
      ...selection,
      candidateKey: queueItem?.candidateKey || null,
      draftId: queueItem?.draftId ?? null,
      queueStatus: queueItem?.status || null,
    } : null,
  };
}

function bridgeEditorialPlan(objective = 'qualified_growth') {
  const selectedObjective = bridgeEditorialObjective(objective);
  const plan = getLatestEditorialPlan(selectedObjective);
  return {
    objective: selectedObjective,
    hasPlan: Boolean(plan),
    run: plan?.run || null,
    sourceFreshness: SOURCE_SNAPSHOT_KINDS.map((kind) => {
      const snapshot = getDiscoverSnapshot(kind);
      return {
        kind,
        fetchedAt: snapshot.fetchedAt,
        lastRefreshAttemptAt: snapshot.lastRefreshAttemptAt,
        error: snapshot.error,
        legacyFallback: snapshot.legacyFallback,
        candidateCount: snapshot.candidates.length,
      };
    }),
    recommendations: (plan?.recommendations || []).map(bridgeEditorialRecommendation),
    noStrongAction: Boolean(plan && plan.recommendations.length === 0),
    noStrongActionReason: plan?.run?.context?.noStrongCurrentActionReason || '',
  };
}

async function main() {
  const command = process.argv[2];
  const payload = await readInput();

  if (command === 'editorial-plan') {
    result(bridgeEditorialPlan(payload.objective || 'qualified_growth'));
    return;
  }

  if (command === 'editorial-refresh') {
    const objective = bridgeEditorialObjective(payload.objective || 'qualified_growth');
    await refreshEditorialPlan({ objective, refreshSources: payload.refreshSources === true });
    result(bridgeEditorialPlan(objective));
    return;
  }

  if (command === 'editorial-recommendation') {
    const recommendation = getEditorialRecommendation(Number(payload.recommendationId));
    if (!recommendation) throw new Error(`Editorial recommendation not found: ${payload.recommendationId}`);
    result({ recommendation: bridgeEditorialRecommendation(recommendation) });
    return;
  }

  if (command === 'editorial-select') {
    const selected = selectEditorialRecommendation(Number(payload.recommendationId), {
      pipelineOverride: payload.pipelineOverride == null || payload.pipelineOverride === '' ? null : String(payload.pipelineOverride),
    });
    result({
      recommendation: bridgeEditorialRecommendation(selected.recommendation),
      selection: selected.selection,
      queueItem: selected.queueItem,
      candidateKey: selected.queueItem.candidateKey,
      draftId: selected.queueItem.draftId ?? null,
      research: selected.research || null,
      idempotent: selected.idempotent === true,
    });
    return;
  }

  if (command === 'editorial-dismiss') {
    const recommendation = dismissEditorialRecommendation(Number(payload.recommendationId));
    result({ recommendation: bridgeEditorialRecommendation(recommendation) });
    return;
  }

  if (command === 'editorial-add-source') {
    const evidence = await attachEditorialResearchSource(Number(payload.recommendationId), {
      url: payload.url,
      claim: payload.claim,
      claimType: payload.claimType || 'other',
    });
    const recommendation = getEditorialRecommendation(Number(payload.recommendationId));
    result({ evidence, recommendation: bridgeEditorialRecommendation(recommendation) });
    return;
  }

  if (command === 'editorial-outcomes') {
    result({
      outcomes: getEditorialOutcomeSummary({
        windowMinutes: Number(payload.windowMinutes || 1440),
        limit: Math.max(1, Math.min(200, Number(payload.limit || 200))),
      }),
    });
    return;
  }

  if (command === 'ai-config') {
    result(safeAiConfig());
    return;
  }

  if (command === 'ai-runtimes') {
    result({ runtimes: await listAiRuntimeAvailability() });
    return;
  }

  if (command === 'ai-select-default') {
    if (payload.clear === true || payload.profileId == null || payload.profileId === '') {
      clearAiDefaultProfile();
      result(safeAiConfig());
      return;
    }
    const profile = requireAssignableAiProfile(payload.profileId, { confirmUnknownCapability: payload.confirmUnknownCapability === true });
    setAiDefaultProfile(profile.id);
    result(safeAiConfig());
    return;
  }

  if (command === 'ai-bind-role') {
    const role = String(payload.role || '');
    if (!AI_ROLES.includes(role)) throw new Error(`Invalid AI role: ${role || 'missing'}`);
    if (payload.clear === true) {
      clearAiRoleBinding(role);
      result({ role: safeAiRole(role) });
      return;
    }
    const confirmUnknownCapability = payload.confirmUnknownCapability === true;
    const primaryProfileId = payload.primaryProfileId == null || payload.primaryProfileId === '' ? null : Number(payload.primaryProfileId);
    const fallbackProfileId = payload.fallbackProfileId == null || payload.fallbackProfileId === '' ? null : Number(payload.fallbackProfileId);
    if (primaryProfileId != null) requireAssignableAiProfile(primaryProfileId, { confirmUnknownCapability });
    if (fallbackProfileId != null) requireAssignableAiProfile(fallbackProfileId, { confirmUnknownCapability });
    setAiRoleBinding(role, { primaryProfileId, fallbackProfileId });
    result({ role: safeAiRole(role) });
    return;
  }

  if (command === 'ingest') {
    const candidate = manualCandidate(payload);
    const key = candidateKey(candidate);
    upsertCandidates([candidate], { saved: false });
    let workflow = payload.saved === true ? saveCandidateToWorkflow(key, true) : inspectWorkflow(key);
    if (payload.createDraft) {
      if (!workflow.queueItem) workflow = ensureCandidateWorkflow(key);
      const currentPipeline = workflow.queueItem?.pipeline;
      const pipeline = ['original', 'quote', 'thread', 'reply'].includes(currentPipeline) ? currentPipeline : 'original';
      routeCandidate(key, pipeline, { actor: 'agent' });
      workflow = inspectWorkflow(key);
    }
    result({ candidate: workflow.candidate, draft: workflow.draft, queueItem: workflow.queueItem, scores: workflow.scores, recommendation: workflow.recommendation });
    return;
  }

  if (command === 'inspect') {
    const candidate = requireCandidate(payload.key);
    result({ candidate, draft: getDraftByCandidate(candidate.key) });
    return;
  }

  if (command === 'create-draft') {
    const candidate = requireCandidate(payload.key);
    let workflow = ensureCandidateWorkflow(candidate.key);
    const pipeline = ['original', 'quote', 'thread', 'reply'].includes(workflow.queueItem?.pipeline) ? workflow.queueItem.pipeline : 'original';
    routeCandidate(candidate.key, pipeline, { actor: 'agent' });
    workflow = inspectWorkflow(candidate.key);
    result({ draft: workflow.draft, analysis: scoreDraft(workflow.draft, candidate), queueItem: workflow.queueItem });
    return;
  }

  if (command === 'writer-packet') {
    const workflow = inspectWorkflow(payload.key);
    const pipeline = workflow.queueItem?.pipeline;
    if (!['original', 'quote', 'thread', 'reply'].includes(pipeline)) {
      throw new Error(`writer-packet requires a routed text pipeline; current pipeline is ${pipeline || 'none'}.`);
    }
    if (!workflow.draft) throw new Error(`Draft required for ${pipeline}.`);
    const username = sourceUsername(workflow.candidate);
    result(buildWriterPacket({
      candidate: workflow.candidate,
      queueItem: workflow.queueItem,
      draft: workflow.draft,
      relationship: username ? getRelationshipProfile(username) : null,
      recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: workflow.candidate.key }),
      recentReplies: listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: workflow.candidate.key }),
    }));
    return;
  }

  if (command === 'apply-writer-output') {
    const current = requireDraft(payload.id);
    const candidate = requireCandidate(current.candidateKey);
    const workflow = inspectWorkflow(candidate.key);
    if (current.status === 'published' || current.publishedTweetId || workflow.queueItem?.status === 'published' || workflow.queueItem?.publishedAt || workflow.queueItem?.outputTweetId) {
      throw new Error('Published text is historical record and cannot be edited.');
    }
    const pipeline = workflow.queueItem?.pipeline;
    if (!['original', 'quote', 'thread', 'reply'].includes(pipeline)) {
      throw new Error(`apply-writer-output requires a routed text pipeline; current pipeline is ${pipeline || 'none'}.`);
    }
    if (payload.output?.pipeline !== pipeline) {
      throw new Error(`Writer pipeline mismatch: ${payload.output?.pipeline || 'missing'} !== ${pipeline}. Route the queue item first.`);
    }
    const writerBase = current.editor?.pipeline && current.editor.pipeline !== pipeline
      ? { ...current, editor: {} }
      : current;
    const next = applyWriterOutput(writerBase, payload.output || {});
    const analysis = scoreDraft(next, candidate, {
      pipeline,
      recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidate.key }),
      recentReplies: pipeline === 'reply'
        ? listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidate.key })
        : [],
      factualityConfirmed: false,
      evidenceConfirmed: false,
      mediaReady: false,
    });
    const draft = saveDraft({ ...next, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
    const queueItem = routeCandidate(candidate.key, pipeline, { actor: 'agent' });
    result({
      draft,
      analysis,
      queueItem,
      ...(payload.output?.decision === 'DO_NOT_POST'
        ? { recommendation: 'Do not publish this draft; route the queue item to research, watch, or ignore as appropriate.' }
        : {}),
    });
    return;
  }

  if (command === 'update-draft') {
    const current = requireDraft(payload.id);
    const candidate = requireCandidate(current.candidateKey);
    let workflow = inspectWorkflow(candidate.key);
    if (current.status === 'published' || current.publishedTweetId || workflow.queueItem?.status === 'published' || workflow.queueItem?.publishedAt || workflow.queueItem?.outputTweetId) {
      throw new Error('Published text is historical record and cannot be edited.');
    }
    if (!workflow.queueItem) workflow = ensureCandidateWorkflow(candidate.key);
    const pipeline = ['original', 'quote', 'thread', 'reply'].includes(workflow.queueItem?.pipeline) ? workflow.queueItem.pipeline : 'original';
    const next = {
      ...current,
      hook: payload.hook ?? current.hook,
      insight: payload.insight ?? current.insight,
      evidence: payload.evidence ?? current.evidence,
      action: payload.action ?? current.action,
      scheduledAt: payload.scheduledAt == null ? current.scheduledAt : Number(payload.scheduledAt),
      publishedTweetId: payload.publishedTweetId ?? current.publishedTweetId,
    };
    if (pipeline === 'thread') {
      if (payload.threadParts != null && !Array.isArray(payload.threadParts)) throw new Error('threadParts must be an array.');
      next.threadParts = (payload.threadParts ?? current.threadParts ?? []).map((part) => String(part ?? ''));
      next.body = '';
      if (Object.keys(current.editor || {}).length) next.editor = { ...current.editor, pipeline, threadParts: [...next.threadParts] };
    } else {
      next.body = payload.body ?? (current.editor?.finalText ? current.body : composeDraft(next, { pipeline }));
      if (Object.keys(current.editor || {}).length) next.editor = { ...current.editor, pipeline, finalText: next.body };
    }
    const analysis = scoreDraft(next, candidate);
    next.qualityScore = analysis.score;
    next.gates = {};
    const requestedStatus = payload.status ?? current.status;
    if (!['draft', 'ready', 'published'].includes(requestedStatus)) throw new Error(`Invalid draft status: ${requestedStatus}`);
    if (requestedStatus === 'published' && !next.publishedTweetId) throw new Error('published status requires publishedTweetId.');

    if (requestedStatus === 'published') {
      const draft = saveDraft({ ...next, status: 'published' });
      result({ draft, analysis, queueItem: inspectWorkflow(candidate.key).queueItem });
      return;
    }

    const draft = saveDraft({ ...next, status: 'draft' });
    routeCandidate(candidate.key, pipeline, { actor: 'agent' });

    if (requestedStatus === 'ready') {
      const review = requestQueueReview(candidate.key);
      result({ draft: review.draft, analysis: review.analysis, approvalRequired: true, queueItem: review.queueItem });
      return;
    }

    result({ draft, analysis, queueItem: inspectWorkflow(candidate.key).queueItem });
    return;
  }

  if (command === 'queue') {
    result({
      next: getNextReadyDraft(Date.now(), Number(payload.minScore || 40)),
      drafts: listDrafts({ status: payload.draftStatus, limit: Number(payload.limit || 20) }),
      queueItems: listQueueItems({ status: payload.status, pipeline: payload.pipeline, lane: payload.lane, limit: Number(payload.limit || 20) }),
    });
    return;
  }

  if (command === 'schedule-next') {
    const now = payload.now == null ? Date.now() : Number(payload.now);
    if (!Number.isFinite(now)) throw new Error('schedule-next now must be numeric when supplied.');
    const items = listApprovedMainFeedItems({ automatedOnly: true, limit: Math.max(1, Math.min(200, Number(payload.limit || 100))) });
    const context = schedulerContext(now);
    const decisions = rankMainFeedItems(items, context);
    result({
      now,
      next: decisions.find((decision) => decision.eligible) || null,
      decisions,
      publicationAuthority: 'approved main-feed queue + scheduler',
    });
    return;
  }

  if (command === 'schedule-inspect') {
    const key = String(payload.key || '');
    if (!key) throw new Error('schedule-inspect requires key.');
    const item = getMainFeedScheduleItem(key);
    if (!item) throw new Error(`Main-feed schedule item not found: ${key}`);
    const now = payload.now == null ? Date.now() : Number(payload.now);
    if (!Number.isFinite(now)) throw new Error('schedule-inspect now must be numeric when supplied.');
    result({
      now,
      item,
      decision: recommendMainFeedSchedule(item, schedulerContext(now)),
      readOnly: true,
    });
    return;
  }

  if (command === 'route') {
    requireCandidate(payload.key);
    const queueItem = routeCandidate(payload.key, payload.pipeline, { actor: 'agent', reason: payload.reason || '' });
    result({ queueItem, approvalRequired: queueItem.status === 'needs_review' });
    return;
  }

  if (command === 'workflow') {
    result(inspectWorkflow(payload.key));
    return;
  }

  if (command === 'research') {
    result({ candidates: listCandidates({ source: payload.source, saved: payload.saved, viralOnly: Boolean(payload.viralOnly), withinHours: Number(payload.withinHours || 0) || undefined, limit: Number(payload.limit || 30) }) });
    return;
  }

  if (command === 'performance') {
    result(getPerformanceSnapshot(Number(payload.limit || 30)));
    return;
  }

  if (command === 'measurements') {
    if (payload.queueItemId != null) {
      result({ queueItemId: Number(payload.queueItemId), measurements: getPublicationMeasurements(Number(payload.queueItemId)) });
      return;
    }
    const since = Number(payload.since || 0);
    const until = payload.until == null ? Date.now() : Number(payload.until);
    result({
      series: listPublicationMeasurementSeries({ limit: Number(payload.limit || 30) }),
      newFollowerQuality: getNewFollowerQuality({ since, until, minScore: Number(payload.minScore ?? 12) }),
    });
    return;
  }

  if (command === 'experiments') {
    if (payload.id != null) {
      const experiment = getExperiment(Number(payload.id));
      if (!experiment) throw new Error(`Experiment not found: ${payload.id}`);
      result({ experiment, assignments: listExperimentAssignments(experiment.id), readOnly: true });
      return;
    }
    result({ experiments: listExperiments({ status: payload.status || null, limit: Number(payload.limit || 100) }), readOnly: true });
    return;
  }

  if (command === 'experiment-create') {
    if (payload.confirmCreate !== true) throw new Error('experiment-create requires confirmCreate=true for the explicit write action.');
    const definition = payload.experiment || payload.definition;
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error('experiment-create requires an experiment definition object.');
    result({ experiment: createExperiment(definition), assignmentPolicy: 'caller_selected', randomized: false });
    return;
  }

  if (command === 'experiment-assign') {
    if (payload.confirmAssign !== true) throw new Error('experiment-assign requires confirmAssign=true for the explicit write action.');
    if (!payload.key) throw new Error('experiment-assign requires key.');
    const context = payload.context == null ? {} : payload.context;
    if (!context || typeof context !== 'object' || Array.isArray(context)) throw new Error('experiment-assign context must be an object.');
    result({
      queueItem: assignExperimentVariant(payload.key, Number(payload.experimentId), payload.variant, {
        context,
        timingHistorySufficient: payload.timingHistorySufficient === true,
      }),
      assignmentPolicy: 'caller_selected',
      randomized: false,
    });
    return;
  }

  if (command === 'experiment-summary') {
    if (payload.id == null) throw new Error('experiment-summary requires id.');
    result(getExperimentSummary(Number(payload.id), { windowMinutes: payload.windowMinutes == null ? null : Number(payload.windowMinutes) }));
    return;
  }

  if (command === 'learning') {
    const algorithmEvidence = payload.algorithmEvidence == null ? null : payload.algorithmEvidence;
    if (algorithmEvidence != null && !Array.isArray(algorithmEvidence)) throw new Error('learning algorithmEvidence must be an array when supplied.');
    result({ ...getLearningOverview({ algorithmEvidence }), readOnly: true });
    return;
  }

  if (command === 'learning-refresh') {
    if (payload.experimentId == null) throw new Error('learning-refresh requires experimentId.');
    const match = payload.match == null ? undefined : payload.match;
    if (match != null && (!match || typeof match !== 'object' || Array.isArray(match))) throw new Error('learning-refresh match must be an object when supplied.');
    result(refreshLearnedRuleSuggestion({
      experimentId: Number(payload.experimentId),
      baselineLabel: payload.baselineLabel,
      comparisonLabel: payload.comparisonLabel,
      windowMinutes: payload.windowMinutes == null ? null : Number(payload.windowMinutes),
      key: payload.key,
      scope: payload.scope,
      adjustmentTarget: payload.adjustmentTarget,
      adjustmentComponent: payload.adjustmentComponent,
      match,
      mechanismTags: Array.isArray(payload.mechanismTags) ? payload.mechanismTags : [],
      outlierDominated: payload.outlierDominated === true,
      requiresBroadSupport: payload.requiresBroadSupport === true,
      support: payload.support,
      minimumSampleSize: payload.minimumSampleSize,
      higherIsBetter: payload.higherIsBetter,
      proposedAdjustment: payload.proposedAdjustment,
    }));
    return;
  }

  if (command === 'learning-accept') {
    if (payload.confirmAccept !== true) throw new Error('learning-accept requires confirmAccept=true for the explicit production-strategy change.');
    if (payload.id == null) throw new Error('learning-accept requires id.');
    result({ rule: acceptLearnedRule(Number(payload.id)), overview: getLearningOverview() });
    return;
  }

  if (command === 'learning-retire') {
    if (payload.confirmRetire !== true) throw new Error('learning-retire requires confirmRetire=true for the explicit production-strategy change.');
    if (payload.id == null) throw new Error('learning-retire requires id.');
    result({ rule: retireLearnedRule(Number(payload.id), { reason: payload.reason || '' }), overview: getLearningOverview() });
    return;
  }

  if (command === 'decide') {
    const candidate = requireCandidate(payload.key);
    const existingActions = listCandidateActions(candidate.key);
    const context = {
      ...(payload.context || {}),
      alreadyUsed: payload.context?.alreadyUsed ?? hasCandidateAction(candidate.key),
    };
    result({ candidate, existingActions, recommendation: recommendDistributionAction(candidate, context) });
    return;
  }

  if (command === 'record-action') {
    const candidate = requireCandidate(payload.key);
    const action = String(payload.action || '');
    if (!['direct', 'quote', 'repost', 'reply'].includes(action)) throw new Error(`Invalid action: ${action}`);
    const recorded = recordCandidateAction({
      candidateKey: candidate.key,
      action,
      outputTweetId: payload.outputTweetId || null,
      outputUrl: payload.outputUrl || null,
      commentary: payload.commentary || '',
    });
    result({ candidateKey: candidate.key, recorded, actions: listCandidateActions(candidate.key) });
    return;
  }

  if (command === 'engage-next') {
    const refresh = payload.refresh === false ? null : await refreshEngagementOpportunities({
      targetLimit: Math.max(1, Math.min(50, Number(payload.targetLimit || 12))),
      postsPerTarget: Math.max(1, Math.min(10, Number(payload.postsPerTarget || 4))),
      minTargetScore: Number(payload.minTargetScore ?? 35),
      targetSinceHours: Math.max(1, Number(payload.targetSinceHours || 24)),
      responseSinceHours: Math.max(1, Number(payload.responseSinceHours || 72)),
    });
    const items = listEngagementItems({
      status: payload.status || undefined,
      minPriority: Number(payload.minPriority || 0),
      includeExpired: Boolean(payload.includeExpired),
      limit: Math.max(1, Math.min(200, Number(payload.limit || 50))),
    });
    const packets = items.map(engagementPacket);
    result({
      refresh: refresh ? { refreshed: refresh.refreshed, rejected: refresh.rejected, expired: refresh.expired, errors: refresh.errors } : null,
      accountHealth: getAccountHealthSummary(),
      activeConversations: packets.filter((item) => item.queueItem.engagementKind !== 'initial_reply'),
      newOpportunities: packets.filter((item) => item.queueItem.engagementKind === 'initial_reply'),
    });
    return;
  }

  if (command === 'engage-draft') {
    const key = String(payload.key || '');
    if (!key) throw new Error('engage-draft requires key.');
    const item = listEngagementItems({ includeExpired: true, limit: 500 }).find((queueItem) => queueItem.candidateKey === key);
    if (!item) throw new Error(`Engagement item not found: ${key}`);
    if (['published', 'ignored', 'expired'].includes(item.status)) throw new Error(`Engagement item is terminal: ${item.status}.`);
    routeCandidate(key, 'reply', { actor: 'agent' });
    let workflow = inspectWorkflow(key);
    if (payload.body != null) {
      const body = String(payload.body).trim();
      if (!body) throw new Error('engage-draft body cannot be empty.');
      const updated = {
        ...workflow.draft,
        body,
        gates: {},
        status: 'draft',
        editor: { ...(workflow.draft.editor || {}), pipeline: 'reply', finalText: body },
      };
      updated.qualityScore = scoreDraft(updated, workflow.candidate).score;
      saveDraft(updated);
      routeCandidate(key, 'reply', { actor: 'agent' });
      workflow = inspectWorkflow(key);
    }
    let review = null;
    if (payload.requestReview === true) {
      review = requestQueueReview(key, {
        factualityConfirmed: payload.factualityConfirmed === true,
        evidenceConfirmed: payload.evidenceConfirmed === true,
      });
      workflow = inspectWorkflow(key);
    }
    const queueItem = workflow.queueItem;
    result({
      ...engagementPacket(queueItem),
      review: review ? { analysis: review.analysis, approvalRequired: true } : null,
      writerPacket: buildWriterPacket({
        candidate: workflow.candidate,
        queueItem,
        draft: workflow.draft,
        relationship: queueItem.targetUsername ? getRelationshipProfile(queueItem.targetUsername) : null,
        recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: key }),
        recentReplies: listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: key }),
        recentReplyArchetypes: listEngagementItems({ includeExpired: true, limit: 30 })
          .filter((recent) => recent.candidateKey !== key && recent.replyArchetype)
          .map((recent) => recent.replyArchetype),
      }),
    });
    return;
  }

  if (command === 'engage-resolve') {
    const key = String(payload.key || '');
    const action = String(payload.action || '');
    if (!key) throw new Error('engage-resolve requires key.');
    if (action === 'ignore' || action === 'expire') {
      result({ queueItem: resolveEngagementItem(key, action, payload.reason || '') });
      return;
    }
    if (action === 'send') {
      if (payload.confirmSend !== true) throw new Error('engage-resolve send requires confirmSend=true for the explicit send action.');
      const accountHealth = getAccountHealthSummary();
      if (accountHealth.health.state === 'constrained') {
        const reason = accountHealth.health.reasons.find((item) => item.level === 'constrained');
        throw new Error(`Engagement send blocked by supported observed constraint: ${reason?.message || 'account health constrained'}`);
      }
      result(await sendApprovedEngagementReply(key));
      return;
    }
    throw new Error(`Invalid engage-resolve action: ${action || 'missing'}.`);
  }

  if (command === 'account-health') {
    const now = payload.now == null ? Date.now() : Number(payload.now);
    if (!Number.isFinite(now)) throw new Error('account-health now must be numeric when supplied.');
    result(getAccountHealthSummary({ now }));
    return;
  }

  if (command === 'health-observe') {
    const type = String(payload.type || '');
    if (!ACCOUNT_HEALTH_OBSERVATION_TYPES.includes(type) || type === 'under_the_hood_snapshot') {
      throw new Error(`Unsupported manual health observation type: ${type || 'missing'}.`);
    }
    const source = String(payload.source || '').trim();
    const sourceRef = String(payload.sourceRef ?? payload.source_ref ?? '').trim();
    const observedAt = Number(payload.observedAt ?? payload.observed_at);
    if (!source || !sourceRef) throw new Error('health-observe requires source and sourceRef provenance.');
    if (!Number.isFinite(observedAt) || observedAt <= 0) throw new Error('health-observe requires a positive observedAt timestamp.');
    const metadata = payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? { ...payload.metadata }
      : {};
    if (payload.label != null && metadata.label == null) metadata.label = String(payload.label);
    if (['visibility_label_observed', 'visibility_label_cleared'].includes(type) && !String(metadata.label || '').trim()) {
      throw new Error(`${type} requires metadata.label.`);
    }
    const observation = recordAccountHealthObservation({
      type,
      severity: payload.severity || 'info',
      source,
      sourceRef,
      metadata,
      observedAt,
    });
    result({ observation, accountHealth: getAccountHealthSummary({ now: Math.max(Date.now(), observedAt) }) });
    return;
  }

  if (command === 'health-under-the-hood') {
    const report = await fetchXUnderTheHoodReport();
    const observation = report.available === true ? recordUnderTheHoodSnapshot(report) : null;
    result({ report, recorded: Boolean(observation), observation, accountHealth: getAccountHealthSummary() });
    return;
  }

  if (command === 'relationship-targets') {
    result({
      targets: listRelationshipProfiles({
        className: payload.className || payload.class || undefined,
        stage: payload.stage || undefined,
        minTargetScore: Number(payload.minTargetScore ?? payload.minScore ?? 0),
        limit: Math.max(1, Math.min(200, Number(payload.limit || 30))),
      }),
    });
    return;
  }

  if (command === 'relationship-inspect') {
    const username = String(payload.username || '').replace(/^@/, '');
    if (!username) throw new Error('relationship-inspect requires username.');
    const profile = getRelationshipProfile(username);
    if (!profile) throw new Error(`Relationship profile not found: ${username}`);
    result({ profile, events: listRelationshipEvents(username, { limit: Math.max(1, Math.min(200, Number(payload.limit || 30))) }) });
    return;
  }

  if (command === 'relationship-events') {
    const username = String(payload.username || '').replace(/^@/, '');
    if (!username) throw new Error('relationship-events requires username.');
    result({ username, events: listRelationshipEvents(username, { limit: Math.max(1, Math.min(200, Number(payload.limit || 50))) }) });
    return;
  }

  if (command === 'audience-sync') {
    result(await syncAudience(payload.username || process.env.X_ACCOUNT || 'ham_zax'));
    return;
  }

  if (command === 'audience') {
    const minScore = Number(payload.minScore || 12);
    result({
      summary: getAudienceSummary(),
      targetAccounts: listAudienceProfiles({ youFollow: true, followsYou: false, minScore, limit: Number(payload.limit || 30) }),
      relevantFollowers: listAudienceProfiles({ followsYou: true, minScore, limit: Number(payload.limit || 30) }),
    });
    return;
  }

  throw new Error('Usage: node agent_bridge.js <ai-config|ai-runtimes|ai-select-default|ai-bind-role|ingest|inspect|create-draft|writer-packet|apply-writer-output|update-draft|queue|schedule-next|schedule-inspect|route|workflow|research|performance|measurements|experiments|experiment-create|experiment-assign|experiment-summary|learning|learning-refresh|learning-accept|learning-retire|decide|record-action|engage-next|engage-draft|engage-resolve|account-health|health-observe|health-under-the-hood|relationship-targets|relationship-inspect|relationship-events|audience-sync|audience> < JSON');
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exit(1);
});
