import { useEffect, useRef, useState } from 'react'
import {
  useAISettings,
  useAIRuntimeAvailability,
  useAICatalogPreview,
  useViralResearch,
  useViralResearchRun,
  useViralResearchStatus,
  useViralResearchStop,
  type AIProfileView,
  type ViralResearchGroup,
  type ViralResearchPost,
} from '../../api/client'
import {
  Badge,
  Disclosure,
  Error,
  Loading,
  StatCard,
  formatDateTime,
  formatNumber,
} from '../../components/primitives'

const INPUT = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800'
const LABEL = 'text-xs font-medium uppercase tracking-wide text-slate-500'

type EvidenceView = 'evidence' | 'intent' | 'niche' | 'posts'
type IntentMode = 'profile' | 'runtime'

const CHECKPOINT_LABELS: Record<string, string> = {
  queued: 'Queued',
  discovering: 'Discover',
  enriching: 'Enrich posts',
  controls: 'Author controls',
  threads: 'Threads',
  intent_ai: 'AI intent',
  analyzing: 'Analyze',
  exporting: 'Export',
  complete: 'Complete',
  stopped: 'Stopped',
  failed: 'Failed',
}

function displayLabel(value: string) {
  return value.replaceAll('_', ' ').replaceAll('/', ' / ')
}

function percent(value: number | null | undefined, digits = 0) {
  return value == null ? 'n/a' : `${(value * 100).toFixed(digits)}%`
}

function numeric(value: number | null | undefined, digits = 2) {
  return value == null ? 'n/a' : value.toFixed(digits)
}

function evidenceTone(group: ViralResearchGroup): 'success' | 'info' | 'neutral' | 'warning' {
  if (group.evidenceClass === 'STRONG_REPEATED_ASSOCIATION' || group.evidenceClass === 'REPEATED_ASSOCIATION') return 'success'
  if (group.evidenceClass === 'DIRECTIONAL') return 'info'
  if (group.evidenceClass === 'INSUFFICIENT') return 'neutral'
  return 'warning'
}

function GroupCard({ group }: { group: ViralResearchGroup }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{displayLabel(group.groupType)}</div>
          <div className="mt-1 font-semibold text-slate-900">{displayLabel(group.label)}</div>
        </div>
        <Badge tone={evidenceTone(group)}>{displayLabel(group.evidenceClass)}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700 md:grid-cols-4">
        <div><span className="text-slate-500">Posts</span><br /><strong>{group.sampleSize}</strong></div>
        <div><span className="text-slate-500">Authors</span><br /><strong>{group.uniqueAuthors}</strong></div>
        <div><span className="text-slate-500">Views / follower</span><br /><strong>{numeric(group.medianViewsPerFollower)}</strong></div>
        <div><span className="text-slate-500">Median author lift</span><br /><strong>{group.medianAuthorViewsLift == null ? 'n/a' : `${group.medianAuthorViewsLift.toFixed(2)}×`}</strong></div>
      </div>
      <div className="mt-3 text-xs text-slate-600">
        Same-author wins: {group.authorComparableCount
          ? `${group.authorWinCount}/${group.authorComparableCount} · ${percent(group.authorWinRate)} · 90% CI ${percent(group.authorWinRate90CiLow, 1)}–${percent(group.authorWinRate90CiHigh, 1)}`
          : 'not enough comparable posts'}
      </div>
      <div className="mt-1 text-xs text-slate-600">
        Matched-cohort top quartile: {group.cohortComparableCount
          ? `${group.cohortBreakoutCount}/${group.cohortComparableCount} · ${percent(group.cohortBreakoutRate)}`
          : 'not enough comparable posts'}
      </div>
    </div>
  )
}

