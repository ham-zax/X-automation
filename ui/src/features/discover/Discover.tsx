import { useEffect, useRef, useState } from 'react'
import {
  useDiscover,
  useDiscoverRefresh,
  useDiscoverTriage,
  type DiscoveredCandidate,
} from '../../api/client'
import { Loading, Error, Empty, Badge, Disclosure, Pending, formatNumber } from '../../components/primitives'
import { navigate } from '../../router'

const FEEDS = [
  { id: 'for-you', label: 'For you' },
  { id: 'trending', label: 'Trending' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'github', label: 'GitHub' },
  { id: 'hn', label: 'Hacker News' },
  { id: 'all', label: 'All sources' },
  { id: 'saved', label: 'Bookmarks' },
]

function candidateMetricLine(candidate: DiscoveredCandidate): string {
  const metrics = candidate.metrics
  if (metrics.kind === 'github') {
    return `${formatNumber(metrics.stars as number)} stars · ~${formatNumber(metrics.starsPerDay as number)} stars/day`
  }
  if (metrics.kind === 'hn') {
    return `${formatNumber(metrics.points as number)} points · ${formatNumber(metrics.comments as number)} comments`
  }
  return `${formatNumber(metrics.views as number)} views · ${formatNumber(metrics.likes as number)} likes · ${formatNumber(metrics.retweets as number)} reposts · ${formatNumber(metrics.replies as number)} replies`
}

function CandidateCard({ candidate, index }: { candidate: DiscoveredCandidate; index: number }) {
  const triage = useDiscoverTriage()
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
  const queue = candidate.queue

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">#{index + 1} {candidate.title}</div>
          <div className="text-xs text-slate-500">
            {candidate.source.toUpperCase()}
            {candidate.timestamp ? ` · ${new Date(candidate.timestamp).toLocaleString()}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {candidate.viral ? <Badge tone="danger">{candidate.viral.label}</Badge> : <Badge>{isX ? 'Relevant signal' : 'Research signal'}</Badge>}
          {candidate.saved && <Badge tone="success">Bookmarked</Badge>}
          {queue && <Badge tone="info">{queue.statusLabel}</Badge>}
        </div>
      </div>

      {isX && candidate.niche.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {candidate.niche.tags.map((tag) => <Badge key={tag.tag} tone="info">{tag.label}</Badge>)}
        </div>
      )}

      {candidate.viral && (
        <Disclosure summary="Trend details">
          <div className="flex flex-wrap gap-2">
            <Badge>{candidate.viral.ageHours.toFixed(1)}h old</Badge>
            <Badge>{formatNumber(candidate.viral.viewsPerHour)} views/h</Badge>
            <Badge>{candidate.viral.engagementsPerHour.toFixed(1)} engagement/h</Badge>
            <Badge>Internal signal {Math.round(candidate.viral.score)}/100</Badge>
          </div>
        </Disclosure>
      )}

      <p className="mt-3 text-sm leading-6 text-slate-700 break-words">{candidate.displayText}</p>
      <div className="mt-2 text-xs text-slate-500">{candidateMetricLine(candidate)}</div>

      {queue?.recommendedPipeline && (
        <div className="mt-2 text-sm text-slate-700">
          <strong>Suggested next step:</strong> {queue.recommendedPipelineLabel} <span className="text-slate-500">— {queue.routingReason}</span>
        </div>
      )}
      {queue?.draftId && (
        <div className="mt-2">
          <a href={`#/draft/${queue.draftId}`} className="text-sm font-medium text-sky-700 hover:underline">
            Continue draft · quality {queue.draftQualityScore ?? 0}/50 · approval threshold 40 →
          </a>
        </div>
      )}

      {isX && candidate.niche.matches.length > 0 && (
        <Disclosure summary="Why it matches">
          <div className="flex flex-wrap gap-1">
            {candidate.niche.matches.map((match) => <Badge key={match}>{match}</Badge>)}
            {candidate.niche.score != null && <Badge>Internal topic fit {candidate.niche.score}/50</Badge>}
          </div>
        </Disclosure>
      )}

      {pendingAction ? (
        <div className="mt-4">
          {pendingAction === 'original' || pendingAction === 'quote' || pendingAction === 'thread' || pendingAction === 'reply'
            ? <Pending label="Generating draft…" />
            : pendingAction === 'discard'
              ? <Pending label="Discarding draft…" />
              : pendingAction === 'ignore'
                ? <Pending label="Skipping source…" />
              : <Pending label={pendingAction === 'unsave' ? 'Removing bookmark…' : 'Saving bookmark…'} />}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => runTriage('original')}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Draft original
          </button>
          {isX && (
            <button
              onClick={() => runTriage('quote')}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Draft quote
            </button>
          )}
          <button
            onClick={() => runTriage('thread')}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Draft thread
          </button>
          {isX && (
            <button
              onClick={() => runTriage('reply')}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Draft reply
            </button>
          )}
          <button
            onClick={() => runTriage(candidate.saved ? 'unsave' : 'save')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${candidate.saved ? 'border border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {candidate.saved ? 'Remove bookmark' : 'Bookmark'}
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
          <button
            onClick={() => runTriage('ignore')}
            disabled={queue?.status === 'ignored'}
            title="Stop pursuing this source. A bookmarked source stays bookmarked until you remove the bookmark."
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {queue?.status === 'ignored' ? 'Skipped' : 'Skip source'}
          </button>
          {candidate.url && (
            <a
              href={candidate.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Open source ↗
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
          <p className="mt-1 text-sm text-slate-600">Find useful things worth talking about.</p>
        </div>
        {data?.refreshable && (
          <button
            onClick={() => refresh.mutate(data.refreshable as string)}
            disabled={refresh.isPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {refresh.isPending ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>

      {refresh.isError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Refresh failed: {refresh.error.message}
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

      {data && data.topicFilters.length > 0 && (feed === 'for-you' || feed === 'trending' || feed === 'opportunities' || feed === 'all' || feed === 'saved') && (
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
          title="No candidates found for this view"
          message={data?.refreshable ? 'This feed refreshes automatically the first time it is empty, or use Refresh.' : 'Check back later or try another feed.'}
        />
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {data.total} {data.total === 1 ? 'candidate' : 'candidates'}
          </p>
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
