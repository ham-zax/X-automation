// Durable evidence-backed follow/like/repost ledger. No unfollow action exists here.
// Runs within the same SQLite file as the canonical growth store but has its
// own narrowly-scoped, transactional mutation ledger.
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DB_FILE, getGrowthRun, getGrowthOperatorDelegation, getAccountHealthSummary,
  getGrowthProductPolicy, getAudienceProfile, listCandidates,
  getBlockingActAttemptForTarget, getCandidate, getSourceMomentum, setAudienceFollowState } from './store.js';
import { activityWindow, observedBreakout, verifiedBreakingEvent } from './growth_activity_policy.js';
import { DomainValidationError } from './errors.js';

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
db.exec(`CREATE TABLE IF NOT EXISTS social_action_attempts (
  attempt_id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK(action IN ('follow','like','repost')),
  target_key TEXT NOT NULL,
  target_url TEXT NOT NULL,
  run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('claimed','mutation_started','repost_confirmation_started','confirmed','confirmed_not_applied','closed_unresolved')),
  reason TEXT NOT NULL,
  context_json TEXT NOT NULL,
  pre_evidence_json TEXT,
  repost_menu_evidence_json TEXT,
  post_evidence_json TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  UNIQUE(action,target_key)
);
CREATE INDEX IF NOT EXISTS idx_social_action_time ON social_action_attempts(action,created_at); `);

// SQLite cannot alter a CHECK constraint in place. Upgrade old follow/like
// ledgers transactionally, preserving attempt IDs and unresolved send fences.
function ensureSocialSchemaVersion2() {
  const sql=String(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='social_action_attempts'").get()?.sql||'');
  if(sql.includes("'repost'") && sql.includes('repost_menu_evidence_json')) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE social_action_attempts_migrating_v2 (
      attempt_id TEXT PRIMARY KEY,
      action TEXT NOT NULL CHECK(action IN ('follow','like','repost')),
      target_key TEXT NOT NULL,
      target_url TEXT NOT NULL,
      run_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('claimed','mutation_started','repost_confirmation_started','confirmed','confirmed_not_applied','closed_unresolved')),
      reason TEXT NOT NULL,
      context_json TEXT NOT NULL,
      pre_evidence_json TEXT,
      repost_menu_evidence_json TEXT,
      post_evidence_json TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      UNIQUE(action,target_key)
    )`);
    db.exec(`INSERT INTO social_action_attempts_migrating_v2
      (attempt_id,action,target_key,target_url,run_id,session_id,state,reason,context_json,
       pre_evidence_json,post_evidence_json,created_at,started_at,finished_at)
      SELECT attempt_id,action,target_key,target_url,run_id,session_id,state,reason,context_json,
       pre_evidence_json,post_evidence_json,created_at,started_at,finished_at
      FROM social_action_attempts`);
    db.exec('DROP TABLE social_action_attempts');
    db.exec('ALTER TABLE social_action_attempts_migrating_v2 RENAME TO social_action_attempts');
    db.exec('CREATE INDEX idx_social_action_time ON social_action_attempts(action,created_at)');
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw new DomainValidationError(`Social engagement schema migration failed; no action permitted: ${error.message}`);
  }
}
ensureSocialSchemaVersion2();

const validName = (value) => /^[A-Za-z0-9_]{1,15}$/.test(value);
const validId = (value) => /^\d{5,25}$/.test(value);
const source = (targetUrl) => String(targetUrl||'').match(/^https:\/\/(?:www\.)?x\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})(?:[/?#]|$)/i);
const states = new Set(['claimed','mutation_started','repost_confirmation_started','confirmed','confirmed_not_applied','closed_unresolved']);

function identity(input) {
  const action = String(input.action || '').toLowerCase();
  if (!['follow','like','repost'].includes(action)) throw new DomainValidationError('Only follow, like, and repost are supported. Unfollow is human-only.');
  const handle = String(input.username || '').replace(/^@/,'').toLowerCase();
  if (!validName(handle)) throw new DomainValidationError('Social action needs an exact observed X username.');
  const own = String(process.env.X_ACCOUNT || 'ham_zax').replace(/^@/,'').toLowerCase();
  if (handle === own) throw new DomainValidationError('Cannot follow, like or repost own content with social automation.');
  if (action === 'follow') return {action,handle,targetKey:handle,url:`https://x.com/${handle}`};
  const parsed = source(input.targetUrl);
  if (!parsed || parsed[1].toLowerCase() !== handle || !validId(parsed[2])) {
    throw new DomainValidationError('Like/repost requires the exact observed source post permalink and matching author.');
  }
  return {action,handle,targetKey:parsed[2],url:`https://x.com/${handle}/status/${parsed[2]}`};
}

