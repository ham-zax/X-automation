import { useState } from 'react'
import {
  useGrowthOperator,
  useGrowthOperatorAction,
  type GrowthOperatorData,
} from '../../api/client'
import { Badge, Error, Loading, formatDateTime } from '../../components/primitives'

function timestamp(value: number | null) {
  return value ? formatDateTime(value) : 'Not recorded'
}

function ReadinessCell({ label, ready, warning = false, value, detail }: {
  label: string
  ready: boolean
  warning?: boolean
  value: string
  detail: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${ready ? 'bg-emerald-500' : warning ? 'bg-amber-500' : 'bg-slate-300'}`} />
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
    </div>
  )
}

function ConfigForm({ data }: { data: GrowthOperatorData }) {
  const configure = useGrowthOperatorAction('configure')
  const [mode, setMode] = useState(data.grant.mode)
  const [milestones, setMilestones] = useState(data.grant.milestones.join(', '))

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold text-slate-900">Delegation configuration</div>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Configure the owner delegation itself. Saving a material change increments the delegation revision, so older mission-agent approvals cannot be claimed under a new authority revision.
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['dry_run', 'live'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-md border px-3 py-2 text-sm ${mode === value ? 'border-slate-900 bg-slate-50 font-medium text-slate-900' : 'border-slate-200 text-slate-600'}`}
              >
                {value === 'dry_run' ? 'Dry run' : 'Live delegated authority'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Dry run preserves planning/measurement without mission-agent approval authority. Live enables bounded agent execution only while the delegation is Running.
          </p>
        </div>

        <label className="text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Growth milestones</span>
          <input
            type="text"
            value={milestones}
            onChange={(event) => setMilestones(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="1000, 10000, 100000"
          />
          <span className="mt-1 block text-xs text-slate-500">Milestones are observational goals for progress/strategy shifts. Reaching one does not revoke delegation or stop the agent.</span>
        </label>
      </div>

      <button
        type="button"
        disabled={configure.isPending}
        onClick={() => configure.mutate({
          mode,
          milestones: milestones.split(',').map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0),
        })}
        className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {configure.isPending ? 'Saving…' : 'Save delegation'}
      </button>
      {configure.isError && <div className="mt-2 text-sm text-red-700">{configure.error.message}</div>}
      {configure.isSuccess && <div className="mt-2 text-sm text-emerald-700">Delegation saved. Revision {configure.data.grant.revision}.</div>}
    </section>
  )
}

export function GrowthOperatorSettings() {
  const query = useGrowthOperator()
  const start = useGrowthOperatorAction('start')
  const pause = useGrowthOperatorAction('pause')
  const stop = useGrowthOperatorAction('stop')

  if (query.isLoading) return <Loading message="Loading Growth Operator delegation…" />
  if (query.error) return <Error message={query.error.message} onRetry={() => query.refetch()} />
  if (!query.data) return <Error message="Growth Operator settings are unavailable." />

  const data = query.data
  const grant = data.grant
  const actionError = start.error?.message || pause.error?.message || stop.error?.message || null
  const actionSucceeded = start.isSuccess || pause.isSuccess || stop.isSuccess
  const stateTone = grant.state === 'running' ? 'success' : grant.state === 'paused' ? 'warning' : grant.state === 'completed' ? 'info' : 'neutral'
  const liveAuthorityActive = grant.state === 'running' && grant.mode === 'live'
  const readiness = data.readiness
  const browserReady = readiness.transports.browserAgent.runtimeAttached
    && readiness.transports.browserAgent.browserMutation
    && readiness.transports.browserAgent.xAuthenticated
    && readiness.transports.browserAgent.accountVerified
  const forYouReady = readiness.sensors.xForYou.fresh && readiness.sensors.xForYou.authenticatedAccountVerified
  const reconciliationClear = readiness.reconciliation.activeCount === 0
  const schedulerReady = readiness.scheduler.growthAgent.configured && readiness.scheduler.growthAgent.enabled

  return (
    <div className="space-y-6">
      <div>
        <a href="#/settings" className="text-sm font-medium text-slate-500 hover:text-slate-700">← Settings</a>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Growth Operator</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Owner control of the revisioned delegation. Start once, then the agent may execute bounded growth work without per-action approval ceremonies. Publication transport and external platform policy remain separate gates.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-slate-900">Delegation state</strong>
              <Badge tone={stateTone}>{grant.state.replaceAll('_', ' ')}</Badge>
              <Badge tone={grant.mode === 'live' ? 'info' : 'neutral'}>{grant.mode === 'live' ? 'Live' : 'Dry run'}</Badge>
            </div>
            <div className="mt-2 text-sm text-slate-600">Milestones {grant.milestones.map((value) => value.toLocaleString()).join(' → ')} · delegation revision {grant.revision}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => start.mutate({})}
              disabled={start.isPending || grant.state === 'running'}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {start.isPending ? 'Starting…' : grant.state === 'paused' ? 'Resume' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => pause.mutate({})}
              disabled={pause.isPending || grant.state !== 'running'}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-40"
            >
              {pause.isPending ? 'Pausing…' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={() => stop.mutate({})}
              disabled={stop.isPending || grant.state === 'stopped' || grant.state === 'completed'}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              {stop.isPending ? 'Stopping…' : 'Stop'}
            </button>
          </div>
        </div>

        {actionError && <div className="mt-3 text-sm text-red-700">{actionError}</div>}
        {actionSucceeded && <div className="mt-3 text-sm text-emerald-700">Delegation state updated. Current revision {grant.revision}.</div>}

        <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2 lg:grid-cols-5">
          <div><strong className="text-slate-800">Started</strong><br />{timestamp(grant.startedAt)}</div>
          <div><strong className="text-slate-800">Paused</strong><br />{timestamp(grant.pausedAt)}</div>
          <div><strong className="text-slate-800">Stopped</strong><br />{timestamp(grant.stoppedAt)}</div>
          <div><strong className="text-slate-800">Completed</strong><br />{timestamp(grant.completedAt)}</div>
          <div><strong className="text-slate-800">Last changed</strong><br />{timestamp(grant.updatedAt)}</div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Operational readiness</div>
            <p className="mt-1 text-sm text-slate-600">Permission is only the first gate. These are the live dependencies required to keep a Growth Run moving.</p>
          </div>
          <span className="text-xs text-slate-500">Observed {formatDateTime(readiness.generatedAt)}</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <ReadinessCell
            label="Permission"
            ready={readiness.permission.live}
            value={readiness.permission.live ? 'Live' : `${readiness.permission.state}`}
            detail={`Delegation rev ${readiness.permission.revision}`}
          />
          <ReadinessCell
            label="Agent"
            ready={readiness.reasoningAgent.attached}
            value={readiness.reasoningAgent.attached ? 'Attached' : 'Not attached'}
            detail={readiness.reasoningAgent.attached ? `${readiness.reasoningAgent.adapterType || 'agent'} · ${readiness.reasoningAgent.activeRunStage || 'idle'}` : 'No recent runtime heartbeat'}
          />
          <ReadinessCell
            label="Browser"
            ready={browserReady}
            value={browserReady ? 'Ready' : 'Not ready'}
            detail={browserReady ? `@${readiness.transports.browserAgent.accountObserved}` : 'Read, mutation, auth, or account check missing'}
          />
          <ReadinessCell
            label="For You"
            ready={forYouReady}
            warning={!forYouReady}
            value={forYouReady ? `${readiness.sensors.xForYou.count} fresh` : 'Refresh needed'}
            detail={readiness.sensors.xForYou.fetchedAt ? timestamp(readiness.sensors.xForYou.fetchedAt) : 'No verified snapshot'}
          />
          <ReadinessCell
            label="Reconcile"
            ready={reconciliationClear}
            warning={!reconciliationClear}
            value={reconciliationClear ? 'Clear' : `${readiness.reconciliation.activeCount} active`}
            detail={readiness.reconciliation.closedUnresolvedCount ? `${readiness.reconciliation.closedUnresolvedCount} historical unresolved · fenced` : 'No uncertain writes'}
          />
          <ReadinessCell
            label="Scheduler"
            ready={schedulerReady}
            warning={!schedulerReady}
            value={schedulerReady ? 'Active' : 'Not active'}
            detail={readiness.scheduler.growthAgent.nextInvocationAt ? `Next ${timestamp(readiness.scheduler.growthAgent.nextInvocationAt)}` : 'No unattended wake scheduled'}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span>Background API daemon: {readiness.scheduler.backgroundAutomation.stale ? 'stale' : 'healthy'}</span>
          <span>Account health: {readiness.accountHealth.state}</span>
          {readiness.reasoningAgent.activeRunId && <span>Run {readiness.reasoningAgent.activeRunId.slice(0, 8)}…</span>}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sky-950">Delegated operator authority</strong>
            <Badge tone={liveAuthorityActive ? 'success' : 'neutral'}>{liveAuthorityActive ? 'Active' : 'Not active'}</Badge>
          </div>
          <p className="mt-2 text-sm text-sky-900">
            Live + Running lets the Growth Operator select, prepare, and approve eligible bounded work under this exact delegation revision. Individual content still must pass its own evidence, provenance, and deterministic gates.
          </p>
          <p className="mt-2 text-xs text-sky-800">The agent cannot start or restore delegation after the owner pauses/stops it. X mutation remains transport/policy-gated independently.</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-slate-900">Publication transports</strong>
            <Badge tone={browserReady ? 'success' : 'neutral'}>{browserReady ? 'Browser ready' : 'Browser unavailable'}</Badge>
            <Badge tone={readiness.transports.xApi.credentialsPresent ? 'info' : 'neutral'}>{readiness.transports.xApi.credentialsPresent ? 'X API configured' : 'X API unavailable'}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            AUTO_POST is {data.autoPost ? 'configured' : 'off'}, but that flag is not publication readiness. Browser and X API capability are checked independently at the point of action.
          </p>
          <p className="mt-2 text-xs text-slate-500">Live delegation never bypasses exact-content gates, attempt identity, account-health constraints, or structural reconciliation.</p>
        </section>
      </div>

      <ConfigForm key={grant.revision} data={data} />
    </div>
  )
}
