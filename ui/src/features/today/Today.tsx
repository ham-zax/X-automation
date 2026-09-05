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
import { Badge, Disclosure, Loading, Error, Empty, Notice, Pending, formatDateTime } from '../../components/primitives'
import { MetricCard, PageHeader } from '../../components/workspace'
import { navigate } from '../../router'
import { OperatorOverview } from './OperatorOverview'

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
  // Terminal formatting belongs in logs, not the rendered source status.
  const error = source.error?.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').trim()
  const errorSummary = error?.includes('ERR_INSUFFICIENT_RESOURCES')
    ? 'The browser reported insufficient resources.'
    : error?.includes('Page crashed')
      ? 'The source browser tab crashed.'
      : error?.split(/Call log:|\r?\n/, 1)[0].replace(/https?:\/\/\S+/g, '(request URL in diagnostics)').trim()
  const label = SOURCE_LABELS[source.kind] || source.kind

  return (
    <section aria-label={`${label} source status`} className={`source-freshness border-l-2 px-3 py-1.5 text-xs ${error ? 'border-amber-400 text-amber-900' : 'border-slate-300 text-slate-600'}`}>
      <div className="font-semibold">{label}</div>
      <div className="mt-1">{source.fetchedAt ? `Snapshot ${formatDateTime(source.fetchedAt)}` : 'No snapshot yet'} · {source.candidateCount} items</div>
      {error && (
        <div className="mt-3">
          <p className="font-semibold">Refresh failed: {errorSummary || 'Source unavailable'}</p>
          <p className="mt-1">{source.fetchedAt ? 'The previous snapshot is retained; it has not been refreshed.' : 'No successful snapshot is available yet.'}</p>
          <details className="mt-2">
            <summary>Refresh diagnostics</summary>
            <pre className="source-refresh-log">{error}</pre>
          </details>
        </div>
      )}
    </section>
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

  const decisionTone = recommendation.decision === 'PREPARE'
    ? 'success'
    : recommendation.decision === 'RESEARCH_MORE'
      ? 'warning'
      : 'neutral'

  return (
    <article className="editorial-recommendation" data-recommendation={recommendation.decision.toLowerCase()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={decisionTone}>
              {recommendation.decision === 'PREPARE' ? (PIPELINE_LABELS[recommendation.pipeline || ''] || recommendation.pipeline) : recommendation.decision.replace('_', ' ')}
            </Badge>
            <span className="text-xs tabular-nums text-slate-400">#{recommendation.rank}</span>
            {recommendation.selection && <Badge tone="info">Selected</Badge>}
            {recommendation.status === 'dismissed' && <Badge>Dismissed</Badge>}
          </div>
          <h4 className="mt-2 text-base font-semibold text-slate-900 sm:text-lg">{recommendation.title}</h4>
          <p className="mt-2 max-w-[78ch] text-base leading-7 text-slate-600">{recommendation.thesis}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Fit</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{Math.round(Number(potentials.objectiveFit || 0))}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {active && cta && (
          <button onClick={choose} disabled={select.isPending} className="action-button" data-variant="primary">
            {select.isPending ? 'Selecting…' : cta}
          </button>
        )}
        {active && (
          <button onClick={() => dismiss.mutate(recommendation.id)} disabled={dismiss.isPending} className="action-button" data-variant="ghost">
            {dismiss.isPending ? 'Dismissing…' : 'Dismiss'}
          </button>
        )}
        {!active && recommendation.selection && recommendation.pipeline === 'reply' && recommendation.selection.candidateKey && (
          <a href={`#/conversations/${encodeURIComponent(recommendation.selection.candidateKey)}`} className="text-sm font-semibold text-indigo-700 hover:underline">Open conversation →</a>
        )}
        {!active && recommendation.selection?.draftId && recommendation.pipeline !== 'reply' && <a href={`#/draft/${recommendation.selection.draftId}`} className="text-sm font-semibold text-indigo-700 hover:underline">Continue draft →</a>}
        {!active && recommendation.selection && !recommendation.selection.draftId && recommendation.pipeline !== 'reply' && <a href="#/create" className="text-sm font-semibold text-indigo-700 hover:underline">Open workflow →</a>}
      </div>

      <div className="recommendation-context text-sm">
        <div>
          {recommendation.whyNow && <div><strong>Why this is worth doing</strong><p>{recommendation.whyNow}</p></div>}
          {recommendation.whyThisFormat && <div className="mt-3"><strong>Why this format</strong><p>{recommendation.whyThisFormat}</p></div>}
        </div>
        <div>
          <strong>Intended reader outcome</strong>
          <p>{recommendation.desiredReaderOutcome || 'Not specified for this recommendation.'}</p>
          <div className="mt-3 font-semibold text-slate-800">Supporting sources</div>
          <div className="mt-1 space-y-2">{recommendation.sources.length ? recommendation.sources.map((source) => (
            <div key={source.key}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">{source.title || source.key} ↗</a> : source.title || source.key}</div>
          )) : <span className="text-slate-500">No source rows available.</span>}</div>
        </div>
      </div>
      <Disclosure summary="Evidence, scoring & provenance">
        <div className="space-y-4 text-sm text-slate-700">

          <div className="grid grid-cols-3 gap-x-5 gap-y-2 border-y border-slate-100 py-3 text-xs sm:grid-cols-6">
            <div><span className="text-slate-500">Reach</span><div className="font-semibold text-slate-900">{Math.round(Number(potentials.reachPotential || 0))}</div></div>
            <div><span className="text-slate-500">Follow</span><div className="font-semibold text-slate-900">{Math.round(Number(potentials.followPotential || 0))}</div></div>
            <div><span className="text-slate-500">Conversation</span><div className="font-semibold text-slate-900">{Math.round(Number(potentials.conversationPotential || 0))}</div></div>
            <div><span className="text-slate-500">Relationship</span><div className="font-semibold text-slate-900">{Math.round(Number(potentials.relationshipPotential || 0))}</div></div>
            <div><span className="text-slate-500">Authority</span><div className="font-semibold text-slate-900">{Math.round(Number(recommendation.authority.value || 0))}</div></div>
            <div><span className="text-slate-500">Objective fit</span><div className="font-semibold text-slate-900">{Math.round(Number(potentials.objectiveFit || 0))}</div></div>
          </div>

          <div className="text-sm text-slate-500">
            <strong>Profile proof:</strong> {recommendation.profileProof.coverage || 'none'}
            {' · '}<strong>Evidence:</strong> {evidenceStatuses || 'none supplied'}
          </div>

          {recommendation.decision === 'RESEARCH_MORE' && recommendation.researchQuestions.length > 0 && (
            <div>
              <strong>Research questions</strong>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">{recommendation.researchQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
            </div>
          )}

          <div>
            <strong>Evidence</strong>
            <div className="mt-1 space-y-2">{recommendation.evidence.length ? recommendation.evidence.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 p-2">
                <div className="font-medium">#{item.id} · {item.status.replaceAll('_', ' ')} · {item.claimType}</div>
                <div>{item.claim || item.summary}</div>
                <div className="text-xs text-slate-500">{item.sourceFamily}{item.resolvedUrl ? <> · <a href={item.resolvedUrl} target="_blank" rel="noopener noreferrer" className="underline">source ↗</a></> : null}</div>
              </div>
            )) : <span className="text-slate-500">No research evidence supplied.</span>}</div>
          </div>
          {recommendation.algorithmEvidence.length > 0 && <div><strong>Algorithm mechanisms:</strong> {recommendation.algorithmEvidence.map(readable).join(' · ')}</div>}
          {Object.keys(recommendation.learnedContext).length > 0 && <div><strong>Measured/learned context:</strong> {readable(recommendation.learnedContext)}</div>}
          {recommendation.risks.length > 0 && <div><strong>Risks:</strong> {recommendation.risks.map(readable).join(' · ')}</div>}
          {recommendation.alternatives.length > 0 && <div><strong>Alternatives:</strong> {recommendation.alternatives.map(readable).join(' · ')}</div>}
          <div><strong>AI provenance:</strong> {executionSummary(recommendation.aiExecution)}</div>
        </div>
      </Disclosure>

      {recommendation.decision === 'RESEARCH_MORE' && (
        <Disclosure summary="Add evidence" className="compact-disclosure">
          <ResearchSourceForm recommendationId={recommendation.id} />
        </Disclosure>
      )}

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
    <section className="operator-surface p-4 sm:p-5" data-tone="ai">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-700">AI Editorial Plan</div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">What is worth doing now?</h3>
          <p className="mt-1 text-sm text-slate-600">Advisory only. Selection never approves or publishes.</p>
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
          <button onClick={() => refresh.mutate({ objective, refreshSources: true })} disabled={refresh.isPending} className="action-button" data-variant="secondary">
            {refresh.isPending ? 'Refreshing…' : 'Refresh sources & recommendations'}
          </button>
        </div>
      </div>

      {refresh.isPending && <div className="mt-3"><Pending label="Refreshing source snapshots and editorial recommendations…" /></div>}
      {saveObjective.isPending && <div className="mt-2 text-xs text-slate-500">Saving this as your default Growth Focus goal…</div>}
      {refresh.isError && <div className="mt-3"><Notice tone="danger" title="Refresh failed">{refresh.error.message}</Notice></div>}
      {saveObjective.isError && <div className="mt-3"><Notice tone="danger" title="Could not save goal">{saveObjective.error.message}</Notice></div>}
      {plan.isError && <div className="mt-3"><Error message={plan.error.message} onRetry={() => void plan.refetch()} /></div>}
      {plan.isLoading && <div className="mt-3"><Loading message="Loading the latest editorial plan…" /></div>}

      {data && (
        <>
          <div className="mt-5 grid gap-3 border-y border-slate-200 py-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Source freshness">
            {data.sourceFreshness.map((source) => <SourceFreshness key={source.kind} source={source} />)}
          </div>
          {!data.hasPlan ? (
            <div className="mt-4"><Notice tone="neutral" title="No completed plan yet">Use the explicit refresh action when you want to run the editorial pass.</Notice></div>
          ) : data.noStrongAction ? (
            <div className="mt-4"><Notice tone="success" title="No strong main-feed post right now">{data.noStrongActionReason || 'The current evidence does not support forcing a post.'}</Notice></div>
          ) : (
            <div className="mt-4 divide-y divide-slate-200">{data.recommendations.map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} />)}</div>
          )}
        </>
      )}
    </section>
  )
}

