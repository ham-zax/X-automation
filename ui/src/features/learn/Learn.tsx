import { useClassifyPublishedContent, useImprove, useResults, type StrategyOutcomeCohort } from '../../api/client'
import { Badge, Disclosure, Error, Loading, StatCard } from '../../components/primitives'
import { Improve } from '../improve/Improve'
import { ViralStyles } from '../viral/ViralStyles'

type LearnSection = 'external' | 'evidence' | 'tests' | 'strategy'

const SECTIONS: { id: LearnSection; label: string; description: string }[] = [
  { id: 'external', label: 'External patterns', description: 'Observational patterns from comparable outside posts, with samples and limitations.' },
  { id: 'evidence', label: 'Your evidence', description: 'Own-account writing-approach observations from real fixed-window measurements.' },
  { id: 'tests', label: 'Tests', description: 'Explicit comparisons, assignments, and their existing evidence states.' },
  { id: 'strategy', label: 'Strategy', description: 'External, own-account, test, and learned-rule context kept separate before any human decision.' },
]

function compactGroups(groups: { value: string; summary: StrategyOutcomeCohort }[]) {
  if (!groups.length) return <span className="text-slate-500">No observations yet.</span>
  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((group) => (
        <Badge key={group.value}>{group.value.replaceAll('_', ' ')} · n={group.summary.sampleSize}</Badge>
      ))}
    </div>
  )
}

function YourEvidence() {
  const results = useResults()
  const classify = useClassifyPublishedContent()
  if (results.isLoading) return <Loading message="Loading own-account evidence..." />
  if (results.error) return <Error message={results.error.message} onRetry={() => results.refetch()} />
  if (!results.data) return <Error message="Own-account evidence is unavailable." />

  const outcomes = results.data.writingStrategyOutcomes
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Your evidence</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Own-account observations from the same mature {outcomes.windowMinutes / 60}h publication window used for writing-approach comparison. Results remains the detailed record of what happened.
            </p>
          </div>
          <Badge tone="info">Own-account observation</Badge>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <div className="font-semibold text-slate-900">Classify the final published text</div>
              <p className="mt-1 text-sm text-slate-600">
                Generation provenance records which writing guidance influenced Writer. This separate, explicit AI action labels the text that actually went out so measured publications can also become own-account strategy evidence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => classify.mutate({ limit: 20 })}
              disabled={classify.isPending}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
            >
              {classify.isPending ? 'Classifying…' : 'Classify recent published posts'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            This may spend AI tokens through the current Editorial scan assignment. Existing labels are reused; each action is bounded to the 20 most recent eligible publications. <a href="#/settings/ai" className="font-medium text-sky-700 hover:underline">AI Settings →</a>
          </p>
          {classify.isSuccess && (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Classified {classify.data.classified} publication{classify.data.classified === 1 ? '' : 's'} · reused {classify.data.reused} existing label{classify.data.reused === 1 ? '' : 's'}{classify.data.invalid.length ? ` · ${classify.data.invalid.length} could not be labeled` : ''}. Future draft guidance can use labeled posts when matching measurement evidence exists.
            </div>
          )}
          {classify.isError && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Published-text classification failed: {classify.error.message}
            </div>
          )}
        </div>

        {outcomes.availability === 'available' ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard
                label="Measured publications"
                value={outcomes.observationCount}
                note={`${outcomes.appliedObservationCount} used an Apply strategy in Writer.${outcomes.truncated ? ` Latest ${outcomes.measurementCount} of ${outcomes.totalMeasurementCount} mature measurements are summarized.` : ''}`}
              />
              <StatCard label="Comparison window" value={`${outcomes.windowMinutes / 60}h`} note="One fixed window; no 15m/24h mixing." />
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Intent · applied generations</div>
              {compactGroups(outcomes.byIntent)}
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Presentation style · applied generations</div>
              {compactGroups(outcomes.byStyle)}
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Opening feature · applied generations</div>
              {compactGroups(outcomes.byOpeningFeature)}
            </div>
            <p className="text-xs text-slate-500">These are descriptive associations, not proof that a writing approach caused performance.</p>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <strong>No mature own-account writing-approach evidence yet.</strong>
            <div className="mt-1 text-slate-600">
              {outcomes.availability === 'no_measurements'
                ? 'No 24h publication measurements exist yet, so there is nothing to interpret here.'
                : 'Existing mature measurements do not contain recorded Writer-generation strategy provenance, so they remain unattributed.'}
            </div>
          </div>
        )}
      </section>

      <a href="#/results" className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Open detailed Results →
      </a>
    </div>
  )
}

function evidenceStateSummary(states: string[]) {
  const counts = new Map<string, number>()
  for (const state of states) counts.set(state || 'unknown', (counts.get(state || 'unknown') || 0) + 1)
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([state, count]) => `${state}: ${count}`).join(' · ') || 'none'
}

