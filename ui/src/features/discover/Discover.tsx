import { useEffect, useRef, useState } from 'react'
import {
  useDiscover,
  useDiscoverRefresh,
  useDiscoverTriage,
  useRoutingDecision,
  type DiscoveredCandidate,
} from '../../api/client'
import { Loading, Error, Empty, Badge, Disclosure, Notice, Pending, formatDateTime, formatNumber } from '../../components/primitives'
import { PageHeader, SegmentedTabs } from '../../components/workspace'
import { resolveDiscoverPrimaryAction, resolveDiscoverSelection } from './discoverView'
import { navigate } from '../../router'
import { GrowthFitPanel } from '../create/GrowthFitPanel'

const FEEDS = [
  { id: 'for-you', label: 'To review' },
  { id: 'x', label: 'X latest' },
  { id: 'trending', label: 'X momentum' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'github', label: 'GitHub Trending' },
  { id: 'hn', label: 'Hacker News' },
  { id: 'saved', label: 'Bookmarks' },
  { id: 'handled', label: 'Handled' },
  { id: 'all', label: 'All sources' },
]

const FEED_DESCRIPTIONS: Record<string, string> = {
  'for-you': 'Unresolved opportunities across sources.',
  x: 'Latest X search snapshot, ranked for your topics — not the global timeline.',
  trending: 'Recent X search results ranked by observed momentum — not global Trends.',
  opportunities: 'Relationship, career, builder, and business opportunities.',
  github: 'Today’s GitHub Trending snapshot.',
  hn: 'Current Hacker News Top Stories snapshot.',
  saved: 'Bookmarked sources.',
  handled: 'Sources with recorded actions.',
  all: 'Persisted source history.',
}

function candidateMetricLine(candidate: DiscoveredCandidate): string {
  const metrics = candidate.metrics
  if (metrics.kind === 'github') {
    const language = metrics.language ? ` · ${metrics.language}` : ''
    return `${formatNumber(metrics.stars as number)} stars · ${formatNumber(metrics.starsToday as number)} stars today · ${formatNumber(metrics.forks as number)} forks${language}`
  }
  if (metrics.kind === 'github_legacy') {
    return `${formatNumber(metrics.stars as number)} stars · ~${formatNumber(metrics.starsPerDay as number)} stars/day since creation · legacy heuristic`
  }
  if (metrics.kind === 'hn' || metrics.kind === 'hn_legacy') {
    const author = metrics.by ? ` · by ${metrics.by}` : ''
    return `${formatNumber(metrics.points as number)} points · ${formatNumber(metrics.comments as number)} comments${author}${metrics.kind === 'hn_legacy' ? ' · historical collected candidate' : ''}`
  }
  return `${formatNumber(metrics.views as number)} views · ${formatNumber(metrics.likes as number)} likes · ${formatNumber(metrics.retweets as number)} reposts · ${formatNumber(metrics.replies as number)} replies`
}

function sourceMomentumLine(candidate: DiscoveredCandidate): string | null {
  const momentum = candidate.sourceMomentum
  if (!momentum?.deltas) return null
  const interval = momentum.intervalHours == null ? 'previous observation' : `${momentum.intervalHours.toFixed(1)}h observation interval`
  const deltas = momentum.deltas as Record<string, unknown>
  if (momentum.snapshotKind === 'github_trending') {
    const rank = Number(deltas.rankMovement || 0)
    const stars = Number(deltas.stars || 0)
    const starsToday = Number(deltas.starsToday || 0)
    const parts = [rank ? `rank ${rank > 0 ? '+' : ''}${rank}` : '', stars ? `${stars > 0 ? '+' : ''}${stars} stars` : '', starsToday ? `${starsToday > 0 ? '+' : ''}${starsToday} stars today` : ''].filter(Boolean)
    return parts.length ? `${parts.join(' · ')} · ${interval}` : null
  }
  if (momentum.snapshotKind === 'hn_top') {
    const rank = Number(deltas.rankMovement || 0)
    const points = Number(deltas.points || 0)
    const comments = Number(deltas.comments || 0)
    const parts = [rank ? `rank ${rank > 0 ? '+' : ''}${rank}` : '', points ? `${points > 0 ? '+' : ''}${points} points` : '', comments ? `${comments > 0 ? '+' : ''}${comments} comments` : ''].filter(Boolean)
    return parts.length ? `${parts.join(' · ')} · ${interval}` : null
  }
  const parts = ['views', 'likes', 'reposts', 'replies'].flatMap((key) => {
    const value = deltas[key]
    if (!value || typeof value !== 'object') return []
    const delta = Number((value as { delta?: number }).delta)
    if (!Number.isFinite(delta) || delta === 0) return []
    return `${delta > 0 ? '+' : ''}${formatNumber(delta)} ${key}`
  })
  return parts.length ? `${parts.join(' · ')} · ${interval}` : null
}

