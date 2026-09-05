import { useDraftEditor, useQueueAction } from '../../api/client'
import {
  Badge,
  Disclosure,
  Error,
  Loading,
  Notice,
  Pending,
  formatDateTime,
} from '../../components/primitives'
import { DraftEditor } from './DraftEditor'
import { GrowthFitPanel } from './GrowthFitPanel'

export function DraftPage({ draftId }: { draftId: number }) {
  const { data, isLoading, error, refetch } = useDraftEditor(Number.isFinite(draftId) ? draftId : null)
  const review = useQueueAction('review')
  const approve = useQueueAction('approve')

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
  const actionError = (review.isError && review.error.message) || (approve.isError && approve.error.message) || null

  return (
    <div className="space-y-6">
      <div>
        <a href={isReply ? (queueItem ? `#/conversations/${encodeURIComponent(queueItem.candidateKey)}` : '#/conversations') : '#/create'} className="text-sm font-medium text-slate-500 hover:text-slate-700">
          ← {isReply ? 'Back to conversations' : 'Back to Posts'}
        </a>
      </div>

      <div className="operator-surface p-5 sm:p-6" data-tone="ai">
        <GrowthFitPanel
          growthFit={data.growthFit}
          queueItemId={queueItem?.id ?? null}
          readOnly={flags.readOnly || Boolean(queueItem?.humanApprovedAt)}
        />
        <div className="mt-5"><DraftEditor data={data} /></div>

        <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
          {flags.canApproveReply && (
            <Notice tone="success" title="Ready for exact-reply approval">
              Use the conversation view to freeze this text for the browser-agent execution lane.
              {queueItem && (
                <a href={`#/conversations/${encodeURIComponent(queueItem.candidateKey)}`} className="mt-2 inline-block text-sm font-semibold text-indigo-700 underline">Go to conversation →</a>
              )}
            </Notice>
          )}

          {flags.approvedReplyReadyForBrowser && (
            <Notice tone="success" title="Approved — not sent yet">
              The exact text is frozen for the persistent Growth Operator; browser execution will claim it only when the live target is ready.
              {queueItem && (
                <a href={`#/conversations/${encodeURIComponent(queueItem.candidateKey)}`} className="mt-2 inline-block text-sm font-semibold text-indigo-700 underline">Go to conversation →</a>
              )}
            </Notice>
          )}

          {flags.canReview && (
            <div>
              <button
                onClick={() => review.mutate({ key: data.candidate.key })}
                disabled={review.isPending}
                className="action-button" data-variant="secondary"
              >
                {review.isPending ? 'Checking…' : queueItem?.status === 'needs_review' ? 'Recheck readiness' : 'Check readiness'}
              </button>
              <div className="mt-1 text-xs text-slate-500">This checks whether the current draft is ready for human approval. It does not publish anything.</div>
            </div>
          )}

          {flags.canApprove && (
            <div className="operator-surface p-4" data-tone="success">
              {approve.isPending ? (
                <Pending label="Approving…" />
              ) : (
                <button
                  onClick={() => approve.mutate({ key: data.candidate.key })}
                  className="action-button" data-variant="success"
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
            <Notice tone="success" title="Approved — not published yet">
              {schedule ? (
                <>
                  {' '}Recommended publishing time:{' '}
                  {schedule.recommendedAt == null ? 'not ready yet' : formatDateTime(schedule.recommendedAt)}.
                </>
              ) : null}
              {' '}The publishing plan lives in <a href="#/create" className="underline">Posts</a>.
            </Notice>
          )}

          {queueItem?.publishedAt && (
            <Notice tone="neutral" title="Published">
              {formatDateTime(queueItem.publishedAt)}
              {queueItem.outputUrl && <> · <a href={queueItem.outputUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">view post ↗</a></>}
            </Notice>
          )}

          {queueItem?.publishError && (
            <Notice tone="danger" title="A publishing attempt failed">{queueItem.publishError} The item remains inspectable for a human decision.</Notice>
          )}
        </div>

        {schedule && flags.approvedMainFeed && (
          <Disclosure summary="Publishing plan details">
            <div className="text-sm text-slate-700">
              Recommended: {schedule.recommendedAt == null ? 'not ready yet' : formatDateTime(schedule.recommendedAt)}
              {schedule.manualOnly ? ' · repost via browser-agent or manual action' : ''}
              {schedule.scheduleSource === 'human' ? ' · you chose this time' : ''}
            </div>
            <div className="mt-1 text-xs text-slate-500">{schedule.reason}</div>
            <div className="mt-2"><Badge tone={schedule.eligible ? 'success' : 'warning'}>{schedule.eligible ? 'Ready' : 'Not ready'}</Badge></div>
          </Disclosure>
        )}
      </div>

      {actionError && (
        <Notice tone="danger" title="Action failed">{actionError}</Notice>
      )}
    </div>
  )
}
