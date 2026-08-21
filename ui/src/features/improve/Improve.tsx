import { useMemo, useState } from 'react'
import {
  useImprove,
  useLearningAction,
  useSession,
  useTestAction,
  useTestCreate,
  type LearnedRuleView,
  type TestView,
} from '../../api/client'
import {
  Badge,
  Disclosure,
  Error,
  Loading,
  Pending,
  StatCard,
  TechnicalDetails,
} from '../../components/primitives'

const NETWORK_DIMENSIONS = new Set([
  'target_class', 'target_score_bucket', 'target_size_bucket', 'reply_age_bucket', 'conversation_saturation_bucket',
  'reply_archetype', 'relationship_stage', 'interaction_volume_bucket', 'target_concentration_bucket', 'archetype_repetition_bucket',
])

const WINDOWS = [
  ['15', '15 minutes'],
  ['60', '1 hour'],
  ['360', '6 hours'],
  ['1440', '24 hours'],
] as const

function CreateTestForm() {
  const session = useSession()
  const create = useTestCreate()
  const labels = session.data?.labels
  const dimensions = labels?.dimensionGroups
  const metrics = labels?.metricsByKind

  const [name, setName] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [dimension, setDimension] = useState('format')
  const [variantA, setVariantA] = useState('')
  const [variantB, setVariantB] = useState('')
  const [primaryMetric, setPrimaryMetric] = useState('views_per_hour')
  const [status, setStatus] = useState('draft')
  const [populationJson, setPopulationJson] = useState('{}')
  const [secondaryMetrics, setSecondaryMetrics] = useState('')
  const [minimum, setMinimum] = useState('5')

  const isNetwork = NETWORK_DIMENSIONS.has(dimension)
  const contentDimensions = dimensions?.content || []
  const networkDimensionList = dimensions?.network || []
  const metricOptions = isNetwork ? metrics?.network || [] : metrics?.content || []
  const dimensionLabel = (value: string) => labels?.dimensions?.[value] || value
  const metricLabel = (value: string) => labels?.metrics?.[value] || value

  const submit = () => {
    if (populationInvalid) return
    create.mutate({
      name,
      hypothesis,
      dimension,
      variantA,
      variantB,
      primaryMetric,
      status,
      population: JSON.parse(populationJson || '{}') as Record<string, unknown>,
      secondaryMetrics: secondaryMetrics.split(',').map((value) => value.trim()).filter(Boolean),
      minimumCompletedPerVariant: Number(minimum) || 5,
    }, {
      onSuccess: () => {
        setName(''); setHypothesis(''); setVariantA(''); setVariantB('')
      },
    })
  }

  const populationInvalid = (() => {
    try { JSON.parse(populationJson || '{}'); return false } catch { return true }
  })()

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900">Tests</h3>
      <p className="text-sm text-slate-600">Compare one choice at a time. Creating a test does not assign, approve, schedule, or publish anything.</p>
      <form
        className="mt-4 grid gap-3 md:grid-cols-2"
        onSubmit={(event) => { event.preventDefault(); submit() }}
      >
        <label className="text-sm text-slate-700">
          Test name
          <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Reply style: detail vs question" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm text-slate-700">
          What are you changing?
          <select value={dimension} onChange={(event) => setDimension(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <optgroup label="Content">
              {contentDimensions.map((value) => <option key={value} value={value}>{dimensionLabel(value)}</option>)}
            </optgroup>
            <optgroup label="Conversations & relationships">
              {networkDimensionList.map((value) => <option key={value} value={value}>{dimensionLabel(value)}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="text-sm text-slate-700 md:col-span-2">
          What do you want to learn?
          <input required value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} placeholder="Detail-first replies may continue more conversations." className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm text-slate-700">
          Option A
          <input required value={variantA} onChange={(event) => setVariantA(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm text-slate-700">
          Option B
          <input required value={variantB} onChange={(event) => setVariantB(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm text-slate-700">
          Success looks like
          <select value={primaryMetric} onChange={(event) => setPrimaryMetric(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {metricOptions.map((value) => <option key={value} value={value}>{metricLabel(value)}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Test state
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="draft">Draft — set up only</option>
            <option value="active">Active — ready for explicit assignments</option>
          </select>
        </label>
        <Disclosure summary="Advanced setup" className="md:col-span-2">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              Applies when (population JSON)
              <input value={populationJson} onChange={(event) => setPopulationJson(event.target.value)} className={`mt-1 w-full rounded-md border px-2 py-1.5 text-sm font-mono ${populationInvalid ? 'border-red-400' : 'border-slate-300'}`} />
            </label>
            <label className="text-sm text-slate-700">
              Secondary metrics (comma-separated)
              <input value={secondaryMetrics} onChange={(event) => setSecondaryMetrics(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-sm text-slate-700">
              Minimum completed / option
              <input type="number" min={1} value={minimum} onChange={(event) => setMinimum(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
          </div>
        </Disclosure>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={create.isPending || populationInvalid}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create test'}
          </button>
          <div className="mt-2 text-xs text-slate-500">
            Creation and assignment are explicit. The system does not randomize variants or create duplicate/near-duplicate A/B posts.
          </div>
        </div>
      </form>
      {create.isError && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{create.error.message}</div>
      )}
    </div>
  )
}

function TestCard({ test }: { test: TestView }) {
  const statusAction = useTestAction('status')
  const assignAction = useTestAction('assign')
  const [assignKey, setAssignKey] = useState(test.assignableItems[0]?.key || '')
  const [assignVariant, setAssignVariant] = useState(test.variants[0] || '')
  const [timingConfirmed, setTimingConfirmed] = useState(false)
  const isTiming = test.dimension === 'timing_bucket'

  const evidenceBadges = test.summaries
    .filter((entry) => entry.summary?.evidence)
    .map((entry) => `${entry.label} · ${entry.summary?.evidence?.label}`)

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{test.name}</h4>
          <div className="text-xs text-slate-500">
            Testing {test.dimensionLabel} · success measured by {test.primaryMetricLabel}
          </div>
        </div>
        <Badge tone={test.status === 'active' ? 'success' : test.status === 'completed' ? 'neutral' : 'warning'}>{test.status}</Badge>
      </div>

      <p className="mt-3 text-sm text-slate-700">{test.hypothesis}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {evidenceBadges.length > 0
          ? evidenceBadges.map((badge) => <Badge key={badge} tone="info">{badge}</Badge>)
          : <Badge>Not enough evidence yet</Badge>}
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {test.assignments.length} item{test.assignments.length === 1 ? '' : 's'} assigned. No automatic winner or causal claim is produced.
      </div>

      {test.status === 'draft' && (
        <div className="mt-3">
          <button
            onClick={() => statusAction.mutate({ id: test.id, status: 'active' })}
            disabled={statusAction.isPending}
            className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
          >
            {statusAction.isPending ? 'Activating…' : 'Activate test'}
          </button>
          <span className="ml-2 text-xs text-slate-500">Draft tests cannot be assigned until activated.</span>
        </div>
      )}

      {test.status === 'active' && test.assignableItems.length > 0 && (
        <form
          className="mt-3 grid gap-2 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault()
            assignAction.mutate({ id: test.id, key: assignKey, variant: assignVariant, timingHistorySufficient: timingConfirmed })
          }}
        >
          <label className="text-sm text-slate-700">
            Use this test on
            <select value={assignKey} onChange={(event) => setAssignKey(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {test.assignableItems.map((item) => (
                <option key={item.key} value={item.key}>{item.label} · {item.statusLabel}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Use option
            <select value={assignVariant} onChange={(event) => setAssignVariant(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {test.variants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={assignAction.isPending}
              className="w-full rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
            >
              {assignAction.isPending ? 'Assigning…' : 'Assign option'}
            </button>
          </div>
          {isTiming && (
            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-3">
              <input type="checkbox" checked={timingConfirmed} onChange={(event) => setTimingConfirmed(event.target.checked)} />
              I have enough prior timing history to use this timing test.
            </label>
          )}
          <div className="text-xs text-slate-500 md:col-span-3">
            Assignment is explicit — you choose the option. Nothing is randomized and no extra post is created for the test.
          </div>
        </form>
      )}

      {test.status === 'active' && test.assignableItems.length === 0 && (
        <div className="mt-3 text-sm text-slate-500">No unassigned pre-review items are available for this test.</div>
      )}

      {test.status === 'completed' && (
        <div className="mt-3 text-sm text-slate-500">This test is complete and cannot receive new assignments.</div>
      )}

      {test.status === 'active' && (
        <button
          onClick={() => { if (window.confirm('Complete this test? It will stop accepting new assignments.')) statusAction.mutate({ id: test.id, status: 'completed' }) }}
          disabled={statusAction.isPending}
          className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Complete test
        </button>
      )}

      {(statusAction.isError || assignAction.isError) && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {statusAction.error?.message}
          {assignAction.error?.message}
        </div>
      )}

      <Disclosure summary="Technical evidence and exact configuration">
        <div className="text-xs text-slate-600">
          Dimension <code>{test.dimension}</code> · metric <code>{test.primaryMetric}</code> · population <code>{JSON.stringify(test.population)}</code> · minimum {test.minimumCompletedPerVariant}/option
        </div>
        <div className="mt-2 space-y-2">
          {test.summaries.map((entry) => entry.summary ? (
            <div key={entry.label} className="rounded-md border border-slate-200 p-2">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-xs text-slate-800">{entry.label}</strong>
                <Badge tone={entry.summary.evidence?.state === 'repeated' ? 'success' : entry.summary.evidence?.state === 'directional' ? 'info' : 'neutral'}>
                  {entry.summary.evidence?.label || 'insufficient'}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {entry.summary.primaryMetricLabel} · {Object.entries(entry.summary.primaryMetricValues).map(([variant, value]) => `${variant}: ${value == null ? 'n/a' : value}`).join(' · ') || 'no completed observations'}
              </div>
              <div className="mt-1 text-xs text-slate-500">Samples: {JSON.stringify(entry.summary.completedByVariant)}. No automatic winner/causal label.</div>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-slate-500">Confounders &amp; health/network context</summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-slate-600">{JSON.stringify(entry.summary.cohorts, null, 2)}</pre>
              </details>
            </div>
          ) : null)}
          {test.assignments.length > 0 && (
            <div className="rounded-md border border-slate-200 p-2">
              <div className="text-xs font-semibold text-slate-800">Assignments</div>
              <ul className="mt-1 space-y-1 text-xs text-slate-600">
                {test.assignments.map((assignment, index) => (
                  <li key={index}>
                    {assignment.candidateKey} → {assignment.variantLabel} · {assignment.lane}/{assignment.pipeline} · {assignment.statusLabel}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Disclosure>
    </article>
  )
}

function LearnedRuleCard({ rule }: { rule: LearnedRuleView }) {
  const accept = useLearningAction('accept')
  const retire = useLearningAction('retire')
  const [retireReason, setRetireReason] = useState('')

  const adjustmentAmount = rule.status === 'accepted'
    ? Number(rule.adjustment.effective || 0)
    : Number(rule.adjustment.proposed || 0)
  const changeCopy = adjustmentAmount === 0
    ? 'No production priority changes yet.'
    : `Future matching recommendations may adjust ${String(rule.adjustment.target || 'recommendations').replaceAll('_', ' ')} by ${adjustmentAmount >= 0 ? '+' : ''}${adjustmentAmount}, within the existing bound.`

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {rule.status === 'suggested' ? 'We noticed something' : rule.status === 'accepted' ? 'Accepted change' : 'Past learning'}
          </div>
          <h4 className="mt-1 text-lg font-semibold text-slate-900">{rule.finding || rule.key || 'Observed pattern'}</h4>
          <div className="text-xs text-slate-500">
            {rule.evidence.label} · {rule.evidence.sampleSize || 0} example{Number(rule.evidence.sampleSize || 0) === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={rule.status === 'accepted' ? 'success' : rule.status === 'retired' ? 'neutral' : 'info'}>{rule.statusLabel}</Badge>
          {rule.review.reviewRequired && <Badge tone="warning">Needs review</Badge>}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {rule.status === 'suggested' ? 'Suggested change' : 'What this changes'}
        </div>
        <div className="font-medium text-slate-900">{rule.recommendation || 'Keep watching this pattern.'}</div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {rule.status === 'suggested' ? 'What will change if accepted' : 'What this changes'}
        </div>
        <div className="text-sm text-slate-800">{changeCopy}</div>
        <div className="mt-2 text-xs text-slate-500">
          This never sends content, bypasses approval, ignores expiry, or overrides a manual route/schedule.
        </div>
      </div>

      {rule.review.reasons?.length ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Review before relying on this change.</strong>
          <ul className="mb-0 mt-1 list-disc space-y-1 pl-5">
            {rule.review.reasons.map((reason, index) => <li key={index}><strong>{reason.code}</strong> — {reason.message}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        {rule.status === 'suggested' ? (
          rule.acceptance?.eligible ? (
            accept.isPending ? (
              <Pending label="Accepting…" />
            ) : (
              <button
                onClick={() => accept.mutate({ id: rule.id })}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Accept change
              </button>
            )
          ) : (
            <div className="text-sm text-slate-500">More evidence is required before this suggestion can affect recommendations.</div>
          )
        ) : rule.status === 'accepted' ? (
          <Disclosure summary="Manage accepted change">
            <div className="flex gap-2">
              <input
                value={retireReason}
                onChange={(event) => setRetireReason(event.target.value)}
                placeholder="Why are you retiring it?"
                className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <button
                onClick={() => retire.mutate({ id: rule.id, reason: retireReason })}
                disabled={retire.isPending}
                className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {retire.isPending ? 'Retiring…' : 'Retire change'}
              </button>
            </div>
          </Disclosure>
        ) : (
          <div className="text-sm text-slate-500">This learning is kept for history and has zero production effect.</div>
        )}
      </div>

      {(accept.isError || retire.isError) && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {accept.error?.message}
          {retire.error?.message}
        </div>
      )}

      <Disclosure summary="Why?">
        <div className="text-sm text-slate-700">
          <div><strong>Measured:</strong> {rule.primaryMetricLabel || 'unknown'}</div>
          <div>
            <strong>Comparison:</strong> {rule.comparison.baselineLabel || 'baseline'} {rule.comparison.baselineValue ?? 'n/a'} → {rule.comparison.comparisonLabel || 'comparison'} {rule.comparison.comparisonValue ?? 'n/a'}
          </div>
          <div><strong>Evidence state:</strong> {rule.evidence.label}</div>
          <div><strong>Mechanism tags:</strong> {rule.mechanismTags.length ? rule.mechanismTags.join(', ') : 'none'}</div>
        </div>
        <TechnicalDetails>
          <div>Scope <code>{rule.scope}</code> · key <code>{rule.key}</code> · match <code>{JSON.stringify(rule.match)}</code></div>
        </TechnicalDetails>
      </Disclosure>
    </article>
  )
}

function RefreshSuggestionForms({ tests }: { tests: TestView[] }) {
  const refresh = useLearningAction('refresh')
  const eligible = tests.filter((test) => test.variants.length >= 2)
  const [selection, setSelection] = useState<Record<number, { baseline: string; comparison: string; window: string }>>({})

  if (eligible.length === 0) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">No test with at least two options is available yet.</div>
  }

  return (
    <div className="space-y-3">
      {eligible.map((test) => {
        const current = selection[test.id] || {
          baseline: test.variants[0],
          comparison: test.variants[1],
          window: '60',
        }
        const isNetwork = test.isNetwork
        return (
          <form
            key={test.id}
            className="rounded-lg border border-slate-200 bg-white p-4"
            onSubmit={(event) => {
              event.preventDefault()
              refresh.mutate({
                experimentId: test.id,
                baselineLabel: current.baseline,
                comparisonLabel: current.comparison,
                ...(!isNetwork ? { windowMinutes: Number(current.window) } : {}),
              })
            }}
          >
            <div className="font-semibold text-slate-900">{test.name}</div>
            <div className="mb-2 text-xs text-slate-500">
              Look for a pattern in {test.primaryMetricLabel}. This creates a suggestion only; it changes nothing until you accept it.
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <label className="text-sm text-slate-700">
                Compare
                <select
                  value={current.baseline}
                  onChange={(event) => setSelection((prev) => ({ ...prev, [test.id]: { ...current, baseline: event.target.value } }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {test.variants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Against
                <select
                  value={current.comparison}
                  onChange={(event) => setSelection((prev) => ({ ...prev, [test.id]: { ...current, comparison: event.target.value } }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {test.variants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
                </select>
              </label>
              {!isNetwork && (
                <label className="text-sm text-slate-700">
                  Measurement point
                  <select
                    value={current.window}
                    onChange={(event) => setSelection((prev) => ({ ...prev, [test.id]: { ...current, window: event.target.value } }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    {WINDOWS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              )}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={refresh.isPending}
                  className="w-full rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                >
                  {refresh.isPending ? 'Checking…' : 'Check for a pattern'}
                </button>
              </div>
            </div>
          </form>
        )
      })}
      {refresh.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{refresh.error.message}</div>
      )}
      {refresh.isSuccess && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {(refresh.data as { created?: boolean })?.created
            ? 'A new suggested change is ready for review below.'
            : 'No new pattern qualified from the current evidence.'}
        </div>
      )}
    </div>
  )
}

type ImproveView = 'all' | 'tests' | 'learning'

export function Improve({ embedded = false, view = 'all' }: { embedded?: boolean; view?: ImproveView } = {}) {
  const { data, isLoading, error, refetch } = useImprove()
  const decisionRule = useMemo(() => {
    if (!data) return null
    const suggested = data.learning.rules.filter((rule) => rule.status === 'suggested')
    return suggested.find((rule) => rule.acceptance?.eligible) || suggested[0] || null
  }, [data])

  if (isLoading) {
    return <Loading message="Loading experiments..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data) {
    return <Error message="Experiment data is unavailable." />
  }

  const activeTests = data.tests.filter((test) => test.status === 'active')
  const showTests = view !== 'learning'
  const showLearning = view !== 'tests'

  return (
    <div className="space-y-8">
      {!embedded && (
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Experiments</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use measured outcomes to ask focused questions, then decide whether any recommendation should change.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {showTests && <StatCard label="Tests" value={data.tests.length} note={`${activeTests.length} active. Assignments are explicit and never randomized.`} />}
        {showLearning && (
          <StatCard
            label="What we've learned"
            value={data.learning.suggested}
            note={`suggested · ${data.learning.accepted} accepted. Suggestions have zero effect until you accept them.`}
          />
        )}
      </div>

      {showLearning && (decisionRule ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Needs a human decision</div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{decisionRule.finding || 'A measured pattern is ready to review'}</h3>
          <div className="text-xs text-slate-500">
            {decisionRule.evidence.label} · {decisionRule.evidence.sampleSize || 0} examples
          </div>
          <p className="mt-3 text-sm text-slate-700">{decisionRule.recommendation || 'Review the evidence before deciding whether anything should change.'}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <strong>No strategy decision is waiting right now.</strong> Keep collecting measured outcomes or create a focused test when you have a question worth comparing.
        </div>
      ))}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <strong>Nothing here publishes by itself.</strong>
        <div className="mt-1 text-xs text-slate-600">
          Tests only attach explicit comparison context. Learned suggestions stay inert until human acceptance, and accepted changes remain bounded by the existing approval, expiry, account-status, and manual-choice rules.
        </div>
      </div>

      {showTests && (
        <>
          <CreateTestForm />
          {data.tests.length > 0 && (
            <section className="space-y-3">
              {data.tests.map((test) => <TestCard key={test.id} test={test} />)}
            </section>
          )}
        </>
      )}

      {showLearning && (
        <>
          <section>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">What we've learned</h3>
            <p className="mb-3 text-sm text-slate-600">Patterns from your own measured work. Suggestions stay inert until you explicitly accept them.</p>
            {data.learning.rules.length > 0 ? (
              <div className="space-y-3">
                {data.learning.rules.map((rule) => <LearnedRuleCard key={rule.id} rule={rule} />)}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                No learning suggestions yet. Run tests and collect measured outcomes first.
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">Look for a new pattern</h3>
            <p className="mb-3 text-sm text-slate-600">Check a declared test for a measurable difference between its options.</p>
            <RefreshSuggestionForms tests={data.tests} />
          </section>
        </>
      )}
    </div>
  )
}
