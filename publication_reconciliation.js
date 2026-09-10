import {
  appendPublicationAttemptReconciliationEvidence,
  correctPublicationAttemptTerminalState,
  getAutonomousReplyDecision,
  getAutonomousReplyGrantState,
  getLatestPublicationAttemptForQueueItem,
  getPublicationAttempt,
  getQueueItem,
  listPublicationAttempts,
  listRecentUnresolvedMainFeedAttempts,
  migrateLegacyPublishingQueueItems,
  runStoreTransaction,
  saveAutonomousReplyGrantState,
  saveQueueItem,
  transitionPublicationAttempt,
  updateAutonomousReplyDecision,
} from './store.js';

const MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread', 'repost']);

function requireAttempt(attemptId) {
  const attempt = getPublicationAttempt(attemptId);
  if (!attempt) throw new Error(`Publication attempt not found: ${attemptId}`);
  return attempt;
}

function queueForAttempt(attempt) {
  const queueItem = getQueueItem(attempt.queueItemId);
  if (!queueItem || queueItem.candidateKey !== attempt.candidateKey) {
    throw new Error(`Publication attempt ${attempt.attemptId} no longer matches its queue item.`);
  }
  return queueItem;
}

const DEFINITIVE_NOT_SENT_PROOF_KINDS = new Set(['mutation_not_dispatched', 'transport_rejected']);

function hasDefinitiveNotSentProof(evidence) {
  const proof = evidence?.notSentProof;
  return Boolean(proof
    && typeof proof === 'object'
    && !Array.isArray(proof)
    && DEFINITIVE_NOT_SENT_PROOF_KINDS.has(String(proof.kind || ''))
    && String(proof.detail || '').trim());
}

export function ensureLegacyPublicationAttemptMigration({ now = Date.now() } = {}) {
  const publishing = migrateLegacyPublishingQueueItems();
  const attempts = listPublicationAttempts({ limit: 500 });
  const corrected = [];
  for (const attempt of attempts) {
    if (attempt.state !== 'confirmed_not_sent' || hasDefinitiveNotSentProof(attempt.reconciliationEvidence)) continue;
    const correctedAttempt = correctPublicationAttemptTerminalState(attempt.attemptId, {
      state: 'closed_unresolved',
      reconciliationEvidence: {
        migration: 'legacy_confirmed_not_sent_without_definitive_proof',
        reason: 'Legacy browser UI persistence was not sufficient proof that X never accepted the send.',
      },
      closureReason: 'Legacy confirmed_not_sent evidence was insufficient under the corrected publication boundary; outcome remains unresolved until positive live evidence is found.',
      lastError: 'Legacy no-send evidence was not definitive.',
      now,
    });
    const queueItem = queueForAttempt(correctedAttempt);
    if (queueItem.status !== 'published') {
      saveQueueItem({
        ...queueItem,
        status: 'unresolved',
        publishStartedAt: null,
        publishError: 'Publication outcome requires reconciliation; legacy no-send evidence was not definitive.',
      });
    }
    if (correctedAttempt.authoritySnapshot?.type === 'autonomous_reply' && Number.isInteger(Number(correctedAttempt.authoritySnapshot?.decisionId))) {
      const decision = getAutonomousReplyDecision(Number(correctedAttempt.authoritySnapshot.decisionId));
      if (decision && decision.sentAt == null && !decision.outputTweetId && !decision.outputUrl) {
        updateAutonomousReplyDecision(decision.id, {
          decision: 'reconciliation_required',
          claimedAt: null,
          reasons: [{
            code: 'PUBLICATION_OUTCOME_UNRESOLVED',
            reason: 'Legacy confirmed_not_sent evidence was insufficient; do not retry until the exact publication outcome is reconciled.',
          }],
          updatedAt: Number(now),
        });
      }
    }
    corrected.push(correctedAttempt.attemptId);
  }
  return { publishing, correctedConfirmedNotSent: corrected };
}

export function markPublicationAttemptInvestigating(attemptId, {
  reason = 'Publication outcome requires reconciliation.',
  evidence = {},
  executionEvidence = {},
  outputTweetId = undefined,
  outputUrl = undefined,
  now = Date.now(),
} = {}) {
  const current = requireAttempt(attemptId);
  const attempt = current.state === 'investigating'
    ? current
    : transitionPublicationAttempt(attemptId, {
      state: 'investigating',
      reconciliationEvidence: evidence,
      executionEvidence,
      outputTweetId,
      outputUrl,
      lastError: reason,
      now,
    });
  const queueItem = queueForAttempt(attempt);
  if (queueItem.status === 'publishing') {
    saveQueueItem({ ...queueItem, publishError: String(reason || '') });
  }
  return { attempt: getPublicationAttempt(attempt.attemptId), queueItem: getQueueItem(queueItem.id) };
}

