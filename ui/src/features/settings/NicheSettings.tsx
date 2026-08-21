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
    defaultObjective: profile.defaultObjective,
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
  onChange,
  onRoleChange,
}: {
  group: GrowthFocusGroup
  onChange: (terms: string[]) => void
  onRoleChange?: (role: 'core' | 'adjacent' | 'off') => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{group.label}</div>
          <div className="mt-1 text-xs text-slate-500">{group.terms.length} matching terms</div>
        </div>
        <div className="flex items-center gap-2">
          {group.requiresTechnicalContext && <Badge tone="neutral">Needs technical context</Badge>}
          {onRoleChange && (
            <select
              value={group.role || 'core'}
              onChange={(event) => onRoleChange(event.target.value as 'core' | 'adjacent' | 'off')}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
              aria-label={`${group.label} Growth Focus role`}
            >
              <option value="core">Core</option>
              <option value="adjacent">Adjacent</option>
              <option value="off">Off</option>
            </select>
          )}
        </div>
      </div>
      <textarea
        value={group.terms.join('\n')}
        onChange={(event) => onChange(splitTerms(event.target.value))}
        rows={7}
        spellCheck={false}
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800"
        aria-label={`${group.label} terms`}
      />
      <p className="mt-2 text-xs text-slate-500">One term per line. Remove a term to stop matching it; add a term to broaden this category.</p>
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

  const updateGroup = (kind: 'contentGroups' | 'audienceGroups', tag: string, terms: string[]) => {
    setDraft((current) => current ? {
      ...current,
      [kind]: current[kind].map((group) => group.tag === tag ? { ...group, terms } : group),
    } : current)
  }
  const updateContentRole = (tag: string, role: 'core' | 'adjacent' | 'off') => {
    setDraft((current) => current ? {
      ...current,
      contentGroups: current.contentGroups.map((group) => group.tag === tag ? { ...group, role } : group),
    } : current)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="#/settings" className="text-sm font-medium text-slate-500 hover:text-slate-700">← Settings</a>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Growth Focus</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Choose the audience-growth goal and how deterministic topic matches should be interpreted. Topic classification remains evidence; these roles decide whether an opportunity is Core, Adjacent, or Outside current focus.
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
            onClick={() => reset.mutate()}
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
      </section>

      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Topics and their role</h3>
          <p className="mt-1 text-sm text-slate-600">Terms drive deterministic classification. The role controls strategy: Core is normal focus, Adjacent is allowed when technically relevant, and Off is treated as outside current focus unless you explicitly choose to use an opportunity anyway.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {draft.contentGroups.map((group) => (
            <GroupEditor
              key={group.tag}
              group={group}
              onChange={(terms) => updateGroup('contentGroups', group.tag, terms)}
              onRoleChange={(role) => updateContentRole(group.tag, role)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Who we want in the audience</h3>
          <p className="mt-1 text-sm text-slate-600">Broader profile-language matches used to decide whether a follower or followed account fits the target technical network.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {draft.audienceGroups.map((group) => (
            <GroupEditor key={group.tag} group={group} onChange={(terms) => updateGroup('audienceGroups', group.tag, terms)} />
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
        <strong className="text-slate-800">Current scope:</strong> Growth Focus changes how current candidate classification is interpreted and how audience fit is reviewed. It does not rewrite live X source-search queries, approve content, or change Writer strategy behavior.
      </div>
    </div>
  )
}
