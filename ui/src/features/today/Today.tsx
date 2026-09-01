import { useEffect, useState } from 'react'
import {
  useEditorialAddResearchSource,
  useEditorialDismiss,
  useEditorialPlan,
  useEditorialRefresh,
  useEditorialSelect,
  useGrowthFocus,
  useGrowthFocusObjective,
  useToday,
  type EditorialObjective,
  type EditorialRecommendationView,
  type EditorialSourceFreshness,
  type TodayAction,
} from '../../api/client'
import { Badge, Disclosure, Loading, Error, Empty, Pending, StatCard, formatDateTime } from '../../components/primitives'
import { navigate } from '../../router'

const OBJECTIVES: { value: EditorialObjective; label: string }[] = [
  { value: 'qualified_growth', label: 'Grow relevant followers' },
  { value: 'reach_momentum', label: 'Maximize reach' },
  { value: 'relationships', label: 'Build relationships' },
  { value: 'technical_authority', label: 'Build technical authority' },
  { value: 'balanced', label: 'Balanced' },
]

const SOURCE_LABELS: Record<string, string> = {
  x_latest: 'X latest',
  x_momentum: 'X momentum',
  github_trending: 'GitHub Trending',
  hn_top: 'HN Top Stories',
}

const PIPELINE_LABELS: Record<string, string> = {
  original: 'Original',
  quote: 'Quote',
  thread: 'Thread',
  reply: 'Reply',
  repost: 'Repost',
  research: 'Research',
}

function readable(value: unknown) {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try { return JSON.stringify(value) } catch { return String(value) }
}

function executionSummary(execution: Record<string, unknown>) {
  const values = [execution.runtime, execution.provider, execution.model, execution.reasoning]
    .map((value) => String(value || '').trim()).filter(Boolean)
  return values.length ? values.join(' · ') : 'Not recorded for this recommendation'
}

function SourceFreshness({ source }: { source: EditorialSourceFreshness }) {
  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${source.error ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
      <div className="font-semibold">{SOURCE_LABELS[source.kind] || source.kind}</div>
      <div className="mt-1">{source.fetchedAt ? `Snapshot ${formatDateTime(source.fetchedAt)}` : 'No snapshot yet'} · {source.candidateCount} items</div>
      {source.error && <div className="mt-1">Last refresh error: {source.error}</div>}
    </div>
  )
}

function ResearchSourceForm({ recommendationId }: { recommendationId: number }) {
  const addSource = useEditorialAddResearchSource()
  const [url, setUrl] = useState('')
  const [claim, setClaim] = useState('')

  return (
    <form
      className="mt-3 grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      onSubmit={(event) => {
        event.preventDefault()
        if (!url.trim() || !claim.trim()) return
        addSource.mutate({ recommendationId, url: url.trim(), claim: claim.trim() }, {
          onSuccess: () => { setUrl(''); setClaim('') },
        })
      }}
    >
      <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Source URL" className="rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm" />
      <input value={claim} onChange={(event) => setClaim(event.target.value)} placeholder="What context should this source add?" className="rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm" />
      <button type="submit" disabled={addSource.isPending || !url.trim() || !claim.trim()} className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 disabled:opacity-50">
        {addSource.isPending ? 'Adding…' : 'Add source'}
      </button>
      {addSource.isError && <div className="md:col-span-3 text-xs text-red-700">{addSource.error.message}</div>}
      {addSource.data && <div className="md:col-span-3 text-xs text-amber-900">Attached evidence #{addSource.data.evidence.id} · {addSource.data.evidence.status.replaceAll('_', ' ')}</div>}
    </form>
  )
}

function recommendationCta(recommendation: EditorialRecommendationView) {
  if (recommendation.decision === 'RESEARCH_MORE') return 'Open research'
  if (recommendation.decision === 'SKIP') return null
  if (recommendation.pipeline === 'reply') return 'Open conversation'
  if (recommendation.pipeline === 'repost') return 'Prepare repost'
  return 'Draft this'
}

