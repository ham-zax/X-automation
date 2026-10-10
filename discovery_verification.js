// Source-dependent standalone claims use the existing Editorial evidence and
// independent Writer content review. Heuristic viral labels never grant authority.
// This is a conservative, inspectable provenance/coverage gate, not a semantic
// theorem prover: the independent reviewer must assess truth and contradictions.
import { extractViralStyleFeatures } from './viral_style.js';

export const DISCOVERY_VERIFICATION_VERSION = 2;
const MATERIAL_PRIMARY_KINDS = new Set(['github_readme', 'github_release', 'official_documentation']);
const EXTERNAL_SOURCE = /^https:\/\/x\.com\/[a-z0-9_]+\/status\/\d+/i;
const STOP_WORDS = new Set(('the a an and or but with from into about your their its this that what when where why how '
  + 'it is are was were been have has had be to of on in for by as at no not can could should '
  + 'you we i my our they them who which project tool repo repository readme docs documentation '
  + 'says said states describes shows reported developer developers new using use check before '
  + 'there some more less real than very now just available').split(' '));

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
function unique(items) {
  return [...new Set(items.map(item => clean(item)).filter(Boolean))];
}
function githubFamily(value) {
  try {
    const u = new URL(value);
    if (!['github.com', 'www.github.com', 'api.github.com'].includes(u.hostname.toLowerCase())) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (u.hostname === 'api.github.com' && parts[0] !== 'repos') return null;
    const [owner, repo] = u.hostname === 'api.github.com' ? parts.slice(1, 3) : parts.slice(0, 2);
    return /^[\w.-]+$/.test(owner || '') && /^[\w.-]+$/.test(repo || '')
      ? `github:${owner.toLowerCase()}/${repo.replace(/\.git$/i, '').toLowerCase()}` : null;
  } catch { return null; }
}
function quotedUrls(text) {
  return (String(text || '').match(/https:\/\/[^\s<>()\[\]{}"']+/gi) || [])
    .map(value => value.replace(/[.,;:!?]+$/, ''));
}
function independentSources(candidate, sourceCandidates) {
  return [...(Array.isArray(sourceCandidates) ? sourceCandidates : []), candidate].filter(Boolean);
}
function substantiveTokens(text) {
  return unique((clean(text).toLowerCase().match(/[a-z0-9]+(?:[.-][a-z0-9]+)*/g) || [])
    .filter(word => word.length > 2 && !STOP_WORDS.has(word)));
}
function quoteSupportsSurface(assertion, quote) {
  const claimTerms = substantiveTokens(assertion);
  const cited = new Set(substantiveTokens(quote));
  // A focused excerpt that says a capability is *not* supported cannot be
  // cited as positive proof of that capability. The reviewer still assesses
  // the broader semantics; this only stops a common deterministic inversion.
  const negative = /\b(?:not|never|cannot|can't|doesn't|unsupported|incompatible|unavailable|not supported)\b/i;
  if (negative.test(quote) !== negative.test(assertion)) return false;
  return claimTerms.length > 0
    && claimTerms.filter(word => cited.has(word)).length >= Math.ceil(claimTerms.length * 0.7);
}
function draftSegments(units) {
  return (Array.isArray(units) ? units : []).flatMap(unit => String(unit || '')
    .split(/(?<=[.!?])\s+|\n+/))
    .map(clean)
    .filter(value => /[a-z]/i.test(value) && !/^https?:\/\/\S+$/i.test(value));
}

export function requiresTechDiscoveryVerification({ pipeline = 'original', candidate = null, sourceCandidates = [] } = {}) {
  if (!['original', 'thread'].includes(String(pipeline))) return false;
  return independentSources(candidate, sourceCandidates)
    .some(source => source.source === 'x' && EXTERNAL_SOURCE.test(String(source.url || source.key || '')));
}

/**
 * All authority inputs are persisted by the existing Editorial/Writer paths.
 * The content reviewer must separately assess semantics, pricing, project ID,
 * compatibility, negatives, and qualification. Booleans alone are not factual
 * proof: we additionally require linked project identity, actual source excerpt
 * overlap, one review entry per exact prose segment, and a current review.
 */
export function evaluateTechDiscoveryEvidence({
  pipeline = 'original',
  candidate = null,
  sourceCandidates = [],
  evidence = [],
  usedEvidenceIds = [],
  review = null,
  publicUnits = [],
} = {}) {
  const sources = independentSources(candidate, sourceCandidates);
  const sourceUrls = unique(sources.filter(item => item.source === 'x'
    && EXTERNAL_SOURCE.test(String(item.url || item.key || ''))).map(item => item.url || item.key));
  const observedFormats = unique(sources.filter(item => item.source === 'x').flatMap(item => {
    const features = extractViralStyleFeatures({ text: item.text || '' });
    return [...features.hookLabels, ...features.styleLabels];
  })).sort();
  const required = requiresTechDiscoveryVerification({ pipeline, candidate, sourceCandidates });
  const referencedProjects = new Set(sources.flatMap(item => [
    githubFamily(item.url || ''),
    ...quotedUrls(item.text || '').map(githubFamily),
  ]).filter(Boolean));
  const rows = Array.isArray(evidence) ? evidence : [];
  const primary = rows.filter(item => item?.status === 'primary_supported'
    && MATERIAL_PRIMARY_KINDS.has(String(item.sourceKind || '')) && item.id != null);
  const materialPrimaryEvidenceIds = unique(primary.map(item => String(item.id)));
  const used = new Set(unique(Array.isArray(usedEvidenceIds) ? usedEvidenceIds : []));
  const usedPrimaryEvidenceIds = materialPrimaryEvidenceIds.filter(id => used.has(id));
  const segments = draftSegments(publicUnits);
  const reviewedClaims = Array.isArray(review?.factualClaims) ? review.factualClaims : [];
  const failures = [];
  if (required) {
    if (!usedPrimaryEvidenceIds.length) failures.push('MISSING_CITED_MATERIAL_PRIMARY');
    if (!referencedProjects.size) failures.push('PROJECT_IDENTITY_NOT_LINKED');
    if (!review?.passed) failures.push('INDEPENDENT_REVIEW_NOT_PASSED');
    if (!segments.length) failures.push('EMPTY_STANDALONE_DRAFT');
    const byId = new Map(primary.map(row => [String(row.id), row]));
    let supported = 0;
    for (const segment of segments) {
      const claim = reviewedClaims.find(item => clean(item?.text) === segment);
      if (!claim) {
        failures.push('UNREVIEWED_PUBLIC_ASSERTION');
        continue;
      }
      if (claim.status === 'interpretation') {
        if (!/^(?:i (?:think|believe|prefer|would)|my take|to me|the (?:real|interesting|useful|important) (?:part|lesson|bit|point)|worth (?:noting|watching)|why i (?:care|like)|this (?:feels|looks)|what matters)/i.test(segment)
          || /\b(?:supports?|compatible|works? (?:on|with)|can run|runs? on|requires?|includes?|free|paid|costs?|version|all devices|every device)\b/i.test(segment)) {
          failures.push('UNSUPPORTED_INTERPRETATION_CLASS');
        }
        continue;
      }
      if (claim.status === 'illustrative') continue; // Existing deterministic imperative/example checks still apply.
      if (claim.status !== 'supported') {
        failures.push('UNSUPPORTED_MATERIAL_ASSERTION');
        continue;
      }
      const row = byId.get(String(claim.sourceId || ''));
      const quote = clean(claim.sourceQuote);
      if (!row || !used.has(String(row.id))) {
        failures.push('ASSERTION_NOT_LINKED_TO_CITED_PRIMARY');
        continue;
      }
      const family = githubFamily(row.resolvedUrl || row.requestedUrl || '');
      const claimedFamily = String(row.sourceFamily || '').toLowerCase();
      if (!family || family !== claimedFamily || !referencedProjects.has(family)) {
        failures.push('PRIMARY_PROJECT_IDENTITY_MISMATCH');
      }
      if (!quote || !clean(row.summary).includes(quote) || !quoteSupportsSurface(segment, quote)) {
        failures.push('ASSERTION_NOT_SUPPORTED_BY_CITED_EXCERPT');
      }
      const judgment = claim.supportAssessment || {};
      if (judgment.support !== 'supported' || judgment.projectMatch !== true
        || judgment.contradictionChecked !== true || judgment.limitationsChecked !== true) {
        failures.push('INDEPENDENT_CLAIM_SUPPORT_UNATTESTED');
      }
      supported += 1;
    }
    if (!supported) failures.push('NO_INDEPENDENTLY_CHECKED_MATERIAL_ASSERTION');
  }
  return {
    schemaVersion: DISCOVERY_VERIFICATION_VERSION,
    required,
    sourceUrls,
    observedFormats,
    referencedProjects: [...referencedProjects].sort(),
    materialPrimaryEvidenceIds,
    usedPrimaryEvidenceIds,
    assertionCount: segments.length,
    reviewedAssertionCount: reviewedClaims.length,
    issues: unique(failures),
    satisfied: !required || failures.length === 0,
    status: !required ? 'not_required'
      : failures.length ? failures[0].toLowerCase()
        : 'material_claims_reviewed',
    limitation: 'Structural source/project/quote checks do not prove semantic entailment. An independent reviewer must explicitly assess every claim, contradictions and material limitations, and can refuse approval.',
  };
}