function editorialPlanLabel(candidate: DiscoveredCandidate) {
  const plan = candidate.editorialPlan
  if (!plan) return null
  if (plan.decision === 'RESEARCH_MORE') return 'Research recommended'
  if (plan.decision === 'SKIP') return "In today's plan · Skip"
  const pipeline = plan.pipeline ? plan.pipeline.charAt(0).toUpperCase() + plan.pipeline.slice(1) : 'Prepare'
  return `In today's plan · ${pipeline}`
}

function CandidateRow({
  candidate,
  index,
  selected,
  onSelect,
}: {
  candidate: DiscoveredCandidate
  index: number
  selected: boolean
  onSelect: () => void
}) {
  const sourceRank = Number(candidate.metrics.rank || 0) || index + 1
  const source = candidate.metrics.kind === 'github'
    ? 'GitHub'
    : candidate.metrics.kind === 'hn'
      ? 'Hacker News'
      : candidate.viral
        ? 'X momentum'
        : 'X'
  const state = candidate.completion?.label
    || candidate.queue?.statusLabel
    || editorialPlanLabel(candidate)
    || (candidate.saved ? 'Bookmarked' : '')

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="selection-row w-full border-b border-slate-200 bg-white px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50"
      data-selected={selected ? 'true' : 'false'}
    >
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        <span>#{sourceRank} · {source}</span>
        {state && <span className="max-w-[45%] truncate text-slate-600 normal-case tracking-normal">{state}</span>}
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold text-slate-900">{candidate.title}</div>
      {candidate.displayText && <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{candidate.displayText}</div>}
      <div className="mt-2 truncate text-[11px] text-slate-500">{candidateMetricLine(candidate)}</div>
    </button>
  )
}

