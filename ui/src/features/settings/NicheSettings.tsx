import { useEffect, useState } from 'react'
import {
  useCandidateRescore,
  useGrowthFocus,
  useGrowthFocusReset,
  useGrowthFocusSave,
  type EditorialObjective,
  type GrowthFocusGroup,
  type GrowthFocusProfile,
} from '../../api/client'
import { Badge, Error, Loading, formatDateTime } from '../../components/primitives'

const OBJECTIVES: { value: EditorialObjective; label: string }[] = [
  { value: 'qualified_growth', label: 'Grow relevant followers' },
  { value: 'reach_momentum', label: 'Maximize reach' },
  { value: 'technical_authority', label: 'Build technical authority' },
  { value: 'relationships', label: 'Build relationships and opportunities' },
  { value: 'balanced', label: 'Balanced' },
]

function cloneProfile(profile: GrowthFocusProfile): GrowthFocusProfile {
  return {
    schemaVersion: profile.schemaVersion,
    defaultObjective: profile.defaultObjective,
    topicBalance: { ...profile.topicBalance },
    exploration: { ...profile.exploration },
    discovery: { ...profile.discovery },
    contentGroups: profile.contentGroups.map((group) => ({ ...group, terms: [...group.terms] })),
    audienceGroups: profile.audienceGroups.map((group) => ({ ...group, terms: [...group.terms] })),
    deprioritizedTerms: [...profile.deprioritizedTerms],
    exclusionTerms: [...profile.exclusionTerms],
  }
}

function splitTerms(value: string) {
  return [...new Set(value.split(/\n|,/).map((term) => term.trim().toLowerCase()).filter(Boolean))]
}

