import { useEffect, useRef, useState } from 'react'
import {
  useDiscover,
  useDiscoverRefresh,
  useDiscoverTriage,
  useRoutingDecision,
  type DiscoveredCandidate,
} from '../../api/client'
import { Loading, Error, Empty, Badge, Disclosure, Pending, formatDateTime, formatNumber } from '../../components/primitives'
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
  'for-you': 'Your unresolved inbox across sources. Live source tabs are snapshots; items stay here until you draft, pause, skip, or complete them.',
  x: 'Latest fetched posts from the configured X topic searches, re-ranked for your topics. This is not X’s global timeline or Trends page.',
  trending: 'Latest fetched Top results from the core AI/dev-tool X searches over the last 24 hours, then ranked by observed momentum. This is not X’s global Trends page.',
  opportunities: 'Unresolved X sources in your inbox that match the relationship, career, builder, or business opportunity filters.',
  github: 'Latest fetched GitHub Trending repositories for Today, preserved in GitHub’s displayed order.',
  hn: 'Latest fetched Hacker News Top Stories snapshot, preserved in the official API order.',
  saved: 'Sources you explicitly bookmarked for reference, whether or not you already acted on them.',
  handled: 'Sources with recorded publication, quote, reply, or repost history.',
  all: 'Your persisted source history across active, paused, skipped, and completed work.',
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