function sameAutonomousReplyClaim(decision, attempt) {
  return Boolean(decision
    && decision.sentAt == null
    && !decision.outputTweetId
    && !decision.outputUrl
    && Number(decision.queueItemId) === Number(attempt.queueItemId)
    && String(decision.candidateKey || '') === String(attempt.candidateKey || '')
    && String(decision.targetTweetId || '') === String(attempt.targetTweetId || '')
    && Number(decision.grantRevision) === Number(attempt.authoritySnapshot?.grantRevision)
    && String(decision.exactReply || '').trim() === String(attempt.approvedContent || '').trim());
}

function legacyBrokenAutonomousRetry(decision, attempt, queueItem) {
  if (!decision || attempt.state !== 'confirmed_not_sent') return false;
  const reasons = Array.isArray(decision.reasons) ? decision.reasons : [];
  return decision.decision === 'skipped'
    && decision.claimedAt == null
    && decision.sentAt == null
    && !decision.outputTweetId
    && !decision.outputUrl
    && Number(decision.queueItemId) === Number(attempt.queueItemId)
    && String(decision.candidateKey || '') === String(attempt.candidateKey || '')
    && String(decision.targetTweetId || '') === String(attempt.targetTweetId || '')
    && Number(decision.grantRevision) === Number(attempt.authoritySnapshot?.grantRevision)
    && reasons.some((entry) => entry?.code === 'HUMAN_WORKFLOW_ACTIVE')
    && queueItem.status === 'approved'
    && !queueItem.humanApprovedAt
    && !String(queueItem.approvedText || '').trim();
}

export function confirmPublicationAttemptNotSent(attemptId, {
  reason,
  evidence,
  now = Date.now(),
} = {}) {
  if (!String(reason || '').trim()) throw new Error('confirmed_not_sent requires a concrete reason.');
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || evidence.sendBoundaryCrossed !== false) {
    throw new Error('confirmed_not_sent requires evidence.sendBoundaryCrossed=false.');
  }
  if (!hasDefinitiveNotSentProof(evidence)) {
    throw new Error('confirmed_not_sent requires definitive evidence.notSentProof with kind=mutation_not_dispatched or transport_rejected. Composer persistence, missing toast, or a temporarily missing output are not sufficient.');
  }
  return runStoreTransaction(() => {
    const current = requireAttempt(attemptId);
    if (current.authoritySnapshot?.type === 'autonomous_reply' && Number.isInteger(Number(current.authoritySnapshot?.decisionId))) {
      const currentDecision = getAutonomousReplyDecision(Number(current.authoritySnapshot.decisionId));
      if (currentDecision
        && (currentDecision.sentAt != null || currentDecision.outputTweetId || currentDecision.outputUrl || currentDecision.decision === 'sent')) {
        throw new Error('confirmed_not_sent cannot rewind an autonomous Reply decision that already has sent/output evidence.');
      }
    }
    const alreadyConfirmed = current.state === 'confirmed_not_sent';
    const attempt = alreadyConfirmed
      ? current
      : transitionPublicationAttempt(attemptId, {
        state: 'confirmed_not_sent',
        reconciliationEvidence: evidence,
        closureReason: reason,
        lastError: reason,
        now,
      });
    const queueItem = queueForAttempt(attempt);
    const autonomous = attempt.authoritySnapshot?.type === 'autonomous_reply';
    const saved = queueItem.status === 'publishing' || (autonomous && queueItem.status === 'approved' && !queueItem.humanApprovedAt)
      ? saveQueueItem({
        ...queueItem,
        status: autonomous ? 'drafting' : 'approved',
        publishStartedAt: null,
        publishError: autonomous ? null : String(reason),
      })
      : queueItem;

    let autonomousReplyDecision = null;
    let autonomousReplyBudgetRefunded = false;
    if (autonomous && Number.isInteger(Number(attempt.authoritySnapshot?.decisionId))) {
      const decision = getAutonomousReplyDecision(Number(attempt.authoritySnapshot.decisionId));
      const latestAttempt = getLatestPublicationAttemptForQueueItem(attempt.queueItemId);
      const isLatestAttempt = String(latestAttempt?.attemptId || '') === String(attempt.attemptId);
      const exactClaim = sameAutonomousReplyClaim(decision, attempt);
      const legacyBrokenRetry = legacyBrokenAutonomousRetry(decision, attempt, queueItem);
      const grant = getAutonomousReplyGrantState();
      const sameGrant = grant && Number(grant.revision) === Number(attempt.authoritySnapshot.grantRevision);
      const claimStillOwned = exactClaim
        && decision.decision === 'sending'
        && Number(decision.claimedAt) === Number(attempt.claimedAt);
      const alreadyRecovered = exactClaim && decision.decision === 'eligible_live' && decision.claimedAt == null;

      if (isLatestAttempt && sameGrant && (claimStillOwned || alreadyRecovered || legacyBrokenRetry)) {
        autonomousReplyDecision = updateAutonomousReplyDecision(decision.id, {
          decision: 'eligible_live',
          exactReply: String(attempt.approvedContent || '').trim(),
          reasons: [],
          claimedAt: null,
          sentAt: null,
          outputTweetId: null,
          outputUrl: null,
          updatedAt: Math.max(Number(now), Number(saved.updatedAt || 0)),
        });
        if (!alreadyConfirmed && claimStillOwned && Number(grant.budgetUsed || 0) > 0) {
          saveAutonomousReplyGrantState({
            ...grant,
            budgetUsed: Number(grant.budgetUsed || 0) - 1,
          });
          autonomousReplyBudgetRefunded = true;
        }
      } else if (isLatestAttempt && claimStillOwned && !sameGrant) {
        autonomousReplyDecision = updateAutonomousReplyDecision(decision.id, {
          decision: 'skipped',
          reasons: [{
            code: 'AUTHORITY_CHANGED',
            reason: 'The previous autonomous claim was confirmed not sent, but the Reply grant revision changed before retry recovery.',
          }],
          claimedAt: null,
          updatedAt: Math.max(Number(now), Number(saved.updatedAt || 0)),
        });
      }
    }

    return {
      attempt,
      queueItem: saved,
      autonomousReplyDecision,
      autonomousReplyBudgetRefunded,
    };
  });
}

