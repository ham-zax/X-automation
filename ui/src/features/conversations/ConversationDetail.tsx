import { useState } from 'react'
import { useConversationAction, useConversationDetail } from '../../api/client'
import {
  Badge,
  ConfirmCheckboxes,
  Disclosure,
  Error,
  Loading,
  Pending,
  TechnicalDetails,
  formatDateTime,
} from '../../components/primitives'
import { navigate } from '../../router'
import { DraftEditor } from '../create/DraftEditor'
import { GrowthFitPanel } from '../create/GrowthFitPanel'

export function ConversationDetail({ candidateKey }: { candidateKey: string }) {
  const { data, isLoading, error, refetch } = useConversationDetail(candidateKey)
  const draftAction = useConversationAction('draft', candidateKey)
  const reviewAction = useConversationAction('review', candidateKey)
  const approveSendAction = useConversationAction('approve-send', candidateKey)
  const sendAction = useConversationAction('send', candidateKey)
  const resolveAction = useConversationAction('resolve', candidateKey)
  const quoteAction = useConversationAction('quote', candidateKey)
  const [confirmations, setConfirmations] = useState({ factualityConfirmed: false, evidenceConfirmed: false })

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
  const evidenceRequired = Boolean(editor?.analysis.gatesView.humanConfirmations.some((confirmation) => confirmation.code === 'EVIDENCE_UNCONFIRMED'))
  const canApproveSend = data.flags.canApproveSend
  const canSendApproved = data.flags.approved && !data.health.constrained
  const actionError =
    (draftAction.isError && draftAction.error.message)
    || (reviewAction.isError && reviewAction.error.message)
    || (approveSendAction.isError && approveSendAction.error.message)
    || (sendAction.isError && sendAction.error.message)
    || (resolveAction.isError && resolveAction.error.message)
    || (quoteAction.isError && quoteAction.error.message)
    || null

  const approveSendPending = approveSendAction.isPending
  const sendPending = sendAction.isPending

  return (
    <div className="space-y-6">
      <div>
        <a href="#/conversations" className="text-sm font-medium text-slate-500 hover:text-slate-700">← Back to conversations</a>
      </div>

      <article className="rounded-lg border border-slate-200 bg-white p-6">
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
          <div className="mt-1 text-slate-700">{data.contribution || 'Review the source and decide whether you have a concrete contribution.'}</div>
        </div>

        {data.relationship && (
          <div className="mt-3 text-sm text-slate-600">
            {data.relationship.targetScoreLabel} relationship fit · {data.relationship.stage.replaceAll('_', ' ')} ·
            {' '}{data.relationship.theirRepliesToUs} prior repl{data.relationship.theirRepliesToUs === 1 ? 'y' : 'ies'} ·
            {' '}{data.relationship.meaningfulInteractions} useful interaction{data.relationship.meaningfulInteractions === 1 ? '' : 's'}
          </div>
        )}

        {data.candidate && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exact source</div>
            <div className="mt-1 break-words text-sm text-slate-800">{data.candidate.text}</div>
            {data.candidate.url && (
              <a href={data.candidate.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-sky-700 hover:underline">
                Open source ↗
              </a>
            )}
          </div>
        )}

        {data.rejectionReasons.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            This opportunity is currently unavailable.
            <Disclosure summary="Why?">
              {data.rejectionReasons.map((reason, index) => <div key={index}>{reason}</div>)}
            </Disclosure>
          </div>
        )}

        <Disclosure summary="Why this recommendation?">
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

      {data.health.constrained && data.status !== 'published' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <strong>Sending is temporarily unavailable.</strong> Supported account evidence is currently limiting reply approval/sending.
          {' '}<a href="/legacy?source=health" className="underline">Review account status</a>.
        </div>
      )}

      {editor ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
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
                <ConfirmCheckboxes
                  factuality={confirmations.factualityConfirmed}
                  evidence={confirmations.evidenceConfirmed}
                  evidenceRequired={evidenceRequired}
                  onChange={setConfirmations}
                />
                <button
                  onClick={() => reviewAction.mutate(confirmations)}
                  disabled={reviewAction.isPending}
                  className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                >
                  {reviewAction.isPending ? 'Checking…' : editor.queueItem?.status === 'needs_review' ? 'Recheck readiness' : 'Check readiness'}
                </button>
                <div className="mt-1 text-xs text-slate-500">This checks whether the current draft is ready for human approval. It does not send anything.</div>
              </div>
            )}

            {canApproveSend && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <ConfirmCheckboxes
                  factuality={confirmations.factualityConfirmed}
                  evidence={confirmations.evidenceConfirmed}
                  evidenceRequired={evidenceRequired}
                  onChange={setConfirmations}
                />
                {approveSendPending ? (
                  <Pending label="Approving and sending the exact reply…" />
                ) : (
                  <button
                    onClick={() => approveSendAction.mutate(confirmations)}
                    disabled={!confirmations.factualityConfirmed || (evidenceRequired && !confirmations.evidenceConfirmed)}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve &amp; send exact reply
                  </button>
                )}
                <div className="mt-1 text-xs text-emerald-900">
                  This sends the exact text above as a reply on X after your approval. Nothing sends until you click.
                </div>
              </div>
            )}

            {canSendApproved && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                {sendPending ? (
                  <Pending label="Sending the approved reply…" />
                ) : (
                  <button
                    onClick={() => sendAction.mutate({})}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Send approved reply
                  </button>
                )}
                <div className="mt-1 text-xs text-emerald-900">You already approved this exact text. This action sends it on X.</div>
              </div>
            )}

            {approveSendAction.isSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Reply sent. The conversation status now reflects the authoritative result.
              </div>
            )}
            {sendAction.isSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Reply sent. The conversation status now reflects the authoritative result.
              </div>
            )}
          </div>
        </section>
      ) : draftAction.isPending ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <Pending label="Generating a reply draft with AI…" />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="text-sm text-slate-600">No reply draft yet. Generate one with AI, then review the exact text before approving.</div>
          <button
            onClick={() => draftAction.mutate({})}
            className="mt-3 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Generate reply with AI
          </button>
        </div>
      )}

      {editor && data.status !== 'published' && (
        <Disclosure summary="More actions">
          <div className="flex flex-wrap items-end gap-2">
            {data.engagementKind === 'initial_reply' && (
              <button
                onClick={() => quoteAction.mutate({}, { onSuccess: (result) => {
                  const draftId = (result as { draftId?: number | null }).draftId
                  if (draftId) navigate(`/draft/${draftId}`)
                } })}
                disabled={quoteAction.isPending}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Make a quote post instead
              </button>
            )}
            <button
              onClick={() => resolveAction.mutate({ action: 'ignore' }, { onSuccess: () => navigate('/conversations') })}
              disabled={resolveAction.isPending}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Skip conversation
            </button>
            <button
              onClick={() => resolveAction.mutate({ action: 'expire' }, { onSuccess: () => navigate('/conversations') })}
              disabled={resolveAction.isPending}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              No longer useful
            </button>
          </div>
        </Disclosure>
      )}

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
      )}
    </div>
  )
}