function RecommendationCard({ recommendation }: { recommendation: EditorialRecommendationView }) {
  const select = useEditorialSelect()
  const dismiss = useEditorialDismiss()
  const cta = recommendationCta(recommendation)
  const active = recommendation.status === 'suggested'
  const potentials = recommendation.potentials
  const evidenceStatuses = Object.entries(recommendation.evidenceState.statuses)
    .map(([status, count]) => `${count} ${status.replaceAll('_', ' ')}`).join(' · ')

  const choose = () => select.mutate({ recommendationId: recommendation.id }, {
    onSuccess: (result) => {
      if (recommendation.decision === 'RESEARCH_MORE' || recommendation.pipeline === 'repost') {
        navigate('/create')
      } else if (recommendation.pipeline === 'reply') {
        navigate(`/conversations/${encodeURIComponent(result.candidateKey)}`)
      } else if (result.draftId) {
        navigate(`/draft/${result.draftId}`)
      } else {
        navigate('/create')
      }
    },
  })

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={recommendation.decision === 'PREPARE' ? 'success' : recommendation.decision === 'RESEARCH_MORE' ? 'warning' : 'neutral'}>
              {recommendation.decision === 'PREPARE' ? (PIPELINE_LABELS[recommendation.pipeline || ''] || recommendation.pipeline) : recommendation.decision.replace('_', ' ')}
            </Badge>
            <span className="text-xs text-slate-500">#{recommendation.rank}</span>
            {recommendation.selection && <Badge tone="info">Selected · {PIPELINE_LABELS[recommendation.selection.selectedPipeline] || recommendation.selection.selectedPipeline}</Badge>}
            {recommendation.status === 'dismissed' && <Badge>Dismissed</Badge>}
          </div>
          <h4 className="mt-2 text-lg font-semibold text-slate-900">{recommendation.title}</h4>
          <p className="mt-1 text-sm font-medium text-slate-800">{recommendation.thesis}</p>
          {recommendation.whyNow && <p className="mt-2 text-sm text-slate-600"><strong>Why now:</strong> {recommendation.whyNow}</p>}
          {recommendation.whyThisFormat && <p className="mt-1 text-sm text-slate-600"><strong>Why this format:</strong> {recommendation.whyThisFormat}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <div><span className="text-slate-500">Reach</span><div className="font-semibold text-slate-900">{Math.round(Number(potentials.reachPotential || 0))}</div></div>
        <div><span className="text-slate-500">Follow</span><div className="font-semibold text-slate-900">{Math.round(Number(potentials.followPotential || 0))}</div></div>
        <div><span className="text-slate-500">Conversation</span><div className="font-semibold text-slate-900">{Math.round(Number(potentials.conversationPotential || 0))}</div></div>
        <div><span className="text-slate-500">Relationship</span><div className="font-semibold text-slate-900">{Math.round(Number(potentials.relationshipPotential || 0))}</div></div>
        <div><span className="text-slate-500">Authority</span><div className="font-semibold text-slate-900">{Math.round(Number(recommendation.authority.value || 0))}</div></div>
        <div><span className="text-slate-500">Objective fit</span><div className="font-semibold text-slate-900">{Math.round(Number(potentials.objectiveFit || 0))}</div></div>
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <div className="rounded-md bg-slate-50 px-3 py-2"><strong>Desired reader outcome:</strong> {recommendation.desiredReaderOutcome || 'Not specified'}</div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <strong>Profile proof:</strong> {recommendation.profileProof.coverage || 'none'}
          {' · '}<strong>Evidence:</strong> {evidenceStatuses || 'none supplied'}
        </div>
      </div>

      {recommendation.decision === 'RESEARCH_MORE' && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Manual/external research suggested.</strong>
          {recommendation.researchQuestions.length > 0 && (
            <ul className="mt-2 list-disc pl-5">{recommendation.researchQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
          )}
        </div>
      )}

      <Disclosure summary="Why this recommendation?">
        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <strong>Sources</strong>
            <div className="mt-1 space-y-1">{recommendation.sources.length ? recommendation.sources.map((source) => (
              <div key={source.key}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">{source.title || source.key} ↗</a> : source.title || source.key}</div>
            )) : <span className="text-slate-500">No source rows available.</span>}</div>
          </div>
          <div>
            <strong>Evidence</strong>
            <div className="mt-1 space-y-2">{recommendation.evidence.length ? recommendation.evidence.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 p-2">
                <div className="font-medium">#{item.id} · {item.status.replaceAll('_', ' ')} · {item.claimType}</div>
                <div>{item.claim || item.summary}</div>
                <div className="text-xs text-slate-500">{item.sourceFamily}{item.resolvedUrl ? <> · <a href={item.resolvedUrl} target="_blank" rel="noopener noreferrer" className="underline">source ↗</a></> : null}</div>
              </div>
            )) : <span className="text-slate-500">No research evidence supplied to this recommendation.</span>}</div>
          </div>
          {recommendation.algorithmEvidence.length > 0 && <div><strong>Algorithm mechanisms:</strong> {recommendation.algorithmEvidence.map(readable).join(' · ')}</div>}
          {Object.keys(recommendation.learnedContext).length > 0 && <div><strong>Measured/learned context:</strong> {readable(recommendation.learnedContext)}</div>}
          {recommendation.risks.length > 0 && <div><strong>Risks:</strong> {recommendation.risks.map(readable).join(' · ')}</div>}
          {recommendation.alternatives.length > 0 && <div><strong>Alternatives:</strong> {recommendation.alternatives.map(readable).join(' · ')}</div>}
          <div><strong>AI provenance:</strong> {executionSummary(recommendation.aiExecution)}</div>
        </div>
      </Disclosure>

      {recommendation.decision === 'RESEARCH_MORE' && <ResearchSourceForm recommendationId={recommendation.id} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {active && cta && (
          <button onClick={choose} disabled={select.isPending} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
            {select.isPending ? 'Selecting…' : cta}
          </button>
        )}
        {active && (
          <button onClick={() => dismiss.mutate(recommendation.id)} disabled={dismiss.isPending} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {dismiss.isPending ? 'Dismissing…' : 'Dismiss'}
          </button>
        )}
        {!active && recommendation.selection && recommendation.pipeline === 'reply' && recommendation.selection.candidateKey && (
          <a href={`#/conversations/${encodeURIComponent(recommendation.selection.candidateKey)}`} className="text-sm font-medium text-sky-700 hover:underline">Open selected conversation →</a>
        )}
        {!active && recommendation.selection?.draftId && recommendation.pipeline !== 'reply' && <a href={`#/draft/${recommendation.selection.draftId}`} className="text-sm font-medium text-sky-700 hover:underline">Continue selected draft →</a>}
        {!active && recommendation.selection && !recommendation.selection.draftId && recommendation.pipeline !== 'reply' && <a href="#/create" className="text-sm font-medium text-sky-700 hover:underline">Open selected workflow →</a>}
      </div>
      {(select.isError || dismiss.isError) && (
        <div className="mt-2 text-sm text-red-700">
          {select.error?.message || dismiss.error?.message}
          {select.error?.message.includes('Use anyway') && <>{' '}<a href="#/discover" className="font-semibold underline">Review the source in Discover →</a></>}
        </div>
      )}
    </article>
  )
}

