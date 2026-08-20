import { NICHE_GROUPS } from './strategy.js';
import { viralStyleResearch } from './viral_style_research.js';

export const VIRAL_SWEEP_THRESHOLDS = Object.freeze({
  breakout: Object.freeze({ name: 'breakout', minFaves: 30, minRetweets: 3, minReplies: 2 }),
  strong: Object.freeze({ name: 'strong', minFaves: 100, minRetweets: 10, minReplies: 5 }),
});

function utcDayStart(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function ymd(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function historicalWindows(days, windowDays, analysisNow = Date.now()) {
  const tomorrow = utcDayStart(analysisNow) + 86_400_000;
  const result = [];
  for (let offset = 0; offset < days; offset += windowDays) {
    const until = tomorrow - offset * 86_400_000;
    const size = Math.min(windowDays, days - offset);
    result.push({
      since: ymd(until - size * 86_400_000),
      until: ymd(until),
    });
  }
  return result;
}

function quoteTerm(term) {
  return `"${String(term || '').replaceAll('"', '\\"')}"`;
}

function queryFor(group, threshold, window) {
  const topic = group.terms.map(quoteTerm).join(' OR ');
  return `(${topic}) min_faves:${threshold.minFaves} min_retweets:${threshold.minRetweets} min_replies:${threshold.minReplies} since:${window.since} until:${window.until} lang:en -filter:replies -filter:retweets`;
}

export function buildViralSweepJobs({
  days = 21,
  windowDays = 7,
  niches = NICHE_GROUPS.map((group) => group.tag),
  thresholds = ['strong'],
  analysisNow = Date.now(),
} = {}) {
  const selectedNiches = new Set(niches);
  const selectedThresholds = thresholds.map((name) => VIRAL_SWEEP_THRESHOLDS[name]).filter(Boolean);
  const windows = historicalWindows(days, windowDays, analysisNow);
  const jobs = [];
  for (const group of NICHE_GROUPS) {
    if (!selectedNiches.has(group.tag)) continue;
    for (const window of windows) {
      for (const threshold of selectedThresholds) {
        jobs.push({
          nicheTag: group.tag,
          nicheLabel: group.label,
          threshold: threshold.name,
          since: window.since,
          until: window.until,
          query: queryFor(group, threshold, window),
        });
      }
    }
  }
  return jobs;
}

export async function runViralSweep({
  days = 21,
  windowDays = 7,
  niches = NICHE_GROUPS.map((group) => group.tag),
  thresholds = ['strong'],
  limitPerQuery = 5,
  controlsPerSeed = 0,
  threads = true,
  onProgress = null,
  shouldStop = null,
} = {}) {
  const jobs = buildViralSweepJobs({ days, windowDays, niches, thresholds });
  const results = [];
  let totalSeeds = 0;
  let totalErrors = 0;

  onProgress?.({ stage: 'collecting', checkpoint: 'queued', totalJobs: jobs.length, completedJobs: 0, current: null });
  for (let index = 0; index < jobs.length; index++) {
    if (shouldStop?.()) {
      return { stopped: true, jobs, results, totalSeeds, totalErrors };
    }
    const job = jobs[index];
    onProgress?.({
      stage: 'collecting',
      checkpoint: 'discovering',
      totalJobs: jobs.length,
      completedJobs: index,
      current: job,
      currentCandidate: null,
    });
    try {
      const result = await viralStyleResearch.collect({
        query: job.query,
        limit: limitPerQuery,
        controls: controlsPerSeed,
        threads,
        full: false,
        shouldStop,
        onProgress: (unit) => {
          onProgress?.({
            stage: 'collecting',
            checkpoint: unit.checkpoint || 'enriching',
            totalJobs: jobs.length,
            completedJobs: index,
            current: job,
            currentCandidate: {
              completed: Number(unit.completedCandidates || 0),
              total: unit.totalCandidates == null ? null : Number(unit.totalCandidates),
              candidateId: unit.candidateId || null,
              collectedSeeds: Number(unit.collectedSeeds || 0),
              message: unit.message || '',
            },
          });
        },
      });
      totalSeeds += Number(result.seeds || 0);
      totalErrors += Array.isArray(result.errors) ? result.errors.length : 0;
      results.push({ ...job, ok: true, seeds: result.seeds || 0, errors: result.errors || [] });
      if (result.stopped || shouldStop?.()) {
        return { stopped: true, jobs, results, totalSeeds, totalErrors };
      }
    } catch (error) {
      totalErrors += 1;
      results.push({ ...job, ok: false, seeds: 0, errors: [{ error: error?.message || String(error) }] });
    }
    onProgress?.({
      stage: 'collecting',
      checkpoint: 'discovering',
      totalJobs: jobs.length,
      completedJobs: index + 1,
      current: job,
      currentCandidate: null,
      totalSeeds,
      totalErrors,
    });
  }

  return { stopped: false, jobs, results, totalSeeds, totalErrors };
}

export const viralSweepInternals = Object.freeze({ historicalWindows, queryFor });