function ActionCard({ action }: { action: TodayAction }) {
  const tone = action.tone === 'primary' ? 'primary' : action.tone

  return (
    <a
      href={action.href}
      className="operator-surface block p-5 hover:border-[var(--ui-primary-border)] sm:p-6"
      data-tone={tone}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{action.eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{action.title}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">{action.body}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-indigo-700">
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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Agent-led growth · Human oversight"
        title="Growth workspace"
        note={data.taskCount === 0
          ? 'You are caught up. Nothing requires a decision right now.'
          : data.taskCount === 1
            ? '1 decision is worth your attention.'
            : `${data.taskCount} decisions are worth your attention.`}
        right={(
          <a
            href="#/discover"
            className="action-button" data-variant="secondary"
          >
            Find new signals
          </a>
        )}
      />

      <OperatorOverview />

      <section aria-labelledby="today-attention">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Now</div>
            <h3 id="today-attention" className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Next decisions</h3>
          </div>
          <span className="text-sm tabular-nums text-slate-500">{data.actions.length}</span>
        </div>
        {data.actions.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.actions.map((action, index) => (
              <ActionCard key={index} action={action} />
            ))}
          </div>
        ) : (
          <Notice tone="success" title="Caught up">No immediate decisions are waiting. Discover a new signal or check recent results when you are ready.</Notice>
        )}
      </section>

      <section aria-labelledby="today-pulse">
        <div className="mb-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current state</div>
          <h3 id="today-pulse" className="mt-1 text-lg font-semibold text-slate-900">Growth pulse</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard label="Active conversations" value={data.stats.activeConversations} tone="primary" />
          <MetricCard label="Posts awaiting review" value={data.stats.waitingForReview} tone="warning" />
          <MetricCard label="Useful interactions · 7d" value={data.stats.meaningfulInteractions7d} tone="info" />
          <MetricCard
            label="Relevant followers · 24h"
            value={data.stats.newRelevantFollowers24h}
            note={`of ${data.stats.newlyObservedFollowers24h} newly observed`}
            tone="success"
          />
        </div>
      </section>

      <EditorialPlan objective={objective} onObjectiveChange={setObjective} />

      <section className="border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Account status</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{data.accountHealth.label}</div>
            {data.nextScheduled && (
              <div className="mt-1 text-sm text-slate-600">
                Next post {formatDateTime(data.nextScheduled.recommendedAt)} · {data.automation ? 'automation enabled' : 'manual publishing'}
              </div>
            )}
          </div>
          <a href="#/results" className="text-sm font-semibold text-indigo-700 hover:underline">View performance →</a>
        </div>
      </section>
    </div>
  )
}