function boundRun(runId,sessionId) {
  const run = getGrowthRun(String(runId||''));
  if (!run || run.status !== 'active' || run.sessionId !== sessionId) {
    throw new DomainValidationError('Social actions require the active canonical Growth Run and its exact session.');
  }
  const grant = getGrowthOperatorDelegation();
  if (grant.state !== 'running' || grant.mode !== 'live' || grant.revision !== run.delegationRevision) {
    throw new DomainValidationError('Growth Operator live delegation/revision is no longer valid.');
  }
  if (getAccountHealthSummary().health.state === 'constrained') {
    throw new DomainValidationError('Social action disabled by constrained Account Health.');
  }
  return run;
}

function checkPolicy(action, now, context = null) {
  const product = getGrowthProductPolicy();
  const p = product.social;
  if (!p?.[action]?.enabled) throw new DomainValidationError(`Social ${action} is disabled in product settings.`);
  if (activityWindow({now,policy:product}).rest) {
    let urgent = null;
    if (action === 'repost' && context?.targetUrl) {
      const post = getCandidate(context.targetUrl);
      const observed = ['x_for_you','x_creator_latest']
        .map(kind=>getSourceMomentum(context.targetUrl,kind))
        .filter(item=>item.current).sort((a,b)=>b.current.observedAt-a.current.observedAt);
      urgent = observedBreakout({momentum:observed[0],postCreatedAt:post?.timestamp,now,policy:product})
        || verifiedBreakingEvent({urgency:context.urgency,sourceUrls:context.evidenceUrls||context.references}, {now,policy:product});
    }
    if (!urgent) throw new DomainValidationError('Owner rest hours: only a freshly verified launch/breakthrough or measured breakout may justify an urgent Repost. Routine Follows/Likes wait.');
  }
  const count = db.prepare(`SELECT COUNT(*) AS n FROM social_action_attempts
    WHERE action=? AND created_at>=? AND state!='confirmed_not_applied'`).get(action,now-86_400_000).n;
  if (count >= p[action].maxPer24Hours) throw new DomainValidationError(`Social ${action} safety ceiling reached.`);
  return p[action];
}

