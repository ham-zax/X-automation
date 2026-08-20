import { useState } from 'react'
import { useRelevanceDecision, type StrategicRelevance } from '../../api/client'
import { Badge } from '../../components/primitives'

const STATE_LABELS: Record<StrategicRelevance['state'], string> = {
  core: 'Core',
  adjacent: 'Adjacent',
  outside: 'Outside current focus',
  unknown: 'Needs refresh',
}

const OBJECTIVE_LABELS: Record<string, string> = {
  qualified_growth: 'Grow relevant followers',
  reach_momentum: 'Maximize reach',
  relationships: 'Build relationships',
  technical_authority: 'Build technical authority',
  balanced: 'Balanced',
}

export function GrowthFitPanel({
  growthFit,
  queueItemId,
  candidateKey,
  readOnly = false,
}: {
  growthFit: StrategicRelevance
  queueItemId?: number | null
  candidateKey?: string
  readOnly?: boolean
}) {
  const decision = useRelevanceDecision()
  const [reason, setReason] = useState('')
  const tone: 'success' | 'info' | 'warning' | 'neutral' = growthFit.state === 'core'
    ? 'success'
    : growthFit.state === 'adjacent'
      ? 'info'
      : growthFit.state === 'outside' ? 'warning' : 'neutral'

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Growth fit</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={tone}>{STATE_LABELS[growthFit.state]}</Badge>
            <span className="text-xs text-slate-500">Goal: {OBJECTIVE_LABELS[growthFit.objective] || growthFit.objective}</span>
            {growthFit.topicScore != null && <span className="text-xs text-slate-500">Classifier evidence {growthFit.topicScore}/50</span>}
          </div>
        </div>
        <a href="#/advanced/niche" className="text-sm font-medium text-sky-700 hover:underline">Review Growth Focus</a>
      </div>

      <p className="mt-2 text-sm text-slate-700">{growthFit.explanation}</p>

      {growthFit.state === 'unknown' && (
        <div className="mt-3 text-xs text-amber-800">This is not being treated as Outside current focus. Refresh candidate classification from Growth Focus before approval.</div>
      )}

      {growthFit.humanOverride && (
        <div className="mt-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900">
          <strong>Human decision: use anyway.</strong> {growthFit.humanOverride.reason}
          {!readOnly && (queueItemId != null || candidateKey) && (
            <button
              type="button"
              onClick={() => decision.mutate({ queueItemId: queueItemId ?? undefined, key: candidateKey, decision: 'clear_override' })}
              disabled={decision.isPending}
              className="ml-2 text-xs font-medium underline disabled:opacity-50"
            >
              Clear decision
            </button>
          )}
        </div>
      )}

      {!readOnly && growthFit.state === 'outside' && !growthFit.humanOverride && (queueItemId != null || candidateKey) && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <label className="block text-sm font-medium text-amber-950">
            Use this opportunity anyway
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Short reason this is worth pursuing"
              className="mt-2 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <button
            type="button"
            onClick={() => decision.mutate({ queueItemId: queueItemId ?? undefined, key: candidateKey, decision: 'use_anyway', reason: reason.trim() })}
            disabled={decision.isPending || !reason.trim()}
            className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 disabled:opacity-50"
          >
            {decision.isPending ? 'Saving decision…' : 'Use this opportunity anyway'}
          </button>
          <div className="mt-1 text-xs text-amber-800">This records a human strategy decision. It does not approve, schedule, publish, or send anything.</div>
        </div>
      )}

      {decision.isError && <div className="mt-2 text-sm text-red-700">{decision.error.message}</div>}
    </section>
  )
}