function EditorialPlan({ objective, onObjectiveChange }: { objective: EditorialObjective; onObjectiveChange: (objective: EditorialObjective) => void }) {
  const plan = useEditorialPlan(objective)
  const refresh = useEditorialRefresh()
  const saveObjective = useGrowthFocusObjective()
  const data = plan.data

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">AI Editorial Plan</div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">What is worth doing now?</h3>
          <p className="mt-1 text-sm text-slate-600">Advisory recommendations from current source snapshots, research evidence, account context, and measured history. Selection is not approval or publication.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-600">
            Goal
            <select
              value={objective}
              onChange={(event) => {
                const next = event.target.value as EditorialObjective
                onObjectiveChange(next)
                saveObjective.mutate(next)
              }}
              className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            >
              {OBJECTIVES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button onClick={() => refresh.mutate({ objective, refreshSources: true })} disabled={refresh.isPending} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            {refresh.isPending ? 'Refreshing…' : 'Refresh sources & recommendations'}
          </button>
        </div>
      </div>

      {refresh.isPending && <div className="mt-3"><Pending label="Refreshing source snapshots and editorial recommendations…" /></div>}
      {saveObjective.isPending && <div className="mt-2 text-xs text-slate-500">Saving this as your default Growth Focus goal…</div>}
      {refresh.isError && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{refresh.error.message}</div>}
      {saveObjective.isError && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveObjective.error.message}</div>}
      {plan.isError && <div className="mt-3"><Error message={plan.error.message} onRetry={() => void plan.refetch()} /></div>}
      {plan.isLoading && <div className="mt-3"><Loading message="Loading the latest editorial plan…" /></div>}

      {data && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {data.sourceFreshness.map((source) => <SourceFreshness key={source.kind} source={source} />)}
          </div>
          {!data.hasPlan ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">No completed plan exists for this goal yet. Use the explicit refresh action when you want to run the editorial pass.</div>
          ) : data.noStrongAction ? (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <strong>No strong main-feed post right now.</strong>{data.noStrongActionReason ? ` ${data.noStrongActionReason}` : ' The current evidence does not support forcing a post.'}
            </div>
          ) : (
            <div className="mt-4 space-y-4">{data.recommendations.map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} />)}</div>
          )}
        </>
      )}
    </section>
  )
}