function substantiated(input, ident) {
  const why = String(input.reason||'').trim();
  const observedAt = Number(input.observedAt||0);
  const references=Array.isArray(input.evidenceUrls)?input.evidenceUrls: [];
  const now=Date.now();
  if (why.length<35 || why.length>650 || observedAt>now || now-observedAt>20*60_000 || !observedAt) {
    throw new DomainValidationError('Follow/like/repost needs a specific reason and fresh observed X evidence.');
  }
  if (!references.some(u=>typeof u==='string' && /^https:\/\/x\.com\//.test(u))) {
    throw new DomainValidationError('Follow/like/repost requires at least one actual observed X source URL.');
  }
  if(ident.action==='follow') {
    const distinct=new Set(references.map(x=>source(x)?.[2]).filter(Boolean));
    if(distinct.size<2) throw new DomainValidationError('Follow needs at least two distinct observed useful posts by the same account.');
    if(references.some(u=>source(u)?.[1]?.toLowerCase()!==ident.handle)) {
      throw new DomainValidationError('Following evidence must belong to the proposed account.');
    }
  } else if (!references.some(u=>source(u)?.[2]===ident.targetKey)) {
    throw new DomainValidationError('Like/repost evidence must cite the exact target post.');
  }
  if (ident.action==='repost') {
    const audienceValue=String(input.audienceValue||'').trim();
    const whyNotQuote=String(input.whyNotQuote||'').trim();
    if(audienceValue.length<45 || whyNotQuote.length<35 || why.length<75) {
      throw new DomainValidationError('Reposting requires exceptional reader value and a specific reason why an unchanged repost is better than a quote.');
    }
    return {why,observedAt,references:references.slice(0,8),audienceValue,whyNotQuote,
      urgency:input.urgency && typeof input.urgency==='object' ? input.urgency : null};
  }
  return {why,observedAt,references:references.slice(0,8)};
}

function row(attemptId) {
  const r=db.prepare('SELECT * FROM social_action_attempts WHERE attempt_id=?').get(attemptId);
  if(!r) throw new DomainValidationError('Social attempt not found.');
  return {attemptId:r.attempt_id,action:r.action,targetKey:r.target_key,targetUrl:r.target_url,
    runId:r.run_id,sessionId:r.session_id,state:r.state,reason:r.reason,
    createdAt:r.created_at,startedAt:r.started_at,finishedAt:r.finished_at,
    context:JSON.parse(r.context_json),preEvidence:r.pre_evidence_json?JSON.parse(r.pre_evidence_json):null,
    repostMenuEvidence:r.repost_menu_evidence_json?JSON.parse(r.repost_menu_evidence_json):null,
    postEvidence:r.post_evidence_json?JSON.parse(r.post_evidence_json):null};
}
export function listSocialAttempts({limit=100}={}) {
  return db.prepare('SELECT attempt_id FROM social_action_attempts ORDER BY created_at DESC LIMIT ?')
    .all(Math.min(200,Math.max(1,Number(limit)||100))).map(r=>row(r.attempt_id));
}
export function socialStatus(input) {
  const ident=identity(input);
  const prior=db.prepare('SELECT attempt_id FROM social_action_attempts WHERE action=? AND target_key=?')
    .get(ident.action,ident.targetKey);
  const followed=ident.action==='follow' && getAudienceProfile(ident.handle)?.youFollow;
  const publicInteraction=ident.action==='repost' ? getBlockingActAttemptForTarget(ident.targetKey) : null;
  return {action:ident.action,targetUrl:ident.url,alreadyFollowed:Boolean(followed),
    existing:prior?row(prior.attempt_id):null,
    existingPublicInteraction:publicInteraction ? {attemptId:publicInteraction.attemptId,state:publicInteraction.state} : null,
    canClaim:!prior&&!followed&&!publicInteraction,advisory:true};
}
export function claimSocialAction(input) {
  const ident=identity(input);
  const evidence=substantiated(input,ident);
  const now=Date.now();
  boundRun(input.runId,input.sessionId);
  const policy=checkPolicy(ident.action,now,{...input,targetUrl:ident.url});
  const audience=getAudienceProfile(ident.handle);
  if(ident.action==='repost' && getBlockingActAttemptForTarget(ident.targetKey)) {
    throw new DomainValidationError('This source already has an original public interaction; prefer one additive distribution path, not both repost and quote/reply.');
  }
  if(ident.action==='follow' && audience?.youFollow) throw new DomainValidationError('Already following account in last stored audience observation.');
  // A single interesting post is sufficient for a like, but not a follow.
  if(ident.action==='follow' && new Set(evidence.references.map(u=>source(u)?.[2]).filter(Boolean)).size<policy.minimumObservedPosts) {
    throw new DomainValidationError('More distinct observed posts required by product follow policy.');
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    checkPolicy(ident.action,now,{...input,targetUrl:ident.url});
    if(ident.action==='repost' && getBlockingActAttemptForTarget(ident.targetKey)) {
      throw new DomainValidationError('Public reply/quote target was already claimed; do not repost it as a second distribution action.');
    }
    const existing=db.prepare('SELECT attempt_id FROM social_action_attempts WHERE action=? AND target_key=?')
      .get(ident.action,ident.targetKey);
    if(existing) throw new DomainValidationError('Social action already claimed, completed or unresolved. Do not retry.');
    const attemptId=randomUUID();
    db.prepare(`INSERT INTO social_action_attempts
      (attempt_id,action,target_key,target_url,run_id,session_id,state,reason,context_json,created_at)
      VALUES (?,?,?,?,?,?,'claimed',?,?,?)`)
      .run(attemptId,ident.action,ident.targetKey,ident.url,input.runId,input.sessionId,
        evidence.why,JSON.stringify(evidence),now);
    db.exec('COMMIT');
    return {attempt:row(attemptId),browserRule:ident.action==='repost'
      ? 'Verify source in the exact status page, then social-start before clicking the Repost menu trigger. After observing the actual menu call social-repost-menu-start BEFORE one menu Repost click, then independently verify Undo repost. Do not repeat uncertain clicks.'
      : 'Observe exact target and current not-following/not-liked button. Call social-start before one possible click; never click without that transition.'};
  } catch(e) {db.exec('ROLLBACK');throw e;}
}

function mutationEvidence(input,a) {
  const x=input.evidence;
  const now=Date.now();
  if(!x||typeof x!=='object'||x.targetUrl!==a.targetUrl
    || !Number.isSafeInteger(x.observedAt)||x.observedAt>now+60_000||now-x.observedAt>4*60_000) {
    throw new DomainValidationError('Social mutation requires a recent observed exact-target URL.');
  }
  const expected=a.action==='follow'?'Follow':a.action==='like'?'Like':'Repost';
  if(String(x.controlName||'')!==expected) {
    throw new DomainValidationError(`Expected current exact-target ${expected} control; if already followed/liked, do not click.`);
  }
  if(String(x.snapshot||'').length<30 || !String(x.snapshot).toLowerCase().includes(a.action==='follow' ? a.targetKey : new URL(a.targetUrl).pathname.split('/')[1])) {
    throw new DomainValidationError('Social mutation needs exact-target author evidence from the current browser snapshot.');
  }
  return {targetUrl:x.targetUrl, observedAt:x.observedAt, controlName:expected, snapshot:String(x.snapshot).slice(0,2000)};
}
export function startSocialAction(input) {
  const a=row(String(input.attemptId||''));
  boundRun(input.runId,input.sessionId);
  if(a.runId!==input.runId||a.sessionId!==input.sessionId||a.state!=='claimed') {
    throw new DomainValidationError('Only exact active claimant may start a fresh social action.');
  }
  checkPolicy(a.action,Date.now(),{targetUrl:a.targetUrl,evidenceUrls:a.context.references,urgency:a.context.urgency});
  const evidence=mutationEvidence(input,a);
  const out=db.prepare(`UPDATE social_action_attempts SET state='mutation_started', started_at=?, pre_evidence_json=?
    WHERE attempt_id=? AND state='claimed'`).run(Date.now(),JSON.stringify(evidence),a.attemptId);
  if(!out.changes) throw new DomainValidationError('Social action start race; stop without a click.');
  return {attempt:row(a.attemptId),executionRule:a.action==='repost'
    ? 'Click exact-target Repost menu trigger ONCE; observe its menu. Then call social-repost-menu-start before clicking the exact Repost confirmation ONCE. If uncertain, close unresolved; never retry.'
    : 'One exact-target browser click only. Never retry on timeout or unknown dispatch; resolve from fresh visible state.'};
}
export function startRepostConfirmation(input) {
  const a=row(String(input.attemptId||''));
  if(a.action!=='repost'||a.state!=='mutation_started') throw new DomainValidationError('Repost confirmation requires a started repost menu and a fresh exclusive attempt.');
  if(a.runId!==input.runId||a.sessionId!==input.sessionId) throw new DomainValidationError('Repost confirmation owner mismatch.');
  boundRun(input.runId,input.sessionId);
  checkPolicy(a.action,Date.now(),{targetUrl:a.targetUrl,evidenceUrls:a.context.references,urgency:a.context.urgency});
  const proof=input.evidence||{};
  const seen=Number(proof.observedAt);
  const current=Date.now();
  const author=new URL(a.targetUrl).pathname.split('/')[1].toLowerCase();
  if(proof.targetUrl!==a.targetUrl || proof.menuControlName!=='Repost'
    || !(seen>=a.startedAt&&seen<=current+60_000&&current-seen<=120_000)
    || !String(proof.snapshot||'').toLowerCase().includes(author)
    || String(proof.snapshot||'').length<30) {
    throw new DomainValidationError('Exact source account, recent Repost menu and source URL must be observed before repost confirmation.');
  }
  const evidence={targetUrl:a.targetUrl,observedAt:seen,menuControlName:'Repost',snapshot:String(proof.snapshot).slice(0,2000)};
  const changed=db.prepare(`UPDATE social_action_attempts
    SET state='repost_confirmation_started',repost_menu_evidence_json=?
    WHERE attempt_id=? AND state='mutation_started'`).run(JSON.stringify(evidence),a.attemptId);
  if(!changed.changes) throw new DomainValidationError('Repost confirmation race; do not click.');
  return {attempt:row(a.attemptId),executionRule:'Only now click observed Repost confirmation ONCE. Verify Undo repost on exact source tweet or close unresolved. Never retry.'};
}
export function resolveSocialAction(input) {
  const a=row(String(input.attemptId||''));
  if(a.runId!==input.runId||a.sessionId!==input.sessionId) throw new DomainValidationError('Social attempt owner mismatch.');
  const state=String(input.state||'');
  if(!states.has(state)||!['confirmed','confirmed_not_applied','closed_unresolved'].includes(state)) throw new DomainValidationError('Invalid social resolution.');
  if(a.state==='claimed' && state==='confirmed') throw new DomainValidationError('Cannot confirm a social action without mutation-start fence.');
  if(['mutation_started','repost_confirmation_started'].includes(a.state) && state==='confirmed_not_applied') throw new DomainValidationError('A started click cannot safely be declared not applied.');
  if(!['claimed','mutation_started','repost_confirmation_started'].includes(a.state)) throw new DomainValidationError('Social attempt already terminal; never retry.');
  if(state==='confirmed' && a.state!==(a.action==='repost'?'repost_confirmation_started':'mutation_started')) {
    throw new DomainValidationError('Confirmed social action must cross its exact mutation boundary.');
  }
  const e=input.evidence || {};
  if(state==='confirmed' && (e.targetUrl!==a.targetUrl
    || !(Number(e.observedAt)>=a.startedAt && Number(e.observedAt)<=Date.now()+60_000)
    || e.afterControlName!==(a.action==='follow'?'Following':a.action==='like'?'Unlike':'Undo repost')
    || String(e.snapshot||'').length<30
    || !String(e.snapshot).toLowerCase().includes(new URL(a.targetUrl).pathname.split('/')[1].toLowerCase()))) {
    throw new DomainValidationError('Positive exact-target post-click browser verification required.');
  }
  if(state==='confirmed_not_applied' && a.state!=='claimed') throw new DomainValidationError('Not-applied is allowed only before mutation-start.');
  const evidence={targetUrl:String(e.targetUrl||a.targetUrl),observedAt:Number(e.observedAt||Date.now()),
    afterControlName:String(e.afterControlName||''),snapshot:String(e.snapshot||'').slice(0,2000),
    reason:String(e.reason||'').slice(0,600)};
  const out=db.prepare('UPDATE social_action_attempts SET state=?,finished_at=?,post_evidence_json=? WHERE attempt_id=? AND state=?')
    .run(state,Date.now(),JSON.stringify(evidence),a.attemptId,a.state);
  if(!out.changes) throw new DomainValidationError('Social resolution race.');
  if(state==='confirmed' && a.action==='follow') {
    const handle=new URL(a.targetUrl).pathname.slice(1);
    if(getAudienceProfile(handle)) setAudienceFollowState(handle,{youFollow:true});
  }
  return row(a.attemptId);
}

// Read-only leads, not instructions to click. Compare sustained author quality,
// usefulness, topic fit, and observed engagement independently of account size.
export function discoverSocialCandidates({limit=20}={}) {
  const n=Math.max(1,Math.min(50,Number(limit)||20));
  const sources=listCandidates({source:'x',sort:'recent',limit:500});
  const own=String(process.env.X_ACCOUNT||'ham_zax').toLowerCase().replace(/^@/,'');
  const authors=new Map();
  const likes=[];
  const reposts=[];
  for(const candidate of sources) {
    const match=source(candidate.url||candidate.key);
    if(!match) continue;
    const author=match[1].toLowerCase(), tweetId=match[2];
    if(author===own||!String(candidate.text||'').trim()) continue;
    const niche=Number(candidate.niche?.score||0);
    const velocity=Math.max(0,Number(candidate.viral?.engagementsPerHour||0));
    const momentum=Math.log10(velocity+1);
    const score=Math.round((niche*.75+momentum*6)*10)/10;
    const item={username:author,targetUrl:`https://x.com/${author}/status/${tweetId}`,
      text:String(candidate.text||'').slice(0,220),nicheScore:niche,
      measuredEngagementsPerHour:Math.round(velocity),priority:score};
    if(!db.prepare("SELECT 1 FROM social_action_attempts WHERE action='like' AND target_key=?").get(tweetId)) likes.push(item);
    if(!db.prepare("SELECT 1 FROM social_action_attempts WHERE action='repost' AND target_key=?").get(tweetId)
      && !getBlockingActAttemptForTarget(tweetId)) {
      reposts.push({...item,reason:'Consider unchanged Repost only if this original source is especially useful to our followers, not merely popular. Otherwise add a distinct Quote take, Reply, Like or skip.'});
    }
    if(!authors.has(author)) authors.set(author,[]);
    const seen=authors.get(author);
    if(!seen.some(x=>x.targetUrl===item.targetUrl)) seen.push(item);
  }
  const follows=[];
  for(const [username,posts] of authors) {
    if(posts.length<2||getAudienceProfile(username)?.youFollow) continue;
    if(db.prepare("SELECT 1 FROM social_action_attempts WHERE action='follow' AND target_key=?").get(username)) continue;
    const ranked=[...posts].sort((a,b)=>b.priority-a.priority);
    const score=Math.round((ranked.slice(0,3).reduce((x,y)=>x+y.priority,0)/Math.min(3,ranked.length))*10)/10;
    follows.push({username,priority:score,distinctObservedPosts:posts.length,
      examples:ranked.slice(0,3),reason:'Read the live profile and recent posts before choosing whether this author is worth following; no metric is an automatic follow threshold.'});
  }
  follows.sort((a,b)=>b.priority-a.priority||a.username.localeCompare(b.username));
  likes.sort((a,b)=>b.priority-a.priority||a.targetUrl.localeCompare(b.targetUrl));
  reposts.sort((a,b)=>b.priority-a.priority||a.targetUrl.localeCompare(b.targetUrl));
  const policy=getGrowthProductPolicy().social;
  return {follows:policy.follow.enabled?follows.slice(0,n):[],
    likes:policy.like.enabled?likes.slice(0,n):[],
    reposts:policy.repost.enabled?reposts.slice(0,n):[],
    policy,provisional:true,
    guidance:'Read-only suggestions, never automatic actions. Pick like for an insightful post, Repost for exceptional unchanged source distribution, Quote for unique added perspective, Reply for direct discussion, Follow for sustained useful author work, or skip. Use the social ledger for Follow/Like/Repost, act for Quote/Reply, and NEVER unfollow.'};
}
