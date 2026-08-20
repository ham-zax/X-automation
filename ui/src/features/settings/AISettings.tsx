import { useState } from 'react'
import {
  useAICatalog,
  useAICatalogRefresh,
  useAIConnectionCheck,
  useAIDefaultSave,
  useAIProfileDelete,
  useAIProfileEnabled,
  useAIProfileSave,
  useAIRoleSave,
  useAIRuns,
  useAIRuntimeAvailability,
  useAISecretRemove,
  useAISecretReplace,
  useAISettings,
  type AICapability,
  type AIConnectionCheck,
  type AIProfileView,
  type AIRoleView,
  type AIRuntimeAvailability,
  type AISettingsData,
} from '../../api/client'
import { Badge, Error, Loading, TechnicalDetails, formatDateTime } from '../../components/primitives'

const ROLE_LABELS: Record<string, string> = {
  continuous_scan: 'Continuous scan',
  editorial_scan: 'Editorial scan',
  editorial_final: 'Editorial final',
  writer: 'Writer',
}

const RUNTIME_LABELS: Record<string, string> = {
  direct_api: 'Direct API',
  codex: 'Codex',
  opencode: 'OpenCode',
  opencode2: 'OpenCode 2',
  agy: 'AGY',
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  openai_compatible: 'OpenAI-compatible',
  runtime_managed: 'Runtime managed',
}

const CAPABILITY_LABELS: Record<AICapability, string> = {
  supported: 'Structured output supported',
  compatible_fallback: 'Validated JSON fallback',
  unknown: 'Capability unknown',
  unsupported: 'Structured output unsupported',
}

function capabilityTone(capability: AICapability): 'success' | 'warning' | 'danger' | 'neutral' {
  if (capability === 'supported') return 'success'
  if (capability === 'compatible_fallback' || capability === 'unknown') return 'warning'
  return 'danger'
}

function profileSummary(profile: AIProfileView | null | undefined) {
  if (!profile) return 'No profile'
  const variant = profile.reasoning ? ` / ${profile.reasoning}` : ''
  return `${RUNTIME_LABELS[profile.runtime] || profile.runtime} · ${PROVIDER_LABELS[profile.providerKind] || profile.providerKind} · ${profile.model}${variant}`
}

function profileOptionLabel(profile: AIProfileView) {
  return `${profile.name} — ${profile.model}${profile.reasoning ? ` / ${profile.reasoning}` : ''}${profile.enabled ? '' : ' — disabled'}${profile.capability === 'unsupported' ? ' — unsupported' : ''}`
}

function assignable(profile: AIProfileView) {
  return profile.enabled && profile.capability !== 'unsupported' && profile.id != null
}

