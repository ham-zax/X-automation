import { useConversationAction, useConversationDetail } from '../../api/client'
import {
  Badge,
  Disclosure,
  Error,
  Loading,
  Notice,
  Pending,
  TechnicalDetails,
  formatDateTime,
} from '../../components/primitives'
import { navigate } from '../../router'
import { DraftEditor } from '../create/DraftEditor'
import { GrowthFitPanel } from '../create/GrowthFitPanel'
import { autonomousLabel, autonomousTone } from './autonomousView'

export function ConversationDetail({ candidateKey }: { candidateKey: string }) {
  const { data, isLoading, error, refetch } = useConversationDetail(candidateKey)
  const draftAction = useConversationAction('draft', candidateKey)
  const reviewAction = useConversationAction('review', candidateKey)
  const approveAction = useConversationAction('approve', candidateKey)
  const resolveAction = useConversationAction('resolve', candidateKey)
  const quoteAction = useConversationAction('quote', candidateKey)

  if (isLoading) {
    return <Loading message="Loading conversation..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data) {
    return <Error message="Conversation not found." />
  }

  const editor = data.editor
  const canApproveReply = data.flags.canApproveReply
  const approvedForBrowser = data.flags.approved && !data.health.constrained
  const actionError =
    (draftAction.isError && draftAction.error.message)
    || (reviewAction.isError && reviewAction.error.message)
    || (approveAction.isError && approveAction.error.message)
    || (resolveAction.isError && resolveAction.error.message)
    || (quoteAction.isError && quoteAction.error.message)
    || null

  const approvePending = approveAction.isPending

  return (
    <div className="space-y-6">
      <div>
        <a href="#/conversations" className="text-sm font-medium text-slate-500 hover:text-slate-700">← Back to conversations</a>
      </div>

      <div className="conversation-workspace">
      <div className="space-y-5">
      <article className="operator-surface p-5 sm:p-6" data-tone="primary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              @{data.targetUsername} · {data.engagementKindLabel}
            </h2>
            <div className="mt-1 text-sm text-slate-500">
              {data.statusLabel}
              {data.expiresAt ? ` · useful until ${formatDateTime(data.expiresAt)}` : ''}
            </div>
          </div>
          <div className="flex gap-2">
            <Badge tone={data.priority >= 60 ? 'success' : 'neutral'}>{data.priorityLabel}</Badge>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold text-slate-900">What you can add</div>
          <div className="mt-1 text-slate-700">{data.contribution || 'Review the source and decide whether there is a legitimate reason to act.'}</div>
        </div>

        {data.relationship && (
          <div className="mt-3 text-sm text-slate-600">
            {data.relationship.targetScoreLabel} relationship fit · {data.relationship.stage.replaceAll('_', ' ')} ·
            {' '}{data.relationship.theirRepliesToUs} prior repl{data.relationship.theirRepliesToUs === 1 ? 'y' : 'ies'} ·
            {' '}{data.relationship.meaningfulInteractions} useful interaction{data.relationship.meaningfulInteractions === 1 ? '' : 's'}
          </div>
        )}

        {data.candidate && (
          <div className="operator-surface mt-4 p-4" data-tone="info">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exact source</div>
            <div className="source-text">{data.candidate.text}</div>
            {data.candidate.url && (
              <a href={data.candidate.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-sky-700 hover:underline">
                Open source ↗
              </a>
            )}
          </div>
        )}

        {data.rejectionReasons.length > 0 && (
          <Notice tone="danger" title="This opportunity is currently unavailable">
            <div className="space-y-2">{data.rejectionReasons.map((reason, index) => <div key={index}>{reason}</div>)}</div>
          </Notice>
        )}

        <Disclosure summary="Recommendation & evidence" defaultOpen>
          <div className="text-sm text-slate-700">
            <strong>Reply priority:</strong> {data.priorityLabel} (internal priority {Math.round(data.priority)})
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(data.components).map(([key, value]) => (
              <Badge key={key}>{key.replaceAll('_', ' ')} {Math.round(Number(value || 0))}</Badge>
            ))}
          </div>
          {data.learnedAdjustment && Number(data.learnedAdjustment.learnedAdjustment || 0) !== 0 && (
            <div className="mt-2 text-sm text-sky-800">
              <strong>Accepted learned contribution:</strong> reply priority adjusted by {Number(data.learnedAdjustment.learnedAdjustment) >= 0 ? '+' : ''}{Number(data.learnedAdjustment.learnedAdjustment)}.
            </div>
          )}
          <TechnicalDetails>
            <div>Freshness: {JSON.stringify(data.freshness)}</div>
            <div>Soft pressure: {JSON.stringify(data.softPressure)}</div>
            <div>Saturation: {JSON.stringify(data.saturationSummary)}</div>
            <div>Repetition: {JSON.stringify(data.repetitionSummary)}</div>
            <div>Expiry: {JSON.stringify(data.expiry)}</div>
          </TechnicalDetails>
        </Disclosure>
      </article>

      {data.autonomousDecision && (
        <section className="operator-surface p-4" data-tone="ai">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sky-950">Autonomous decision</strong>
            <Badge tone={autonomousTone(data.autonomousDecision.decision)}>{autonomousLabel(data.autonomousDecision.decision)}</Badge>
            <Badge>{data.autonomousDecision.sourceClass.replaceAll('_', ' ')}</Badge>
            {data.autonomousDecision.intent && <Badge>{data.autonomousDecision.intent.replaceAll('_', ' ')}</Badge>}
            {data.autonomousDecision.tone && <Badge>{data.autonomousDecision.tone.replaceAll('_', ' ')}</Badge>}
          </div>
          {data.autonomousDecision.exactReply && <div className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{data.autonomousDecision.exactReply}</div>}
          {data.autonomousDecision.reasons.length > 0 && (
            <div className="mt-3 space-y-1 text-xs text-slate-700">
              {data.autonomousDecision.reasons.map((reason, index) => <div key={`${reason.code}-${index}`}><strong>{reason.code}</strong> · {reason.reason}</div>)}
            </div>
          )}
          <div className="mt-2 text-xs text-slate-600">Grant revision {data.autonomousDecision.grantRevision} · {data.autonomousDecision.mode === 'dry_run' ? 'dry run; no X mutation' : 'live authority'}.</div>
        </section>
      )}

      {data.health.constrained && data.status !== 'published' && (
        <Notice tone="danger" title="Sending is temporarily unavailable">Supported account evidence is currently limiting reply approval/sending. <a href="/legacy?source=health" className="underline">Review account status</a>.</Notice>
      )}

      </div>
      <div className="space-y-5">
      {editor ? (
        <section className="operator-surface p-5 sm:p-6" data-tone="ai">
          <GrowthFitPanel
            growthFit={editor.growthFit}
            queueItemId={editor.queueItem?.id ?? null}
            candidateKey={editor.candidate.key}
            readOnly={editor.flags.readOnly || Boolean(editor.queueItem?.humanApprovedAt)}
          />
          <div className="mt-5"><DraftEditor data={editor} /></div>

          <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
            {editor.flags.canReview && (
              <div>
                <button
                  onClick={() => reviewAction.mutate({})}
                  disabled={reviewAction.isPending}
                  className="action-button" data-variant="secondary"
                >
                  {reviewAction.isPending ? 'Checking…' : editor.queueItem?.status === 'needs_review' ? 'Recheck readiness' : 'Check readiness'}
                </button>
                <div className="mt-1 text-xs text-slate-500">This checks whether the current draft is ready for human approval. It does not send anything.</div>
              </div>
            )}

            {canApproveReply && (
              <div className="operator-surface p-4" data-tone="success">
                {approvePending ? (
                  <Pending label="Approving the exact reply…" />
                ) : (
                  <button
                    onClick={() => approveAction.mutate({})}
                    className="action-button" data-variant="success"
                  >
                    Approve exact reply
                  </button>
                )}
                <div className="mt-1 text-xs text-emerald-900">
                  This freezes the exact reply for the browser-agent lane. The web server does not click X; the persistent Growth Operator must inspect the target, claim this exact reply, send once, and verify the parent/text before reconciliation.
                </div>
              </div>
            )}

            {approvedForBrowser && (
              <Notice tone="success" title="Approved for browser execution"><span className="text-xs">The exact text is frozen. A persistent Growth Operator can now inspect the live target and atomically claim it with <code>browser-reply-claim</code> immediately before the X action.</span></Notice>
            )}

            {approveAction.isSuccess && <Notice tone="success" title="Reply approved">It is ready for the browser-agent execution lane; no X mutation happened in the web server.</Notice>}
          </div>
        </section>
      ) : draftAction.isPending ? (
        <div className="operator-surface p-5 sm:p-6">
          <Pending label="Generating a reply draft with AI…" />
        </div>
      ) : (
        <div className="operator-surface p-5 sm:p-6">
          <div className="text-sm text-slate-600">No reply draft yet. Generate one with AI, then review the exact text before approving.</div>
          <button
            onClick={() => draftAction.mutate({})}
            className="action-button mt-3" data-variant="primary"
          >
            Generate reply with AI
          </button>
        </div>
      )}

      {editor && data.status !== 'published' && (
        <Disclosure summary="Alternative actions" defaultOpen>
          <div className="flex flex-wrap items-end gap-2">
            {data.engagementKind === 'initial_reply' && (
              <button
                onClick={() => quoteAction.mutate({}, { onSuccess: (result) => {
                  const draftId = (result as { draftId?: number | null }).draftId
                  if (draftId) navigate(`/draft/${draftId}`)
                } })}
                disabled={quoteAction.isPending}
                className="action-button" data-variant="secondary"
              >
                Make a quote post instead
              </button>
            )}
            <button
              onClick={() => resolveAction.mutate({ action: 'ignore' }, { onSuccess: () => navigate('/conversations') })}
              disabled={resolveAction.isPending}
              className="action-button" data-variant="secondary"
            >
              Skip conversation
            </button>
            <button
              onClick={() => resolveAction.mutate({ action: 'expire' }, { onSuccess: () => navigate('/conversations') })}
              disabled={resolveAction.isPending}
              className="action-button" data-variant="secondary"
            >
              No longer useful
            </button>
          </div>
        </Disclosure>
      )}

      {actionError && (
        <Notice tone="danger" title="Action failed">{actionError}</Notice>
      )}
      </div>
      </div>
    </div>
  )
}
