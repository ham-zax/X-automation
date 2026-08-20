import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildViralStyleReportRows,
  extractViralStyleFeatures,
} from './viral_style.js';

const DATA_DIR = path.resolve(process.env.VIRAL_STYLE_DIR || '.viral-style-research');
const POSTS_FILE = path.join(DATA_DIR, 'posts.jsonl');
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.jsonl');
const THREADS_FILE = path.join(DATA_DIR, 'threads.jsonl');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s);
    if (inlineValue !== undefined) options[rawKey] = inlineValue;
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) options[rawKey] = argv[++index];
    else options[rawKey] = true;
  }
  return options;
}

function finite(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function median(values) {
  const numbers = values.map(finite).filter((value) => value != null).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

function ratio(numerator, denominator) {
  const left = finite(numerator);
  const right = finite(denominator);
  if (left == null || right == null || right <= 0) return null;
  return left / right;
}

async function readJsonl(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function inverseNormalCdf(probability) {
  if (!(probability > 0 && probability < 1)) throw new RangeError('probability must be between 0 and 1');

  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];
  const low = 0.02425;
  const high = 1 - low;

  if (probability < low) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (probability <= high) {
    const q = probability - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
      / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - probability));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
    / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function wilsonInterval(successes, total, confidence = 0.90) {
  const n = finite(total);
  const x = finite(successes);
  if (n == null || x == null || n <= 0 || x < 0 || x > n) return { low: null, high: null };
  const z = inverseNormalCdf(0.5 + confidence / 2);
  const p = x / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

function percentileAgainst(value, peers) {
  const target = finite(value);
  const values = peers.map(finite).filter((peer) => peer != null);
  if (target == null || !values.length) return null;
  let lower = 0;
  let equal = 0;
  for (const peer of values) {
    if (peer < target) lower++;
    else if (peer === target) equal++;
  }
  return (lower + equal * 0.5) / values.length;
}

function currentTaxonomyRow(row, post) {
  const styleFeatures = extractViralStyleFeatures({
    ...post,
    text: row.text || post?.text || '',
  });
  return {
    ...row,
    isReply: Boolean(post?.isReply),
    isQuote: Boolean(post?.isQuote),
    isRetweet: Boolean(post?.isRetweet),
    hookLabels: styleFeatures.hookLabels,
    styleLabels: styleFeatures.styleLabels,
    styleFeatures,
  };
}

function makeEligibleRows(posts, snapshots, threads, {
  days,
  matureHours,
  analysisNow,
}) {
  const postById = new Map(posts.map((post) => [String(post.id || ''), post]));
  const cutoff = analysisNow - days * 86_400_000;
  return buildViralStyleReportRows(posts, snapshots, threads)
    .map((row) => currentTaxonomyRow(row, postById.get(String(row.tweetId || ''))))
    .filter((row) => row.createdAt != null && row.createdAt >= cutoff)
    .filter((row) => row.observedAt != null)
    .filter((row) => finite(row.postAgeMinutes) != null && Number(row.postAgeMinutes) >= matureHours * 60)
    .filter((row) => !row.isRetweet && !row.isReply)
    .filter((row) => finite(row.viewsPerFollower) != null);
}

function addComparisons(rows) {
  const byAuthor = new Map();
  const byCohortAge = new Map();

  for (const row of rows) {
    const authorKey = String(row.username || '').toLowerCase();
    if (!byAuthor.has(authorKey)) byAuthor.set(authorKey, []);
    byAuthor.get(authorKey).push(row);

    const cohortKey = `${row.followerCohort}|${row.ageBand}`;
    if (!byCohortAge.has(cohortKey)) byCohortAge.set(cohortKey, []);
    byCohortAge.get(cohortKey).push(row);
  }

  return rows.map((row) => {
    const authorKey = String(row.username || '').toLowerCase();
    const authorPeers = (byAuthor.get(authorKey) || []).filter((peer) => (
      peer.tweetId !== row.tweetId
      && peer.ageBand === row.ageBand
      && finite(peer.viewsPerFollower) != null
    ));
    const authorMedianViewsPerFollower = authorPeers.length >= 2
      ? median(authorPeers.map((peer) => peer.viewsPerFollower))
      : null;
    const authorViewsLift = authorMedianViewsPerFollower != null
      ? ratio(row.viewsPerFollower, authorMedianViewsPerFollower)
      : null;

    const cohortKey = `${row.followerCohort}|${row.ageBand}`;
    const cohortPeers = (byCohortAge.get(cohortKey) || []).filter((peer) => (
      peer.tweetId !== row.tweetId
      && finite(peer.viewsPerFollower) != null
    ));
    const cohortPercentile = cohortPeers.length >= 4
      ? percentileAgainst(row.viewsPerFollower, cohortPeers.map((peer) => peer.viewsPerFollower))
      : null;

    return {
      ...row,
      authorPeerCount: authorPeers.length,
      authorMedianViewsPerFollower,
      authorViewsLift,
      authorWin: authorViewsLift == null ? null : authorViewsLift > 1,
      cohortPeerCount: cohortPeers.length,
      cohortPercentile,
      cohortBreakout: cohortPercentile == null ? null : cohortPercentile >= 0.75,
    };
  });
}

function evidenceClass(summary) {
  if (summary.sampleSize < 5 || summary.uniqueAuthors < 3) return 'INSUFFICIENT';
  if (
    summary.sampleSize >= 10
    && summary.uniqueAuthors >= 5
    && summary.authorComparableCount >= 8
    && finite(summary.medianAuthorViewsLift) != null
    && summary.medianAuthorViewsLift >= 1.5
    && finite(summary.authorWinRate90CiLow) != null
    && summary.authorWinRate90CiLow > 0.50
  ) return 'STRONG_REPEATED_ASSOCIATION';
  if (
    summary.sampleSize >= 6
    && summary.uniqueAuthors >= 3
    && (
      (
        summary.authorComparableCount >= 5
        && finite(summary.medianAuthorViewsLift) != null
        && summary.medianAuthorViewsLift > 1
        && finite(summary.authorWinRate90CiLow) != null
        && summary.authorWinRate90CiLow > 0.50
      )
      || (
        summary.cohortComparableCount >= 8
        && finite(summary.cohortBreakoutRate90CiLow) != null
        && summary.cohortBreakoutRate90CiLow > 0.25
      )
    )
  ) return 'REPEATED_ASSOCIATION';
  return 'DIRECTIONAL';
}

function summarizeGroup(type, label, rows, confidence) {
  const authorComparable = rows.filter((row) => row.authorWin != null);
  const authorWins = authorComparable.filter((row) => row.authorWin).length;
  const authorInterval = wilsonInterval(authorWins, authorComparable.length, confidence);
  const cohortComparable = rows.filter((row) => row.cohortBreakout != null);
  const cohortBreakouts = cohortComparable.filter((row) => row.cohortBreakout).length;
  const cohortInterval = wilsonInterval(cohortBreakouts, cohortComparable.length, confidence);

  const summary = {
    groupType: type,
    label,
    sampleSize: rows.length,
    uniqueAuthors: new Set(rows.map((row) => String(row.username || '').toLowerCase()).filter(Boolean)).size,
    medianViewsPerFollower: median(rows.map((row) => row.viewsPerFollower)),
    medianEngagementsPerView: median(rows.map((row) => row.engagementsPerView)),
    medianBookmarksPerView: median(rows.map((row) => row.bookmarksPerView)),
    medianRepostsPerView: median(rows.map((row) => row.repostsPerView)),
    medianRepliesPerView: median(rows.map((row) => row.repliesPerView)),
    medianViewsPerHour: median(rows.map((row) => row.viewsPerHour)),
    authorComparableCount: authorComparable.length,
    authorWinCount: authorWins,
    authorWinRate: ratio(authorWins, authorComparable.length),
    authorWinRate90CiLow: authorInterval.low,
    authorWinRate90CiHigh: authorInterval.high,
    medianAuthorViewsLift: median(authorComparable.map((row) => row.authorViewsLift)),
    cohortComparableCount: cohortComparable.length,
    cohortBreakoutCount: cohortBreakouts,
    cohortBreakoutRate: ratio(cohortBreakouts, cohortComparable.length),
    cohortBreakoutRate90CiLow: cohortInterval.low,
    cohortBreakoutRate90CiHigh: cohortInterval.high,
  };
  summary.evidenceClass = evidenceClass(summary);
  return summary;
}

function featureLabels(row) {
  const features = row.styleFeatures || {};
  const labels = [];
  const add = (label, condition) => { if (condition) labels.push(label); };
  add('first_person_experience', features.hasFirstPersonExperience);
  add('second_person_address', features.hasSecondPersonAddress);
  add('contains_number', Number(features.numberCount || 0) > 0);
  add('contains_percentage', Number(features.percentCount || 0) > 0);
  add('short_first_line_60_chars_or_less', Number(features.firstLineChars || 0) > 0 && Number(features.firstLineChars || 0) <= 60);
  add('short_post_40_words_or_less', Number(features.wordCount || 0) > 0 && Number(features.wordCount || 0) <= 40);
  add('multi_paragraph', Number(features.paragraphCount || 0) >= 2);
  add('question_present', Number(features.questionCount || 0) > 0);
  add('exclamation_present', Number(features.exclamationCount || 0) > 0);
  add('link_present', Number(features.linkCount || 0) > 0);
  add('mention_present', Number(features.mentionCount || 0) > 0);
  add('hashtag_present', Number(features.hashtagCount || 0) > 0);
  add('bullet_list', Number(features.bulletLineCount || 0) > 0);
  add('media_present', row.mediaType && row.mediaType !== 'none');
  add('benchmark_language', features.hasBenchmarkLanguage);
  add('cost_value_language', features.hasCostValueLanguage);
  add('release_language', features.hasReleaseLanguage);
  add('urgency_language', features.hasUrgencyLanguage);
  add('contrarian_language', features.hasContrarianLanguage);
  add('curiosity_gap', features.hasCuriosityGap);
  add('resource_promise', features.hasResourcePromise);
  add('thread_promise', features.hasThreadPromise);
  return labels;
}

function grouped(rows, type, labelsForRow, confidence) {
  const map = new Map();
  for (const row of rows) {
    for (const rawLabel of labelsForRow(row)) {
      const label = String(rawLabel || '').trim();
      if (!label) continue;
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(row);
    }
  }
  return [...map.entries()]
    .map(([label, items]) => summarizeGroup(type, label, items, confidence))
    .sort((left, right) => {
      const strength = {
        STRONG_REPEATED_ASSOCIATION: 4,
        REPEATED_ASSOCIATION: 3,
        DIRECTIONAL: 2,
        INSUFFICIENT: 1,
      };
      return (strength[right.evidenceClass] - strength[left.evidenceClass])
        || (right.sampleSize - left.sampleSize)
        || left.label.localeCompare(right.label);
    });
}

function timingSummaries(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.publicationUtcHour == null) continue;
    const hour = Number(row.publicationUtcHour);
    if (!map.has(hour)) map.set(hour, []);
    map.get(hour).push(row);
  }
  return [...map.entries()]
    .filter(([, items]) => items.length >= 4)
    .map(([hour, items]) => ({
      utcHour: hour,
      sampleSize: items.length,
      uniqueAuthors: new Set(items.map((item) => item.username)).size,
      medianViewsPerFollower: median(items.map((item) => item.viewsPerFollower)),
      medianEngagementsPerView: median(items.map((item) => item.engagementsPerView)),
      medianBookmarksPerView: median(items.map((item) => item.bookmarksPerView)),
      medianViewsPerHour: median(items.map((item) => item.viewsPerHour)),
    }))
    .sort((left, right) => right.medianViewsPerFollower - left.medianViewsPerFollower || left.utcHour - right.utcHour);
}

function threadSummary(rows) {
  const roots = rows.filter((row) => Number(row.threadLength || 1) > 1);
  return {
    sampleSize: roots.length,
    evidenceClass: roots.length >= 5 ? 'DIRECTIONAL' : 'INSUFFICIENT',
    completeCount: roots.filter((row) => row.threadComplete === true).length,
    partialCount: roots.filter((row) => row.threadComplete === false).length,
    unknownCompletenessCount: roots.filter((row) => row.threadComplete == null).length,
    medianThreadLength: median(roots.map((row) => row.threadLength)),
    medianViewsPerFollower: median(roots.map((row) => row.viewsPerFollower)),
    examples: roots
      .slice()
      .sort((left, right) => (right.viewsPerFollower || 0) - (left.viewsPerFollower || 0))
      .slice(0, 5)
      .map((row) => ({
        tweetId: row.tweetId,
        username: row.username,
        url: row.url,
        firstLine: row.styleFeatures?.firstLine || '',
        viewsPerFollower: row.viewsPerFollower,
        threadLength: row.threadLength,
        threadExpectedLength: row.threadExpectedLength,
        threadComplete: row.threadComplete,
      })),
  };
}

function analyzeWindow(posts, snapshots, threads, {
  days,
  matureHours,
  confidence,
  analysisNow,
}) {
  const eligible = addComparisons(makeEligibleRows(posts, snapshots, threads, {
    days,
    matureHours,
    analysisNow,
  }));

  const styleGroups = grouped(eligible, 'style', (row) => row.styleLabels, confidence);
  const hookGroups = grouped(eligible, 'hook', (row) => row.hookLabels, confidence);
  const featureGroups = grouped(eligible, 'feature', featureLabels, confidence);
  const groups = [...styleGroups, ...hookGroups, ...featureGroups].sort((left, right) => {
    const strength = {
      STRONG_REPEATED_ASSOCIATION: 4,
      REPEATED_ASSOCIATION: 3,
      DIRECTIONAL: 2,
      INSUFFICIENT: 1,
    };
    return (strength[right.evidenceClass] - strength[left.evidenceClass])
      || (right.sampleSize - left.sampleSize)
      || left.label.localeCompare(right.label);
  });

  const topPosts = eligible
    .slice()
    .sort((left, right) => (right.viewsPerFollower || 0) - (left.viewsPerFollower || 0))
    .slice(0, 12)
    .map((row) => ({
      tweetId: row.tweetId,
      username: row.username,
      url: row.url,
      firstLine: row.styleFeatures?.firstLine || '',
      sampleKind: row.sampleKind,
      postAgeMinutes: row.postAgeMinutes,
      authorFollowers: row.authorFollowers,
      views: row.views,
      viewsPerFollower: row.viewsPerFollower,
      engagementsPerView: row.engagementsPerView,
      bookmarksPerView: row.bookmarksPerView,
      authorPeerCount: row.authorPeerCount,
      authorViewsLift: row.authorViewsLift,
      cohortPeerCount: row.cohortPeerCount,
      cohortPercentile: row.cohortPercentile,
      hookLabels: row.hookLabels,
      styleLabels: row.styleLabels,
    }));

  return {
    generatedAt: analysisNow,
    windowDays: days,
    maturityHours: matureHours,
    confidence,
    interpretation: 'Observational retrospective evidence inside the collected dataset. Confidence intervals describe directional rates; they are not future-post accuracy or X ranking causality.',
    dataset: {
      totalStoredPosts: posts.length,
      totalStoredSnapshots: snapshots.length,
      totalStoredThreads: threads.length,
      eligiblePosts: eligible.length,
      eligibleAuthors: new Set(eligible.map((row) => row.username)).size,
      eligibleBySampleKind: Object.fromEntries([...new Set(eligible.map((row) => row.sampleKind))].sort().map((kind) => [kind, eligible.filter((row) => row.sampleKind === kind).length])),
      authorComparablePosts: eligible.filter((row) => row.authorWin != null).length,
      cohortComparablePosts: eligible.filter((row) => row.cohortBreakout != null).length,
    },
    supportedGroups: groups.filter((group) => ['REPEATED_ASSOCIATION', 'STRONG_REPEATED_ASSOCIATION'].includes(group.evidenceClass)),
    directionalGroups: groups.filter((group) => group.evidenceClass === 'DIRECTIONAL'),
    insufficientGroups: groups.filter((group) => group.evidenceClass === 'INSUFFICIENT'),
    styleGroups,
    hookGroups,
    featureGroups,
    timing: timingSummaries(eligible),
    threads: threadSummary(eligible),
    topPosts,
    rows: eligible,
  };
}

function csvCell(value) {
  if (value == null) return '';
  const text = Array.isArray(value) ? value.join('|') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(records) {
  if (!records.length) return '';
  const headers = Object.keys(records[0]);
  return `${headers.map(csvCell).join(',')}\n${records.map((record) => headers.map((header) => csvCell(record[header])).join(',')).join('\n')}\n`;
}

function postCsvRecord(row) {
  return {
    tweetId: row.tweetId,
    url: row.url,
    username: row.username,
    sampleKind: row.sampleKind,
    createdAtUtc: row.createdAtIso,
    publicationUtcHour: row.publicationUtcHour,
    ageBand: row.ageBand,
    postAgeMinutes: row.postAgeMinutes,
    authorFollowersAtObservation: row.authorFollowers,
    followerCohort: row.followerCohort,
    views: row.views,
    likes: row.likes,
    reposts: row.reposts,
    replies: row.replies,
    bookmarks: row.bookmarks,
    viewsPerFollower: row.viewsPerFollower,
    engagementsPerView: row.engagementsPerView,
    bookmarksPerView: row.bookmarksPerView,
    repostsPerView: row.repostsPerView,
    repliesPerView: row.repliesPerView,
    viewsPerHour: row.viewsPerHour,
    authorPeerCount: row.authorPeerCount,
    authorMedianViewsPerFollower: row.authorMedianViewsPerFollower,
    authorViewsLift: row.authorViewsLift,
    authorWin: row.authorWin,
    cohortPeerCount: row.cohortPeerCount,
    cohortPercentile: row.cohortPercentile,
    cohortBreakout: row.cohortBreakout,
    isQuote: row.isQuote,
    mediaType: row.mediaType,
    threadLength: row.threadLength,
    threadExpectedLength: row.threadExpectedLength,
    threadComplete: row.threadComplete,
    hookLabels: row.hookLabels,
    styleLabels: row.styleLabels,
    firstLine: row.styleFeatures?.firstLine || '',
    wordCount: row.styleFeatures?.wordCount,
    firstLineChars: row.styleFeatures?.firstLineChars,
    paragraphCount: row.styleFeatures?.paragraphCount,
    bulletLineCount: row.styleFeatures?.bulletLineCount,
    numberCount: row.styleFeatures?.numberCount,
    percentCount: row.styleFeatures?.percentCount,
    hasFirstPersonExperience: row.styleFeatures?.hasFirstPersonExperience,
    hasSecondPersonAddress: row.styleFeatures?.hasSecondPersonAddress,
    hasBenchmarkLanguage: row.styleFeatures?.hasBenchmarkLanguage,
    hasCostValueLanguage: row.styleFeatures?.hasCostValueLanguage,
    hasReleaseLanguage: row.styleFeatures?.hasReleaseLanguage,
    hasCuriosityGap: row.styleFeatures?.hasCuriosityGap,
    hasResourcePromise: row.styleFeatures?.hasResourcePromise,
    hasThreadPromise: row.styleFeatures?.hasThreadPromise,
  };
}

function groupCsvRecord(group) {
  return { ...group };
}

function percent(value, digits = 0) {
  const number = finite(value);
  return number == null ? 'n/a' : `${(number * 100).toFixed(digits)}%`;
}

function numeric(value, digits = 2) {
  const number = finite(value);
  return number == null ? 'n/a' : number.toFixed(digits);
}

function groupLine(group) {
  const authorEvidence = group.authorComparableCount
    ? `author wins ${group.authorWinCount}/${group.authorComparableCount} (${percent(group.authorWinRate)}; 90% CI ${percent(group.authorWinRate90CiLow, 1)}-${percent(group.authorWinRate90CiHigh, 1)}), median lift ${numeric(group.medianAuthorViewsLift)}x`
    : 'author-relative comparison unavailable';
  const cohortEvidence = group.cohortComparableCount
    ? `matched-cohort top-quartile ${group.cohortBreakoutCount}/${group.cohortComparableCount} (${percent(group.cohortBreakoutRate)}; 90% CI ${percent(group.cohortBreakoutRate90CiLow, 1)}-${percent(group.cohortBreakoutRate90CiHigh, 1)})`
    : 'matched-cohort comparison unavailable';
  return `- **${group.groupType}:${group.label}** — n=${group.sampleSize}, authors=${group.uniqueAuthors}; median views/follower ${numeric(group.medianViewsPerFollower)}; ${authorEvidence}; ${cohortEvidence}.`;
}

function markdownReport(report) {
  const lines = [];
  lines.push(`# Viral Style Retrospective — ${report.windowDays} days`);
  lines.push('');
  lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`);
  lines.push(`Maturity floor: ${report.maturityHours}h`);
  lines.push(`Confidence level for directional-rate intervals: ${(report.confidence * 100).toFixed(0)}%`);
  lines.push('');
  lines.push('## Study population');
  lines.push('');
  lines.push(`- Stored dataset: ${report.dataset.totalStoredPosts} posts / ${report.dataset.totalStoredSnapshots} snapshots / ${report.dataset.totalStoredThreads} thread records.`);
  lines.push(`- Eligible mature posts in this window: ${report.dataset.eligiblePosts} across ${report.dataset.eligibleAuthors} authors.`);
  lines.push(`- Same-author/same-age comparable posts: ${report.dataset.authorComparablePosts}.`);
  lines.push(`- Matched follower-cohort/age comparable posts: ${report.dataset.cohortComparablePosts}.`);
  lines.push(`- Eligible sample kinds: ${Object.entries(report.dataset.eligibleBySampleKind).map(([key, value]) => `${key}=${value}`).join(', ') || 'none'}.`);
  lines.push('');
  lines.push('## What the current evidence supports');
  lines.push('');
  if (!report.supportedGroups.length) lines.push('No hook/style/feature group currently reaches the repeated-association threshold. This is a valid result; the analyzer will not turn sparse data into a style rule.');
  else report.supportedGroups.forEach((group) => lines.push(groupLine(group)));
  lines.push('');
  lines.push('## Promising but not established');
  lines.push('');
  if (!report.directionalGroups.length) lines.push('No directional groups meet the minimum 5-post / 3-author breadth requirement.');
  else report.directionalGroups.slice(0, 15).forEach((group) => lines.push(groupLine(group)));
  lines.push('');
  lines.push('## Insufficient sample');
  lines.push('');
  report.insufficientGroups.slice(0, 20).forEach((group) => lines.push(`- ${group.groupType}:${group.label} — n=${group.sampleSize}, authors=${group.uniqueAuthors}.`));
  if (!report.insufficientGroups.length) lines.push('None.');
  lines.push('');
  lines.push('## Top normalized individual performers');
  lines.push('');
  for (const post of report.topPosts) {
    lines.push(`- @${post.username} — ${numeric(post.viewsPerFollower)} views/follower, ${post.views ?? 'n/a'} views, ${post.authorFollowers ?? 'n/a'} followers at observation; ${post.hookLabels.join(', ') || 'no hook label'}; ${post.styleLabels.join(', ') || 'no style label'} — ${post.firstLine} — ${post.url}`);
  }
  lines.push('');
  lines.push('## Timing observations');
  lines.push('');
  if (!report.timing.length) lines.push('No UTC publication hour has at least four eligible observations.');
  else report.timing.forEach((slot) => lines.push(`- ${String(slot.utcHour).padStart(2, '0')}:00 UTC — n=${slot.sampleSize}, authors=${slot.uniqueAuthors}, median views/follower ${numeric(slot.medianViewsPerFollower)}, median engagement/view ${percent(slot.medianEngagementsPerView, 2)}.`));
  lines.push('');
  lines.push('## Thread observations');
  lines.push('');
  lines.push(`Thread roots in eligible sample: ${report.threads.sampleSize}; evidence class: ${report.threads.evidenceClass}.`);
  if (report.threads.examples.length) {
    for (const example of report.threads.examples) {
      lines.push(`- @${example.username} — observed ${example.threadLength}${example.threadExpectedLength ? `/${example.threadExpectedLength}` : ''} posts, complete=${String(example.threadComplete)}, views/follower ${numeric(example.viewsPerFollower)} — ${example.firstLine} — ${example.url}`);
    }
  }
  lines.push('');
  lines.push('## Interpretation limits');
  lines.push('');
  lines.push('- This is a selected research dataset, not a random sample of all X posts.');
  lines.push('- Follower counts are observation-time counts, not reconstructed follower counts at the exact publication moment.');
  lines.push('- Same-author and follower/age matching reduce some reach confounding but do not remove topic, news-cycle, media, network, or distribution confounding.');
  lines.push('- A 90% confidence interval here describes uncertainty around an observed directional rate. It is not 90% predictive accuracy for future virality.');
  lines.push('- No result in this report is an X ranking-factor claim or a causal guarantee.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function writeReport(report) {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  const prefix = `retrospective_${report.windowDays}d`;
  const jsonFile = path.join(DATA_DIR, `${prefix}.json`);
  const postsFile = path.join(DATA_DIR, `${prefix}_posts.csv`);
  const groupsFile = path.join(DATA_DIR, `${prefix}_groups.csv`);
  const markdownFile = path.join(DATA_DIR, `${prefix}.md`);

  const jsonCopy = { ...report };
  delete jsonCopy.rows;
  await fs.writeFile(jsonFile, `${JSON.stringify(jsonCopy, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.writeFile(postsFile, toCsv(report.rows.map(postCsvRecord)), { encoding: 'utf8', mode: 0o600 });
  await fs.writeFile(groupsFile, toCsv([...report.styleGroups, ...report.hookGroups, ...report.featureGroups].map(groupCsvRecord)), { encoding: 'utf8', mode: 0o600 });
  await fs.writeFile(markdownFile, markdownReport(report), { encoding: 'utf8', mode: 0o600 });

  return { jsonFile, postsFile, groupsFile, markdownFile };
}

async function loadDataset() {
  const [posts, snapshots, threads] = await Promise.all([
    readJsonl(POSTS_FILE),
    readJsonl(SNAPSHOTS_FILE),
    readJsonl(THREADS_FILE),
  ]);
  return { posts, snapshots, threads };
}

async function analyzeAndWrite(dataset, options) {
  const report = analyzeWindow(dataset.posts, dataset.snapshots, dataset.threads, options);
  const files = await writeReport(report);
  return {
    windowDays: report.windowDays,
    maturityHours: report.maturityHours,
    eligiblePosts: report.dataset.eligiblePosts,
    eligibleAuthors: report.dataset.eligibleAuthors,
    supportedGroups: report.supportedGroups.map((group) => ({
      groupType: group.groupType,
      label: group.label,
      evidenceClass: group.evidenceClass,
      sampleSize: group.sampleSize,
      uniqueAuthors: group.uniqueAuthors,
    })),
    directionalGroups: report.directionalGroups.length,
    files,
  };
}

function usage() {
  return `Usage:\n  node viral_style_analyze.js --days 30 --mature-hours 24 --confidence 0.90\n  node viral_style_analyze.js --days 14 --mature-hours 24 --confidence 0.90\n  node viral_style_analyze.js --all [--mature-hours 24] [--confidence 0.90]\n\nReads only ${DATA_DIR} and writes retrospective reports back into that gitignored directory.`;
}

async function main() {
  const options = parseArgs();
  if (options.help || options.h) {
    console.log(usage());
    return;
  }
  const matureHours = boundedNumber(options['mature-hours'], 24, 1, 24 * 30);
  const confidence = boundedNumber(options.confidence, 0.90, 0.50, 0.999);
  const analysisNow = Date.now();
  const dataset = await loadDataset();

  if (options.all) {
    const results = [];
    for (const days of [14, 30]) {
      results.push(await analyzeAndWrite(dataset, { days, matureHours, confidence, analysisNow }));
    }
    console.log(JSON.stringify({ analysisNow, results }, null, 2));
    return;
  }

  const days = boundedNumber(options.days, 30, 1, 365);
  const result = await analyzeAndWrite(dataset, { days, matureHours, confidence, analysisNow });
  console.log(JSON.stringify({ analysisNow, result }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`[viral-style-analysis] ${error.message}`);
    process.exitCode = 1;
  });
}

export const viralStyleRetrospective = Object.freeze({
  analyzeWindow,
  wilsonInterval,
});
