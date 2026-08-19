import { useState } from 'react'
import { useCreate, useQueueAction, type CreateSection, type QueueItemView, type SchedulePlan } from '../../api/client'
import {
  Badge,
  ConfirmCheckboxes,
  Disclosure,
  Error,
  GatePanel,
  Loading,
  Pending,
  StatCard,
  formatDateTime,
  fromDatetimeLocal,
  toDatetimeLocal,
} from '../../components/primitives'

const ROUTE_OPTIONS = [
  ['original', 'Original post'],
  ['quote', 'Quote post'],
  ['thread', 'Thread'],
  ['reply', 'Reply'],
  ['repost', 'Repost'],
  ['research', 'Research further'],
  ['watch', 'Pause'],
  ['ignore', 'Skip source'],
] as const

function RouteForm({ item }: { item: QueueItemView }) {
  const route = useQueueAction('route')
  const [pipeline, setPipeline] = useState(item.pipeline !== 'triage' ? item.pipeline : item.recommendedPipeline || 'original')
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        route.mutate({ key: item.candidateKey, pipeline })
      }}
    >
      <span className="text-sm font-semibold text-slate-700">Next step</span>
      <select
        value={pipeline}
        onChange={(event) => setPipeline(event.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        {ROUTE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button
        type="submit"
        disabled={route.isPending}
        className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {route.isPending ? 'Applying…' : 'Apply'}
      </button>
      {route.isError && route.variables?.key === item.candidateKey && (
        <span className="text-xs text-red-600">{route.error.message}</span>
      )}
    </form>
  )
}

function SchedulePanel({ item, schedule }: { item: QueueItemView; schedule: SchedulePlan | null }) {
  const scheduleAction = useQueueAction('schedule')
  const [urgency, setUrgency] = useState((schedule?.scheduleUrgency as string) || item.scheduleUrgency || 'evergreen')
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocal(schedule?.scheduledAt ?? item.scheduledAt))
  const [expiresAt, setExpiresAt] = useState(toDatetimeLocal(schedule?.expiresAt ?? item.expiresAt))

  if (!schedule) return null

  const recommended = schedule.recommendedAt == null
    ? (schedule.manualOnly ? 'Not ready to repost yet' : 'Not ready to publish yet')
    : schedule.recommendedAt <= Date.now()
      ? (schedule.manualOnly ? 'Repost when you are ready' : 'Publish when you are ready')
      : `Around ${new Date(schedule.recommendedAt).toLocaleString()}`

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong className="text-sm text-slate-900">{schedule.manualOnly ? 'Manual repost plan' : 'Publishing plan'}</strong>
          <div className="text-xs text-slate-600">{recommended}</div>
        </div>
        <Badge tone={schedule.eligible ? 'success' : 'warning'}>{schedule.eligible ? (schedule.manualOnly ? 'Ready to repost' : 'Ready') : 'Not ready'}</Badge>
      </div>
      {schedule.manualOnly && (
        <div className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">The app does not repost automatically. Repost it on X, then record completion here so this item leaves your active workflow.</div>
      )}
      <form
        className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault()
          scheduleAction.mutate({
            key: item.candidateKey,
            scheduleUrgency: urgency,
            scheduledAt: scheduledAt ? fromDatetimeLocal(scheduledAt) : null,
            expiresAt: expiresAt ? fromDatetimeLocal(expiresAt) : null,
          })
        }}
      >
        <label className="text-sm text-slate-600">
          How urgent is this?
          <select value={urgency} onChange={(event) => setUrgency(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="evergreen">Can wait</option>
            <option value="timely">Timely</option>
            <option value="viral">Time-sensitive</option>
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Useful until
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm text-slate-600">
          Choose a different time
          <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={scheduleAction.isPending}
            className="w-full rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
          >
            {scheduleAction.isPending ? 'Saving…' : 'Save plan'}
          </button>
        </div>
        <div className="col-span-full text-xs text-slate-500">
          {item.scheduleSource === 'human'
            ? 'You chose the publishing time. Clear it to return to the recommendation.'
            : 'The recommended time is advisory and does not approve or publish the post.'}
        </div>
      </form>
      {scheduleAction.isError && (
        <div className="mt-2 text-xs text-red-600">{scheduleAction.error.message}</div>
      )}
      <Disclosure summary="Why this time?">
        <div className="text-sm text-slate-700">{schedule.reason}</div>
      </Disclosure>
    </div>
  )
}

