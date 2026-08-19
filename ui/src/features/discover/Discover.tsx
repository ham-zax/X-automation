import { useDiscover, type DiscoveredCandidate } from '../../api/client'
import { Loading, Error, Empty } from '../../components/primitives'

function CandidateCard({ candidate }: { candidate: DiscoveredCandidate }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {candidate.nicheLabel}
            </span>
            {candidate.viralTier !== 'standard' && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                {candidate.viralTier}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-slate-900 line-clamp-2 mb-2">
            {candidate.title}
          </h3>
          <p className="text-sm text-slate-600 line-clamp-3 mb-3">{candidate.text}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
        <div className="flex gap-3">
          <span>Score: {candidate.score.toFixed(1)}</span>
          <span>Source: {candidate.source}</span>
        </div>
        {candidate.url && (
          <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            View source →
          </a>
        )}
      </div>
      
      <div className="flex gap-2">
        <button className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Original
        </button>
        <button className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
          Quote
        </button>
        <button className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
          Conversation
        </button>
        <button className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
          Save
        </button>
      </div>
    </div>
  )
}

export function Discover() {
  const { data, isLoading, error, refetch } = useDiscover()

  if (isLoading) {
    return <Loading message="Loading discoveries..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data || data.candidates.length === 0) {
    return (
      <Empty
        title="No new discoveries"
        message="Check back later or adjust your discovery sources."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Discover</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.total} {data.total === 1 ? 'candidate' : 'candidates'} worth reviewing
        </p>
      </div>

      <div className="space-y-4">
        {data.candidates.map((candidate) => (
          <CandidateCard key={candidate.key} candidate={candidate} />
        ))}
      </div>
    </div>
  )
}