function DefaultProfileForm({ data }: { data: AISettingsData }) {
  const save = useAIDefaultSave()
  const [selected, setSelected] = useState(data.defaultProfileId == null ? '' : String(data.defaultProfileId))
  const selectedProfile = data.profiles.find((profile) => String(profile.id) === selected) || null
  const [confirmUnknown, setConfirmUnknown] = useState(false)
  const requiresConfirmation = selectedProfile?.capability === 'unknown'

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Default profile</h2>
          <p className="mt-1 text-sm text-slate-600">Used when a role does not have its own primary profile.</p>
        </div>
        {data.defaultProfile && <Badge tone={capabilityTone(data.defaultProfile.capability)}>{data.defaultProfile.name}</Badge>}
      </div>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate({ profileId: selected ? Number(selected) : null, confirmUnknownCapability: confirmUnknown })
        }}
      >
        <label className="min-w-0 flex-1 text-sm text-slate-700">
          Global default
          <select value={selected} onChange={(event) => { setSelected(event.target.value); setConfirmUnknown(false) }} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="">No global default</option>
            {data.profiles.map((profile) => (
              <option key={profile.id} value={profile.id ?? ''} disabled={!assignable(profile)}>{profileOptionLabel(profile)}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={save.isPending || (requiresConfirmation && !confirmUnknown)} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          {save.isPending ? 'Saving…' : 'Save default'}
        </button>
      </form>
      {requiresConfirmation && (
        <label className="mt-3 flex items-start gap-2 text-sm text-amber-800">
          <input type="checkbox" className="mt-0.5" checked={confirmUnknown} onChange={(event) => setConfirmUnknown(event.target.checked)} />
          <span>This profile reports unknown structured-output capability. Allow it only with explicit advanced confirmation.</span>
        </label>
      )}
      {save.isError && <p className="mt-3 text-sm text-red-700">{save.error.message}</p>}
    </section>
  )
}

function RoleAssignment({ role, profiles }: { role: AIRoleView; profiles: AIProfileView[] }) {
  const save = useAIRoleSave()
  const [primary, setPrimary] = useState(role.primaryProfileId == null ? '' : String(role.primaryProfileId))
  const [fallback, setFallback] = useState(role.fallbackProfileId == null ? '' : String(role.fallbackProfileId))
  const [confirmUnknown, setConfirmUnknown] = useState(false)
  const selectedProfiles = [primary, fallback]
    .filter(Boolean)
    .map((id) => profiles.find((profile) => String(profile.id) === id))
    .filter((profile): profile is AIProfileView => Boolean(profile))
  const requiresConfirmation = selectedProfiles.some((profile) => profile.capability === 'unknown')

  const submit = (clear = false) => save.mutate({
    role: role.role,
    primaryProfileId: clear || !primary ? null : Number(primary),
    fallbackProfileId: clear || !fallback ? null : Number(fallback),
    confirmUnknownCapability: confirmUnknown,
  })

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{ROLE_LABELS[role.role] || role.role}</div>
          <div className="mt-1 text-sm text-slate-600">{profileSummary(role.resolvedProfile)}</div>
          <div className="mt-1 text-xs text-slate-500">Resolved from {role.resolutionSource.replaceAll('_', ' ')}.</div>
        </div>
        <div className="flex gap-2">
          {role.role === 'continuous_scan' && <Badge tone="neutral">Not active</Badge>}
          {role.resolvedProfile && <Badge tone={capabilityTone(role.resolvedProfile.capability)}>{CAPABILITY_LABELS[role.resolvedProfile.capability]}</Badge>}
        </div>
      </div>
      {role.role === 'continuous_scan' && (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          This role is configuration-only. Assigning a profile does not start a background job.
        </p>
      )}
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); submit(false) }}>
        <label className="text-sm text-slate-700">
          Primary override
          <select value={primary} onChange={(event) => { setPrimary(event.target.value); setConfirmUnknown(false) }} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="">Use global / compatibility default</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id ?? ''} disabled={!assignable(profile)}>{profileOptionLabel(profile)}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Fallback
          <select value={fallback} onChange={(event) => { setFallback(event.target.value); setConfirmUnknown(false) }} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="">No fallback</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id ?? ''} disabled={!assignable(profile)}>{profileOptionLabel(profile)}</option>)}
          </select>
        </label>
        {requiresConfirmation && (
          <label className="md:col-span-2 flex items-start gap-2 text-sm text-amber-800">
            <input type="checkbox" className="mt-0.5" checked={confirmUnknown} onChange={(event) => setConfirmUnknown(event.target.checked)} />
            <span>Confirm assignment despite unknown structured-output capability.</span>
          </label>
        )}
        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={save.isPending || (requiresConfirmation && !confirmUnknown)} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {save.isPending ? 'Saving…' : 'Save assignment'}
          </button>
          <button type="button" disabled={save.isPending || (!role.primaryProfileId && !role.fallbackProfileId)} onClick={() => { setPrimary(''); setFallback(''); submit(true) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Clear override
          </button>
          {role.fallbackProfile && <span className="text-xs text-slate-500">Fallback: {profileSummary(role.fallbackProfile)}</span>}
        </div>
      </form>
      {save.isError && <p className="mt-3 text-sm text-red-700">{save.error.message}</p>}
    </div>
  )
}

