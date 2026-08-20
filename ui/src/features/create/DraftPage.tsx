import { useState } from 'react'
import { useDraftEditor, useQueueAction } from '../../api/client'
import {
  Badge,
  ConfirmCheckboxes,
  Disclosure,
  Error,
  Loading,
  Pending,
  formatDateTime,
} from '../../components/primitives'
import { DraftEditor } from './DraftEditor'
import { GrowthFitPanel } from './GrowthFitPanel'

export function DraftPage({ draftId }: { draftId: number }) {
  const { data, isLoading, error, refetch } = useDraftEditor(Number.isFinite(draftId) ? draftId : null)
  const review = useQueueAction('review')
  const approve = useQueueAction('approve')
  const [confirmations, setConfirmations] = useState({ factualityConfirmed: false, evidenceConfirmed: false })

  if (isLoading) {
    return <Loading message="Loading draft..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data) {
    return <Error message="That draft is no longer available." />
  }

  const { flags, schedule, queueItem } = data
  const isReply = flags.engagementReply
  const evidenceRequired = Boolean(data.analysis.gatesView.humanConfirmations.some((confirmation) => confirmation.code === 'EVIDENCE_UNCONFIRMED'))
  const actionError = (review.isError && review.error.message) || (approve.isError && approve.error.message) || null

  return (
    <div className="space-y-6">
      <div>
        <a href={isReply ? (queueItem ? `#/conversations/${encodeURIComponent(queueItem.candidateKey)}` : '#/conversations') : '#/create'} className="text-sm font-medium text-slate-500 hover:text-slate-700">
          ← {isReply ? 'Back to conversations' : 'Back to Posts'}
        </a>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <GrowthFitPanel
          growthFit={data.growthFit}
          queueItemId={queueItem?.id ?? null}
          readOnly={flags.readOnly || Boolean(queueItem?.humanApprovedAt)}
        />
        <div className="mt-5"><DraftEditor data={data} /></div>

        <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
          {flags.canApproveSend && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm text-emerald-900">
                <strong>Ready to approve and send.</strong> Use the send control in the conversation view to send this exact reply on X.
              </div>
              {queueItem && (
                <a href={`#/conversations/${encodeURIComponent(queueItem.candidateKey)}`} className="mt-2 inline-block text-sm font-medium text-emerald-800 underline">
                  Go to conversation →
                </a>
              )}
            </div>
          )}

          {flags.canSendApproved && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm text-emerald-900">
                <strong>Approved — not sent yet.</strong> Use the send control in the conversation view to send this exact reply on X.
              </div>
              {queueItem && (
                <a href={`#/conversations/${encodeURIComponent(queueItem.candidateKey)}`} className="mt-2 inline-block text-sm font-medium text-emerald-800 underline">
                  Go to conversation →
                </a>
              )}
            </div>
          )}

          {flags.canReview && (
            <div>
              <ConfirmCheckboxes
                factuality={confirmations.factualityConfirmed}
                evidence={confirmations.evidenceConfirmed}
                evidenceRequired={evidenceRequired}
                onChange={setConfirmations}
              />
              <button
                onClick={() => review.mutate({ key: data.candidate.key, ...confirmations })}
                disabled={review.isPending}
                className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
              >
                {review.isPending ? 'Checking…' : queueItem?.status === 'needs_review' ? 'Recheck readiness' : 'Check readiness'}
              </button>
              <div className="mt-1 text-xs text-slate-500">This checks whether the current draft is ready for human approval. It does not publish anything.</div>
            </div>
          )}

          {flags.canApprove && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <ConfirmCheckboxes
                factuality={confirmations.factualityConfirmed}
                evidence={confirmations.evidenceConfirmed}
                evidenceRequired={evidenceRequired}
                onChange={setConfirmations}
              />
              {approve.isPending ? (
                <Pending label="Approving…" />
              ) : (
                <button
                  onClick={() => approve.mutate({ key: data.candidate.key, ...confirmations })}
                  disabled={!confirmations.factualityConfirmed || (evidenceRequired && !confirmations.evidenceConfirmed)}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Approve for publishing
                </button>
              )}
              <div className="mt-1 text-xs text-slate-600">
                Approval is not publication. {data.schedule?.automation ? 'Automation may publish it at the planned time.' : 'Automation is off; nothing is auto-published.'}
              </div>
            </div>
          )}

          {flags.approvedMainFeed && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <strong>Approved — not published yet.</strong>
              {schedule ? (
                <>
                  {' '}Recommended publishing time:{' '}
                  {schedule.recommendedAt == null ? 'not ready yet' : formatDateTime(schedule.recommendedAt)}.
                </>
              ) : null}
              {' '}The publishing plan lives in <a href="#/create" className="underline">Posts</a>.
            </div>
          )}

          {queueItem?.publishedAt && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
              <strong>Published.</strong> {formatDateTime(queueItem.publishedAt)}
              {queueItem.outputUrl && <> · <a href={queueItem.outputUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">view post ↗</a></>}
            </div>
          )}

          {queueItem?.publishError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <strong>A publishing attempt failed.</strong> {queueItem.publishError}
              {' '}The item remains inspectable for a human decision.
            </div>
          )}
        </div>

        {schedule && flags.approvedMainFeed && (
          <Disclosure summary="Publishing plan details">
            <div className="text-sm text-slate-700">
              Recommended: {schedule.recommendedAt == null ? 'not ready yet' : formatDateTime(schedule.recommendedAt)}
              {schedule.manualOnly ? ' · reposts remain manual' : ''}
              {schedule.scheduleSource === 'human' ? ' · you chose this time' : ''}
            </div>
            <div className="mt-1 text-xs text-slate-500">{schedule.reason}</div>
            <div className="mt-2"><Badge tone={schedule.eligible ? 'success' : 'warning'}>{schedule.eligible ? 'Ready' : 'Not ready'}</Badge></div>
          </Disclosure>
        )}
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
      )}
    </div>
  )
}
