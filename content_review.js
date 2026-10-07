import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const quantityPattern = /(?:[$€£]\s*\d+(?:,\d{3})*(?:\.\d+)?|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|x\b|ms\b|milliseconds?\b|seconds?\b|minutes?\b|hours?\b|GB\b|MB\b|TB\b|tokens?\b|requests?\b|users?\b))/gi;

export function factualQuantities(text) {
  const prose = String(text || '').replace(/```[\s\S]*?```|`[^`]*`/g, '');
  return [...prose.matchAll(quantityPattern)].map(match => match[0].toLowerCase().replace(/[\s,]/g, ''));
}

export function contentSources(candidate, evidence = []) {
  return [
    { id: 'candidate', status: 'source_claim', url: String(candidate?.url || ''), excerpts: [clean(candidate?.text)].filter(Boolean) },
    ...evidence.filter(item => ['primary_supported', 'source_claim'].includes(item.status)).map(item => ({
      id: String(item.id), status: item.status,
      url: String(item.resolvedUrl || item.requestedUrl || ''),
      excerpts: [clean(item.claim), clean(item.summary)].filter(Boolean),
    })),
  ].sort((a, b) => a.id.localeCompare(b.id));
}

export function reviewFingerprint({ units, pipeline, behavior, personaVersion, candidate, evidence = [] }) {
  // Only decision fields affect review; timestamps/selection metadata do not.
  const decision = Object.fromEntries(['decision', 'primaryPurpose', 'secondaryPurposes', 'socialMode',
    'informationDepth', 'affectStrategy', 'affectProvenance', 'conversationStage', 'reasonToExist']
    .map(key => [key, behavior?.[key] ?? null]));
  return digest({ units, pipeline, decision, personaVersion, sources: contentSources(candidate, evidence) });
}

export function checkReviewClaims(review, { units, candidate, evidence = [], ownerEvidence = false }) {
  const text = clean(units.join('\n\n'));
  const sources = new Map(contentSources(candidate, evidence).map(source => [source.id, source]));
  const failures = [];
  const claims = Array.isArray(review?.factualClaims) ? review.factualClaims : [];
  if (!Array.isArray(review?.factualClaims) || !Array.isArray(review?.ownerClaims)
      || !Array.isArray(review?.voiceIssues) || !Array.isArray(review?.issues)
      || typeof review?.passed !== 'boolean') failures.push('Content review is incomplete.');
  for (const claim of claims) {
    const assertion = clean(claim?.text);
    if (!assertion || !text.includes(assertion)) {
      failures.push('A reviewed claim is absent from the exact draft.');
      continue;
    }
    if (claim.status === 'illustrative') {
      if (!/^(?:if|suppose|hypothetical|for example|e\.g\.|use|set|limit|stop|retry|wait)\b/i.test(assertion)
          || /\b(?:measured|achieved|delivers|benchmark results|our results|my results)\b/i.test(assertion)) {
        failures.push('An empirical claim was labeled as an illustration.');
      }
      continue;
    }
    if (claim.status !== 'supported') {
      failures.push(`Unsupported claim: ${assertion}`);
      continue;
    }
    const source = sources.get(String(claim.sourceId));
    const quote = clean(claim.sourceQuote);
    if (!source || !quote || !source.excerpts.some(excerpt => excerpt.includes(quote))) {
      failures.push('A claim cites an unavailable source or an invented source excerpt.');
      continue;
    }
    const sourceQuantities = factualQuantities(quote);
    if (factualQuantities(assertion).some(quantity => !sourceQuantities.includes(quantity))) {
      failures.push('A claim changes a sourced quantity or unit.');
    }
    const start = text.indexOf(assertion);
    const attributedText = text.slice(Math.max(0, start - 80), start + assertion.length);
    if (source.status === 'source_claim' && (claim.attributed !== true
        || !/\b(?:reports?|reported|says?|said|claims?|claimed|according to|per the|source|post|announcement|docs?|paper|author)\b/i.test(attributedText))) {
      failures.push('An unverified source claim must be explicitly attributed.');
    }
  }
  const covered = claims.flatMap(claim => factualQuantities(claim.text));
  if (!ownerEvidence && factualQuantities(text).some(quantity => !covered.includes(quantity))) {
    failures.push('The review omitted a quantitative claim.');
  }
  if (!ownerEvidence && review?.ownerClaims?.length) failures.push('Owner experience needs exact-text human attestation.');
  failures.push(...(Array.isArray(review?.issues) ? review.issues.map(clean).filter(Boolean) : []));
  return [...new Set(failures)];
}

export function bindContentReview(review, context, { reviewer = 'external_agent', execution = null } = {}) {
  const failures = checkReviewClaims(review, context);
  const voiceIssues = Array.isArray(review?.voiceIssues) ? review.voiceIssues.map(clean).filter(Boolean) : [];
  if (review?.passed === false && failures.length === 0 && voiceIssues.length === 0) failures.push('The reviewer did not approve this content.');
  return {
    schemaVersion: 1, reviewer, execution, reviewedAt: Date.now(),
    fingerprint: reviewFingerprint(context), personaVersion: context.personaVersion,
    factualClaims: review?.factualClaims || [], ownerClaims: review?.ownerClaims || [],
    available: review?.available !== false,
    voiceIssues, issues: failures,
    passed: review?.passed === true && failures.length === 0 && voiceIssues.length === 0,
  };
}

export function currentContentReview(review, context) {
  if (!review || review.schemaVersion !== 1 || review.fingerprint !== reviewFingerprint(context)) {
    return { current: false, passed: false, issues: ['Exact content, persona, behavior or evidence changed; review this draft again.'] };
  }
  const failures = checkReviewClaims(review, context);
  const voiceIssues = Array.isArray(review.voiceIssues) ? review.voiceIssues : [];
  return { current: true, factualPassed: review.available === false ? null : failures.length === 0,
    passed: review.passed === true && failures.length === 0 && voiceIssues.length === 0,
    issues: [...failures, ...voiceIssues] };
}