function RuntimeCard({ runtime }: { runtime: AIRuntimeAvailability }) {
  const status = runtime.installed ? 'Installed' : 'Not installed'
  const tone = runtime.installed ? (runtime.structuredOutput === 'unsupported' ? 'warning' : 'success') : 'neutral'
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-900">{RUNTIME_LABELS[runtime.runtime] || runtime.runtime}</div>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <div className="mt-2 text-sm text-slate-600">{runtime.version || 'No version reported'}</div>
      <div className="mt-1 text-xs text-slate-500">{CAPABILITY_LABELS[runtime.structuredOutput] || runtime.structuredOutput}</div>
      {runtime.reason && <div className="mt-1 text-xs text-slate-500">{runtime.reason.replaceAll('_', ' ')}</div>}
    </div>
  )
}

function ConnectionResult({ result }: { result: AIConnectionCheck }) {
  const value = (state: boolean | null) => state == null ? 'Unknown' : state ? 'Yes' : 'No'
  return (
    <dl className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
      <div><dt className="text-slate-500">Runtime available</dt><dd className="font-medium text-slate-900">{value(result.runtimeAvailable)}</dd></div>
      <div><dt className="text-slate-500">Provider reachable</dt><dd className="font-medium text-slate-900">{value(result.providerReachable)}</dd></div>
      <div><dt className="text-slate-500">Authenticated</dt><dd className="font-medium text-slate-900">{value(result.authenticated)}</dd></div>
      <div><dt className="text-slate-500">Selected model found</dt><dd className="font-medium text-slate-900">{value(result.modelFound)}</dd></div>
      <div><dt className="text-slate-500">Structured output</dt><dd className="font-medium text-slate-900">{result.structuredOutputPath || 'Unknown'}</dd></div>
      <div><dt className="text-slate-500">Latency</dt><dd className="font-medium text-slate-900">{result.latencyMs} ms</dd></div>
      {result.error && <div className="sm:col-span-2"><dt className="text-slate-500">Error</dt><dd className="font-medium text-red-700">{result.error.code}</dd></div>}
    </dl>
  )
}

