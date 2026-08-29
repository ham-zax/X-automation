import { summarizeContentCohort } from './experiments.js';
import { buildWritingStrategyEvidence } from './strategy_guidance.js';
import { analyzeStoredDataset } from './viral_style_analyze.js';
import {
  PUBLICATION_MEASUREMENT_WINDOWS,
  countPublicationMeasurements,
  getCandidate,
  getExperimentSummary,
  getNewFollowerQuality,
  getQueueItem,
  listExperiments,
  listPublicationMeasurements,
} from './store.js';

const FINAL_WINDOW_MINUTES = 1440;
const STRATEGY_EXPERIMENT_DIMENSIONS = new Set(['style', 'hook_type']);

function stringList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))].sort();
}

function publicationReference(measurement, queueItem, candidate) {
  return {
    measurementId: measurement.id,
    queueItemId: measurement.queueItemId,
    tweetId: measurement.tweetId,
    title: candidate?.title || queueItem?.candidateKey || measurement.tweetId,
    outputUrl: queueItem?.outputUrl || null,
    publishedAt: queueItem?.publishedAt || null,
    capturedAt: measurement.capturedAt,
  };
}

function strategyObservation(measurement) {
  const provenance = measurement?.metadata?.writingStrategy;
  if (!provenance) return { unavailable: 'strategy_provenance_not_recorded', measurement };
  const generation = provenance.generation;
  if (!generation || generation.state !== 'recorded') return { unavailable: 'generation_provenance_not_recorded', measurement, provenance };

  const queueItem = getQueueItem(measurement.queueItemId);
  if (!queueItem?.publishedAt) return { unavailable: 'published_queue_item_unavailable', measurement, provenance };
  const candidate = getCandidate(queueItem.candidateKey);
  const snapshot = generation.strategySnapshot && typeof generation.strategySnapshot === 'object'
    ? generation.strategySnapshot
    : null;
  const strategyMode = generation.strategyMode ?? null;
  const selectionSource = snapshot?.selectionSource || (strategyMode == null ? 'none' : 'unknown');
  const newFollowerQuality = getNewFollowerQuality({ since: measurement.baselineAt, until: measurement.capturedAt });
  const context = {
    strategyMode: strategyMode ?? 'no_selection',
    strategySelectionSource: selectionSource,
    editorialObjective: provenance.editorialObjective || '',
    finalPublishedPipeline: provenance.finalPublishedPipeline || queueItem.pipeline || '',
    growthFitState: provenance.growthFocus?.state || '',
    growthFocusProfileRevision: provenance.growthFocus?.profileRevision ?? null,
    classifierProfileRevision: provenance.candidateClassification?.profileRevision ?? null,
    classifierVersion: provenance.candidateClassification?.classifierVersion ?? null,
  };

  return {
    measurement: { ...measurement, publishedAt: queueItem.publishedAt },
    strategyApplied: generation.strategyApplied === true,
    strategyMode,
    selectionSource,
    approach: {
      intent: snapshot?.intent ?? null,
      style: snapshot?.style ?? null,
      openingFeatures: stringList(snapshot?.openingFeatures),
    },
    context,
    confounders: context,
    newFollowerQuality,
    sourcePublication: publicationReference(measurement, queueItem, candidate),
    provenance,
  };
}

function summarizeNewFollowerQuality(observations) {
  const rows = observations.map((observation) => observation.newFollowerQuality).filter(Boolean);
  const newlyObservedFollowerAssociations = rows.reduce((sum, row) => sum + Number(row.newlyObservedFollowers || 0), 0);
  const relevantFollowerAssociations = rows.reduce((sum, row) => sum + Number(row.nicheAlignedNewFollowers || 0), 0);
  return {
    observationWindows: rows.length,
    newlyObservedFollowerAssociations,
    relevantFollowerAssociations,
    alignmentRate: newlyObservedFollowerAssociations
      ? relevantFollowerAssociations / newlyObservedFollowerAssociations
      : null,
    attribution: 'period_association_only',
    overlappingWindowsMayDoubleCount: true,
  };
}

function summarizeStrategyCohort(observations) {
  return {
    ...summarizeContentCohort(observations),
    newFollowerQuality: summarizeNewFollowerQuality(observations),
    sourcePublications: observations.map((observation) => observation.sourcePublication),
  };
}

function summarizeGroups(observations, valueFor) {
  const groups = new Map();
  for (const observation of observations) {
    const values = Array.isArray(valueFor(observation)) ? valueFor(observation) : [valueFor(observation)];
    for (const raw of values) {
      const value = String(raw || '').trim();
      if (!value) continue;
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(observation);
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, rows]) => ({ value, summary: summarizeStrategyCohort(rows) }));
}

