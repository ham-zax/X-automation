import { useToday, type TodayAction } from '../../api/client'
import { Loading, Error, Empty, StatCard, formatDateTime } from '../../components/primitives'

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
        <StatCard label="Waiting for review" value={data.stats.waitingForReview} />
        <StatCard label="Useful interactions · 7d" value={data.stats.meaningfulInteractions7d} />
        <StatCard
          label="New relevant followers · 24h"
          value={data.stats.newRelevantFollowers24h}
          note={`of ${data.stats.newlyObservedFollowers24h} newly observed`}
        />
      </div>

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
          <a href="#/results" className="text-sm font-medium text-sky-700 hover:underline">Details</a>
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
