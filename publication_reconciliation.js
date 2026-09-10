import {
  appendPublicationAttemptReconciliationEvidence,
  getAutonomousReplyDecision,
  getAutonomousReplyGrantState,
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

export function ensureLegacyPublicationAttemptMigration() {
  return migrateLegacyPublishingQueueItems();
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

export function confirmPublicationAttemptNotSent(attemptId, {
  reason,
  evidence,
  now = Date.now(),
} = {}) {
  if (!String(reason || '').trim()) throw new Error('confirmed_not_sent requires a concrete reason.');
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || evidence.sendBoundaryCrossed !== false) {
    throw new Error('confirmed_not_sent requires evidence.sendBoundaryCrossed=false.');
  }
  return runStoreTransaction(() => {
    const current = requireAttempt(attemptId);
    const attempt = current.state === 'confirmed_not_sent'
      ? current
      : transitionPublicationAttempt(attemptId, {
        state: 'confirmed_not_sent',
        reconciliationEvidence: evidence,
        closureReason: reason,
        lastError: reason,
        now,
      });
    const queueItem = queueForAttempt(attempt);
    const saved = queueItem.status === 'publishing'
      ? saveQueueItem({
        ...queueItem,
        status: 'approved',
        publishStartedAt: null,
        publishError: String(reason),
      })
      : queueItem;

    let autonomousReplyDecision = null;
    let autonomousReplyBudgetRefunded = false;
    if (attempt.authoritySnapshot?.type === 'autonomous_reply' && Number.isInteger(Number(attempt.authoritySnapshot?.decisionId))) {
      const decision = getAutonomousReplyDecision(Number(attempt.authoritySnapshot.decisionId));
      const sameClaim = decision
        && decision.decision === 'sending'
        && decision.sentAt == null
        && !decision.outputTweetId
        && !decision.outputUrl
        && Number(decision.queueItemId) === Number(attempt.queueItemId)
        && String(decision.candidateKey || '') === String(attempt.candidateKey || '')
        && String(decision.targetTweetId || '') === String(attempt.targetTweetId || '')
        && Number(decision.grantRevision) === Number(attempt.authoritySnapshot.grantRevision)
        && Number(decision.claimedAt) === Number(attempt.claimedAt);
      if (sameClaim) {
        autonomousReplyDecision = updateAutonomousReplyDecision(decision.id, {
          decision: 'eligible_live',
          claimedAt: null,
          updatedAt: Number(now),
        });
        const grant = getAutonomousReplyGrantState();
        if (grant
          && Number(grant.revision) === Number(attempt.authoritySnapshot.grantRevision)
          && Number(grant.budgetUsed || 0) > 0) {
          saveAutonomousReplyGrantState({
            ...grant,
            budgetUsed: Number(grant.budgetUsed || 0) - 1,
          });
          autonomousReplyBudgetRefunded = true;
        }
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