function QueueCard({ item, automation }: { item: QueueItemView; automation: boolean }) {
  const review = useQueueAction('review')
  const approve = useQueueAction('approve')
  const completeRepost = useQueueAction('complete-repost')
  const discard = useQueueAction('discard')
  const [confirmations, setConfirmations] = useState({ factualityConfirmed: false, evidenceConfirmed: false })

  const mainFeedReview = item.status === 'needs_review' && ['original', 'quote', 'thread', 'repost'].includes(item.pipeline)
  const canApprove = mainFeedReview && (item.pipeline === 'repost' || (item.draft != null && item.draft.qualityScore >= 40 && item.draft.gates?.passed === true))
  const canRequestReview = ['original', 'quote', 'thread', 'reply'].includes(item.pipeline) && ['drafting', 'needs_review'].includes(item.status)
  const choosingType = ['triage', 'researching', 'watching'].includes(item.status)
  const approvalBlockers = item.draft
    ? [
        ...(item.draft.gatesView?.writingFailures || []).map((failure) => failure.message),
        ...(item.draft.gatesView?.humanConfirmations || []).map((confirmation) => confirmation.message),
      ]
    : []
  const evidenceRequired = Boolean(item.draft?.liveAnalysis?.gatesView.humanConfirmations.some((confirmation) => confirmation.code === 'EVIDENCE_UNCONFIRMED'))

  const publicationState = item.publishStartedAt || item.publishedAt || item.publishError ? (
    <div className="mt-2 text-sm text-slate-700">
      <strong>{item.status === 'published' ? 'Completed:' : 'Publishing:'}</strong>{' '}
      {item.status === 'published' && item.pipeline === 'repost'
        ? `repost recorded ${formatDateTime(item.publishedAt)}`
        : <>
            {item.publishStartedAt ? `started ${formatDateTime(item.publishStartedAt)}` : 'not started'}
            {item.publishedAt ? ` · published ${formatDateTime(item.publishedAt)}` : ''}
          </>}
      {item.publishError ? ` · ${item.publishError}` : ''}
      {item.outputUrl ? <> · <a href={item.outputUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">view on X ↗</a></> : ''}
    </div>
  ) : null

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900">{item.title}</div>
          <div className="text-xs text-slate-500">
            {item.source.toUpperCase()} · {item.pipelineLabel} · {item.statusLabel}
            {item.humanApprovedAt ? ` · approved ${formatDateTime(item.humanApprovedAt)}` : ''}
          </div>
        </div>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Source ↗
          </a>
        )}
      </div>

      <p className="mt-3 break-words text-sm text-slate-700">{item.text}</p>

      {item.status !== 'published' && item.recommendedPipeline && (
        <div className="mt-2 text-sm text-slate-700">
          <strong>Suggested next step:</strong> {item.recommendedPipelineLabel} <span className="text-slate-500">— {item.routingReason}</span>
        </div>
      )}
      {publicationState}

      {item.draft && (
        <div className="mt-3">
          {item.status !== 'published' && <GatePanel gates={item.draft.gatesView} />}
          <div className="mt-1 text-xs text-slate-500">
            {item.status === 'published' ? 'Recorded draft quality' : 'Draft quality'} {item.draft.qualityScore}/50
            {item.status !== 'published' ? ' · approval threshold 40' : ''}
          </div>
        </div>
      )}

      {item.schedule && <SchedulePanel item={item} schedule={item.schedule} />}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {choosingType && <RouteForm item={item} />}
        {item.draftId && !choosingType && (
          <a href={`#/draft/${item.draftId}`} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
            {item.status === 'published' ? 'View published text' : item.status === 'drafting' ? 'Continue draft' : 'Review draft'}
          </a>
        )}
        {item.draftId && !['publishing', 'published'].includes(item.status) && (
          <button
            onClick={() => {
              if (window.confirm('Discard this draft? The source and its history will remain available.')) discard.mutate({ key: item.candidateKey })
            }}
            disabled={discard.isPending}
            className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {discard.isPending ? 'Discarding…' : 'Discard draft'}
          </button>
        )}
        {canApprove && item.pipeline !== 'repost' && (
          <div className="w-full">
            <ConfirmCheckboxes
              factuality={confirmations.factualityConfirmed}
              evidence={confirmations.evidenceConfirmed}
              evidenceRequired={evidenceRequired}
              onChange={setConfirmations}
            />
            {approve.isPending && approve.variables?.key === item.candidateKey ? (
              <Pending label="Approving…" />
            ) : (
              <button
                onClick={() => approve.mutate({ key: item.candidateKey, ...confirmations })}
                disabled={!confirmations.factualityConfirmed || (evidenceRequired && !confirmations.evidenceConfirmed)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve for publishing
              </button>
            )}
            <div className="mt-1 text-xs text-slate-500">Approval is not publication. {automation ? 'Automation may publish it at the planned time.' : 'Automation is off; publishing happens only when enabled and scheduled.'}</div>
          </div>
        )}
        {canApprove && item.pipeline === 'repost' && (
          <button
            onClick={() => approve.mutate({ key: item.candidateKey })}
            disabled={approve.isPending}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Approve repost
          </button>
        )}
        {item.pipeline === 'repost' && item.status === 'approved' && (
          <div>
            <button
              onClick={() => {
                if (window.confirm('Have you already reposted this source on X? This records that manual action as completed.')) {
                  completeRepost.mutate({ key: item.candidateKey, confirmCompleted: true })
                }
              }}
              disabled={completeRepost.isPending}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {completeRepost.isPending ? 'Recording…' : 'Mark reposted'}
            </button>
            <div className="mt-1 text-xs text-slate-500">Use this only after you actually reposted it on X. The app records your confirmation; it does not perform the repost.</div>
          </div>
        )}
      </div>

      {canRequestReview && (
        <Disclosure summary="Approval readiness">
          <ConfirmCheckboxes
            factuality={confirmations.factualityConfirmed}
            evidence={confirmations.evidenceConfirmed}
            evidenceRequired={evidenceRequired}
            onChange={setConfirmations}
          />
          <button
            onClick={() => review.mutate({ key: item.candidateKey, ...confirmations })}
            disabled={review.isPending}
            className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
          >
            {review.isPending ? 'Checking…' : item.status === 'needs_review' ? 'Recheck readiness' : 'Check readiness'}
          </button>
          <div className="mt-1 text-xs text-slate-500">This checks whether the current draft is ready for human approval. It does not publish anything.</div>
        </Disclosure>
      )}

      {mainFeedReview && !canApprove && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>Not ready for approval.</strong>{' '}
          {item.draft
            ? approvalBlockers.length
              ? approvalBlockers.slice(0, 2).join(' ')
              : 'Open the draft to fix the checks or complete the required confirmations.'
            : 'Create a draft first.'}
        </div>
      )}

      {(review.isError && review.variables?.key === item.candidateKey) || (approve.isError && approve.variables?.key === item.candidateKey) || (completeRepost.isError && completeRepost.variables?.key === item.candidateKey) || (discard.isError && discard.variables?.key === item.candidateKey) ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {(review.isError && review.variables?.key === item.candidateKey ? review.error.message : '')}
          {(approve.isError && approve.variables?.key === item.candidateKey ? approve.error.message : '')}
          {(completeRepost.isError && completeRepost.variables?.key === item.candidateKey ? completeRepost.error.message : '')}
          {(discard.isError && discard.variables?.key === item.candidateKey ? discard.error.message : '')}
        </div>
      ) : null}

      <Disclosure summary="Why this recommendation?">
        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <strong>Suggested next step:</strong>{' '}
            {item.recommendedPipelineLabel || item.pipelineLabel}
            {item.routingReason ? ` — ${item.routingReason}` : ''}
          </div>
          {mainFeedReview && !canApprove && approvalBlockers.length > 0 && (
            <div><strong>Why approval is blocked:</strong> {approvalBlockers.join(' ')}</div>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge>Reach {item.potentials.reach}</Badge>
            <Badge>Follow {item.potentials.follow}</Badge>
            <Badge>Conversation {item.potentials.conversation}</Badge>
            <Badge>Relationship {item.potentials.relationship}</Badge>
          </div>
          <div className="text-xs text-slate-500">These scores help rank attention; they do not override the writing checks or your approval decision.</div>
        </div>
      </Disclosure>
    </article>
  )
}

export function Create() {
  const { data, isLoading, error, refetch } = useCreate()

  if (isLoading) {
    return <Loading message="Loading your create workspace..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data || data.sections.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Posts</h2>
          <p className="mt-1 text-sm text-slate-600">Move a source through drafting, review, approval, and publishing.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No active post work. Start in Discover and choose what a source should become.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Posts</h2>
          <p className="mt-1 text-sm text-slate-600">Move a source through drafting, review, approval, and publishing.</p>
        </div>
        <Badge tone={data.automation ? 'danger' : 'neutral'}>Auto-publishing {data.automation ? 'on' : 'off'}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sources to decide" value={data.counts.ideas} />
        <StatCard label="Drafts in progress" value={data.counts.drafting} />
        <StatCard label="Needs review" value={data.counts.review} />
        <StatCard label="Approved" value={data.counts.approvedWaiting} />
      </div>

      {data.sections.map((section: CreateSection) => (
        <section key={section.id}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
              <p className="text-sm text-slate-600">{section.note}</p>
            </div>
            <Badge>{section.items.length}</Badge>
          </div>
          <div className="space-y-3">
            {section.items.map((item) => (
              <QueueCard key={item.id} item={item} automation={data.automation} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
