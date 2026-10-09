// Isolated ledger transition tests. Never touch the real X account or live SQLite.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = mkdtempSync(path.join(os.tmpdir(), 'xgrowth-social-ledger-'));
process.chdir(scratch);
after(() => { process.chdir(originalCwd); rmSync(scratch, {recursive:true,force:true}); });

const store = await import('../store.js');
const social = await import('../social_engagement.js');
const { socialOperatorPrompt } = await import('../ops/social_operator_contract.js');
const { buildScoutCards } = await import('../scout.js');
const { validateGrowthPolicy, DEFAULT_GROWTH_POLICY } = await import('../growth_product_policy.js');

const author='samplebuilder';
const tweetId='2108319632490693104';
const url=`https://x.com/${author}/status/${tweetId}`;
const now=Date.now();
const reason='This original source teaches an unusually useful concrete technical pattern that our builder audience should see intact without being buried by a take.';
const audienceValue='Engineers can study this hands-on implementation detail directly without chasing secondary summaries or misleading snippets.';
const whyNotQuote='The original source explains the implementation clearly, and our extra commentary would add no substantive new insight.';
const accountEvidence=`Observed @${author} on the exact original status page with a fresh Repost menu trigger and useful source content.`;
const policy=store.getGrowthProductPolicy();
const audience=store.getGrowthProductPolicyView();

test('versioned social lane configuration and advisory persona contract', () => {
  assert.equal(validateGrowthPolicy(DEFAULT_GROWTH_POLICY).social.repost.maxPer24Hours,5);
  assert.equal(policy.social.follow.maxPer24Hours,4);
  assert.equal(policy.social.like.maxPer24Hours,20);
  assert.equal(audience.policy.social.repost.enabled,true);
  const instructions=socialOperatorPrompt();
  for(const phrase of ['social-repost-menu-start','social-start','social-resolve','Quote','NEVER AUTOMATICALLY UNFOLLOW']) {
    assert.ok(instructions.includes(phrase),`missing instruction ${phrase}`);
  }
});

test('quote discovery remains independent when replies are turned off', () => {
  const specific=structuredClone(DEFAULT_GROWTH_POLICY);
  specific.lanes.reply.enabled=false;
  specific.lanes.quote.enabled=true;
  const generatedAt=Date.parse('2026-10-09T10:00:00Z');
  const packet=buildScoutCards({now:generatedAt,productPolicy:specific,ownHandle:'ham_zax',
    candidates:[{source:'x',key:url,url,text:'An interesting primary research model launch and technical detail.',
      publishedAt:generatedAt-600_000,nicheScore:82,viewsPerHour:100,engagementsPerHour:15}],
    attempts:[],inspirationCandidates:[],limit:5});
  const quoteCard=packet.cards.find(x=>x.tier==='T1');
  assert.equal(quoteCard?.action,'quote');
  assert.deepEqual(quoteCard?.eligibleActions,['quote']);
});

test('unfollow never enters the autonomous mutation ledger', () => {
  assert.throws(() => social.socialStatus({action:'unfollow',username:author}),/Unfollow is human-only/);
  assert.throws(() => social.socialStatus({action:'repost',username:author,targetUrl:'https://example.org/not-x'}),/exact observed source post/);
});

test('repost needs audience value, exact evidence and active authority', () => {
  assert.throws(() => social.claimSocialAction({action:'repost',username:author,targetUrl:url,
    reason,observedAt:now,evidenceUrls:[url],runId:'fake',sessionId:'fake'}),/exceptional reader value/);
  assert.throws(() => social.claimSocialAction({action:'repost',username:author,targetUrl:url,
    reason,audienceValue,whyNotQuote,observedAt:Date.now(),evidenceUrls:[url],runId:'fake',sessionId:'fake'}),/active canonical Growth Run/);
  assert.equal(social.socialStatus({action:'repost',username:author,targetUrl:url}).canClaim,true);
});

test('repost requires two distinct click boundaries and final structural evidence', () => {
  store.configureGrowthOperatorDelegation({mode:'live'});
  const grant=store.startGrowthOperatorDelegation();
  const runId='simulated-run-001',sessionId='simulated-session-001';
  store.createGrowthRun({runId,sessionId,delegationRevision:grant.revision,now:Date.now()});
  const claim=social.claimSocialAction({action:'repost',username:author,targetUrl:url,
    reason,audienceValue,whyNotQuote,observedAt:Date.now(),evidenceUrls:[url],runId,sessionId});
  assert.equal(claim.attempt.state,'claimed');
  assert.equal(social.socialStatus({action:'repost',username:author,targetUrl:url}).canClaim,false);
  const attemptId=claim.attempt.attemptId;
  assert.throws(()=>social.resolveSocialAction({attemptId,runId,sessionId,state:'confirmed',evidence:{}}),/mutation boundary|mutation-start fence/);
  const started=social.startSocialAction({attemptId,runId,sessionId,evidence:{
    targetUrl:url,observedAt:Date.now(),controlName:'Repost',snapshot:accountEvidence}});
  assert.equal(started.attempt.state,'mutation_started');
  assert.throws(()=>social.resolveSocialAction({attemptId,runId,sessionId,state:'confirmed',evidence:{
    targetUrl:url,observedAt:Date.now(),afterControlName:'Undo repost',snapshot:accountEvidence}}),/mutation boundary/);
  const menu=social.startRepostConfirmation({attemptId,runId,sessionId,evidence:{
    targetUrl:url,observedAt:Date.now(),menuControlName:'Repost',snapshot:accountEvidence+' Repost menu is open with a Repost confirmation.'}});
  assert.equal(menu.attempt.state,'repost_confirmation_started');
  assert.throws(()=>social.startRepostConfirmation({attemptId,runId,sessionId,evidence:{}}),/requires a started repost menu/);
  assert.throws(()=>social.resolveSocialAction({attemptId,runId,sessionId,state:'confirmed',evidence:{
    targetUrl:url,observedAt:Date.now(),afterControlName:'Like',snapshot:accountEvidence}}),/Positive exact-target/);
  const confirmed=social.resolveSocialAction({attemptId,runId,sessionId,state:'confirmed',evidence:{
    targetUrl:url,observedAt:Date.now(),afterControlName:'Undo repost',
    snapshot:accountEvidence+' This original now shows Undo repost.'}});
  assert.equal(confirmed.state,'confirmed');
  assert.equal(social.socialStatus({action:'repost',username:author,targetUrl:url}).canClaim,false);
  assert.throws(()=>social.claimSocialAction({action:'repost',username:author,targetUrl:url,
    reason,audienceValue,whyNotQuote,observedAt:Date.now(),evidenceUrls:[url],runId,sessionId}),/already claimed|already claimed, completed/);
});