function CandidateCard({ candidate, index }: { candidate: DiscoveredCandidate; index: number }) {
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

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">#{sourceRank || index + 1} {candidate.title}</div>
          <div className="text-xs text-slate-500">
            {sourceLabel}
            {!isGitHub && candidate.timestamp ? ` · ${new Date(candidate.timestamp).toLocaleString()}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {candidate.viral
            ? <Badge tone="danger">Internal momentum · {candidate.viral.label}</Badge>
            : <Badge>{isGitHubTrending ? 'GitHub Trending' : isGitHub ? 'Legacy GitHub signal' : isHnTopStory ? 'HN Top Stories' : isHn ? 'Historical HN signal' : 'X search signal'}</Badge>}
          {candidate.saved && <Badge tone="success">Bookmarked</Badge>}
          {planLabel && <Badge tone={candidate.editorialPlan?.decision === 'RESEARCH_MORE' ? 'warning' : 'info'}>{planLabel}</Badge>}
          {completion ? <Badge tone="success">Handled · {completion.label}</Badge> : queue && <Badge tone="info">{queue.statusLabel}</Badge>}
        </div>
      </div>

      <GrowthFitPanel growthFit={candidate.growthFit} candidateKey={candidate.key} />

      {!classificationNeedsRefresh && candidate.niche.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {candidate.niche.tags.map((tag) => <Badge key={tag.tag} tone="info">{tag.label}</Badge>)}
        </div>
      )}

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

      {candidate.displayText && <p className="mt-3 text-sm leading-6 text-slate-700 break-words">{candidate.displayText}</p>}
      <div className="mt-2 text-xs text-slate-500">{candidateMetricLine(candidate)}</div>
      {movement && <div className="mt-1 text-xs font-medium text-slate-600">Source movement: {movement}</div>}

      {!completion && !candidate.editorialPlan && queue?.recommendedPipeline && (
        <div className="mt-2 text-sm text-slate-700">
          <strong>Rule-based route:</strong> {queue.recommendedPipelineLabel} <span className="text-slate-500">— {queue.routingReason}</span>
        </div>
      )}
      {!completion && ignoredByRecommendation && queue && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {ignoreOverrideCurrent ? (
            <>
              <strong>Human decision: use anyway.</strong> {queue.routingDecision.reason}
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
              <strong>Current recommendation: Ignore.</strong> Draft actions stay blocked until you explicitly override this recommendation.
              <button
                type="button"
                onClick={() => {
                  const reason = window.prompt('Why use this ignored opportunity anyway? This reason will be stored with the routing decision.')?.trim()
                  if (reason) routingDecision.mutate({ queueItemId: queue.id, decision: 'use_anyway', reason })
                }}
                disabled={routingDecision.isPending}
                className="ml-2 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900 disabled:opacity-50"
              >
                Use anyway
              </button>
            </>
          )}
          <div className="mt-1 text-xs text-amber-800">This records human routing provenance only. It does not approve, schedule, or publish anything.</div>
          {routingDecision.error && <div className="mt-1 text-xs text-red-700">{routingDecision.error.message}</div>}
        </div>
      )}
      {!completion && queue?.draftId && (
        <div className="mt-2">
          <a href={`#/draft/${queue.draftId}`} className="text-sm font-medium text-sky-700 hover:underline">
            Continue draft · writing quality {queue.draftQualityScore ?? 0}/50 · approval threshold 40 →
          </a>
        </div>
      )}

      {completion && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <strong>{completion.summary}</strong>
          {completion.occurredAt ? ` ${formatDateTime(completion.occurredAt)}.` : ''}
          {completion.outputUrl && (
            <> <a href={completion.outputUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">View your {completion.label.toLowerCase()} ↗</a></>
          )}
        </div>
      )}
      {!completion && skipped && (
        <div className="mt-3 text-sm text-slate-600">You skipped this source. Choosing a draft action below reopens it.</div>
      )}

      {!classificationNeedsRefresh && candidate.niche.score != null && (
        <Disclosure summary="Classification evidence">
          <div className="flex flex-wrap gap-1">
            {candidate.niche.matches.map((match) => <Badge key={match}>{match}</Badge>)}
            <Badge>Classifier topic score {candidate.niche.score}/50</Badge>
            {candidate.niche.profileRevision != null && candidate.niche.classifierVersion != null && (
              <Badge>Classification rev {candidate.niche.profileRevision} · v{candidate.niche.classifierVersion}</Badge>
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => runTriage(candidate.saved ? 'unsave' : 'save')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${candidate.saved ? 'border border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {candidate.saved ? 'Remove bookmark' : 'Bookmark for reference'}
          </button>
          {candidate.url && (
            <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
              {openSourceLabel}
            </a>
          )}
          {isHn && typeof candidate.metrics.hnUrl === 'string' && candidate.metrics.hnUrl && candidate.metrics.hnUrl !== candidate.url && (
            <a href={candidate.metrics.hnUrl} target="_blank" rel="noopener noreferrer" className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
              HN discussion ↗
            </a>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => runTriage('original')}
            disabled={!canProceed}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {skipped ? 'Reopen as original' : 'Start original draft'}
          </button>
          {isX && (
            <button
              onClick={() => runTriage('quote')}
              disabled={!canProceed}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {skipped ? 'Reopen as quote' : 'Start quote draft'}
            </button>
          )}
          <button
            onClick={() => runTriage('thread')}
            disabled={!canProceed}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {skipped ? 'Reopen as thread' : 'Start thread draft'}
          </button>
          {isX && (
            <button
              onClick={() => runTriage('reply')}
              disabled={!canProceed}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {skipped ? 'Reopen as reply' : 'Start reply draft'}
            </button>
          )}
          <button
            onClick={() => runTriage(candidate.saved ? 'unsave' : 'save')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${candidate.saved ? 'border border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {candidate.saved ? 'Remove bookmark' : 'Bookmark for reference'}
          </button>
          {queue?.draftId && (
            <button
              onClick={() => {
                if (window.confirm('Discard this draft? The source and its history will remain available.')) runTriage('discard')
              }}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700"
            >
              Discard draft
            </button>
          )}
          {!skipped && (
            <button
              onClick={() => runTriage('ignore')}
              title="Stop pursuing this source. A bookmarked source stays bookmarked until you remove the bookmark."
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Skip source
            </button>
          )}
          {candidate.url && (
            <a
              href={candidate.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              {openSourceLabel}
            </a>
          )}
          {isHn && typeof candidate.metrics.hnUrl === 'string' && candidate.metrics.hnUrl && candidate.metrics.hnUrl !== candidate.url && (
            <a href={candidate.metrics.hnUrl} target="_blank" rel="noopener noreferrer" className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
              HN discussion ↗
            </a>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</div>
      )}
    </article>
  )
}

export function Discover() {
  const [feed, setFeed] = useState('for-you')
  const [tag, setTag] = useState('')
  const { data, isLoading, error, refetch } = useDiscover(feed, tag)
  const refresh = useDiscoverRefresh()
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Discover</h2>
          <p className="mt-1 text-sm text-slate-600">{FEED_DESCRIPTIONS[feed] || 'Find useful things worth talking about.'}</p>
        </div>
        {data?.refreshable && (
          <button
            onClick={() => refresh.mutate(data.refreshable as string)}
            disabled={refresh.isPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {refresh.isPending ? 'Refreshing source…' : 'Refresh source'}
          </button>
        )}
      </div>

      {refresh.isError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Refresh failed: {refresh.error.message}
        </div>
      )}
      {data?.sourceError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The last source refresh had a partial error: {data.sourceError}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FEEDS.map((item) => (
          <button
            key={item.id}
            onClick={() => { setFeed(item.id); setTag('') }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              feed === item.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {data && data.topicFilters.length > 0 && (feed === 'for-you' || feed === 'x' || feed === 'trending' || feed === 'opportunities' || feed === 'all' || feed === 'saved' || feed === 'handled') && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTag('')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!tag ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            All topics
          </button>
          {data.topicFilters.map((topic) => (
            <button
              key={topic.value}
              onClick={() => setTag(topic.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tag === topic.value ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
            >
              {topic.label}
            </button>
          ))}
        </div>
      )}

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
        <>
          <div className="text-sm text-slate-600">
            <div>{data.total} {data.total === 1 ? 'item' : 'items'}</div>
            {data.snapshotAt && <div className="mt-1 text-xs text-slate-500">Source snapshot updated {formatDateTime(data.snapshotAt)}. Refresh source to check upstream again.</div>}
            {data.lastRefreshAttemptAt && data.lastRefreshAttemptAt !== data.snapshotAt && <div className="mt-1 text-xs text-slate-500">Last refresh attempt {formatDateTime(data.lastRefreshAttemptAt)}.</div>}
            {data.legacyFallback && <div className="mt-1 text-xs text-amber-700">Showing the preserved legacy snapshot until the next successful canonical refresh.</div>}
          </div>
          <div className="space-y-4">
            {data.candidates.map((candidate, index) => (
              <CandidateCard key={candidate.key} candidate={candidate} index={index} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
