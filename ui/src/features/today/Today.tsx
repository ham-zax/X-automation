import { useToday, type TodayAction } from '../../api/client'
import { Loading, Error, Empty } from '../../components/primitives'

function ActionCard({ action }: { action: TodayAction }) {
  const toneClasses = {
    primary: 'bg-blue-50 border-blue-200 hover:border-blue-300',
    success: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300',
    warning: 'bg-amber-50 border-amber-200 hover:border-amber-300',
    danger: 'bg-red-50 border-red-200 hover:border-red-300',
  }

  return (
    <a
      href={action.href}
      className={`block rounded-lg border p-6 transition-all ${toneClasses[action.tone]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {action.eyebrow}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{action.title}</h3>
          <p className="mt-2 text-sm text-slate-700">{action.body}</p>
          {action.note && (
            <p className="mt-3 text-xs text-slate-500">{action.note}</p>
          )}
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

  if (!data || data.actions.length === 0) {
    return (
      <Empty
        title="You're caught up"
        message="Nothing requires your attention right now. Check Discover for new opportunities."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Today</h2>
        <p className="mt-1 text-sm text-slate-600">
          {data.taskCount === 1
            ? '1 thing needs your attention'
            : `${data.taskCount} things need your attention`}
        </p>
      </div>

      {data.accountHealth?.health?.state === 'constrained' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-900">Account health needs attention</h3>
              <p className="mt-1 text-sm text-red-700">
                {data.accountHealth.health.explanation || 'Some actions are temporarily limited.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {data.actions.map((action, index) => (
          <ActionCard key={index} action={action} />
        ))}
      </div>

      {data.nextScheduled && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">
            <span className="font-medium">Next scheduled post:</span>{' '}
            {new Date(data.nextScheduled.recommendedAt).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {data.automation
              ? 'Main-feed automation is enabled.'
              : 'Main-feed automation is off. Nothing is auto-published.'}
          </p>
        </div>
      )}
    </div>
  )
}