export function closePublicationAttemptUnresolved(attemptId, {
  reason,
  evidence,
  now = Date.now(),
} = {}) {
  if (!String(reason || '').trim()) throw new Error('closed_unresolved requires a concrete reason.');
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.keys(evidence).length === 0) {
    throw new Error('closed_unresolved requires reconciliation evidence describing the exhausted recovery path.');
  }
  const current = requireAttempt(attemptId);
  const attempt = current.state === 'closed_unresolved'
    ? appendPublicationAttemptReconciliationEvidence(attemptId, evidence, { now })
    : transitionPublicationAttempt(attemptId, {
      state: 'closed_unresolved',
      reconciliationEvidence: evidence,
      closureReason: reason,
      lastError: reason,
      now,
    });
  const queueItem = queueForAttempt(attempt);
  const saved = queueItem.status === 'publishing'
    ? saveQueueItem({
      ...queueItem,
      status: 'unresolved',
      publishStartedAt: null,
      publishError: String(reason),
    })
    : queueItem;
  return { attempt, queueItem: saved };
}

export function confirmPublicationAttemptPublished(attemptId, {
  outputTweetId = null,
  outputUrl = null,
  evidence,
  executionEvidence = {},
  now = Date.now(),
} = {}) {
  const current = requireAttempt(attemptId);
  if (current.actionType !== 'repost' && !String(outputTweetId || outputUrl || '').trim()) {
    throw new Error('confirmed_published requires a confirmed output tweet ID or URL.');
  }
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.keys(evidence).length === 0) {
    throw new Error('confirmed_published requires positive reconciliation evidence.');
  }
  if (['confirmed_not_sent', 'closed_unresolved'].includes(current.state)) {
    return correctPublicationAttemptTerminalState(attemptId, {
      state: 'confirmed_published',
      reconciliationEvidence: evidence,
      executionEvidence,
      outputTweetId,
      outputUrl,
      closureReason: 'Positive publication evidence corrected the earlier terminal reconciliation state.',
      lastError: '',
      now,
    });
  }
  return transitionPublicationAttempt(attemptId, {
    state: 'confirmed_published',
    reconciliationEvidence: evidence,
    executionEvidence,
    outputTweetId,
    outputUrl,
    closureReason: 'Positive publication evidence confirmed.',
    now,
  });
}

export function getPublicationReconciliationReadiness() {
  ensureLegacyPublicationAttemptMigration();
  const attempts = listPublicationAttempts({ limit: 500 });
  const investigating = attempts.filter((attempt) => attempt.state === 'investigating');
  const sendStarted = attempts.filter((attempt) => attempt.state === 'send_started');
  const claimed = attempts.filter((attempt) => attempt.state === 'claimed');
  const closedUnresolved = attempts.filter((attempt) => attempt.state === 'closed_unresolved');
  const active = [...investigating, ...sendStarted, ...claimed];
  const mainFeedBlocking = active.filter((attempt) => MAIN_FEED_PIPELINES.has(attempt.pipeline)
    && ['main', 'main_feed'].includes(attempt.lane));
  return {
    activeCount: active.length,
    investigatingCount: investigating.length,
    sendStartedCount: sendStarted.length,
    claimedCount: claimed.length,
    closedUnresolvedCount: closedUnresolved.length,
    mainFeedBlockingAttemptId: mainFeedBlocking[0]?.attemptId || null,
    mainFeedBlockingQueueItemId: mainFeedBlocking[0]?.queueItemId || null,
  };
}

export function conservativeMainFeedActivityAt() {
  const unresolved = listRecentUnresolvedMainFeedAttempts({ limit: 20 });
  return unresolved.reduce((latest, attempt) => {
    const at = Number(attempt.sendStartedAt || attempt.claimedAt || 0);
    return Number.isFinite(at) ? Math.max(latest, at) : latest;
  }, 0) || null;
}