function ActionCard({ action }: { action: TodayAction }) {
  const toneClasses = {
    primary: 'bg-white border-slate-200 hover:border-slate-400',
    success: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    warning: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    danger: 'bg-red-50 border-red-200 hover:border-red-400',
  }

  return (
    <a
      href={action.href}
      className={`block rounded-lg border p-6 transition-all ${toneClasses[action.tone] || toneClasses.primary}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{action.eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{action.title}</h3>
          <p className="mt-2 text-sm text-slate-700">{action.body}</p>
          {action.note && <p className="mt-3 text-xs text-slate-500">{action.note}</p>}
        </div>
        <span className="shrink-0 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm border border-slate-200">
          {action.action}
        </span>
      </div>
    </a>
  )
}

export function Today() {
  const { data, isLoading, error, refetch } = useToday()
  const growthFocus = useGrowthFocus()
  const [objective, setObjective] = useState<EditorialObjective>('qualified_growth')

  useEffect(() => {
    if (growthFocus.data?.profile.defaultObjective) setObjective(growthFocus.data.profile.defaultObjective)
  }, [growthFocus.data?.profile.defaultObjective])

  if (isLoading) {
    return <Loading message="Loading your workspace..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data) {
    return <Empty title="Workspace unavailable" message="Try refreshing the page." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Today</h2>
          <p className="mt-1 text-sm text-slate-600">
            {data.taskCount === 0
              ? 'You are caught up. Nothing requires a decision right now.'
              : data.taskCount === 1
                ? '1 thing worth looking at'
                : `${data.taskCount} things worth looking at`}
          </p>
        </div>
        <a
          href="#/discover"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Find new signals
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active conversations" value={data.stats.activeConversations} />
        <StatCard label="Posts awaiting review" value={data.stats.waitingForReview} />
        <StatCard label="Useful interactions · 7d" value={data.stats.meaningfulInteractions7d} />
        <StatCard
          label="New relevant followers · 24h"
          value={data.stats.newRelevantFollowers24h}
          note={`of ${data.stats.newlyObservedFollowers24h} newly observed`}
        />
      </div>

      <EditorialPlan objective={objective} onObjectiveChange={setObjective} />

      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Needs your attention</h3>
        {data.actions.length > 0 ? (
          <div className="space-y-4">
            {data.actions.map((action, index) => (
              <ActionCard key={index} action={action} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            No immediate decisions are waiting. Discover a new signal or check recent results when you are ready.
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Account status</div>
            <div className="font-semibold text-slate-900">{data.accountHealth.label}</div>
          </div>
          <a href="#/results" className="text-sm font-medium text-sky-700 hover:underline">View performance</a>
        </div>
        {data.nextScheduled && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium">Next post:</span> {formatDateTime(data.nextScheduled.recommendedAt)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {data.automation
                ? 'Main-feed automation is enabled.'
                : 'Main-feed automation is off. Nothing is auto-published.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