function StrategyEvidence() {
  const results = useResults()
  const improve = useImprove()
  if (results.isLoading || improve.isLoading) return <Loading message="Loading strategy evidence..." />
  if (results.error) return <Error message={results.error.message} onRetry={() => results.refetch()} />
  if (improve.error) return <Error message={improve.error.message} onRetry={() => improve.refetch()} />
  if (!results.data || !improve.data) return <Error message="Strategy evidence is unavailable." />

  const evidence = results.data.writingStrategyEvidence
  const outcomes = results.data.writingStrategyOutcomes
  const externalRefs = evidence.externalEvidence.evidence || []
  const experiments = evidence.experimentEvidence || []
  const learning = improve.data.learning
  const comparable = evidence.comparisons.filter((comparison) => comparison.ownAccount != null)

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Strategy evidence</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Evidence sources stay separate. This page does not create a combined effectiveness score, select a writing approach for a draft, or apply anything to Writer.
            </p>
          </div>
          <a href="#/create" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Open Posts →</a>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <a href="#/learn/external" className="rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-slate-400">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">External</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{externalRefs.length}</div>
            <div className="mt-1 text-xs text-slate-600">Observational evidence references. {evidenceStateSummary(externalRefs.map((ref) => ref.state))}</div>
          </a>
          <a href="#/learn/evidence" className="rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-slate-400">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Own account · generation history</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{outcomes.observationCount}</div>
            <div className="mt-1 text-xs text-slate-600">Mature {outcomes.windowMinutes / 60}h publications with recorded generation provenance. Final published text is classified explicitly in Your evidence before draft guidance can reuse matching measured outcomes.</div>
          </a>
          <a href="#/learn/tests" className="rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-slate-400">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Test evidence</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{experiments.length}</div>
            <div className="mt-1 text-xs text-slate-600">Explicit declared comparisons; assignment and evidence state stay owned by Tests.</div>
          </a>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Learned-rule context</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{learning.accepted}</div>
            <div className="mt-1 text-xs text-slate-600">Accepted · {learning.suggested} suggested · context is not proof and suggestions have zero effect.</div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>No automatic agreement verdict.</strong> External and own-account evidence are exposed side by side, but no threshold has been invented to label them consistent, mixed, or contrary.
          {outcomes.truncated && <> Own-account summaries currently use the latest {outcomes.measurementCount} of {outcomes.totalMeasurementCount} mature measurements.</>}
        </div>

        <Disclosure summary={`Side-by-side evidence with own-account observations · ${comparable.length}`}>
          {comparable.length ? (
            <div className="space-y-2 text-sm text-slate-700">
              {comparable.slice(0, 12).map((comparison) => (
                <div key={`${comparison.dimension}:${comparison.value}`} className="rounded-md border border-slate-200 p-3">
                  <strong>{comparison.dimension.replaceAll('_', ' ')} · {comparison.value.replaceAll('_', ' ')}</strong>
                  <div className="mt-1 text-xs text-slate-500">External refs: {comparison.externalEvidence.length} · own-account n={comparison.ownAccount?.sampleSize ?? 0} · no automatic interpretation</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-600">No strategy dimension currently has both external evidence and mature own-account observations.</div>
          )}
        </Disclosure>
      </section>

      <section>
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-slate-900">Learned changes</h3>
          <p className="mt-1 text-sm text-slate-600">Existing learned-rule controls remain explicit and bounded. They do not select or apply a per-draft writing approach.</p>
        </div>
        <Improve embedded view="learning" />
      </section>
    </div>
  )
}

function Overview() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {SECTIONS.map((section) => (
        <a key={section.id} href={`#/learn/${section.id}`} className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-400">
          <div className="font-semibold text-slate-900">{section.label}</div>
          <p className="mt-1 text-sm text-slate-600">{section.description}</p>
          <div className="mt-3 text-sm font-medium text-sky-700">Open →</div>
        </a>
      ))}
    </div>
  )
}

export function Learn({ section: requestedSection }: { section?: string }) {
  const section = SECTIONS.some((item) => item.id === requestedSection) ? requestedSection as LearnSection : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900"><a href="#/learn">Learn</a></h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Inspect external patterns, your measured evidence, declared tests, and strategy context without blending their provenance.</p>
        </div>
        <Badge>Provisional IA label</Badge>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200" aria-label="Learn sections">
        {SECTIONS.map((item) => (
          <a
            key={item.id}
            href={`#/learn/${item.id}`}
            aria-current={section === item.id ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-2 py-2 text-sm font-medium ${section === item.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {!section && <Overview />}
      {section === 'external' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <strong>External observational evidence.</strong> These patterns come from comparable outside posts. Repeated association is not a causal X-ranking claim or a guarantee for this account.
          </div>
          <ViralStyles embedded />
        </div>
      )}
      {section === 'evidence' && <YourEvidence />}
      {section === 'tests' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <strong>Explicit tests.</strong> Assignments remain human-selected and non-randomized; test evidence stays separate from observational evidence.
          </div>
          <Improve embedded view="tests" />
        </div>
      )}
      {section === 'strategy' && <StrategyEvidence />}
    </div>
  )
}
