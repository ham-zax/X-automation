const LEGACY_VIEWS = [
  ['/legacy?source=relationships', 'Relationships', 'Strategic relationship profiles, stages, and relationship-fit detail.'],
  ['/legacy?source=health', 'Account status', 'Health evidence, repetition, saturation, and visibility provenance.'],
]

export function Advanced() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Diagnostics</h2>
        <p className="mt-1 text-sm text-slate-600">
          Inspect account-health and relationship details that sit behind the main workflow.
        </p>
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Detailed views</h3>
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
