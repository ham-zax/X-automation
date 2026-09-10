import { useGrowthOperator } from '../../api/client'
import { Badge, formatDateTime } from '../../components/primitives'

function actionSummary(actions: { replies: number; quotes: number; reposts: number; originals: number; total: number }) {
  if (!actions.total) return 'No public actions'
  const parts = [
    actions.replies ? `${actions.replies} ${actions.replies === 1 ? 'reply' : 'replies'}` : '',
    actions.quotes ? `${actions.quotes} ${actions.quotes === 1 ? 'quote' : 'quotes'}` : '',
    actions.reposts ? `${actions.reposts} ${actions.reposts === 1 ? 'repost' : 'reposts'}` : '',
    actions.originals ? `${actions.originals} ${actions.originals === 1 ? 'post' : 'posts'}` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

export function OperatorOverview() {
  const operator = useGrowthOperator()
  const readiness = operator.data?.readiness

  if (operator.error) {
    return (
      <section className="operator-surface operator-overview" aria-labelledby="operator-overview-title">
        <div className="operator-overview-heading">
          <div>
            <h3 id="operator-overview-title">Growth</h3>
            <p>Autonomous growth status is temporarily unavailable.</p>
          </div>
          <a href="#/settings/growth-operator" className="action-button">Settings</a>
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{operator.error.message}</div>
      </section>
    )
  }

  if (!readiness) {
    return (
      <section className="operator-surface operator-overview" aria-labelledby="operator-overview-title">
        <div className="operator-overview-heading">
          <div>
            <h3 id="operator-overview-title">Growth</h3>
            <p>Checking whether autonomous growth is ready.</p>
          </div>
        </div>
      </section>
    )
  }

  const agentActive = Boolean(readiness.reasoningAgent.attached && readiness.reasoningAgent.activeRunId)
  const xConnected = Boolean(readiness.transports.browserAgent.accountVerified || readiness.sensors.xForYou.authenticatedAccountVerified)
  const unresolved = readiness.reconciliation.closedUnresolvedCount
  const verificationInProgress = readiness.reconciliation.activeCount
  const schedulerReady = Boolean(readiness.scheduler.growthAgent.configured && readiness.scheduler.growthAgent.enabled)
  const needsAttention = !readiness.permission.live
    || readiness.accountHealth.constrained
    || !xConnected
    || (verificationInProgress > 0 && !agentActive)
  const growthState = needsAttention ? 'Needs attention' : agentActive ? 'Growing' : 'Ready'
  const growthTone = needsAttention ? 'warning' : agentActive ? 'info' : 'success'
  const attention: string[] = []

  if (!readiness.permission.live) attention.push('Autonomous growth is paused or not in Live mode.')
  if (!xConnected) attention.push('The authenticated X account is not currently verified.')
  if (readiness.accountHealth.constrained) {
    attention.push(readiness.accountHealth.reasons[0]?.message || 'Account health is currently constraining public actions.')
  }
  if (verificationInProgress > 0 && !agentActive) attention.push(`${verificationInProgress} ${verificationInProgress === 1 ? 'action is' : 'actions are'} mid-verification while the agent is idle.`)

  const accountHandle = readiness.transports.browserAgent.accountObserved || readiness.transports.browserAgent.accountExpected
  const lastRun = readiness.lastRun

  return (
    <section className="operator-surface operator-overview" aria-labelledby="operator-overview-title">
      <div className="operator-overview-heading">
        <div>
          <h3 id="operator-overview-title">Growth</h3>
          <p>One glance for readiness, agent activity, X connection, and anything that needs intervention.</p>
        </div>
        <a href="#/settings/growth-operator" className="action-button">Settings</a>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Growth status">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Growth</div>
          <div className="mt-2"><Badge tone={growthTone}>{growthState}</Badge></div>
          <p className="mt-2 text-sm text-slate-600">{growthState === 'Growing' ? 'An autonomous run is active.' : growthState === 'Ready' ? 'Ready for the next Growth Run.' : 'One or more conditions need attention.'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Agent</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{agentActive ? 'Active' : 'Idle'}</div>
          <p className="mt-1 text-sm text-slate-600">{agentActive ? 'Working on the current Growth Run.' : 'No reasoning agent is working right now.'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">X</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{xConnected ? `Connected as @${accountHandle}` : 'Browser unavailable'}</div>
          <p className="mt-1 text-sm text-slate-600">{xConnected ? 'Account identity has been verified.' : 'Reconnect the authenticated X browser before public actions.'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Last run</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{lastRun ? actionSummary(lastRun.actions) : 'No run yet'}</div>
          <p className="mt-1 text-sm text-slate-600">{lastRun ? `${lastRun.status}${lastRun.finishedAt ? ` · ${formatDateTime(lastRun.finishedAt)}` : ''}` : 'Completed Growth Runs will appear here.'}</p>
        </div>
      </div>

      {attention.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Growth attention">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold text-amber-950">Attention</h4>
            <Badge tone="warning">{attention.length}</Badge>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-950">
            {attention.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      )}

      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Diagnostics</summary>
        <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          <p><strong className="text-slate-900">Delegation:</strong> {readiness.permission.state} · {readiness.permission.mode}</p>
          <p><strong className="text-slate-900">Agent runtime:</strong> {readiness.reasoningAgent.attached ? 'attached' : 'detached'}{readiness.reasoningAgent.lastSeenAt ? ` · ${formatDateTime(readiness.reasoningAgent.lastSeenAt)}` : ''}</p>
          <p><strong className="text-slate-900">For You:</strong> {readiness.sensors.xForYou.count} stored · {readiness.sensors.xForYou.fresh ? 'fresh' : 'stale'}</p>
          <p><strong className="text-slate-900">Scheduler:</strong> {schedulerReady ? 'active' : 'inactive'}</p>
          <p><strong className="text-slate-900">Reply budget:</strong> {readiness.permission.autonomousReply.remainingBudget == null ? 'no fixed count limit' : `${readiness.permission.autonomousReply.remainingBudget} remaining`}</p>
          <p><strong className="text-slate-900">X API main-feed transport:</strong> {readiness.transports.xApi.credentialsPresent ? 'credentials present' : 'unavailable · missing access token'}</p>
          <p><strong className="text-slate-900">Publication state:</strong> {verificationInProgress} active · {unresolved} unresolved</p>
          <p><strong className="text-slate-900">Run:</strong> {readiness.reasoningAgent.activeRunId ? `${readiness.reasoningAgent.activeRunStage || 'active'}` : 'none active'}</p>
        </div>
      </details>
    </section>
  )
}
