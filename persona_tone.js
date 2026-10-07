import { getAppState, setAppState, runStoreTransaction, getGrowthOperatorDelegation, getCandidate } from './store.js';
import { DomainValidationError } from './errors.js';

const KEY = 'persona_daily_tone:v1';
export const DAILY_TONE_RUBRIC = Object.freeze({
  neutral: { enthusiasm: 0, warmth: 1, playfulness: 0, cue: 'Use the natural voice appropriate to this conversation; add no daily tilt.' },
  focused: { enthusiasm: 0, warmth: 0, playfulness: 0, cue: 'Favor concise, clear wording without turning bluntness into hostility.' },
  curious: { enthusiasm: 1, warmth: 1, playfulness: 0, cue: 'Allow a little exploratory phrasing; ask a question only when the selected purpose supports it.' },
  warm: { enthusiasm: 1, warmth: 2, playfulness: 0, cue: 'Allow a little warmth or acknowledgment when grounded in the actual relationship or conversation.' },
  energized: { enthusiasm: 2, warmth: 1, playfulness: 0, cue: 'Allow restrained enthusiasm about supported builder progress; never inflate claims or manufacture excitement.' },
  playful: { enthusiasm: 1, warmth: 1, playfulness: 2, cue: 'Allow a light humorous turn only in a suitable low-stakes conversation; never force jokes into serious contexts.' },
});

function dateContext(now = Date.now()) {
  if (!Number.isFinite(now)) throw new DomainValidationError('Daily tone requires a numeric timestamp.');
  const timeZone = String(process.env.X_PERSONA_TIMEZONE || 'Asia/Kolkata');
  const day = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return { day, timeZone };
}

function nextDayBoundary(now, day) {
  // Find the actual local midnight, including 23/25-hour daylight-saving days.
  let low = Math.floor(now);
  let high = low + 48 * 60 * 60_000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dateContext(middle).day === day) low = middle;
    else high = middle;
  }
  return high;
}

export function getDailyPersonaTone({ now = Date.now() } = {}) {
  const context = dateContext(now);
  const raw = getAppState(KEY, null);
  const saved = raw ? JSON.parse(raw) : null;
  if (saved && saved.day === context.day && saved.timeZone === context.timeZone && saved.selectedAt <= now && now < saved.expiresAt) {
    if (!Object.hasOwn(DAILY_TONE_RUBRIC, saved.mode) || !Number.isFinite(saved.influence) || saved.influence < 0 || saved.influence > 0.1) throw new Error('Stored daily tone is invalid.');
    return { ...saved, active: true, rubric: DAILY_TONE_RUBRIC[saved.mode] };
  }
  return { ...context, mode: 'neutral', influence: 0, source: 'default', active: false, rubric: DAILY_TONE_RUBRIC.neutral, interpretation: 'writing_preference_only' };
}

export function setDailyPersonaTone(input, { actor = 'agent', now = Date.now() } = {}) {
  const mode = String(input?.mode || '');
  const influence = input?.influence == null ? 0.1 : Number(input.influence);
  const reason = String(input?.reason || '').trim();
  const sourceReferences = [...new Set(Array.isArray(input?.sourceReferences) ? input.sourceReferences.map(String) : [])];
  if (!Object.hasOwn(DAILY_TONE_RUBRIC, mode) || !Number.isFinite(influence) || influence < 0 || influence > 0.1 || !reason || reason.length > 1000 || sourceReferences.length > 20) {
    throw new DomainValidationError('Daily tone requires a valid mode, a reason, and influence between 0 and 0.1.');
  }
  if (!['human', 'agent'].includes(actor)) throw new DomainValidationError('Unsupported daily tone actor.');
  return runStoreTransaction(() => {
    const current = getDailyPersonaTone({ now });
    let delegationRevision = null;
    if (actor === 'agent') {
      const grant = getGrowthOperatorDelegation();
      if (grant.state !== 'running') throw new DomainValidationError('Agent daily tone selection requires a running Growth Operator delegation.');
      delegationRevision = grant.revision;
      if (current.active) throw new DomainValidationError('The daily tone is already selected; only the owner can override it before expiry.');
      if (!sourceReferences.length || sourceReferences.some(reference => !getCandidate(reference))) throw new DomainValidationError('Agent daily tone requires references to observed candidates stored in Growth OS.');
    }
    const context = dateContext(now);
    const saved = {
      ...context, mode, influence, reason, sourceReferences,
      source: actor === 'human' ? 'owner_override' : 'agent_context', delegationRevision,
      selectedAt: now, expiresAt: nextDayBoundary(now, context.day),
      interpretation: 'writing_preference_only',
      boundaries: [
        'This is a low-priority wording preference, not evidence of private mood or emotional history.',
        'Purpose, source context, factual grounding, identity and relationship fit outrank this preference.',
        'It cannot change relevance scoring, route selection, approval, health, quotas or publication authority.',
        'Influence is a preference-strength ceiling, not a measurable percentage of model output.',
      ],
    };
    setAppState(KEY, JSON.stringify(saved));
    return getDailyPersonaTone({ now });
  });
}