function PostCard({ post }: { post: ViralResearchPost }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">@{post.username}</div>
          <div className="mt-1 text-xs text-slate-500">
            {post.createdAtIso ? new Date(post.createdAtIso).toLocaleString() : 'Unknown publication time'} · {post.followerCohort} account
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {post.nicheTags.map((tag) => <Badge key={tag} tone="info">{displayLabel(tag)}</Badge>)}
          {post.aiPrimaryIntent && <Badge tone="success">Intent · {displayLabel(post.aiPrimaryIntent)}</Badge>}
          {post.threadLength > 1 && <Badge>Thread · {post.threadLength}{post.threadExpectedLength ? `/${post.threadExpectedLength}` : ''}</Badge>}
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-800">{post.text}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-700 sm:grid-cols-4 lg:grid-cols-6">
        <div><span className="text-slate-500">Views</span><br /><strong>{post.views == null ? 'n/a' : formatNumber(post.views)}</strong></div>
        <div><span className="text-slate-500">Followers</span><br /><strong>{post.authorFollowers == null ? 'n/a' : formatNumber(post.authorFollowers)}</strong></div>
        <div><span className="text-slate-500">Views/follower</span><br /><strong>{numeric(post.viewsPerFollower)}</strong></div>
        <div><span className="text-slate-500">Engagement/view</span><br /><strong>{percent(post.engagementsPerView, 2)}</strong></div>
        <div><span className="text-slate-500">Author lift</span><br /><strong>{post.authorViewsLift == null ? 'n/a' : `${post.authorViewsLift.toFixed(2)}×`}</strong></div>
        <div><span className="text-slate-500">Cohort percentile</span><br /><strong>{post.cohortPercentile == null ? 'n/a' : percent(post.cohortPercentile)}</strong></div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {post.hookLabels.map((label) => <Badge key={`hook-${label}`}>Hook · {displayLabel(label)}</Badge>)}
        {post.styleLabels.map((label) => <Badge key={`style-${label}`}>Style · {displayLabel(label)}</Badge>)}
        {post.aiSemanticStyle && <Badge tone="info">AI style · {displayLabel(post.aiSemanticStyle)}</Badge>}
        {post.aiAngle && <Badge>Angle · {displayLabel(post.aiAngle)}</Badge>}
      </div>

      {post.aiPrimaryIntent && (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <strong>AI semantic read</strong>
            <Badge tone="success">{Math.round((post.aiIntentConfidence || 0) * 100)}% confidence</Badge>
            {post.aiIntentModel && <Badge>{post.aiIntentModel}</Badge>}
          </div>
          {post.aiIntentRationale && <p className="mt-2">{post.aiIntentRationale}</p>}
          {post.aiIntentEvidenceSpans.length > 0 && (
            <div className="mt-2 text-xs text-slate-600">
              Evidence: {post.aiIntentEvidenceSpans.map((span) => `“${span}”`).join(' · ')}
            </div>
          )}
          <div className="mt-2 text-xs text-slate-500">
            Goal: {displayLabel(post.aiAudienceGoal || 'unknown')} · Reader action: {displayLabel(post.aiReaderAction || 'none')}
          </div>
        </div>
      )}

      <Disclosure summary="Research provenance">
        <div className="space-y-1 text-xs text-slate-600">
          <div><strong>Sample:</strong> {post.sampleKind || 'unknown'}</div>
          <div><strong>Discovery query:</strong> {post.sourceQuery || 'not recorded'}</div>
          <div><strong>Niche matches:</strong> {post.nicheMatches.join(', ') || 'none'}</div>
          <div><strong>Thread completeness:</strong> {post.threadLength > 1 ? String(post.threadComplete) : 'single post'}</div>
        </div>
      </Disclosure>

      <a href={post.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
        Open on X
      </a>
    </article>
  )
}