function CandidateDetail({ candidate, index }: { candidate: DiscoveredCandidate; index: number }) {
  const triage = useDiscoverTriage()
  const routingDecision = useRoutingDecision()
  const pendingAction = triage.variables?.key === candidate.key && triage.isPending ? triage.variables.action : null
  const error = triage.isError && triage.variables?.key === candidate.key ? triage.error : null

  const runTriage = (action: 'original' | 'quote' | 'thread' | 'reply' | 'save' | 'unsave' | 'ignore' | 'discard') => {
    triage.mutate({ key: candidate.key, action }, {
      onSuccess: (result) => {
        const data = result as { draftId?: number | null }
        if (data.draftId) navigate(`/draft/${data.draftId}`)
      },
    })
  }

  const isX = candidate.source === 'x'
  const isGitHub = candidate.source === 'github'
  const isHn = candidate.source === 'hn'
  const isGitHubTrending = candidate.metrics.kind === 'github'
  const isHnTopStory = candidate.metrics.kind === 'hn'
  const sourceRank = Number(candidate.metrics.rank || 0) || null
  const sourceLabel = isGitHubTrending
    ? 'GITHUB TRENDING'
    : isGitHub
      ? 'GITHUB DISCOVERY · LEGACY HEURISTIC'
      : isHnTopStory
        ? 'HN TOP STORIES'
        : isHn
          ? 'HACKER NEWS · HISTORICAL CANDIDATE'
          : 'X'
  const openSourceLabel = isGitHub ? 'Open repository ↗' : isHn ? 'Open article ↗' : 'Open on X ↗'
  const queue = candidate.queue
  const completion = candidate.completion
  const skipped = queue?.status === 'ignored'
  const movement = sourceMomentumLine(candidate)
  const planLabel = editorialPlanLabel(candidate)
  const classificationNeedsRefresh = candidate.niche.status !== 'current'
  const ignoredByRecommendation = queue?.recommendedPipeline === 'ignore'
  const ignoreOverrideCurrent = queue?.routingDecision?.accepted === true
    && queue.routingDecision.actor === 'human'
    && queue.routingDecision.recommendedPipeline === queue.recommendedPipeline
    && queue.routingDecision.routingReason === queue.routingReason
  const canProceed = candidate.growthFit.allowed && (!ignoredByRecommendation || ignoreOverrideCurrent)
  const primaryAction = resolveDiscoverPrimaryAction({ recommendedPipeline: queue?.recommendedPipeline, isX, canProceed, skipped })
  const primaryActionLabel = primaryAction === 'ignore'
    ? 'Skip source'
    : primaryAction
      ? `${skipped ? 'Reopen as' : 'Start'} ${primaryAction === 'original' ? 'original' : primaryAction} ${skipped ? '' : 'draft'}`.trim()
      : null

  return (
    <article className="operator-surface p-5 sm:p-6" data-tone="primary">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">#{sourceRank || index + 1} {candidate.title}</div>
          <div className="text-xs text-slate-500">
            {sourceLabel}
            {!isGitHub && candidate.timestamp ? ` · ${new Date(candidate.timestamp).toLocaleString()}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {candidate.viral && <Badge tone="danger">Momentum</Badge>}
          {candidate.saved && <Badge tone="success">Saved</Badge>}
          {completion
            ? <Badge tone="success">{completion.label}</Badge>
            : planLabel
              ? <Badge tone={candidate.editorialPlan?.decision === 'RESEARCH_MORE' ? 'warning' : 'info'}>{planLabel}</Badge>
              : queue && <Badge tone="info">{queue.statusLabel}</Badge>}
        </div>
      </div>

      <GrowthFitPanel growthFit={candidate.growthFit} candidateKey={candidate.key} />


      {candidate.viral && (
        <Disclosure summary="X momentum details">
          <div className="flex flex-wrap gap-2">
            <Badge>{candidate.viral.ageHours.toFixed(1)}h old</Badge>
            <Badge>{formatNumber(candidate.viral.viewsPerHour)} views/h</Badge>
            <Badge>{candidate.viral.engagementsPerHour.toFixed(1)} engagement/h</Badge>
            <Badge>Internal signal {Math.round(candidate.viral.score)}/100</Badge>
          </div>
        </Disclosure>
      )}

      {candidate.displayText && <p className="mt-3 line-clamp-4 break-words text-sm leading-6 text-slate-700">{candidate.displayText}</p>}
      <div className="mt-2 text-xs text-slate-500">{candidateMetricLine(candidate)}</div>
      {movement && <div className="mt-1 text-xs font-medium text-slate-600">Source movement: {movement}</div>}

      {!completion && !candidate.editorialPlan && queue?.recommendedPipeline && (
        <div className="mt-2 text-sm text-slate-700">
          <strong>Rule-based route:</strong> {queue.recommendedPipelineLabel} <span className="text-slate-500">— {queue.routingReason}</span>
        </div>
      )}
      {!completion && ignoredByRecommendation && queue && (
        <div className="mt-3"><Notice tone="warning" title={ignoreOverrideCurrent ? 'Human decision: use anyway' : 'Current recommendation: Ignore'}>
          <div>
          {ignoreOverrideCurrent ? (
            <>
              {queue.routingDecision.reason}
              <button
                type="button"
                onClick={() => routingDecision.mutate({ queueItemId: queue.id, decision: 'clear_override' })}
                disabled={routingDecision.isPending}
                className="ml-2 text-xs font-semibold underline disabled:opacity-50"
              >
                Clear decision
              </button>
            </>
          ) : (
            <>
              Draft actions stay blocked until you explicitly override this recommendation.
              <button
                type="button"
                onClick={() => {
                  const reason = window.prompt('Why use this ignored opportunity anyway? This reason will be stored with the routing decision.')?.trim()
                  if (reason) routingDecision.mutate({ queueItemId: queue.id, decision: 'use_anyway', reason })
                }}
                disabled={routingDecision.isPending}
                className="action-button ml-2 !min-h-0 !px-2 !py-1 text-xs" data-variant="secondary"
              >
                Use anyway
              </button>
            </>
          )}
          <div className="mt-1 text-xs text-slate-600">This records human routing provenance only. It does not approve, schedule, or publish anything.</div>
          {routingDecision.error && <div className="mt-1 text-xs text-red-700">{routingDecision.error.message}</div>}
          </div>
        </Notice></div>
      )}
      {!completion && queue?.draftId && (
        <div className="mt-2">
          <a href={`#/draft/${queue.draftId}`} className="text-sm font-medium text-sky-700 hover:underline">
            Continue draft · writing quality {queue.draftQualityScore ?? 0}/50 · approval threshold 40 →
          </a>
        </div>
      )}

      {completion && (
        <div className="mt-3"><Notice tone="success" title={completion.summary}>
          {completion.occurredAt ? <>Recorded {formatDateTime(completion.occurredAt)}. </> : null}
          {completion.outputUrl && <a href={completion.outputUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">View your {completion.label.toLowerCase()} ↗</a>}
        </Notice></div>
      )}
      {!completion && skipped && (
        <div className="mt-3 text-sm text-slate-600">You skipped this source. Choosing a draft action below reopens it.</div>
      )}

      {!classificationNeedsRefresh && candidate.niche.score != null && (
        <Disclosure summary="Classification evidence" className="compact-disclosure">
          <div className="flex flex-wrap gap-1">
            {candidate.niche.tags.map((tag) => <Badge key={tag.tag} tone="info">{tag.label}</Badge>)}
            {candidate.niche.matches.map((match) => <Badge key={match}>{match}</Badge>)}
            <Badge>Topic score {candidate.niche.score}/50</Badge>
            {candidate.niche.profileRevision != null && candidate.niche.classifierVersion != null && (
              <Badge>rev {candidate.niche.profileRevision} · v{candidate.niche.classifierVersion}</Badge>
            )}
          </div>
        </Disclosure>
      )}

      {pendingAction ? (
        <div className="mt-4">
          {pendingAction === 'original' || pendingAction === 'quote' || pendingAction === 'thread' || pendingAction === 'reply'
            ? <Pending label="Opening draft workspace…" />
            : pendingAction === 'discard'
              ? <Pending label="Discarding draft…" />
              : pendingAction === 'ignore'
                ? <Pending label="Skipping source…" />
                : <Pending label={pendingAction === 'unsave' ? 'Removing bookmark…' : 'Saving bookmark…'} />}
        </div>
      ) : completion ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <button onClick={() => runTriage(candidate.saved ? 'unsave' : 'save')} className="text-sm font-semibold text-indigo-700 hover:underline">
            {candidate.saved ? 'Remove bookmark' : 'Bookmark'}
          </button>
          {candidate.url && <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-indigo-700 hover:underline">{openSourceLabel}</a>}
          {isHn && typeof candidate.metrics.hnUrl === 'string' && candidate.metrics.hnUrl && candidate.metrics.hnUrl !== candidate.url && (
            <a href={candidate.metrics.hnUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-indigo-700 hover:underline">HN discussion ↗</a>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {primaryAction && primaryActionLabel && (
              <button
                onClick={() => runTriage(primaryAction)}
                className="action-button"
                data-variant={primaryAction === 'ignore' ? 'secondary' : 'primary'}
              >
                {primaryActionLabel}
              </button>
            )}
            {candidate.saved
              ? <button onClick={() => runTriage('unsave')} className="text-sm font-semibold text-indigo-700 hover:underline">Remove bookmark</button>
              : <button onClick={() => runTriage('save')} className="text-sm font-semibold text-indigo-700 hover:underline">Bookmark</button>}
            {candidate.url && <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-indigo-700 hover:underline">{openSourceLabel}</a>}
          </div>

          <Disclosure summary="More actions" className="compact-disclosure">
            <div className="flex flex-wrap items-center gap-2">
              {primaryAction !== 'original' && <button onClick={() => runTriage('original')} disabled={!canProceed} className="action-button" data-variant="secondary">{skipped ? 'Reopen as original' : 'Original draft'}</button>}
              {isX && primaryAction !== 'quote' && <button onClick={() => runTriage('quote')} disabled={!canProceed} className="action-button" data-variant="secondary">{skipped ? 'Reopen as quote' : 'Quote draft'}</button>}
              {primaryAction !== 'thread' && <button onClick={() => runTriage('thread')} disabled={!canProceed} className="action-button" data-variant="secondary">{skipped ? 'Reopen as thread' : 'Thread draft'}</button>}
              {isX && primaryAction !== 'reply' && <button onClick={() => runTriage('reply')} disabled={!canProceed} className="action-button" data-variant="secondary">{skipped ? 'Reopen as reply' : 'Reply draft'}</button>}
              {queue?.draftId && (
                <button
                  onClick={() => { if (window.confirm('Discard this draft? The source and its history will remain available.')) runTriage('discard') }}
                  className="action-button"
                  data-variant="danger"
                >Discard draft</button>
              )}
              {!skipped && primaryAction !== 'ignore' && <button onClick={() => runTriage('ignore')} className="action-button" data-variant="ghost">Skip source</button>}
              {isHn && typeof candidate.metrics.hnUrl === 'string' && candidate.metrics.hnUrl && candidate.metrics.hnUrl !== candidate.url && (
                <a href={candidate.metrics.hnUrl} target="_blank" rel="noopener noreferrer" className="action-button" data-variant="ghost">HN discussion ↗</a>
              )}
            </div>
          </Disclosure>
        </div>
      )}

      {error && <div className="mt-3"><Notice tone="danger" title="Action blocked">{error.message}</Notice></div>}
    </article>
  )
}

export function Discover() {
  const [feed, setFeed] = useState('for-you')
  const [tag, setTag] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = useDiscover(feed, tag)
  const refresh = useDiscoverRefresh()
  const resolvedSelectedKey = resolveDiscoverSelection(data?.candidates || [], selectedKey)
  const selectedIndex = data?.candidates.findIndex((candidate) => candidate.key === resolvedSelectedKey) ?? -1
  const selectedCandidate = selectedIndex >= 0 ? data?.candidates[selectedIndex] : null
  const autoRefreshed = useRef<string | null>(null)

  // Match legacy behavior: refresh a source automatically when its feed is empty on first load.
  useEffect(() => {
    if (!data || refresh.isPending) return
    if (data.candidates.length === 0 && data.refreshable && autoRefreshed.current !== `${data.feed}:${tag}`) {
      autoRefreshed.current = `${data.feed}:${tag}`
      refresh.mutate(data.refreshable)
    }
  }, [data, tag, refresh])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Signal triage"
        title="Discover"
        note={FEED_DESCRIPTIONS[feed] || 'Find useful things worth talking about.'}
        right={data?.refreshable ? (
          <button
            onClick={() => refresh.mutate(data.refreshable as string)}
            disabled={refresh.isPending}
            className="action-button" data-variant="secondary"
          >
            {refresh.isPending ? 'Refreshing source…' : 'Refresh source'}
          </button>
        ) : undefined}
      />

      <div className="space-y-3">
        <SegmentedTabs
          active={feed}
          items={FEEDS}
          ariaLabel="Discovery source"
          onChange={(next) => { setFeed(next); setTag(''); setSelectedKey(null) }}
        />

        {data && data.topicFilters.length > 0 && (feed === 'for-you' || feed === 'x' || feed === 'trending' || feed === 'opportunities' || feed === 'all' || feed === 'saved' || feed === 'handled') && (
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500" htmlFor="discover-topic">Topic</label>
            <select
              id="discover-topic"
              value={tag}
              onChange={(event) => { setTag(event.target.value); setSelectedKey(null) }}
              className="min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700"
            >
              <option value="">All topics</option>
              {data.topicFilters.map((topic) => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {refresh.isError && <Notice tone="warning" title="Refresh failed">{refresh.error.message}</Notice>}
      {data?.sourceError && <Notice tone="warning" title="Partial source refresh">{data.sourceError}</Notice>}

      {isLoading ? (
        <Loading message="Loading discoveries..." />
      ) : error ? (
        <Error message={error.message} onRetry={() => refetch()} />
      ) : !data || data.candidates.length === 0 ? (
        <Empty
          title={data?.refreshable ? 'No source snapshot yet' : 'No candidates found for this view'}
          message={data?.refreshable ? 'This source refreshes automatically the first time it is empty, or use Refresh source.' : 'Check back later or try another view.'}
        />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.55fr)]">
          <section className="operator-surface overflow-hidden" aria-label="Discovery candidates">
            <div className="border-b border-slate-200 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">To scan</div>
                <div className="text-xs tabular-nums text-slate-500">{data.total} {data.total === 1 ? 'item' : 'items'}</div>
              </div>
              {data.snapshotAt && <div className="mt-1 text-[11px] text-slate-500">Snapshot {formatDateTime(data.snapshotAt)}</div>}
              {data.lastRefreshAttemptAt && data.lastRefreshAttemptAt !== data.snapshotAt && <div className="mt-1 text-[11px] text-slate-500">Last refresh attempt {formatDateTime(data.lastRefreshAttemptAt)}</div>}
              {data.legacyFallback && <div className="mt-1 text-[11px] text-amber-700">Preserved legacy snapshot until the next canonical refresh.</div>}
            </div>
            <div className="xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto">
              {data.candidates.map((candidate, index) => {
                const selected = candidate.key === resolvedSelectedKey
                return (
                  <div key={candidate.key}>
                    <CandidateRow
                      candidate={candidate}
                      index={index}
                      selected={selected}
                      onSelect={() => setSelectedKey(candidate.key)}
                    />
                    {selected && (
                      <div className="border-b border-slate-200 bg-[var(--ui-surface-subtle)] p-2 xl:hidden">
                        <CandidateDetail candidate={candidate} index={index} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="hidden xl:block" aria-label="Selected discovery detail">
            <div className="sticky-detail">
              {selectedCandidate ? (
                <CandidateDetail candidate={selectedCandidate} index={selectedIndex} />
              ) : (
                <Empty title="Select a signal" message="Choose a candidate from the list to inspect its evidence and actions." />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
