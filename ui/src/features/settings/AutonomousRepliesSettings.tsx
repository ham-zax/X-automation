import { useState } from 'react'
import {
  useAutonomousReplies,
  useAutonomousReplyAction,
  type AutonomousReplyData,
  type AutonomousReplyDecision,
} from '../../api/client'
import { Badge, Error, Loading, formatDateTime } from '../../components/primitives'

const LABELS: Record<string, string> = {
  active: 'Active conversations',
  momentum: 'High momentum',
  normal: 'Normal relevant',
  technical_insight: 'Technical insight / implementation detail',
  useful_question: 'Useful question',
  constructive_feedback: 'Constructive feedback',
  caveat_edge_case: 'Caveat / edge case',
  verified_correction: 'Verified correction',
  comparison: 'Comparison',
  synthesis: 'Synthesis',
  resource_pointer: 'Useful resource / pointer',
  social_reaction: 'Lightweight social / playful reaction',
  direct: 'Direct',
  warm: 'Warm',
  conversational: 'Conversational',
  light_humor: 'Light humor',
  dry_wit: 'Dry wit',
}

function label(value: string) {
  return LABELS[value] || value.replaceAll('_', ' ')
}

function executionSummary(decision: AutonomousReplyDecision) {
  const execution = decision.aiExecution || {}
  const runtime = String(execution.runtime || execution.provider || '')
  const model = String(execution.model || execution.modelId || '')
  return [runtime, model].filter(Boolean).join(' · ') || 'No AI execution recorded'
}