export function ViralStyles() {
  const [days, setDays] = useState(21)
  const research = useViralResearch(days)
  const status = useViralResearchStatus()
  const run = useViralResearchRun()
  const stop = useViralResearchStop()
  const aiSettings = useAISettings()
  const runtimeAvailability = useAIRuntimeAvailability()
  const catalogPreview = useAICatalogPreview()

  const [niches, setNiches] = useState<string[]>([])
  const [thresholds, setThresholds] = useState<string[]>(['strong'])
  const [limitPerQuery, setLimitPerQuery] = useState(5)
  const [controlsPerSeed, setControlsPerSeed] = useState(0)
  const [threads, setThreads] = useState(true)
  const [intentEnabled, setIntentEnabled] = useState(true)
  const [intentMode, setIntentMode] = useState<IntentMode>('runtime')
  const [profileId, setProfileId] = useState('')
  const [runtime, setRuntime] = useState('')
  const [model, setModel] = useState('')
  const [reasoning, setReasoning] = useState('')
  const [view, setView] = useState<EvidenceView>('evidence')
  const initialized = useRef(false)
  const lastTerminalJob = useRef('')

  const data = research.data
  const job = status.data?.job || data?.job || null
  const active = job?.status === 'running' || job?.status === 'stopping'
  const profiles = (aiSettings.data?.profiles || []).filter((profile) => profile.enabled && ['supported', 'compatible_fallback'].includes(profile.capability))
  const runtimeTypes = new Set(data?.options.runtimeTypes || [])
  const runtimes = (runtimeAvailability.data?.runtimes || []).filter((item) => (
    runtimeTypes.has(item.runtime)
    && item.installed
    && item.structuredOutput !== 'unsupported'
  ))

  useEffect(() => {
    if (!data || initialized.current) return
    initialized.current = true
    setNiches(data.options.niches.map((item) => item.tag))
    if (profiles.length > 0) setIntentMode('profile')
    const defaultRuntime = runtimes.find((item) => item.runtime === 'codex') || runtimes[0]
    if (defaultRuntime) setRuntime(defaultRuntime.runtime)
  }, [data, profiles.length, runtimes])

  useEffect(() => {
    if (!intentEnabled || intentMode !== 'runtime' || !runtime) return
    setModel('')
    setReasoning('')
    catalogPreview.mutate({ runtime: runtime as AIProfileView['runtime'] })
    // catalogPreview is a mutation object; runtime is the operator-controlled invalidation key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentEnabled, intentMode, runtime])

  useEffect(() => {
    if (!job || !['complete', 'failed', 'stopped'].includes(job.status) || lastTerminalJob.current === job.id) return
    lastTerminalJob.current = job.id
    void research.refetch()
  }, [job, research])

  const catalog = catalogPreview.data?.models || []
  const selectedModel = catalog.find((item) => item.id === model) || null
  const reasoningLevels = selectedModel?.reasoningLevels?.length
    ? selectedModel.reasoningLevels
    : runtime === 'agy'
      ? ['low', 'medium', 'high']
      : []

  const searchJobs = niches.length * Math.ceil(days / 7) * thresholds.length
  const maxSeeds = searchJobs * limitPerQuery
  const aiReady = !intentEnabled
    || (intentMode === 'profile' ? Boolean(profileId) : Boolean(runtime && model))
  const canRun = Boolean(data && niches.length && thresholds.length && aiReady && !active)

  const toggle = (value: string, selected: string[], setter: (values: string[]) => void) => {
    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }

  if (research.isLoading) return <Loading message="Loading viral-style research..." />
  if (research.error) return <Error message={research.error.message} onRetry={() => research.refetch()} />
  if (!data) return <Error message="Viral-style research data is unavailable." />

  const report = data.report

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Viral Styles</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Study how high-performing X posts are written across niches. Collection is read-only; AI classifies text-supported communicative intent, not private motivation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">Read-only X research</Badge>
          <Badge>90% association intervals</Badge>
          <Badge>Human-selected scope</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stored posts" value={report.dataset.totalStoredPosts} note={`${report.dataset.totalStoredSnapshots} metric/profile snapshots`} />
        <StatCard label={`Mature · ${days}d`} value={report.dataset.eligiblePosts} note={`${report.dataset.eligibleAuthors} authors`} />
        <StatCard label="Comparable to author" value={report.dataset.authorComparablePosts} note="Same author + same post-age band" />
        <StatCard label="AI intent labeled" value={report.dataset.aiIntentLabeledPosts} note="Confidence ≥ 60% in mature sample" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Run historical research</h3>
            <p className="mt-1 text-sm text-slate-600">Nothing runs until you review these choices and press Run research.</p>
          </div>
          <Badge tone={active ? 'warning' : 'neutral'}>{active ? `Active · ${displayLabel(job?.stage || '')}` : 'Idle'}</Badge>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <div className={LABEL}>1 · Historical window</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.options.windows.map((window) => (
                  <button key={window} type="button" onClick={() => setDays(window)} className={`rounded-md border px-3 py-2 text-sm ${days === window ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
                    Last {window} days
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className={LABEL}>2 · Niches</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {data.options.niches.map((niche) => (
                  <label key={niche.tag} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <input type="checkbox" checked={niches.includes(niche.tag)} onChange={() => toggle(niche.tag, niches, setNiches)} />
                    {niche.label}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <button type="button" className="underline" onClick={() => setNiches(data.options.niches.map((item) => item.tag))}>Select all</button>
                <button type="button" className="underline" onClick={() => setNiches([])}>Clear</button>
              </div>
            </div>

            <div>
              <div className={LABEL}>3 · Discovery floor</div>
              <div className="mt-2 space-y-2">
                {data.options.thresholds.map((threshold) => (
                  <label key={threshold.name} className="flex items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <input className="mt-0.5" type="checkbox" checked={thresholds.includes(threshold.name)} onChange={() => toggle(threshold.name, thresholds, setThresholds)} />
                    <span>
                      <strong>{displayLabel(threshold.name)}</strong>
                      <span className="block text-xs text-slate-500">≥ {threshold.minFaves} likes · {threshold.minRetweets} reposts · {threshold.minReplies} replies</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">These only narrow X candidate discovery. Final analysis still normalizes for followers, age, and author/cohort comparisons.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                <span className={LABEL}>Max posts / query</span>
                <select className={INPUT} value={limitPerQuery} onChange={(event) => setLimitPerQuery(Number(event.target.value))}>
                  {[3, 5, 8, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className={LABEL}>Same-author controls / seed</span>
                <select className={INPUT} value={controlsPerSeed} onChange={(event) => setControlsPerSeed(Number(event.target.value))}>
                  {[0, 1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={threads} onChange={(event) => setThreads(event.target.checked)} />
              Reconstruct likely threads when observable
            </label>
          </div>

          <div className="space-y-5">
            <div>
              <div className={LABEL}>4 · AI semantic analysis</div>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={intentEnabled} onChange={(event) => setIntentEnabled(event.target.checked)} />
                Classify author intent and semantic presentation style
              </label>
              <p className="mt-2 text-xs text-slate-500">The model receives only stored tweet/thread text. It returns constrained labels, confidence, rationale, and exact evidence spans through the Phase-6 structured runtime.</p>
            </div>

            {intentEnabled && (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setIntentMode('profile')} className={`rounded-md border px-3 py-2 text-sm ${intentMode === 'profile' ? 'border-slate-900 bg-white font-medium' : 'border-slate-200 text-slate-600'}`}>AI Settings profile</button>
                  <button type="button" onClick={() => setIntentMode('runtime')} className={`rounded-md border px-3 py-2 text-sm ${intentMode === 'runtime' ? 'border-slate-900 bg-white font-medium' : 'border-slate-200 text-slate-600'}`}>Runtime + exact model</button>
                </div>

                {intentMode === 'profile' ? (
                  <label className="block text-sm text-slate-700">
                    <span className={LABEL}>Profile</span>
                    <select className={INPUT} value={profileId} onChange={(event) => setProfileId(event.target.value)}>
                      <option value="">Select configured profile…</option>
                      {profiles.map((profile) => <option key={profile.id || profile.name} value={profile.id || ''}>{profile.name} · {profile.model}</option>)}
                    </select>
                    {profiles.length === 0 && <span className="mt-2 block text-xs text-amber-700">No enabled structured profiles. Use Runtime + exact model here, or configure one in <a className="underline" href="#/advanced/ai">AI Settings</a>.</span>}
                  </label>
                ) : (
                  <>
                    <label className="block text-sm text-slate-700">
                      <span className={LABEL}>Structured runtime</span>
                      <select className={INPUT} value={runtime} onChange={(event) => setRuntime(event.target.value)}>
                        <option value="">Select runtime…</option>
                        {runtimes.map((item) => <option key={item.runtime} value={item.runtime}>{item.runtime} · {item.version || 'installed'}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm text-slate-700">
                      <span className={LABEL}>Exact model</span>
                      <select className={INPUT} value={model} onChange={(event) => { setModel(event.target.value); setReasoning('') }} disabled={!runtime || catalogPreview.isPending}>
                        <option value="">{catalogPreview.isPending ? 'Loading models…' : 'Select model…'}</option>
                        {catalog.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
                      </select>
                      {catalogPreview.error && <span className="mt-2 block text-xs text-red-700">{catalogPreview.error.message}</span>}
                    </label>
                    <label className="block text-sm text-slate-700">
                      <span className={LABEL}>Reasoning / effort</span>
                      <select className={INPUT} value={reasoning} onChange={(event) => setReasoning(event.target.value)} disabled={!model}>
                        <option value="">Runtime/model default</option>
                        {reasoningLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Run summary</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>Search jobs<br /><strong>{searchJobs}</strong></div>
                <div>Maximum seed candidates<br /><strong>{maxSeeds}</strong></div>
                <div>Niches<br /><strong>{niches.length}</strong></div>
                <div>AI intent<br /><strong>{intentEnabled ? (intentMode === 'profile' ? 'profile' : model || 'choose model') : 'off'}</strong></div>
              </div>
              <p className="mt-3 text-xs text-slate-500">The sweep runs sequentially to avoid duplicate browser load. Stop takes effect between bounded search or AI batches.</p>
            </div>

            {(run.error || stop.error) && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{run.error?.message || stop.error?.message}</div>}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canRun || run.isPending}
                onClick={() => run.mutate({
                  days,
                  niches,
                  thresholds,
                  limitPerQuery,
                  controlsPerSeed,
                  threads,
                  intent: intentEnabled
                    ? intentMode === 'profile'
                      ? { enabled: true, mode: 'profile', profileId: Number(profileId) }
                      : { enabled: true, mode: 'runtime', runtime, model, reasoning }
                    : { enabled: false, mode: intentMode },
                })}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {run.isPending ? 'Starting…' : 'Run research'}
              </button>
              {active && (
                <button type="button" disabled={stop.isPending || job?.status === 'stopping'} onClick={() => stop.mutate()} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">
                  {job?.status === 'stopping' ? 'Stopping…' : 'Stop after current unit'}
                </button>
              )}
            </div>
            {!aiReady && intentEnabled && <p className="text-xs text-amber-700">Choose the exact AI profile or runtime model before starting.</p>}
          </div>
        </div>
      </section>

      {job && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Research run</h3>
              <p className="mt-1 text-xs text-slate-500">Started {formatDateTime(job.startedAt)} · {job.completedAt ? `Finished ${formatDateTime(job.completedAt)}` : 'in progress'}</p>
            </div>
            <Badge tone={job.status === 'complete' ? 'success' : job.status === 'failed' ? 'danger' : job.status === 'stopped' ? 'neutral' : 'warning'}>{displayLabel(job.status)}</Badge>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Checkpoint · <strong className="text-slate-800">{CHECKPOINT_LABELS[job.checkpoint] || displayLabel(job.checkpoint)}</strong></span>
              <span>{Math.round(job.progressPercent || 0)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`Research progress ${Math.round(job.progressPercent || 0)}%`}>
              <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${Math.max(0, Math.min(100, job.progressPercent || 0))}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                'queued',
                'discovering',
                'enriching',
                ...(job.config.controlsPerSeed > 0 ? ['controls'] : []),
                ...(job.config.threads ? ['threads'] : []),
                ...(job.config.intent.enabled ? ['intent_ai'] : []),
                'analyzing',
                'exporting',
                'complete',
              ].map((checkpoint) => {
                const seen = job.events.some((event) => event.checkpoint === checkpoint)
                const current = job.checkpoint === checkpoint
                return (
                  <span key={checkpoint} className={`rounded-full border px-2 py-1 text-xs ${current ? 'border-slate-900 bg-slate-900 text-white' : seen ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-400'}`}>
                    {CHECKPOINT_LABELS[checkpoint] || displayLabel(checkpoint)}
                  </span>
                )
              })}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Stage" value={displayLabel(job.stage)} />
            <StatCard label="Search jobs" value={`${job.progress.completedJobs}/${job.progress.totalJobs || searchJobs}`} />
            <StatCard label="Seed observations" value={job.progress.totalSeeds || 0} />
            <StatCard label="Collection errors" value={job.progress.totalErrors || 0} />
          </div>
          {job.progress.current && (
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              Current: <strong>{job.progress.current.nicheLabel}</strong> · {displayLabel(job.progress.current.threshold)} · {job.progress.current.since} → {job.progress.current.until}
            </div>
          )}
          {job.progress.currentCandidate && (
            <div className="mt-2 text-xs text-slate-600">
              Candidate progress: {job.progress.currentCandidate.completed}/{job.progress.currentCandidate.total ?? '?'}
              {job.progress.currentCandidate.candidateId ? ` · ${job.progress.currentCandidate.candidateId}` : ''}
              {job.progress.currentCandidate.message ? ` · ${job.progress.currentCandidate.message}` : ''}
            </div>
          )}
          {job.intentProgress && (
            <div className="mt-3 text-sm text-slate-700">AI intent: batch {job.intentProgress.completedBatches}/{job.intentProgress.totalBatches} · {job.intentProgress.classified} posts classified</div>
          )}
          {job.events.length > 0 && (
            <Disclosure summary={`Recent checkpoint activity · ${job.events.length}`}>
              <div className="space-y-2 text-xs text-slate-600">
                {job.events.slice(-12).reverse().map((event, index) => (
                  <div key={`${event.at}-${event.checkpoint}-${index}`} className="flex gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="w-20 shrink-0 text-slate-400">{new Date(event.at).toLocaleTimeString()}</span>
                    <span className="w-24 shrink-0 font-medium text-slate-700">{CHECKPOINT_LABELS[event.checkpoint] || displayLabel(event.checkpoint)}</span>
                    <span>{event.message}</span>
                  </div>
                ))}
              </div>
            </Disclosure>
          )}
          {job.error && <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{job.error}</div>}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Research findings</h3>
            <p className="mt-1 text-sm text-slate-600">Mature posts only · {days}-day window · generated {formatDateTime(report.generatedAt)}</p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {([
              ['evidence', 'Evidence'],
              ['intent', 'Intent & style'],
              ['niche', 'Niche & timing'],
              ['posts', 'Posts'],
            ] as [EvidenceView, string][]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setView(id)} className={`rounded-md px-3 py-1.5 text-sm ${view === id ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>
            ))}
          </div>
        </div>

        {view === 'evidence' && (
          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-center gap-2"><h4 className="font-semibold text-slate-900">Supported associations</h4><Badge tone="success">{report.supportedGroups.length}</Badge></div>
              <p className="mt-1 text-xs text-slate-500">Repeated evidence inside this selected dataset. Not causal X ranking claims.</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {report.supportedGroups.length ? report.supportedGroups.map((group) => <GroupCard key={`${group.groupType}-${group.label}`} group={group} />) : <div className="text-sm text-slate-500">No group currently clears the repeated-association threshold.</div>}
              </div>
            </div>
            <Disclosure summary={`Directional signals · ${report.directionalGroups.length}`}>
              <div className="grid gap-3 lg:grid-cols-2">{report.directionalGroups.slice(0, 30).map((group) => <GroupCard key={`${group.groupType}-${group.label}`} group={group} />)}</div>
            </Disclosure>
          </div>
        )}

        {view === 'intent' && (
          <div className="mt-5 space-y-5">
            <div>
              <h4 className="font-semibold text-slate-900">AI author-intent groups</h4>
              <p className="mt-1 text-xs text-slate-500">Text-supported communicative purpose, classified through the selected Phase-6 model.</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {report.intentGroups.length ? report.intentGroups.map((group) => <GroupCard key={`intent-${group.label}`} group={group} />) : <div className="text-sm text-slate-500">Run AI semantic analysis to populate intent groups.</div>}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Semantic presentation style</h4>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {report.semanticStyleGroups.length ? report.semanticStyleGroups.map((group) => <GroupCard key={`semantic-${group.label}`} group={group} />) : <div className="text-sm text-slate-500">No semantic-style labels yet.</div>}
              </div>
            </div>
          </div>
        )}

        {view === 'niche' && (
          <div className="mt-5 space-y-5">
            <div>
              <h4 className="font-semibold text-slate-900">Niche coverage</h4>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">{report.nicheGroups.map((group) => <GroupCard key={`niche-${group.label}`} group={group} />)}</div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">UTC timing observations</h4>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {report.timing.map((slot) => (
                  <div key={slot.utcHour} className="rounded-md border border-slate-200 p-3 text-sm">
                    <strong>{String(slot.utcHour).padStart(2, '0')}:00 UTC</strong>
                    <div className="mt-1 text-xs text-slate-500">n={slot.sampleSize} · {slot.uniqueAuthors} authors</div>
                    <div className="mt-2 text-xs">Median views/follower <strong>{numeric(slot.medianViewsPerFollower)}</strong></div>
                  </div>
                ))}
                {!report.timing.length && <div className="text-sm text-slate-500">Not enough posts per UTC hour yet.</div>}
              </div>
            </div>
          </div>
        )}

        {view === 'posts' && (
          <div className="mt-5 space-y-4">
            <p className="text-xs text-slate-500">Sorted by views/follower within the current mature sample. High reach is evidence to inspect, not a style recommendation by itself.</p>
            {report.posts.map((post) => <PostCard key={post.tweetId} post={post} />)}
            {!report.posts.length && <div className="text-sm text-slate-500">No mature stored posts in this window.</div>}
          </div>
        )}
      </section>
    </div>
  )
}
