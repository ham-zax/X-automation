const REACT_AREAS = [
  ['#/today', 'Today', 'What deserves your attention right now.'],
  ['#/discover', 'Discover', 'Find useful things worth talking about.'],
  ['#/conversations', 'Conversations', 'Continue useful discussions with explicit send control.'],
  ['#/create', 'Create', 'The full create lifecycle: idea to published.'],
  ['#/results', 'Results', 'Outcomes, account status, and audience quality.'],
  ['#/improve', 'Improve', 'Tests and what we have learned.'],
]

const LEGACY_VIEWS = [
  ['/legacy?source=relationships', 'Relationships', 'Strategic relationship profiles, stages, and relationship-fit detail.'],
  ['/legacy?source=health', 'Account status', 'Health evidence, repetition, saturation, and visibility provenance.'],
]

export function Advanced() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Advanced</h2>
        <p className="mt-1 text-sm text-slate-600">
          Daily work should start from the goal areas. These views remain available for inspection and advanced operation.
        </p>
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Workspace</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {REACT_AREAS.map(([href, title, body]) => (
            <a key={href} href={href} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400">
              <div className="font-semibold text-slate-900">{title}</div>
              <div className="mt-1 text-sm text-slate-600">{body}</div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Detailed diagnostics</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {LEGACY_VIEWS.map(([href, title, body]) => (
            <a key={href} href={href} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400">
              <div className="font-semibold text-slate-900">{title}</div>
              <div className="mt-1 text-sm text-slate-600">{body}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