export function getWritingStrategyOutcomeSummary({ windowMinutes = FINAL_WINDOW_MINUTES, limit = 200 } = {}) {
  const window = Number(windowMinutes);
  if (!PUBLICATION_MEASUREMENT_WINDOWS.includes(window)) throw new Error(`Unsupported writing-strategy outcome window: ${windowMinutes}.`);
  const measurements = listPublicationMeasurements({ windowMinutes: window, limit });
  const usableMeasurements = measurements.filter((measurement) => measurement.captureTiming?.ageAppropriate !== false);
  const totalMeasurementCount = countPublicationMeasurements({ windowMinutes: window });
  const resolved = usableMeasurements.map(strategyObservation);
  const observations = resolved.filter((entry) => !entry.unavailable);
  const applied = observations.filter((observation) => observation.strategyApplied);
  const unavailable = resolved.filter((entry) => entry.unavailable);

  return {
    windowMinutes: window,
    availability: observations.length
      ? 'available'
      : measurements.length
        ? 'generation_provenance_unavailable'
        : 'no_measurements',
    measurementCount: measurements.length,
    excludedLateMeasurementCount: measurements.length - usableMeasurements.length,
    totalMeasurementCount,
    truncated: totalMeasurementCount > measurements.length,
    observationCount: observations.length,
    appliedObservationCount: applied.length,
    unavailable: {
      strategyProvenanceNotRecorded: unavailable.filter((entry) => entry.unavailable === 'strategy_provenance_not_recorded').length,
      generationProvenanceNotRecorded: unavailable.filter((entry) => entry.unavailable === 'generation_provenance_not_recorded').length,
      publishedQueueItemUnavailable: unavailable.filter((entry) => entry.unavailable === 'published_queue_item_unavailable').length,
    },
    byIntent: summarizeGroups(applied, (observation) => observation.approach.intent),
    byStyle: summarizeGroups(applied, (observation) => observation.approach.style),
    byOpeningFeature: summarizeGroups(applied, (observation) => observation.approach.openingFeatures),
    byStrategyMode: summarizeGroups(observations, (observation) => observation.strategyMode ?? 'no_selection'),
    bySelectionSource: summarizeGroups(observations, (observation) => observation.selectionSource),
    observations: observations.map((observation) => ({
      sourcePublication: observation.sourcePublication,
      strategyApplied: observation.strategyApplied,
      strategyMode: observation.strategyMode,
      selectionSource: observation.selectionSource,
      approach: observation.approach,
      newFollowerQuality: observation.newFollowerQuality,
      publicationSelection: observation.provenance.publicationSelection,
      generation: observation.provenance.generation,
      editorialObjective: observation.provenance.editorialObjective,
      finalPublishedPipeline: observation.provenance.finalPublishedPipeline,
      growthFocus: observation.provenance.growthFocus,
      candidateClassification: observation.provenance.candidateClassification,
      limitations: observation.provenance.limitations || [],
    })),
    comparisonEvidenceState: null,
    causalClaimAllowed: false,
    limitations: [
      'Cohorts use one fixed publication window, exclude captures that crossed into a later nominal window, and are descriptive associations rather than causal effectiveness estimates.',
      'Intent, style, and opening-feature cohorts include only generations where strategyApplied=true.',
      'Suggest, Off, and no-selection cohorts describe generation modes; Suggest does not imply Writer influence.',
      'New-follower quality uses period associations from getNewFollowerQuality(); overlapping publication windows may count the same newly observed follower in more than one cohort observation.',
    ],
  };
}

function externalGroup(group = {}) {
  return {
    ...group,
    id: `viral:${group.groupType}:${group.label}`,
    rationale: `External Viral ${group.groupType} pattern ${group.label}: n=${Number(group.sampleSize || 0)}, authors=${Number(group.uniqueAuthors || 0)}.`,
    limitations: ['External Viral evidence is observational and does not prove X-ranking causality or future performance.'],
  };
}

function externalPatterns(report) {
  return {
    supportedGroups: (report?.supportedGroups || []).map(externalGroup),
    directionalGroups: (report?.directionalGroups || []).map(externalGroup),
    insufficientGroups: (report?.insufficientGroups || []).map(externalGroup),
  };
}

