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
            <strong className="text-slate-900">AUTO_POST publication transport</strong>
            <Badge tone={data.autoPost ? 'success' : 'neutral'}>{data.autoPost ? 'On' : 'Off'}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            AUTO_POST is separate from delegation. It requests publication of already-approved work only when a compliant mutation transport exists. Delegation Start, Resume, Pause, and Stop never change AUTO_POST.
          </p>
          <p className="mt-2 text-xs text-slate-500">Live delegation never bypasses content gates, queue identity, account-health constraints, or external platform requirements.</p>
        </section>
      </div>

      <ConfigForm key={grant.revision} data={data} />
    </div>
  )
}
