const SETTINGS_ITEMS = [
  ['#/settings/growth-focus', 'Topics & audience', 'Choose the topics to focus on and the people you want to reach.'],
  ['#/settings/persona', 'Voice & preferences', 'Review Hamza’s voice, interests, and recorded opinions.'],
  ['#/settings/growth-operator', 'Agent control', 'Set what the agent may do, then start, pause, or stop its access.'],
  ['#/settings/publishing', 'Publishing strategy', 'Configure sleep, replies, quotes, originals, content priorities, follower tiers, and learning.'],
  ['#/settings/ai', 'AI connection', 'Connect a provider, choose models, and check usage.'],
  ['#/settings/autonomous-replies', 'Reply automation', 'Choose when the agent may reply and review its decisions.'],
  ['#/settings/advanced', 'Diagnostics', 'Check account health, connection problems, and system details.'],
] as const

export function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Manage your voice, audience, and agent access. Open Diagnostics when something needs troubleshooting.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
