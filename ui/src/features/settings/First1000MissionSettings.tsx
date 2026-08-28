import { useState } from 'react'
import {
  useFirst1000Mission,
  useFirst1000MissionAction,
  type First1000MissionData,
} from '../../api/client'
import { Badge, Error, Loading, formatDateTime } from '../../components/primitives'

function timestamp(value: number | null) {
  return value ? formatDateTime(value) : 'Not recorded'
}

function ConfigForm({ data }: { data: First1000MissionData }) {
  const configure = useFirst1000MissionAction('configure')
  const [mode, setMode] = useState(data.grant.mode)
  const [targetFollowers, setTargetFollowers] = useState(String(data.grant.targetFollowers))

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold text-slate-900">Mission grant configuration</div>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Configure the delegated mission grant itself. Saving a material change increments the grant revision, so older mission-agent approvals cannot be claimed under the new authority revision.
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
            Dry run does not authorize mission-agent approvals. Live can authorize eligible approvals only while the mission is Running.
          </p>
        </div>

        <label className="text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target followers</span>
          <input
            type="number"
            min={1}
            step={1}
            value={targetFollowers}
            onChange={(event) => setTargetFollowers(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-slate-500">Default First-1,000 target is 1,000. The grant owner validates positive whole numbers.</span>
        </label>
      </div>

      <button
        type="button"
        disabled={configure.isPending}
        onClick={() => configure.mutate({ mode, targetFollowers: Number(targetFollowers) })}
        className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {configure.isPending ? 'Saving…' : 'Save mission grant'}
      </button>
      {configure.isError && <div className="mt-2 text-sm text-red-700">{configure.error.message}</div>}
      {configure.isSuccess && <div className="mt-2 text-sm text-emerald-700">Mission grant saved. Revision {configure.data.grant.revision}.</div>}
    </section>
  )
}

export function First1000MissionSettings() {
  const query = useFirst1000Mission()
  const start = useFirst1000MissionAction('start')
  const pause = useFirst1000MissionAction('pause')
  const stop = useFirst1000MissionAction('stop')

  if (query.isLoading) return <Loading message="Loading First-1,000 mission…" />
  if (query.error) return <Error message={query.error.message} onRetry={() => query.refetch()} />
  if (!query.data) return <Error message="First-1,000 mission settings are unavailable." />

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
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">First-1,000 mission</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Human control of the revisioned First-1,000 main-feed mission grant. This screen controls delegated approval authority; publication transport remains a separate setting.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-slate-900">Mission state</strong>
              <Badge tone={stateTone}>{grant.state.replaceAll('_', ' ')}</Badge>
              <Badge tone={grant.mode === 'live' ? 'info' : 'neutral'}>{grant.mode === 'live' ? 'Live' : 'Dry run'}</Badge>
            </div>
            <div className="mt-2 text-sm text-slate-600">Target {grant.targetFollowers.toLocaleString()} followers · grant revision {grant.revision}</div>
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
        {actionSucceeded && <div className="mt-3 text-sm text-emerald-700">Mission state updated. Current revision {grant.revision}.</div>}

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
            <strong className="text-sky-950">Delegated approval authority</strong>
            <Badge tone={liveAuthorityActive ? 'success' : 'neutral'}>{liveAuthorityActive ? 'Active' : 'Not active'}</Badge>
          </div>
          <p className="mt-2 text-sm text-sky-900">
            Live + Running lets the mission agent approve eligible automated main-feed Originals, Quotes, and Threads under this exact grant revision. Starting or resuming the mission does not approve any draft.
          </p>
          <p className="mt-2 text-xs text-sky-800">Replies and Repost are outside this grant. Existing human approval remains a separate unchanged path.</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-slate-900">AUTO_POST publication transport</strong>
            <Badge tone={data.autoPost ? 'success' : 'neutral'}>{data.autoPost ? 'On' : 'Off'}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            AUTO_POST is separate from this mission grant. It controls whether the existing main-feed publication automation may publish already-approved work. Mission Start, Resume, Pause, and Stop never change AUTO_POST.
          </p>
          <p className="mt-2 text-xs text-slate-500">Live delegated authority does not publish by itself, even when the mission is Running.</p>
        </section>
      </div>

      <ConfigForm key={grant.revision} data={data} />
    </div>
  )
}