function ProfileEditor({ profile, onSaved, onDeleted }: { profile: AIProfileView | null; onSaved: (id: number) => void; onDeleted: () => void }) {
  const save = useAIProfileSave()
  const enabledMutation = useAIProfileEnabled()
  const deleteMutation = useAIProfileDelete()
  const replaceSecret = useAISecretReplace()
  const removeSecret = useAISecretRemove()
  const connection = useAIConnectionCheck()
  const refreshCatalog = useAICatalogRefresh()
  const catalog = useAICatalog(profile?.id ?? null)

  const [name, setName] = useState(profile?.name || '')
  const [runtime, setRuntime] = useState<AIProfileView['runtime']>(profile?.runtime || 'codex')
  const [providerKind, setProviderKind] = useState<AIProfileView['providerKind']>(profile?.providerKind || 'runtime_managed')
  const [baseUrl, setBaseUrl] = useState(profile?.baseUrl || '')
  const [protocol, setProtocol] = useState<AIProfileView['protocol']>(profile?.protocol || 'runtime_native')
  const [model, setModel] = useState(profile?.model || 'inherit')
  const [reasoning, setReasoning] = useState(profile?.reasoning || '')
  const [runtimeProfile, setRuntimeProfile] = useState(profile?.runtimeProfile || '')
  const [structuredOutput, setStructuredOutput] = useState<AICapability>((profile?.settings.structuredOutput as AICapability) || (profile?.providerKind === 'openai' ? 'supported' : 'compatible_fallback'))
  const [catalogPath, setCatalogPath] = useState(profile?.settings.catalogPath || '/models')
  const [apiKey, setApiKey] = useState('')
  const [secretEnv, setSecretEnv] = useState('')
  const [replacementKey, setReplacementKey] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')

  const direct = runtime === 'direct_api'
  const persistedId = profile?.id ?? null
  const needsCreateSecret = direct && !profile && ['openai', 'openrouter'].includes(providerKind)
  const changingToDirect = direct && profile != null && profile.runtime !== 'direct_api'
  const selectedCatalogModel = catalog.data?.models.find((entry) => entry.id === model) || null
  const catalogModels = (catalog.data?.models || []).filter((entry) => {
    const needle = catalogSearch.trim().toLowerCase()
    return !needle || entry.id.toLowerCase().includes(needle) || entry.name.toLowerCase().includes(needle)
  }).slice(0, 40)

  const changeRuntime = (next: AIProfileView['runtime']) => {
    setRuntime(next)
    if (next === 'direct_api') {
      setProviderKind('openrouter')
      setProtocol('chat_completions')
      setModel('')
      setStructuredOutput('compatible_fallback')
    } else {
      setProviderKind('runtime_managed')
      setProtocol('runtime_native')
      setModel(next === 'codex' ? 'inherit' : '')
      if (next === 'agy') setRuntimeProfile('')
    }
  }

  const submit = () => {
    const settings: Record<string, string> = {}
    if (direct) {
      settings.structuredOutput = structuredOutput
      if (catalogPath.trim()) settings.catalogPath = catalogPath.trim()
    }
    const payload: Record<string, unknown> = {
      name,
      runtime,
      providerKind: direct ? providerKind : 'runtime_managed',
      baseUrl: direct ? baseUrl : '',
      protocol: direct ? protocol : 'runtime_native',
      model,
      reasoning,
      runtimeProfile: direct || runtime === 'agy' ? '' : runtimeProfile,
      settings,
      enabled: profile?.enabled ?? true,
    }
    if ((!profile || changingToDirect) && apiKey.trim()) payload.apiKey = apiKey.trim()
    if ((!profile || changingToDirect) && !apiKey.trim() && secretEnv.trim()) payload.secretEnv = secretEnv.trim()
    save.mutate({ id: persistedId ?? undefined, payload }, {
      onSuccess: ({ profile: saved }) => {
        setApiKey('')
        setSecretEnv('')
        if (saved.id != null) onSaved(saved.id)
      },
    })
  }

  const createSecretMissing = (needsCreateSecret || (changingToDirect && ['openai', 'openrouter'].includes(providerKind))) && !apiKey.trim() && !secretEnv.trim()

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{profile ? profile.name : 'New profile'}</h3>
          <p className="mt-1 text-sm text-slate-600">Profile configuration is non-secret. Credentials are managed separately below.</p>
        </div>
        {profile && <Badge tone={capabilityTone(profile.capability)}>{CAPABILITY_LABELS[profile.capability]}</Badge>}
      </div>

      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); submit() }}>
        <label className="text-sm text-slate-700">
          Name
          <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" />
        </label>
        <label className="text-sm text-slate-700">
          Runtime
          <select value={runtime} onChange={(event) => changeRuntime(event.target.value as AIProfileView['runtime'])} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="direct_api">Direct API</option>
            <option value="codex">Codex</option>
            <option value="opencode">OpenCode</option>
            <option value="opencode2">OpenCode 2</option>
            <option value="agy">AGY</option>
          </select>
        </label>
        {direct ? (
          <>
            <label className="text-sm text-slate-700">
              Provider
              <select value={providerKind} onChange={(event) => {
                const provider = event.target.value as AIProfileView['providerKind']
                setProviderKind(provider)
                setStructuredOutput(provider === 'openai' ? 'supported' : 'compatible_fallback')
              }} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="openai_compatible">OpenAI-compatible</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Protocol
              <select value={protocol} onChange={(event) => setProtocol(event.target.value as AIProfileView['protocol'])} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
                <option value="chat_completions">Chat Completions</option>
                <option value="responses">Responses</option>
              </select>
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              Base URL {providerKind === 'openai_compatible' ? '(required)' : '(optional override)'}
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder={providerKind === 'openrouter' ? 'https://openrouter.ai/api/v1' : providerKind === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:11434/v1'} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm font-mono" />
            </label>
          </>
        ) : runtime !== 'agy' ? (
          <label className="text-sm text-slate-700 md:col-span-2">
            Runtime profile (optional)
            <input value={runtimeProfile} onChange={(event) => setRuntimeProfile(event.target.value)} placeholder="Use the runtime's default configuration" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" />
          </label>
        ) : null}
        <label className="text-sm text-slate-700">
          Model ID
          <input required value={model} onChange={(event) => setModel(event.target.value)} placeholder={runtime === 'codex' ? 'inherit or exact Codex model' : 'Exact upstream model ID'} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm font-mono" />
        </label>
        <label className="text-sm text-slate-700">
          Reasoning / variant
          <input value={reasoning} onChange={(event) => setReasoning(event.target.value)} placeholder={runtime === 'agy' ? 'low, medium, or high' : 'medium, max, or provider/runtime value'} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" />
        </label>
        {direct && (
          <>
            <label className="text-sm text-slate-700">
              Structured-output capability
              <select value={structuredOutput} onChange={(event) => setStructuredOutput(event.target.value as AICapability)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
                <option value="supported">Native supported</option>
                <option value="compatible_fallback">Validated JSON fallback</option>
                <option value="unknown">Unknown</option>
                <option value="unsupported">Unsupported</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Model catalog path
              <input value={catalogPath} onChange={(event) => setCatalogPath(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm font-mono" />
            </label>
          </>
        )}
        {(!profile || changingToDirect) && direct && (
          <div className="md:col-span-2 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              API key {['openai', 'openrouter'].includes(providerKind) ? '(required unless using env)' : '(optional)'}
              <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="new-password" placeholder="Write only" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm" />
            </label>
            <label className="text-sm text-slate-700">
              Or environment variable
              <input value={secretEnv} onChange={(event) => setSecretEnv(event.target.value)} placeholder="OPENROUTER_API_KEY" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm font-mono" />
            </label>
            <p className="md:col-span-2 text-xs text-slate-500">The API never returns a stored key. Environment-variable names are stored as references; their values stay in the environment.</p>
          </div>
        )}
        {structuredOutput === 'unsupported' && direct && <p className="md:col-span-2 text-sm text-red-700">This profile can be saved for diagnostics but cannot be assigned to a structured AI role.</p>}
        {structuredOutput === 'unknown' && direct && <p className="md:col-span-2 text-sm text-amber-700">Assignments require explicit advanced confirmation while capability is unknown.</p>}
        {createSecretMissing && <p className="md:col-span-2 text-sm text-amber-700">OpenAI/OpenRouter profiles need either a local API key or an environment-variable reference.</p>}
        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={save.isPending || createSecretMissing} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">{save.isPending ? 'Saving…' : profile ? 'Save profile' : 'Create profile'}</button>
          {profile && profile.id != null && (
            <button type="button" disabled={enabledMutation.isPending} onClick={() => enabledMutation.mutate({ id: profile.id as number, enabled: !profile.enabled })} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {profile.enabled ? 'Disable' : 'Enable'}
            </button>
          )}
          {profile && profile.id != null && (
            <button type="button" disabled={deleteMutation.isPending} onClick={() => {
              if (!window.confirm(`Delete AI profile “${profile.name}”? Role/default references will be cleared.`)) return
              deleteMutation.mutate(profile.id as number, { onSuccess: onDeleted })
            }} className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>
          )}
        </div>
      </form>
      {(save.isError || enabledMutation.isError || deleteMutation.isError) && <p className="mt-3 text-sm text-red-700">{save.error?.message || enabledMutation.error?.message || deleteMutation.error?.message}</p>}

      {profile && direct && profile.id != null && (
        <div className="mt-5 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-slate-900">API key</h4>
              <p className="text-sm text-slate-600">
                {profile.secret.hasSecret ? `Stored key exists${profile.secret.source ? ` (${profile.secret.source})` : ''}.` : `No resolved key${profile.secret.source ? ` (${profile.secret.source} reference)` : ''}.`}
              </p>
            </div>
            <Badge tone={profile.secret.hasSecret ? 'success' : 'warning'}>{profile.secret.hasSecret ? 'Key present' : 'No key'}</Badge>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="password" value={replacementKey} onChange={(event) => setReplacementKey(event.target.value)} autoComplete="new-password" placeholder="New key (write only)" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm" />
            <button type="button" disabled={!replacementKey.trim() || replaceSecret.isPending} onClick={() => replaceSecret.mutate({ id: profile.id as number, apiKey: replacementKey.trim() }, { onSuccess: () => setReplacementKey('') })} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">Replace key</button>
            {profile.secret.source && (
              <button type="button" disabled={removeSecret.isPending} onClick={() => removeSecret.mutate(profile.id as number)} className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Remove key</button>
            )}
          </div>
          {profile.secret.source === 'env' && <p className="mt-2 text-xs text-slate-500">Remove key detaches this profile from the environment-variable reference; it does not change the environment variable itself. Replacing the key switches this profile to a local file-managed secret.</p>}
          {(replaceSecret.isError || removeSecret.isError) && <p className="mt-2 text-sm text-red-700">{replaceSecret.error?.message || removeSecret.error?.message}</p>}
        </div>
      )}

      {profile && profile.id != null && (
        <div className="mt-5 grid gap-5 border-t border-slate-200 pt-5 lg:grid-cols-2">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-semibold text-slate-900">Model catalog</h4>
                <p className="text-sm text-slate-600">Refresh provider/runtime models, search the returned catalog, or keep a manual exact model ID above.</p>
              </div>
              <button type="button" disabled={refreshCatalog.isPending} onClick={() => refreshCatalog.mutate(profile.id as number)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">{refreshCatalog.isPending ? 'Refreshing…' : 'Refresh models'}</button>
            </div>
            <input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search model IDs or names" className="mt-3 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" />
            <div className="mt-2 max-h-56 overflow-auto rounded-md border border-slate-200">
              {catalog.isLoading && <div className="p-3 text-sm text-slate-500">Loading catalog…</div>}
              {!catalog.isLoading && catalogModels.length === 0 && <div className="p-3 text-sm text-slate-500">{catalog.data?.error?.message || catalog.data?.error?.code || 'No models returned. Manual entry remains available.'}</div>}
              {catalogModels.map((entry) => (
                <button key={entry.id} type="button" onClick={() => setModel(entry.id)} className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50 ${entry.id === model ? 'bg-slate-100' : ''}`}>
                  <div className="font-medium text-slate-900">{entry.name || entry.id}</div>
                  <div className="text-xs text-slate-500">{entry.id}{entry.structuredOutput ? ` · ${CAPABILITY_LABELS[entry.structuredOutput]}` : ''}</div>
                </button>
              ))}
            </div>
            {selectedCatalogModel && (
              <TechnicalDetails>
                <div>Model: {selectedCatalogModel.id}</div>
                {selectedCatalogModel.contextLength != null && <div>Context: {selectedCatalogModel.contextLength.toLocaleString()}</div>}
                {selectedCatalogModel.reasoningLevels?.length ? <div>Reasoning: {selectedCatalogModel.reasoningLevels.join(', ')}</div> : null}
                {selectedCatalogModel.supportedParameters?.length ? <div>Parameters: {selectedCatalogModel.supportedParameters.join(', ')}</div> : null}
                {selectedCatalogModel.pricing && <div>Pricing: {JSON.stringify(selectedCatalogModel.pricing)}</div>}
              </TechnicalDetails>
            )}
            {refreshCatalog.isError && <p className="mt-2 text-sm text-red-700">{refreshCatalog.error.message}</p>}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-semibold text-slate-900">Connection check</h4>
                <p className="text-sm text-slate-600">Bounded availability/catalog/auth check. It does not create editorial or workflow state.</p>
              </div>
              <button type="button" disabled={connection.isPending} onClick={() => connection.mutate(profile.id as number)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">{connection.isPending ? 'Checking…' : 'Check connection'}</button>
            </div>
            {connection.data && <ConnectionResult result={connection.data} />}
            {connection.isError && <p className="mt-2 text-sm text-red-700">{connection.error.message}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfilesSection({ profiles }: { profiles: AIProfileView[] }) {
  const firstId = profiles.find((profile) => profile.id != null)?.id ?? null
  const [selectedId, setSelectedId] = useState<number | null>(firstId)
  const selectedProfile = profiles.find((profile) => profile.id === selectedId) || null

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Profiles</h2>
          <p className="mt-1 text-sm text-slate-600">Reusable runtime/provider/model configurations. Credentials stay outside normal profile reads.</p>
        </div>
        <button type="button" onClick={() => setSelectedId(null)} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">New profile</button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-2">
          {profiles.length === 0 && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No saved AI profiles yet.</div>}
          {profiles.map((profile) => (
            <button key={profile.id} type="button" onClick={() => profile.id != null && setSelectedId(profile.id)} className={`w-full rounded-lg border p-3 text-left ${selectedId === profile.id ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-900">{profile.name}</span>
                <Badge tone={profile.enabled ? 'success' : 'neutral'}>{profile.enabled ? 'Enabled' : 'Disabled'}</Badge>
              </div>
              <div className="mt-1 text-xs text-slate-500">{profileSummary(profile)}</div>
              <div className="mt-2"><Badge tone={capabilityTone(profile.capability)}>{CAPABILITY_LABELS[profile.capability]}</Badge></div>
            </button>
          ))}
        </div>
        <ProfileEditor key={selectedProfile ? `${selectedProfile.id}:${selectedProfile.updatedAt}` : 'new'} profile={selectedProfile} onSaved={setSelectedId} onDeleted={() => setSelectedId(null)} />
      </div>
    </section>
  )
}

function RecentRuns() {
  const runs = useAIRuns(50)
  if (runs.isLoading) return <Loading message="Loading recent AI runs…" />
  if (runs.isError) return <Error message={runs.error.message} onRetry={() => void runs.refetch()} />

  const data = runs.data?.runs || []
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900">Recent AI runs</h2>
        <p className="mt-1 text-sm text-slate-600">Execution provenance and usage only. Unknown token/cost values stay blank rather than being shown as zero.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {data.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">No AI runs have been recorded yet.</div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Role / profile</th>
                <th className="px-3 py-2">Runtime / model</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Latency</th>
                <th className="px-3 py-2">Tokens</th>
                <th className="px-3 py-2">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((run) => (
                <tr key={run.id}>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateTime(run.startedAt)}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{ROLE_LABELS[run.role] || run.role}</div>
                    <div className="text-xs text-slate-500">{run.profileName || run.profileSource || 'Unlabeled profile'}{run.fallbackUsed ? ' · fallback' : ''}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-slate-900">{RUNTIME_LABELS[run.runtime] || run.runtime} · {PROVIDER_LABELS[run.providerKind] || run.providerKind}</div>
                    <div className="text-xs text-slate-500">{run.model || 'Unknown model'}{run.reasoning ? ` / ${run.reasoning}` : ''}</div>
                  </td>
                  <td className="px-3 py-3"><Badge tone={run.status === 'complete' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'}>{run.status}{run.errorCode ? ` · ${run.errorCode}` : ''}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{run.durationMs == null ? '—' : `${run.durationMs} ms`}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{run.inputTokens == null && run.outputTokens == null ? '—' : `${run.inputTokens ?? '?'} in / ${run.outputTokens ?? '?'} out`}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{run.costUsd == null ? '—' : `$${run.costUsd.toFixed(6)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

export function AISettings() {
  const settings = useAISettings()
  const runtimes = useAIRuntimeAvailability()

  if (settings.isError) return <Error message={settings.error.message} onRetry={() => void settings.refetch()} />
  if (settings.isLoading || !settings.data) return <Loading message="Loading AI settings…" />
  const data = settings.data

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a href="#/advanced" className="text-sm text-slate-500 hover:text-slate-900">← Diagnostics</a>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">AI Settings</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Choose runtime/provider/model configuration for advisory AI work. These settings do not change approval, routing, scheduling, or publishing authority.</p>
        </div>
      </div>

      <DefaultProfileForm key={`default:${data.defaultProfileId ?? 'none'}`} data={data} />

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Role assignments</h2>
          <p className="mt-1 text-sm text-slate-600">Role override → global default → documented compatibility default. Fallback is used only for execution failures.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {data.roles.map((role) => <RoleAssignment key={`${role.role}:${role.primaryProfileId ?? 'none'}:${role.fallbackProfileId ?? 'none'}`} role={role} profiles={data.profiles} />)}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Runtime availability</h2>
          <p className="mt-1 text-sm text-slate-600">Local runtime detection is separate from profile assignment.</p>
        </div>
        {runtimes.isError ? (
          <Error message={runtimes.error.message} onRetry={() => void runtimes.refetch()} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(runtimes.data?.runtimes || []).filter((runtime) => runtime.runtime !== 'direct_api').map((runtime) => <RuntimeCard key={runtime.runtime} runtime={runtime} />)}
          </div>
        )}
      </section>

      <ProfilesSection profiles={data.profiles} />
      <RecentRuns />
    </div>
  )
}
