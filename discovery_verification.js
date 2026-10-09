// Pure assessment over the existing candidate/source and Editorial evidence records.
// This creates no second verification database or publication authority.
import { extractViralStyleFeatures } from './viral_style.js';

export const DISCOVERY_VERIFICATION_VERSION = 1;
const MATERIAL_PRIMARY_KINDS = new Set(['github_readme', 'github_release', 'official_documentation']);

function unique(values) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

export function evaluateTechDiscoveryEvidence({
  pipeline = 'original',
  candidate = null,
  sourceCandidates = [],
  evidence = [],
  usedEvidenceIds = [],
} = {}) {
  const originals = (Array.isArray(sourceCandidates) ? sourceCandidates : [])
    .concat(candidate ? [candidate] : [])
    .filter(item => item?.source === 'x' && /\/status\/\d+/.test(String(item.url || item.key || '')));
  const sourceUrls = unique(originals.map(item => item.url || item.key));
  const formats = new Set(originals.flatMap(item => {
    const features = extractViralStyleFeatures({ text: item.text || '' });
    return [...features.hookLabels, ...features.styleLabels];
  }));
  const discovery = ['unexpected_capability', 'free_resource', 'useful_tech_discovery',
    'curated_resource_thread'].some(label => formats.has(label));
  const required = discovery && ['original', 'thread'].includes(pipeline);

  const rows = Array.isArray(evidence) ? evidence : [];
  const usable = rows.filter(item => item?.status === 'primary_supported'
    && MATERIAL_PRIMARY_KINDS.has(String(item.sourceKind || ''))
    && item.id != null);
  const materialPrimaryEvidenceIds = unique(usable.map(item => item.id));
  const used = new Set(unique(Array.isArray(usedEvidenceIds) ? usedEvidenceIds : []));
  const usedPrimaryEvidenceIds = materialPrimaryEvidenceIds.filter(id => used.has(id));

  return {
    schemaVersion: DISCOVERY_VERIFICATION_VERSION,
    required,
    sourceUrls,
    observedFormats: [...formats].sort(),
    materialPrimaryEvidenceIds,
    usedPrimaryEvidenceIds,
    satisfied: !required || usedPrimaryEvidenceIds.length > 0,
    status: !required ? 'not_required'
      : usedPrimaryEvidenceIds.length ? 'material_primary_supported'
        : materialPrimaryEvidenceIds.length ? 'primary_evidence_not_cited'
          : 'unverified_source_claim',
    limitation: 'An X post, an unaudited generic page, and repository metadata alone cannot verify a technical capability or setup requirement. Each material public assertion must still pass exact content review.',
  };
}