function externalEvidenceRead(report) {
  const evidence = buildWritingStrategyEvidence({ externalPatterns: externalPatterns(report) });
  return evidence.externalEvidence.filter((ref) => (
    ref.strategy?.intent || ref.strategy?.style || ref.strategy?.openingFeatures?.length
  ));
}

function experimentEvidenceRead(windowMinutes) {
  return listExperiments({ limit: 100 })
    .filter((experiment) => STRATEGY_EXPERIMENT_DIMENSIONS.has(experiment.dimension))
    .map((experiment) => {
      const result = getExperimentSummary(experiment.id, { windowMinutes });
      const summary = result.summary;
      return {
        experimentId: experiment.id,
        name: experiment.name,
        status: experiment.status,
        dimension: experiment.dimension,
        windowMinutes,
        variants: experiment.variants,
        sampleSize: summary.sampleSize,
        completedByVariant: summary.completedByVariant,
        primaryMetric: summary.primaryMetric,
        primaryMetricValues: summary.primaryMetricValues,
        secondaryMetricValues: summary.secondaryMetricValues,
        evidence: summary.evidence,
        interpretation: summary.interpretation,
      };
    });
}

function cohortIndex(outcomes) {
  const result = new Map();
  for (const [dimension, groups] of [
    ['intent', outcomes.byIntent],
    ['style', outcomes.byStyle],
    ['opening_feature', outcomes.byOpeningFeature],
  ]) {
    for (const group of groups) result.set(`${dimension}:${group.value}`, group.summary);
  }
  return result;
}

function comparisonKeys(externalEvidence, outcomes) {
  const keys = new Set();
  for (const ref of externalEvidence) {
    if (ref.strategy?.intent) keys.add(`intent:${ref.strategy.intent}`);
    if (ref.strategy?.style) keys.add(`style:${ref.strategy.style}`);
    for (const feature of ref.strategy?.openingFeatures || []) keys.add(`opening_feature:${feature}`);
  }
  for (const [dimension, groups] of [
    ['intent', outcomes.byIntent],
    ['style', outcomes.byStyle],
    ['opening_feature', outcomes.byOpeningFeature],
  ]) {
    for (const group of groups) keys.add(`${dimension}:${group.value}`);
  }
  return [...keys].sort();
}

function externalForKey(externalEvidence, dimension, value) {
  return externalEvidence.filter((ref) => {
    if (dimension === 'intent') return ref.strategy?.intent === value;
    if (dimension === 'style') return ref.strategy?.style === value;
    return (ref.strategy?.openingFeatures || []).includes(value);
  });
}

export async function getWritingStrategyFeedbackReadModel({ windowMinutes = FINAL_WINDOW_MINUTES, limit = 200, outcomes = null } = {}) {
  const ownAccount = outcomes || getWritingStrategyOutcomeSummary({ windowMinutes, limit });
  let external;
  try {
    const report = await analyzeStoredDataset({ days: 21, matureHours: 24, confidence: 0.90 });
    external = {
      available: true,
      generatedAt: report.generatedAt,
      windowDays: report.windowDays,
      maturityHours: report.maturityHours,
      confidence: report.confidence,
      dataset: report.dataset,
      evidence: externalEvidenceRead(report),
      error: null,
    };
  } catch (error) {
    external = {
      available: false,
      generatedAt: null,
      windowDays: 21,
      maturityHours: 24,
      confidence: 0.90,
      dataset: null,
      evidence: [],
      error: error?.message || String(error),
    };
  }

  const ownIndex = cohortIndex(ownAccount);
  const comparisons = comparisonKeys(external.evidence, ownAccount).map((key) => {
    const separator = key.indexOf(':');
    const dimension = key.slice(0, separator);
    const value = key.slice(separator + 1);
    return {
      dimension,
      value,
      externalEvidence: externalForKey(external.evidence, dimension, value),
      ownAccount: ownIndex.get(key) || null,
      agreementState: null,
      limitations: [
        'External evidence and own-account outcomes are shown side by side without an automatic agreement verdict because no justified deterministic comparison threshold is defined.',
      ],
    };
  });

  return {
    windowMinutes: Number(windowMinutes),
    externalEvidence: external,
    ownAccount,
    experimentEvidence: experimentEvidenceRead(Number(windowMinutes)),
    comparisons,
    agreementInterpretation: null,
    limitations: [
      'External Viral evidence remains observational and is not treated as X-ranking causality.',
      'Own-account cohorts are descriptive associations from real fixed-window publication measurements.',
      'Experiment evidence preserves the existing Phase-4 evidence state and assignment semantics.',
      'No learned rule is accepted, retired, or changed by this read model.',
    ],
  };
}