function GroupEditor({
  group,
  content,
  onChange,
  onRemove,
}: {
  group: GrowthFocusGroup
  content: boolean
  onChange: (patch: Partial<GrowthFocusGroup>) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-600">
            Label
            <input
              value={group.label}
              onChange={(event) => onChange({ label: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Tag
            <input
              value={group.tag}
              onChange={(event) => onChange({ tag: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs text-slate-800"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          Remove
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">
          Match weight
          <input
            type="number"
            min={1}
            max={50}
            value={group.weight}
            onChange={(event) => onChange({ weight: Number(event.target.value) })}
            className="mt-1 block w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
        {content && (
          <>
            <label className="text-xs font-medium text-slate-600">
              Role
              <select
                value={group.role || 'core'}
                onChange={(event) => onChange({ role: event.target.value as 'core' | 'adjacent' | 'off' })}
                className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
              >
                <option value="core">Preferred</option>
                <option value="adjacent">Adjacent</option>
                <option value="off">Off (explicit block)</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Target share %
              <input
                type="number"
                min={0}
                max={100}
                value={group.targetShare ?? 0}
                onChange={(event) => onChange({ targetShare: Number(event.target.value) })}
                className="mt-1 block w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Research tier
              <select
                value={group.researchTier ?? 2}
                onChange={(event) => onChange({ researchTier: Number(event.target.value) })}
                className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
              >
                <option value={1}>1 — primary</option>
                <option value={2}>2 — supporting</option>
                <option value={3}>3 — occasional</option>
              </select>
            </label>
          </>
        )}
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={group.discover !== false}
            onChange={(event) => onChange({ discover: event.target.checked })}
          />
          {content ? 'Use for X discovery' : 'Use for open-world X discovery'}
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={group.requiresTechnicalContext === true}
            onChange={(event) => onChange({ requiresTechnicalContext: event.target.checked })}
          />
          Needs another technical-topic match
        </label>
      </div>

      <div className="mt-3 text-xs text-slate-500">{group.terms.length} matching terms</div>
      <textarea
        value={group.terms.join('\n')}
        onChange={(event) => onChange({ terms: splitTerms(event.target.value) })}
        rows={7}
        spellCheck={false}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800"
        aria-label={`${group.label} terms`}
      />
      <p className="mt-2 text-xs text-slate-500">One term per line. Discovery and classification both use these active terms.</p>
    </div>
  )
}

function TermListEditor({ title, note, terms, onChange }: { title: string; note: string; terms: string[]; onChange: (terms: string[]) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-1 text-sm text-slate-600">{note}</p>
      <textarea
        value={terms.join('\n')}
        onChange={(event) => onChange(splitTerms(event.target.value))}
        rows={8}
        spellCheck={false}
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800"
      />
    </div>
  )
}

export function NicheSettings() {
  const { data, isLoading, error, refetch } = useGrowthFocus()
  const save = useGrowthFocusSave()
  const reset = useGrowthFocusReset()
  const rescore = useCandidateRescore()
  const [draft, setDraft] = useState<GrowthFocusProfile | null>(null)

  useEffect(() => {
    if (data?.profile) setDraft(cloneProfile(data.profile))
  }, [data])

  if (isLoading) return <Loading message="Loading Growth Focus..." />
  if (error) return <Error message={error.message} onRetry={() => refetch()} />
  if (!data || !draft) return <Error message="Growth Focus is unavailable." />

  const updateGroup = (kind: 'contentGroups' | 'audienceGroups', index: number, patch: Partial<GrowthFocusGroup>) => {
    setDraft((current) => current ? {
      ...current,
      [kind]: current[kind].map((group, groupIndex) => groupIndex === index ? { ...group, ...patch } : group),
    } : current)
  }
  const removeGroup = (kind: 'contentGroups' | 'audienceGroups', index: number) => {
    setDraft((current) => current ? {
      ...current,
      [kind]: current[kind].filter((_, groupIndex) => groupIndex !== index),
    } : current)
  }
  const addGroup = (kind: 'contentGroups' | 'audienceGroups') => {
    setDraft((current) => {
      if (!current) return current
      const suffix = current[kind].length + 1
      const group: GrowthFocusGroup = {
        tag: `topic-${suffix}`,
        label: 'New topic',
        weight: 12,
        ...(kind === 'contentGroups' ? { role: 'core' as const, targetShare: 0, researchTier: 2, discover: true } : { discover: true }),
        terms: [],
      }
      return { ...current, [kind]: [...current[kind], group] }
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="#/settings" className="text-sm font-medium text-slate-500 hover:text-slate-700">← Settings</a>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Growth Focus</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Choose what the account prefers without turning those preferences into a whitelist. Preferred and Adjacent groups receive stronger topic signals; unregistered technical topics can still enter as Emerging tech through the broader configurable universe. Off is the explicit block.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge tone={data.customized ? 'info' : 'neutral'}>{data.customized ? 'Customized' : 'Using defaults'}</Badge>
            <Badge tone="neutral">Classification rev {data.revision} · v{data.classifierVersion}</Badge>
            {data.updatedAt && <span>Last changed {formatDateTime(data.updatedAt)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={rescore.isPending}
            onClick={() => rescore.mutate()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {rescore.isPending ? 'Rescoring…' : 'Rescore candidates'}
          </button>
          <button
            type="button"
            disabled={reset.isPending || !data.customized}
            onClick={() => {
              if (window.confirm('Reset Growth Focus to defaults? This replaces your custom terms and roles and refreshes stored candidate classifications.')) reset.mutate()
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {reset.isPending ? 'Resetting…' : 'Reset to defaults'}
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(draft)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save Growth Focus'}
          </button>
        </div>
      </div>

      {(save.isSuccess || reset.isSuccess) && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Growth Focus updated. Stored candidate classifications were refreshed to the new profile revision.
        </div>
      )}
      {rescore.isSuccess && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Rescored {rescore.data.rescored} of {rescore.data.totalCandidates} candidates · classification rev {rescore.data.profileRevision} · v{rescore.data.classifierVersion}.
        </div>
      )}
      {(save.isError || reset.isError || rescore.isError) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(save.error || reset.error || rescore.error)?.message}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-semibold text-slate-900">
          Default growth goal
          <select
            value={draft.defaultObjective}
            onChange={(event) => setDraft((current) => current ? { ...current, defaultObjective: event.target.value as EditorialObjective } : current)}
            className="mt-2 block w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {OBJECTIVES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">Qualified growth remains the default: relevant followers first, while reach, authority, relationships, and opportunities stay distinct outcomes.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-600">
            Balance window
            <input
              type="number"
              min={10}
              max={100}
              value={draft.topicBalance.windowSize}
              onChange={(event) => setDraft((current) => current ? { ...current, topicBalance: { ...current.topicBalance, windowSize: Number(event.target.value) } } : current)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Balance strength
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={draft.topicBalance.strength}
              onChange={(event) => setDraft((current) => current ? { ...current, topicBalance: { ...current.topicBalance, strength: Number(event.target.value) } } : current)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Max priority adjustment
            <input
              type="number"
              min={0}
              max={20}
              value={draft.topicBalance.maxAdjustment}
              onChange={(event) => setDraft((current) => current ? { ...current, topicBalance: { ...current.topicBalance, maxAdjustment: Number(event.target.value) } } : current)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">Topic balance is a soft ranking correction. Set strength or max adjustment to 0 to disable it without changing topic groups.</p>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <input
              type="checkbox"
              checked={draft.exploration.enabled}
              onChange={(event) => setDraft((current) => current ? { ...current, exploration: { ...current.exploration, enabled: event.target.checked } } : current)}
            />
            Allow unregistered tech topics to compete
          </label>
          <p className="mt-1 text-xs text-slate-500">When enabled, posts inside the broader configured technical audience can surface even when they do not match a registered content niche. Registered niches still receive the stronger preference and balance signals.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Exploratory topic score
              <input
                type="number"
                min={0}
                max={50}
                value={draft.exploration.weight}
                onChange={(event) => setDraft((current) => current ? { ...current, exploration: { ...current.exploration, weight: Number(event.target.value) } } : current)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Broad X search queries
              <input
                type="number"
                min={0}
                max={20}
                value={draft.exploration.maxSearchQueries}
                onChange={(event) => setDraft((current) => current ? { ...current, exploration: { ...current.exploration, maxSearchQueries: Number(event.target.value) } } : current)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
          </div>
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="text-sm font-semibold text-slate-900">Discovery budget and rotation</div>
          <p className="mt-1 text-xs text-slate-500">Bound how many configured X query groups each refresh executes. The selected groups rotate over time so refresh stays fast without permanently favoring the first categories in the list.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">
              Latest query budget
              <input
                type="number"
                min={1}
                max={30}
                value={draft.discovery.latestQueryBudget}
                onChange={(event) => setDraft((current) => current ? { ...current, discovery: { ...current.discovery, latestQueryBudget: Number(event.target.value) } } : current)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Momentum query budget
              <input
                type="number"
                min={1}
                max={30}
                value={draft.discovery.momentumQueryBudget}
                onChange={(event) => setDraft((current) => current ? { ...current, discovery: { ...current.discovery, momentumQueryBudget: Number(event.target.value) } } : current)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Rotate every (minutes)
              <input
                type="number"
                min={1}
                max={120}
                value={draft.discovery.rotationMinutes}
                onChange={(event) => setDraft((current) => current ? { ...current, discovery: { ...current.discovery, rotationMinutes: Number(event.target.value) } } : current)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Topics and their role</h3>
            <p className="mt-1 text-sm text-slate-600">These groups now drive classification and X discovery. Target share is a planning signal used to counter repeated over-selection; it does not force weak posts.</p>
          </div>
          <button
            type="button"
            onClick={() => addGroup('contentGroups')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Add topic
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {draft.contentGroups.map((group, index) => (
            <GroupEditor
              key={`${group.tag}-${index}`}
              group={group}
              content
              onChange={(patch) => updateGroup('contentGroups', index, patch)}
              onRemove={() => removeGroup('contentGroups', index)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Broader tech universe and audience</h3>
            <p className="mt-1 text-sm text-slate-600">These groups describe the wider technical world around the account. They still classify audience fit, and—when open-world exploration is enabled—they also let new or unregistered tech topics enter discovery without becoming permanent niches.</p>
          </div>
          <button
            type="button"
            onClick={() => addGroup('audienceGroups')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Add audience group
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {draft.audienceGroups.map((group, index) => (
            <GroupEditor
              key={`${group.tag}-${index}`}
              group={group}
              content={false}
              onChange={(patch) => updateGroup('audienceGroups', index, patch)}
              onRemove={() => removeGroup('audienceGroups', index)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TermListEditor
          title="Audience deprioritization signals"
          note="Profile-language signals that lower audience fit unless the same account also has strong technical context. These do not set candidate Growth fit."
          terms={draft.deprioritizedTerms}
          onChange={(terms) => setDraft((current) => current ? { ...current, deprioritizedTerms: terms } : current)}
        />
        <TermListEditor
          title="Always exclude from audience fit"
          note="Clear exclusion signals used only for audience-fit classification."
          terms={draft.exclusionTerms}
          onChange={(terms) => setDraft((current) => current ? { ...current, exclusionTerms: terms } : current)}
        />
      </section>

      <div className="rounded-lg border border-slate-200 bg-slate-100 p-4 text-sm text-slate-600">
        <strong className="text-slate-800">Current scope:</strong> Registered content groups are preferences, not the whole universe. Growth Focus can also admit unregistered technical topics through the broader audience scope, so emerging tech can compete on live momentum without being hardcoded into the niche first. Content approval and Writer quality gates remain separate controls.
      </div>
    </div>
  )
}
