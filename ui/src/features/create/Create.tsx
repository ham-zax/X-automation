import { useState } from 'react'
import { useCreate, useQueueAction, type QueueItemView, type SchedulePlan } from '../../api/client'
import {
  Badge,
  Disclosure,
  Error,
  GatePanel,
  Loading,
  Notice,
  Pending,
  formatDateTime,
  fromDatetimeLocal,
  toDatetimeLocal,
} from '../../components/primitives'
import { GrowthFitPanel } from './GrowthFitPanel'
import { PageHeader, SegmentedTabs } from '../../components/workspace'
import { buildPostViews } from './createView'

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
        className="action-button" data-variant="primary"
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
      ? (schedule.manualOnly ? 'Ready for repost execution' : 'Publish when you are ready')
      : `Around ${new Date(schedule.recommendedAt).toLocaleString()}`

  return (
    <div className="operator-surface mt-3 p-4" data-tone={schedule.eligible ? 'success' : 'warning'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong className="text-sm text-slate-900">{schedule.manualOnly ? 'Repost plan' : 'Publishing plan'}</strong>
          <div className="text-xs text-slate-600">{recommended}</div>
        </div>
        <Badge tone={schedule.eligible ? 'success' : 'warning'}>{schedule.eligible ? (schedule.manualOnly ? 'Ready to repost' : 'Ready') : 'Not ready'}</Badge>
      </div>
      {schedule.manualOnly && (
        <div className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">The web app does not click Repost itself. A running Growth Operator can atomically claim this approved source and execute the native Repost through the browser-agent lane, or you can repost manually and record completion here.</div>
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
            className="action-button w-full" data-variant="secondary"
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
      <Disclosure summary="Publishing time & constraints" defaultOpen>
        <div className="text-sm text-slate-700">{schedule.reason}</div>
      </Disclosure>
    </div>
  )
}

function QueueCard({ item, compact = false }: { item: QueueItemView; compact?: boolean }) {
  const review = useQueueAction('review')
  const approve = useQueueAction('approve')
  const completeRepost = useQueueAction('complete-repost')
  const discard = useQueueAction('discard')

  const mainFeedReview = item.status === 'needs_review' && ['original', 'quote', 'thread', 'repost'].includes(item.pipeline)
  const canApprove = mainFeedReview && (item.pipeline === 'repost'
    ? item.growthFit.allowed
    : (item.draft != null && item.draft.qualityScore >= 40 && item.draft.gates?.passed === true && item.draft.growthPackaging?.ready === true))
  const canRequestReview = ['original', 'quote', 'thread', 'reply'].includes(item.pipeline) && ['drafting', 'needs_review'].includes(item.status)
  const choosingType = ['triage', 'researching', 'watching'].includes(item.status)
  const approvalBlockers = item.draft
    ? [
        ...(item.draft.gatesView?.approvalFailures || []).map((failure) => failure.message),
        ...(item.draft.growthPackaging?.blockers || []).map((blocker) => blocker.message),
      ]
    : []

  const cardTone = item.status === 'failed' || item.publishError
    ? 'danger'
    : item.status === 'needs_review'
      ? 'warning'
      : ['approved', 'published'].includes(item.status)
        ? 'success'
        : item.status === 'drafting'
          ? 'ai'
          : ['triage', 'researching'].includes(item.status)
            ? 'info'
            : 'neutral'

  if (compact) {
    return (
      <article className="operator-surface px-4 py-3" data-tone={cardTone}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-sm font-semibold text-slate-900">{item.title}</h4>
              <Badge tone={item.status === 'published' ? 'success' : 'neutral'}>{item.pipelineLabel}</Badge>
            </div>
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-slate-500">{item.text}</p>
            <div className="mt-1 text-xs text-slate-400">
              {item.statusLabel}{item.publishedAt ? ` · ${formatDateTime(item.publishedAt)}` : ''}
              {item.draft ? ` · quality ${item.draft.qualityScore}/50` : ''}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {item.outputUrl && <a href={item.outputUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-indigo-700 hover:underline">X ↗</a>}
            {item.draftId && <a href={`#/draft/${item.draftId}`} className="text-xs font-semibold text-indigo-700 hover:underline">Open →</a>}
          </div>
        </div>
      </article>
    )
  }

  const publicationState = item.publishStartedAt || item.publishedAt || item.publishError ? (
    <div className="mt-2 text-xs text-slate-500">
      {item.publishError
        ? <span className="font-semibold text-red-700">Publication failed</span>
        : item.status === 'published' && item.pipeline === 'repost'
          ? `Repost recorded ${formatDateTime(item.publishedAt)}`
          : <>
              {item.publishStartedAt ? `Started ${formatDateTime(item.publishStartedAt)}` : 'Not started'}
              {item.publishedAt ? ` · published ${formatDateTime(item.publishedAt)}` : ''}
            </>}
      {item.outputUrl ? <> · <a href={item.outputUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 hover:underline">view on X ↗</a></> : ''}
    </div>
  ) : null

  return (
    <article className="operator-surface p-4 sm:p-5" data-tone={cardTone}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold text-slate-900 sm:text-lg">{item.title}</div>
            <Badge tone={cardTone === 'danger' ? 'danger' : cardTone === 'warning' ? 'warning' : cardTone === 'success' ? 'success' : cardTone === 'ai' ? 'ai' : 'neutral'}>{item.statusLabel}</Badge>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {item.source.toUpperCase()} · {item.pipelineLabel}
            {item.humanApprovedAt ? ` · approved ${formatDateTime(item.humanApprovedAt)}` : ''}
          </div>
        </div>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-indigo-700 hover:underline">
            Source ↗
          </a>
        )}
      </div>

      <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7 text-slate-600">{item.text}</p>

      {choosingType && item.recommendedPipeline && (
        <div className="mt-2 text-xs text-slate-500"><strong className="text-slate-700">Suggested:</strong> {item.recommendedPipelineLabel}</div>
      )}
      {publicationState}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {choosingType && <RouteForm item={item} />}
        {item.draftId && !choosingType && (
          <a href={`#/draft/${item.draftId}`} className="action-button" data-variant="primary">
            {item.status === 'published' ? 'View text' : item.status === 'drafting' ? 'Continue draft' : 'Review draft'}
          </a>
        )}
        {canApprove && item.pipeline !== 'repost' && (
          approve.isPending && approve.variables?.key === item.candidateKey ? (
            <Pending label="Approving…" />
          ) : (
            <button onClick={() => approve.mutate({ key: item.candidateKey })} className="action-button" data-variant="success">
              Approve for publishing
            </button>
          )
        )}
        {canApprove && item.pipeline === 'repost' && (
          <button onClick={() => approve.mutate({ key: item.candidateKey })} disabled={approve.isPending} className="action-button" data-variant="success">Approve repost</button>
        )}
        {item.pipeline === 'repost' && item.status === 'approved' && (
          <button
            onClick={() => {
              if (window.confirm('Have you already reposted this source on X? This records that manual action as completed.')) {
                completeRepost.mutate({ key: item.candidateKey, confirmCompleted: true })
              }
            }}
            disabled={completeRepost.isPending}
            className="action-button"
            data-variant="success"
          >
            {completeRepost.isPending ? 'Recording…' : 'Mark reposted'}
          </button>
        )}
        {item.draftId && !['publishing', 'published'].includes(item.status) && (
          <button
            onClick={() => {
              if (window.confirm('Discard this draft? The source and its history will remain available.')) discard.mutate({ key: item.candidateKey })
            }}
            disabled={discard.isPending}
            className="action-button"
            data-variant="ghost"
          >
            Discard
          </button>
        )}
      </div>

      {mainFeedReview && !canApprove && (
        <div className="mt-3"><Notice tone="warning" title="Not ready for approval">
          {item.draft
            ? approvalBlockers.length
              ? approvalBlockers.join(' ')
              : 'Open the draft to fix the checks or complete the required confirmations.'
            : 'Create a draft first.'}
        </Notice></div>
      )}

      {(review.isError && review.variables?.key === item.candidateKey) || (approve.isError && approve.variables?.key === item.candidateKey) || (completeRepost.isError && completeRepost.variables?.key === item.candidateKey) || (discard.isError && discard.variables?.key === item.candidateKey) ? (
        <div className="mt-3"><Notice tone="danger" title="Action failed">
          {(review.isError && review.variables?.key === item.candidateKey ? review.error.message : '')}
          {(approve.isError && approve.variables?.key === item.candidateKey ? approve.error.message : '')}
          {(completeRepost.isError && completeRepost.variables?.key === item.candidateKey ? completeRepost.error.message : '')}
          {(discard.isError && discard.variables?.key === item.candidateKey ? discard.error.message : '')}
        </Notice></div>
      ) : null}

      <Disclosure summary="Review context & evidence" defaultOpen>
        <div className="space-y-3">
          <GrowthFitPanel
            growthFit={item.growthFit}
            queueItemId={item.id}
            candidateKey={item.candidateKey}
            readOnly={Boolean(item.humanApprovedAt) || ['publishing', 'published'].includes(item.status)}
          />

          {item.draft && (
            <div>
              {item.status !== 'published' && <GatePanel gates={item.draft.gatesView} />}
              <div className="mt-1 text-xs text-slate-500">
                Writing quality {item.draft.qualityScore}/50{item.status !== 'published' ? ' · approval threshold 40' : ''}
              </div>
            </div>
          )}

          {item.schedule && <SchedulePanel item={item} schedule={item.schedule} />}

          {item.publishError && <Notice tone="danger" title="Publication failure">{item.publishError}</Notice>}

          {canRequestReview && (
            <div>
              <button onClick={() => review.mutate({ key: item.candidateKey })} disabled={review.isPending} className="action-button" data-variant="secondary">
                {review.isPending ? 'Checking…' : item.status === 'needs_review' ? 'Recheck readiness' : 'Check readiness'}
              </button>
              <div className="mt-1 text-xs text-slate-500">Readiness check only; this does not publish.</div>
            </div>
          )}

          <div className="text-sm text-slate-700">
            <strong>Why this route:</strong> {item.recommendedPipelineLabel || item.pipelineLabel}{item.routingReason ? ` — ${item.routingReason}` : ''}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Reach {item.potentials.reach}</Badge>
            <Badge>Follow {item.potentials.follow}</Badge>
            <Badge>Conversation {item.potentials.conversation}</Badge>
            <Badge>Relationship {item.potentials.relationship}</Badge>
          </div>
          <div className="text-xs text-slate-500">These scores rank attention; they do not override writing checks or approval.</div>
        </div>
      </Disclosure>
    </article>
  )
}

export function Create() {
  const { data, isLoading, error, refetch } = useCreate()
  const [activeView, setActiveView] = useState<string | null>(null)

  if (isLoading) {
    return <Loading message="Loading your create workspace..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data || data.sections.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Publishing lifecycle"
          title="Posts"
          note="Draft → review → approve → publish."
        />
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No active post work. Start in Discover and choose what a source should become.
        </div>
      </div>
    )
  }

  const views = buildPostViews(data.sections)
  const initialView = views.find((view) => view.id === 'attention' && view.count > 0)
    || views.find((view) => view.id !== 'published' && view.count > 0)
    || views.find((view) => view.id === 'published')
    || views[0]
  const selectedView = views.find((view) => view.id === activeView) || initialView
  const visibleSections = selectedView.sections.filter((section) => section.items.length > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publishing lifecycle"
        title="Posts"
        note="Draft → review → approve → publish."
        right={<Badge tone={data.automation ? 'info' : 'neutral'}>Background auto-post {data.automation ? 'requested' : 'off'}</Badge>}
      />

      <p className="text-sm text-slate-500">Background publication needs both an approved item and a supported transport. A running agent can use its separately authorized browser lane.</p>

      <div className="lifecycle-tabs">
      <SegmentedTabs
        active={selectedView.id}
        onChange={setActiveView}
        ariaLabel="Post lifecycle"
        items={views.map((view) => ({ id: view.id, label: view.label, count: view.count, tone: view.tone }))}
      />
      </div>



      {visibleSections.length === 0 ? (
        <Notice tone="neutral" title="Nothing here">Nothing is in this lifecycle view right now.</Notice>
      ) : visibleSections.map((section) => (
        <section key={section.id}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
              <p className="mt-0.5 text-sm text-slate-600">{section.note}</p>
            </div>
            {selectedView.sections.length > 1 && <span className="text-xs tabular-nums text-slate-500">{section.items.length}</span>}
          </div>
          <div className="space-y-3">
            {section.items.map((item) => (
              <QueueCard key={item.id} item={item} compact={selectedView.id === 'published'} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
