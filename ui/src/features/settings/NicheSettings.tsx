import { useEffect, useState } from 'react'
import { useNiche, useNicheReset, useNicheSave, type NicheGroup, type NicheProfile } from '../../api/client'
import { Badge, Error, Loading, formatDateTime } from '../../components/primitives'

function cloneProfile(profile: NicheProfile): NicheProfile {
  return {
    contentGroups: profile.contentGroups.map((group) => ({ ...group, terms: [...group.terms] })),
    audienceGroups: profile.audienceGroups.map((group) => ({ ...group, terms: [...group.terms] })),
    deprioritizedTerms: [...profile.deprioritizedTerms],
    exclusionTerms: [...profile.exclusionTerms],
  }
}

function splitTerms(value: string) {
  return [...new Set(value.split(/\n|,/).map((term) => term.trim().toLowerCase()).filter(Boolean))]
}

function GroupEditor({ group, onChange }: { group: NicheGroup; onChange: (terms: string[]) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{group.label}</div>
          <div className="mt-1 text-xs text-slate-500">{group.terms.length} matching terms</div>
        </div>
        {group.requiresTechnicalContext && <Badge tone="neutral">Needs technical context</Badge>}
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
  const { data, isLoading, error, refetch } = useNiche()
  const save = useNicheSave()
  const reset = useNicheReset()
  const [draft, setDraft] = useState<NicheProfile | null>(null)

  useEffect(() => {
    if (data?.profile) setDraft(cloneProfile(data.profile))
  }, [data])

  if (isLoading) return <Loading message="Loading niche settings..." />
  if (error) return <Error message={error.message} onRetry={() => refetch()} />
  if (!data || !draft) return <Error message="Niche settings are unavailable." />

  const updateGroup = (kind: 'contentGroups' | 'audienceGroups', tag: string, terms: string[]) => {
    setDraft((current) => current ? {
      ...current,
      [kind]: current[kind].map((group) => group.tag === tag ? { ...group, terms } : group),
    } : current)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="#/advanced" className="text-sm font-medium text-slate-500 hover:text-slate-700">← Diagnostics</a>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Your niche</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Define the topics the product should treat as relevant and the kinds of technical profiles that fit the audience you want to build.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge tone={data.customized ? 'info' : 'neutral'}>{data.customized ? 'Customized' : 'Using defaults'}</Badge>
            {data.updatedAt && <span>Last changed {formatDateTime(data.updatedAt)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
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
            {save.isPending ? 'Saving…' : 'Save niche'}
          </button>
        </div>
      </div>

      {(save.isSuccess || reset.isSuccess) && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Niche settings updated. Audience fit is recalculated from the saved profile as it is displayed.
        </div>
      )}
      {(save.isError || reset.isError) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(save.error || reset.error)?.message}
        </div>
      )}

      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">What we want to talk about</h3>
          <p className="mt-1 text-sm text-slate-600">These terms drive the core topic-fit classifier used when new content is evaluated.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {draft.contentGroups.map((group) => (
            <GroupEditor key={group.tag} group={group} onChange={(terms) => updateGroup('contentGroups', group.tag, terms)} />
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
          title="Outside current focus"
          note="Topics that should normally be deprioritized unless the same profile also has strong technical context."
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
        <strong className="text-slate-800">Current scope:</strong> these settings change niche scoring/classification and audience-fit review. They do not rewrite the live X source-search queries yet. AI-assisted niche suggestions are intentionally not part of this first version.
      </div>
    </div>
  )
}