function OutcomeGroup({ title, groups }: { title: string; groups: AutonomousReplyData['outcomes']['byIntent'] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-3 space-y-2">
        {groups.length === 0 && <div className="text-sm text-slate-500">No autonomous sends yet.</div>}
        {groups.map((group) => (
          <div key={group.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-700">{label(group.label)}</span>
            <span className="text-slate-500">{group.sent} sent · {group.targetResponses} response · {group.continued} continued</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DecisionCard({ decision }: { decision: AutonomousReplyDecision }) {
  const tone = decision.decision.includes('send') || decision.decision === 'sent'
    ? 'success'
    : decision.decision.includes('review')
      ? 'warning'
      : 'neutral'
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm text-slate-900">@{decision.targetUsername || 'unknown'}</strong>
        <Badge>{label(decision.sourceClass)}</Badge>
        {decision.intent && <Badge>{label(decision.intent)}</Badge>}
        {decision.tone && <Badge>{label(decision.tone)}</Badge>}
        <Badge tone={tone}>{label(decision.decision)}</Badge>
      </div>
      {decision.exactReply && <div className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{decision.exactReply}</div>}
      {decision.reasons.length > 0 && (
        <div className="mt-3 space-y-1 text-xs text-slate-600">
          {decision.reasons.map((reason, index) => <div key={`${reason.code}-${index}`}><strong>{reason.code}</strong> · {reason.reason}</div>)}
        </div>
      )}
      <div className="mt-3 text-xs text-slate-500">
        Grant revision {decision.grantRevision} · {decision.mode === 'dry_run' ? 'dry run' : 'live'} · {executionSummary(decision)} · {formatDateTime(decision.createdAt)}
      </div>
      {decision.outputUrl && <a href={decision.outputUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-medium text-sky-700 hover:underline">Open sent reply ↗</a>}
    </article>
  )
}

function ConfigForm({ data }: { data: AutonomousReplyData }) {
  const configure = useAutonomousReplyAction('configure')
  const [mode, setMode] = useState(data.grant.mode)
  const [sources, setSources] = useState<string[]>(data.grant.allowedSources)
  const [intents, setIntents] = useState<string[]>(data.grant.allowedIntents)
  const [tones, setTones] = useState<string[]>(data.grant.allowedTones)
  const [humorAllowed, setHumorAllowed] = useState(data.grant.humorAllowed)
  const [liveBudget, setLiveBudget] = useState(data.grant.liveBudget == null ? '' : String(data.grant.liveBudget))
  const [refreshMinutes, setRefreshMinutes] = useState(String(data.grant.refreshMinutes))
  const [xApprovalReference, setXApprovalReference] = useState(data.grant.xApprovalReference || '')
  const [optOutMechanism, setOptOutMechanism] = useState(data.grant.optOutMechanism || '')

  const toggle = (value: string, selected: string[], setSelected: (value: string[]) => void) => {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold text-slate-900">Autonomy grant</div>
      <p className="mt-1 text-sm text-slate-600">This grant is reply-specific. It never creates human approval and it does not change main-feed publishing authority.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</label>
          <div className="mt-2 flex gap-2">
            {(['dry_run', 'live'] as const).map((value) => (
              <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-md border px-3 py-2 text-sm ${mode === value ? 'border-slate-900 bg-slate-50 font-medium' : 'border-slate-200 text-slate-600'}`}>
                {value === 'dry_run' ? 'Dry run' : data.policy.liveTransportReady ? 'Live' : 'Live (transport blocked)'}
              </button>
            ))}
          </div>
        </div>

        <label className="text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Refresh cadence</span>
          <div className="mt-2 flex items-center gap-2">
            <input type="number" min={data.options.minRefreshMinutes} step={1} value={refreshMinutes} onChange={(event) => setRefreshMinutes(event.target.value)} className="w-28 rounded-md border border-slate-300 px-2 py-2" />
            <span>minutes</span>
          </div>
          <span className="mt-1 block text-xs text-slate-500">Minimum {data.options.minRefreshMinutes} minutes under the current daemon poll policy.</span>
        </label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</legend>
          <div className="mt-2 space-y-2">
            {data.options.sourceClasses.map((value) => (
              <label key={value} className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={sources.includes(value)} onChange={() => toggle(value, sources, setSources)} className="mt-0.5" />
                <span>{label(value)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reply intents</legend>
          <div className="mt-2 space-y-2">
            {data.options.intents.map((value) => (
              <label key={value} className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={intents.includes(value)} onChange={() => toggle(value, intents, setIntents)} className="mt-0.5" />
                <span>{label(value)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tones</legend>
          <div className="mt-2 space-y-2">
            {data.options.tones.map((value) => (
              <label key={value} className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={tones.includes(value)} onChange={() => toggle(value, tones, setTones)} className="mt-0.5" />
                <span>{label(value)}</span>
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <input type="checkbox" checked={humorAllowed} onChange={(event) => setHumorAllowed(event.target.checked)} className="mt-0.5" />
            <span><strong>Allow humor.</strong> Context safety still overrides this permission.</span>
          </label>
        </fieldset>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live safety budget</span>
          <input type="number" min={1} step={1} value={liveBudget} onChange={(event) => setLiveBudget(event.target.value)} placeholder="Required before Live Start" className="mt-2 w-full rounded-md border border-slate-300 px-2 py-2" />
          <span className="mt-1 block text-xs text-slate-500">Operator safety limit for one Start session. It is not a quota or X algorithm recommendation.</span>
        </label>
        <label className="text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">X AI-reply approval reference</span>
          <input value={xApprovalReference} onChange={(event) => setXApprovalReference(event.target.value)} placeholder="Written approval / developer reference" className="mt-2 w-full rounded-md border border-slate-300 px-2 py-2" />
          <span className="mt-1 block text-xs text-slate-500">Required for Live Start. Recipient opt-in is still checked independently for each interaction.</span>
        </label>
        <label className="text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recipient opt-out mechanism</span>
          <input value={optOutMechanism} onChange={(event) => setOptOutMechanism(event.target.value)} placeholder="Public instruction or campaign mechanism" className="mt-2 w-full rounded-md border border-slate-300 px-2 py-2" />
          <span className="mt-1 block text-xs text-slate-500">Required for Live Start. Record the clear/easy way opted-in recipients can stop automated replies.</span>
        </label>
      </div>

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {data.policy.note}
        {!data.policy.liveTransportReady && (
          <div className="mt-2 text-xs">Current write transport: {data.policy.currentWriteTransport.replaceAll('_', ' ')}. You can configure Live prerequisites now, but Start remains unavailable until an official X API write transport is installed.</div>
        )}
      </div>

      <button
        type="button"
        disabled={configure.isPending}
        onClick={() => configure.mutate({
          mode,
          allowedSources: sources,
          allowedIntents: intents,
          allowedTones: tones,
          humorAllowed,
          liveBudget: liveBudget ? Number(liveBudget) : null,
          refreshMinutes: Number(refreshMinutes),
          xApprovalReference,
          optOutMechanism,
        })}
        className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {configure.isPending ? 'Saving…' : 'Save autonomy grant'}
      </button>
      {configure.isError && <div className="mt-2 text-sm text-red-700">{configure.error.message}</div>}
      {configure.isSuccess && <div className="mt-2 text-sm text-emerald-700">Autonomy grant saved. Revision {configure.data.grant.revision}.</div>}
    </section>
  )
}

export function AutonomousRepliesSettings() {
  const query = useAutonomousReplies()
  const start = useAutonomousReplyAction('start')
  const pause = useAutonomousReplyAction('pause')
  const stop = useAutonomousReplyAction('stop')

  if (query.isLoading) return <Loading message="Loading autonomous replies…" />
  if (query.error) return <Error message={query.error.message} onRetry={() => query.refetch()} />
  if (!query.data) return <Error message="Autonomous reply settings are unavailable." />
  const data = query.data
  const actionError = start.error?.message || pause.error?.message || stop.error?.message || null

  return (
    <div className="space-y-6">
      <div>
        <a href="#/settings" className="text-sm font-medium text-slate-500 hover:text-slate-700">← Settings</a>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Autonomous replies</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Persistent Engage Next evaluation owned by the application daemon. The browser is only the control and observability surface.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><strong className="text-slate-900">Operator state</strong><Badge tone={data.grant.state === 'running' ? 'success' : data.grant.state === 'paused' ? 'warning' : 'neutral'}>{label(data.grant.state)}</Badge><Badge>{data.grant.mode === 'dry_run' ? 'Dry run' : 'Live'}</Badge></div>
            <div className="mt-2 text-sm text-slate-600">Grant revision {data.grant.revision} · budget {data.grant.liveBudget == null ? 'not set' : `${data.grant.budgetUsed}/${data.grant.liveBudget} used`}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => start.mutate({})} disabled={start.isPending || data.grant.state === 'running' || (data.grant.mode === 'live' && !data.policy.liveTransportReady)} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Start</button>
            <button type="button" onClick={() => pause.mutate({})} disabled={pause.isPending || data.grant.state !== 'running'} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-40">Pause</button>
            <button type="button" onClick={() => stop.mutate({})} disabled={stop.isPending || data.grant.state === 'stopped'} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Stop</button>
          </div>
        </div>
        {actionError && <div className="mt-3 text-sm text-red-700">{actionError}</div>}
        {data.grant.mode === 'live' && !data.policy.liveTransportReady && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Live autonomous sending is intentionally blocked until the reply publisher uses the official X API. Switch to Dry run to start the persistent operator now.</div>
        )}
        <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <div><strong className="text-slate-800">Last successful refresh</strong><br />{data.runtime.lastSuccessfulRefreshAt ? formatDateTime(data.runtime.lastSuccessfulRefreshAt) : 'Not yet'}</div>
          <div><strong className="text-slate-800">Next expected evaluation</strong><br />{data.runtime.nextExpectedRefreshAt ? formatDateTime(data.runtime.nextExpectedRefreshAt) : data.grant.state === 'running' ? 'Next daemon cycle' : 'Not running'}</div>
          <div><strong className="text-slate-800">Last cycle</strong><br />{data.runtime.lastDecisionCounts.sent} send candidate · {data.runtime.lastDecisionCounts.review} review · {data.runtime.lastDecisionCounts.skipped} skipped</div>
        </div>
        {data.runtime.lastError && <div className="mt-3 text-sm text-amber-800">Last refresh had partial source errors: {data.runtime.lastError}</div>}
      </section>

      <ConfigForm key={data.grant.revision} data={data} />

      <section>
        <h3 className="text-lg font-semibold text-slate-900">Recent autonomous decisions</h3>
        <p className="mt-1 text-sm text-slate-600">Exact proposed/sent text, intent, tone, decision reason, grant revision, and AI execution remain inspectable without storing private chain-of-thought.</p>
        <div className="mt-3 space-y-3">
          {data.recentDecisions.length === 0 && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No autonomous decisions recorded yet.</div>}
          {data.recentDecisions.slice(0, 25).map((decision) => <DecisionCard key={decision.id} decision={decision} />)}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-slate-900">Descriptive outcomes</h3>
        <p className="mt-1 text-sm text-slate-600">{data.outcomes.note}</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <OutcomeGroup title="Reply intent" groups={data.outcomes.byIntent} />
          <OutcomeGroup title="Tone" groups={data.outcomes.byTone} />
          <OutcomeGroup title="Source class" groups={data.outcomes.bySourceClass} />
          <OutcomeGroup title="Relationship stage" groups={data.outcomes.byRelationshipStage} />
        </div>
      </section>
    </div>
  )
}
