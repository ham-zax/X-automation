import { useState } from 'react'
import { useRelevanceDecision, type StrategicRelevance } from '../../api/client'
import { Badge, Disclosure, Notice } from '../../components/primitives'

const STATE_LABELS: Record<StrategicRelevance['state'], string> = {
  core: 'Preferred niche',
  adjacent: 'Adjacent niche',
  exploratory: 'Emerging tech',
  outside: 'Outside scope',
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
    : ['adjacent', 'exploratory'].includes(growthFit.state)
      ? 'info'
      : growthFit.state === 'outside' ? 'warning' : 'neutral'

  return (
    <section className="growth-fit-compact">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Growth fit</span>
          <Badge tone={tone}>{STATE_LABELS[growthFit.state]}</Badge>
          {growthFit.topicScore != null && <span className="text-xs tabular-nums text-slate-500">evidence {growthFit.topicScore}/50</span>}
        </div>
        <Disclosure summary="Why?" className="compact-disclosure">
          <div className="max-w-3xl space-y-2 text-sm text-slate-600">
            <p>{growthFit.explanation}</p>
            <div className="text-xs text-slate-500">Goal: {OBJECTIVE_LABELS[growthFit.objective] || growthFit.objective}</div>
            {growthFit.state === 'unknown' && <p className="text-xs text-amber-800">Refresh candidate classification from Growth Focus before approval.</p>}
            {growthFit.state === 'exploratory' && <p className="text-xs text-cyan-800">Allowed inside the broader configured technical universe without permanently adding a niche.</p>}
            <a href="#/settings/growth-focus" className="inline-block text-xs font-semibold text-indigo-700 hover:underline">Review Growth Focus →</a>
          </div>
        </Disclosure>
      </div>

      {growthFit.humanOverride && (
        <div className="mt-2">
          <Notice tone="warning" title="Human decision: use anyway">
            {growthFit.humanOverride.reason}
            {!readOnly && (queueItemId != null || candidateKey) && (
              <button
                type="button"
                onClick={() => decision.mutate({ queueItemId: queueItemId ?? undefined, key: candidateKey, decision: 'clear_override' })}
                disabled={decision.isPending}
                className="action-button ml-2 !min-h-0 !px-2 !py-1 text-xs"
                data-variant="ghost"
              >
                Clear decision
              </button>
            )}
          </Notice>
        </div>
      )}

      {!readOnly && growthFit.state === 'outside' && !growthFit.humanOverride && (queueItemId != null || candidateKey) && (
        <div className="mt-2">
          <Notice tone="warning" title="Outside current Growth Focus">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                Reason to use anyway
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Short reason"
                  className="mt-1 w-full px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => decision.mutate({ queueItemId: queueItemId ?? undefined, key: candidateKey, decision: 'use_anyway', reason: reason.trim() })}
                disabled={decision.isPending || !reason.trim()}
                className="action-button"
                data-variant="secondary"
              >
                {decision.isPending ? 'Saving…' : 'Use anyway'}
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500">Records a Growth Focus decision only; it does not approve or publish.</div>
          </Notice>
        </div>
      )}

      {decision.isError && <div className="mt-2 text-xs text-red-700">{decision.error.message}</div>}
    </section>
  )
}
