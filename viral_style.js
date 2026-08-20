const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'’._+-]*/g;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function finite(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ratio(numerator, denominator) {
  const left = finite(numerator);
  const right = finite(denominator);
  if (left == null || right == null || right <= 0) return null;
  return left / right;
}

function median(values) {
  const numbers = values.map(finite).filter((value) => value != null).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

function compactText(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

function words(text) {
  return compactText(text).match(WORD_RE) || [];
}

function sentenceCount(text) {
  const cleaned = compactText(text);
  if (!cleaned) return 0;
  const segments = cleaned.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
  return Math.max(1, segments.length);
}

function firstLine(text) {
  return compactText(text).split(/\n/).map((line) => line.trim()).find(Boolean) || '';
}

function publicationTime(post) {
  const value = post?.createdAt ?? post?.timestamp ?? null;
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function contains(text, pattern) {
  return pattern.test(text);
}

function normalizeBoolean(value) {
  return value === true;
}

function hookLabels(text, first) {
  const whole = text.toLowerCase();
  const opening = first.toLowerCase();
  const labels = [];
  const add = (label, condition) => { if (condition && !labels.includes(label)) labels.push(label); };

  add('first_person_test', /\b(?:i|we)\s+(?:tested|tried|ran|used|built|tracked|measured|benchmarked|spent|kept|turned|max(?:ed)? out|found)\b/i.test(first));
  add('quantified_claim', /(?:\b\d+(?:\.\d+)?(?:x|%|k|m|b)?\b|\$\s?\d)/i.test(first)
    && /\b(?:more|less|faster|slower|better|worse|higher|lower|cheaper|cost|accuracy|performance|usage|tokens?|requests?|stars?|hours?|days?|models?|billion|million)\b/i.test(first));
  add('release_announcement', /\b(?:introducing|launching|released?|releasing|now (?:live|available)|is live|new\s+[A-Za-z0-9._-]+)\b/i.test(first));
  add('impossible_result', /\b(?:insane|crazy|wild|shouldn['’]?t be possible|impossible|let that sink in|actually insane)\b/i.test(first));
  add('contrarian_take', /\b(?:hot take|unpopular opinion|everyone says|people think|but actually|counterintuitive|wrong about)\b/i.test(first));
  add('conditional_hack', /^\s*(?:if|when)\b/i.test(first) || /\b(?:here['’]?s the workaround|workaround|hack:)\b/i.test(first));
  add('curated_list', /\b(?:top\s+)?\d+\s+(?:best\s+)?(?:prompts?|tools?|ways?|things?|lessons?|use cases?|bots?|resources?)\b/i.test(first)
    || /\bbest\s+(?:prompts?|tools?|ways?|things?|lessons?|use cases?|bots?|resources?)\b/i.test(first)
    || /🧵|\bthread\b/i.test(first));
  add('breaking_alert', /^(?:🚨\s*)?(?:breaking|new|just in|alert)\b/i.test(first) || opening.startsWith('🚨'));
  add('cost_value', /\$\s?\d|\b(?:cheaper|price|pricing|cost|credits?|free|\d+x usage)\b/i.test(first));
  add('problem_solution', /\b(?:problem|fix|solved|instead of|without|stop using|no need to|you can now|can now)\b/i.test(first));
  add('social_proof', /\b(?:\d+[kmb]?\+?\s+(?:users?|requests?|stars?|customers?|teams?)|used by|teams are using|everyone is using|million|billion)\b/i.test(first));
  add('direct_imperative', /^(?:don['’]?t|stop|use|try|run|build|connect|install|watch|read|bookmark|save)\b/i.test(first));
  add('question_hook', /\?$/.test(first) || /^(?:why|how|what|which|can|should|is|are|do|does)\b/i.test(first));

  if (!labels.length && whole) labels.push('plain_declarative');
  return labels;
}

function styleLabels(text, features) {
  const value = text.toLowerCase();
  const labels = [];
  const add = (label, condition) => { if (condition && !labels.includes(label)) labels.push(label); };
  const hooks = new Set(features.hookLabels);

  add('quantified_release', hooks.has('release_announcement') && features.numberCount > 0);
  add('tested_experiment', hooks.has('first_person_test') && (features.numberCount > 0 || features.hasBenchmarkLanguage));
  add('utility_workaround', hooks.has('conditional_hack') || /\b(?:workaround|daily driver|context switches?|workflow|fix)\b/i.test(value));
  add('benchmark_proof', features.hasBenchmarkLanguage && (features.numberCount > 0 || features.percentCount > 0));
  add('curated_resource_thread', hooks.has('curated_list') && (features.hasThreadPromise || features.hasResourcePromise));
  add('compressed_reveal', features.wordCount <= 45 && (hooks.has('impossible_result') || hooks.has('breaking_alert')));
  add('authority_announcement', hooks.has('release_announcement') && /\b(?:we|teams|launching|available|live|introducing)\b/i.test(value));
  add('cost_value_comparison', hooks.has('cost_value') && /\b(?:cheaper|cost|price|credits?|usage|free|subscription|api)\b/i.test(value));
  add('educational_breakdown', features.hasThreadPromise || /\b(?:guide|step[- ]by[- ]step|breakdown|learn|basics|how to|use cases?)\b/i.test(value));
  add('contrarian_observation', hooks.has('contrarian_take') || /\b(?:benchmarks? .* but|production .* similar|not because|not bc)\b/i.test(value));

  if (!labels.length) labels.push('general_observation');
  return labels;
}

export function extractViralStyleFeatures(post = {}) {
  const text = compactText(post.text || post.fullText || '');
  const tokenList = words(text);
  const lines = text ? text.split(/\n/).map((line) => line.trimEnd()) : [];
  const nonEmptyLines = lines.filter((line) => line.trim());
  const paragraphs = text ? text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean) : [];
  const opening = firstLine(text);
  const alphaWords = tokenList.filter((word) => /[A-Za-z]/.test(word));
  const uppercaseWords = alphaWords.filter((word) => word.length >= 2 && word === word.toUpperCase() && word !== word.toLowerCase());
  const bulletLines = nonEmptyLines.filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line));
  const numberMatches = text.match(/\b\d+(?:[.,]\d+)?(?:[kKmMbB])?\b/g) || [];
  const percentageMatches = text.match(/\b\d+(?:\.\d+)?\s*%/g) || [];
  const currencyMatches = text.match(/(?:[$€£¥]\s?\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s?(?:usd|eur|gbp)\b)/gi) || [];
  const linkCount = Array.isArray(post.urls) ? post.urls.length : (text.match(/https?:\/\/\S+/gi) || []).length;
  const mentionCount = Array.isArray(post.mentions) ? post.mentions.length : (text.match(/@[A-Za-z0-9_]+/g) || []).length;
  const hashtagCount = Array.isArray(post.hashtags) ? post.hashtags.length : (text.match(/#[A-Za-z0-9_]+/g) || []).length;
  const emojiCount = (text.match(EMOJI_RE) || []).length;

  const features = {
    charCount: text.length,
    wordCount: tokenList.length,
    sentenceCount: sentenceCount(text),
    lineCount: lines.length,
    paragraphCount: paragraphs.length,
    firstLine: opening,
    firstLineChars: opening.length,
    bulletLineCount: bulletLines.length,
    linkCount,
    mentionCount,
    hashtagCount,
    emojiCount,
    questionCount: (text.match(/\?/g) || []).length,
    exclamationCount: (text.match(/!/g) || []).length,
    uppercaseWordRatio: alphaWords.length ? uppercaseWords.length / alphaWords.length : 0,
    numberCount: numberMatches.length,
    percentCount: percentageMatches.length,
    currencyCount: currencyMatches.length,
    hasFirstPersonExperience: contains(text, /\b(?:i|we)\s+(?:tested|tried|ran|used|built|tracked|measured|benchmarked|spent|found|turned)\b/i),
    hasSecondPersonAddress: /\b(?:you|your|you['’]?re|you['’]?ll|you can)\b/i.test(text),
    hasBenchmarkLanguage: /\b(?:benchmark|accuracy|eval|performance|score|leaderboard|latency|tokens?\/s|throughput|requests?|survivability)\b/i.test(text),
    hasCostValueLanguage: /\b(?:price|pricing|cost|cheaper|credits?|subscription|free|per month|tokens?|usage)\b/i.test(text),
    hasReleaseLanguage: /\b(?:introducing|releas(?:e|ed|es|ing)|launch(?:ed|es|ing)?|now live|available today|new version|ships?|shipping)\b/i.test(text),
    hasUrgencyLanguage: /\b(?:today|now|just|breaking|new|live|hours?|days?|this week|already)\b/i.test(text),
    hasContrarianLanguage: /\b(?:hot take|unpopular opinion|counterintuitive|but actually|everyone says|people think|not because|not bc)\b/i.test(text),
    hasCuriosityGap: /\b(?:here['’]?s|what happened|the reason|why this matters|let that sink in|you won['’]?t believe|i dug out|i found)\b/i.test(text),
    hasImpossibleSurpriseLanguage: /\b(?:insane|crazy|wild|impossible|shouldn['’]?t be possible|let that sink in)\b/i.test(text),
    hasProofLanguage: /\b(?:tested|measured|tracked|benchmark|telemetry|data|requests?|results?|according to|evidence|proof)\b/i.test(text) || /(?:^|\s)source\s*:/i.test(text),
    hasResourcePromise: /\b(?:guide|prompts? included|download|install|repo|github|blog|thread below|use cases?|resources?|template|checklist)\b/i.test(text),
    hasThreadPromise: /(?:🧵|\bthread\b|\b\d+\s+(?:things?|prompts?|ways?|tools?|use cases?)\b)/i.test(text),
  };
  features.hookLabels = hookLabels(text, opening);
  features.styleLabels = styleLabels(text, features);
  return features;
}

export function followerSizeCohort(count) {
  const value = finite(count);
  if (value == null || value < 0) return 'unknown';
  if (value < 5_000) return 'micro';
  if (value < 25_000) return 'small';
  if (value < 100_000) return 'mid';
  if (value < 500_000) return 'large';
  return 'very_large';
}

export function postAgeBand(minutes) {
  const value = finite(minutes);
  if (value == null || value < 0) return 'unknown';
  if (value < 60) return '<1h';
  if (value < 360) return '1-6h';
  if (value < 1_440) return '6-24h';
  if (value < 4_320) return '1-3d';
  if (value < 10_080) return '3-7d';
  return '7d+';
}

export function deriveViralPerformance(snapshot = {}) {
  const views = finite(snapshot.views);
  const likes = finite(snapshot.likes);
  const reposts = finite(snapshot.reposts);
  const replies = finite(snapshot.replies);
  const bookmarks = finite(snapshot.bookmarks);
  const followers = finite(snapshot.authorFollowers);
  const ageMinutes = finite(snapshot.postAgeMinutes);
  const engagements = [likes, reposts, replies].every((value) => value == null)
    ? null
    : (likes || 0) + (reposts || 0) + (replies || 0);
  const ageHours = ageMinutes != null && ageMinutes > 0 ? ageMinutes / 60 : null;
  return {
    viewsPerFollower: ratio(views, followers),
    engagementsPerView: ratio(engagements, views),
    bookmarksPerView: ratio(bookmarks, views),
    repostsPerView: ratio(reposts, views),
    repliesPerView: ratio(replies, views),
    viewsPerHour: ageHours ? ratio(views, ageHours) : null,
    engagementsPerHour: ageHours ? ratio(engagements, ageHours) : null,
    followerCohort: followerSizeCohort(followers),
    ageBand: postAgeBand(ageMinutes),
  };
}

function latestSnapshots(snapshots) {
  const byTweet = new Map();
  for (const snapshot of snapshots || []) {
    const id = String(snapshot?.tweetId || '');
    if (!id) continue;
    const observedAt = finite(snapshot.observedAt) || 0;
    const current = byTweet.get(id);
    if (!current || observedAt > (finite(current.observedAt) || 0)) byTweet.set(id, snapshot);
  }
  return byTweet;
}

function firstSnapshots(snapshots) {
  const byTweet = new Map();
  for (const snapshot of snapshots || []) {
    const id = String(snapshot?.tweetId || '');
    if (!id) continue;
    const observedAt = finite(snapshot.observedAt) || 0;
    const current = byTweet.get(id);
    if (!current || observedAt < (finite(current.observedAt) || 0)) byTweet.set(id, snapshot);
  }
  return byTweet;
}

function groupSummary(rows) {
  return {
    sampleSize: rows.length,
    medians: {
      views: median(rows.map((row) => row.views)),
      likes: median(rows.map((row) => row.likes)),
      reposts: median(rows.map((row) => row.reposts)),
      replies: median(rows.map((row) => row.replies)),
      bookmarks: median(rows.map((row) => row.bookmarks)),
      viewsPerFollower: median(rows.map((row) => row.viewsPerFollower)),
      engagementsPerView: median(rows.map((row) => row.engagementsPerView)),
      bookmarksPerView: median(rows.map((row) => row.bookmarksPerView)),
      viewsPerHour: median(rows.map((row) => row.viewsPerHour)),
      viewsPerFollowerLift: median(rows.map((row) => row.viewsPerFollowerLift)),
      engagementsPerViewLift: median(rows.map((row) => row.engagementsPerViewLift)),
      followerDeltaFromFirstObservation: median(rows.map((row) => row.followerDeltaFromFirstObservation)),
    },
  };
}

function grouped(rows, values) {
  const map = new Map();
  for (const row of rows) {
    for (const value of values(row)) {
      const key = String(value || 'unknown');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
  }
  return [...map.entries()]
    .map(([value, items]) => ({ value, ...groupSummary(items) }))
    .sort((a, b) => b.sampleSize - a.sampleSize || a.value.localeCompare(b.value));
}

export function buildViralStyleReportRows(posts = [], snapshots = [], threads = []) {
  const latest = latestSnapshots(snapshots);
  const first = firstSnapshots(snapshots);
  const threadByRoot = new Map();
  for (const thread of threads || []) {
    const rootId = String(thread?.rootTweetId || '');
    if (!rootId) continue;
    const current = threadByRoot.get(rootId);
    const observedAt = finite(thread.observedAt) || 0;
    if (!current || observedAt >= (finite(current.observedAt) || 0)) threadByRoot.set(rootId, thread);
  }

  const baseRows = (posts || []).map((post) => {
    const tweetId = String(post.id || '');
    const snapshot = latest.get(tweetId) || {};
    const firstSnapshot = first.get(tweetId) || {};
    const derived = deriveViralPerformance(snapshot);
    const createdAt = publicationTime(post);
    const createdDate = createdAt == null ? null : new Date(createdAt);
    const followerDelta = latest.has(tweetId) && first.has(tweetId) && latest.get(tweetId) !== first.get(tweetId)
      ? finite(snapshot.authorFollowers) != null && finite(firstSnapshot.authorFollowers) != null
        ? Number(snapshot.authorFollowers) - Number(firstSnapshot.authorFollowers)
        : null
      : null;
    const thread = threadByRoot.get(tweetId) || null;
    const styleFeatures = extractViralStyleFeatures(post);
    return {
      tweetId,
      username: String(post.username || ''),
      url: String(post.url || ''),
      text: String(post.text || ''),
      sampleKind: String(post.sampleKind || ''),
      sourceQuery: String(post.sourceQuery || ''),
      createdAt,
      createdAtIso: createdDate ? createdDate.toISOString() : '',
      publicationUtcHour: createdDate ? createdDate.getUTCHours() : null,
      publicationUtcDay: createdDate ? createdDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) : '',
      conversationId: String(post.conversationId || ''),
      mediaType: String(post.mediaType || 'none'),
      threadLength: thread ? Number(thread.threadLength || 1) : 1,
      threadObservedChildCount: thread ? Number(thread.observedChildCount || Math.max(0, Number(thread.threadLength || 1) - 1)) : 0,
      threadExpectedListItems: thread?.expectedListItems == null ? null : Number(thread.expectedListItems),
      threadExpectedLength: thread?.expectedThreadLength == null ? null : Number(thread.expectedThreadLength),
      threadComplete: thread ? thread.complete ?? null : null,
      observedAt: finite(snapshot.observedAt),
      postAgeMinutes: finite(snapshot.postAgeMinutes),
      views: finite(snapshot.views),
      likes: finite(snapshot.likes),
      reposts: finite(snapshot.reposts),
      replies: finite(snapshot.replies),
      bookmarks: finite(snapshot.bookmarks),
      authorFollowers: finite(snapshot.authorFollowers),
      authorFollowing: finite(snapshot.authorFollowing),
      authorTweetCount: finite(snapshot.authorTweetCount),
      authorListedCount: finite(snapshot.authorListedCount),
      authorBlueVerified: normalizeBoolean(snapshot.authorBlueVerified),
      authorAccountAgeDays: finite(snapshot.authorAccountAgeDays),
      followerDeltaFromFirstObservation: followerDelta,
      ...derived,
      hookLabels: styleFeatures.hookLabels,
      styleLabels: styleFeatures.styleLabels,
      styleFeatures,
    };
  });

  const controlsByAuthor = new Map();
  for (const row of baseRows) {
    if (row.sampleKind !== 'author_control') continue;
    if (!controlsByAuthor.has(row.username)) controlsByAuthor.set(row.username, []);
    controlsByAuthor.get(row.username).push(row);
  }

  return baseRows.map((row) => {
    const controls = (controlsByAuthor.get(row.username) || []).filter((control) => control.tweetId !== row.tweetId);
    const ageMatchedControls = controls.filter((control) => row.ageBand !== 'unknown' && control.ageBand === row.ageBand);
    const controlViewsPerFollower = median(ageMatchedControls.map((control) => control.viewsPerFollower));
    const controlEngagementsPerView = median(ageMatchedControls.map((control) => control.engagementsPerView));
    return {
      ...row,
      authorControlSampleSize: controls.length,
      authorAgeMatchedControlSampleSize: ageMatchedControls.length,
      authorControlMedianViewsPerFollower: controlViewsPerFollower,
      authorControlMedianEngagementsPerView: controlEngagementsPerView,
      viewsPerFollowerLift: controlViewsPerFollower && row.viewsPerFollower != null ? row.viewsPerFollower / controlViewsPerFollower : null,
      engagementsPerViewLift: controlEngagementsPerView && row.engagementsPerView != null ? row.engagementsPerView / controlEngagementsPerView : null,
    };
  });
}

export function summarizeViralStyleDataset(posts = [], snapshots = [], threads = []) {
  const rows = buildViralStyleReportRows(posts, snapshots, threads);
  const seeds = rows.filter((row) => row.sampleKind === 'viral_seed');
  return {
    generatedAt: Date.now(),
    sampleSize: rows.length,
    seedSampleSize: seeds.length,
    controlSampleSize: rows.filter((row) => row.sampleKind === 'author_control').length,
    targetedSampleSize: rows.filter((row) => row.sampleKind === 'targeted').length,
    interpretation: 'Descriptive observational associations only. Same-author lift reduces reach confounding but does not establish causal effects of wording, timing, or format.',
    seedByStyle: grouped(seeds, (row) => row.styleLabels),
    seedByHook: grouped(seeds, (row) => row.hookLabels),
    seedByFollowerCohort: grouped(seeds, (row) => [row.followerCohort]),
    seedByPublicationUtcHour: grouped(seeds, (row) => [row.publicationUtcHour == null ? 'unknown' : String(row.publicationUtcHour).padStart(2, '0')]),
    byStyle: grouped(rows, (row) => row.styleLabels),
    byHook: grouped(rows, (row) => row.hookLabels),
    bySampleKind: grouped(rows, (row) => [row.sampleKind || 'unknown']),
    byFollowerCohort: grouped(rows, (row) => [row.followerCohort]),
    byAgeBand: grouped(rows, (row) => [row.ageBand]),
    byPublicationUtcHour: grouped(rows, (row) => [row.publicationUtcHour == null ? 'unknown' : String(row.publicationUtcHour).padStart(2, '0')]),
  };
}

export const viralStyleInternals = Object.freeze({ median, publicationTime });
