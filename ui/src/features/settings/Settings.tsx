const SETTINGS_ITEMS = [
  ['#/settings/growth-focus', 'Growth focus', 'Default growth objective, topic roles, classification terms, and target-audience signals.'],
  ['#/settings/ai', 'AI', 'Runtime, provider, model, role assignments, connection checks, and recent AI usage.'],
  ['#/settings/advanced', 'Advanced / diagnostics', 'Relationship detail, account-health evidence, and system-level diagnostic views.'],
] as const

export function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Configure growth focus and AI, or inspect advanced diagnostic detail. Daily work remains in the primary navigation.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {SETTINGS_ITEMS.map(([href, title, description]) => (
          <a key={href} href={href} className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-400">
            <div className="font-semibold text-slate-900">{title}</div>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
            <div className="mt-3 text-sm font-medium text-sky-700">Open →</div>
          </a>
        ))}
      </div>
    </div>
  )
}
