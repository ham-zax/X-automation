import { useState } from 'react'
import {
  type GrowthProductPolicy,
  type GrowthPolicyView,
  useGrowthPolicy,
  useSaveGrowthPolicy,
  useGrowthAnalysis,
  useRefreshGrowthAnalysis,
} from '../../api/client'
import { Error, Loading } from '../../components/primitives'

const sectionClass = 'rounded-xl border border-slate-200 bg-white p-5 space-y-4'
const inputClass = 'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900'
const laneNames: ('reply'|'quote'|'original')[] = ['reply','quote','original']
const interestLabels: Record<string,string> = {
  code_demos:'Code, repositories & examples', ai_breakthroughs:'AI and model breakthroughs',
  tool_discoveries:'Interesting developer tools', builder_lessons:'Builder lessons and experiments',
  industry_commentary:'Industry commentary',
}

function Editor({ initial }: { initial: GrowthPolicyView }) {
  const [draft, setDraft] = useState<GrowthProductPolicy>(initial.policy)
  const save = useSaveGrowthPolicy()
  const set = (path: string[], value: string|number|boolean|number[]|null) => {
    setDraft((previous) => {
      const next = structuredClone(previous)
      let node = next as unknown as Record<string, unknown>
      for (const key of path.slice(0,-1)) node = node[key] as Record<string,unknown>
      node[path[path.length-1]] = value
      return next
    })
  }
  const number = (path: string[], value: string) => set(path, Number(value))
  const field = (label:string,path:string[],value:number,min=0,max=100,description?:string) => (
    <label className="block text-sm text-slate-700" key={path.join('.')}>
      <span className="font-medium">{label}</span>
      <input type="number" min={min} max={max} className={inputClass} value={value}
        onChange={e => number(path,e.target.value)} />
      {description && <span className="mt-1 block text-xs text-slate-500">{description}</span>}
    </label>
  )
  const toggle = (label:string,path:string[],checked:boolean) => (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700" key={path.join('.')}>
      <input type="checkbox" checked={checked} onChange={e=>set(path,e.target.checked)} />{label}
    </label>
  )
  return <div className="space-y-5">
    <section className={sectionClass}>
      <h3 className="font-semibold text-slate-900">Activity & rest</h3>
      <p className="text-sm text-slate-600">Regular autonomous sends rest at night. Verified breaking opportunities may interrupt sleep, but not safety checks.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Timezone<input className={inputClass} value={draft.activity.timeZone}
          onChange={e => set(['activity','timeZone'],e.target.value)} placeholder="Asia/Kolkata" /></label>
        {(['sleepStart','sleepEnd'] as const).map(k=><label className="text-sm" key={k}>{k==='sleepStart'?'Sleep starts':'Wake time'}
          <input type="time" className={inputClass} value={draft.activity[k]} onChange={e=>set(['activity',k],e.target.value)} /></label>)}
        {field('Discovery check (minutes)',['activity','discoveryIntervalMinutes'],draft.activity.discoveryIntervalMinutes,5,120,'The service probes every ~5 minutes for breaking events; this controls ordinary full-feed collection. Emergencies can override it.')}
      </div>
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold text-slate-900">Independent publication lanes</h3>
      <p className="text-sm text-slate-600">Replies should dominate. These are quality/selectivity preferences, not a forced daily post target.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {laneNames.map(lane=><div key={lane} className="space-y-3 rounded-lg border border-slate-200 p-4">
          <strong className="capitalize">{lane}s</strong>
          <div>{toggle('Autonomous lane enabled',['lanes',lane,'enabled'],draft.lanes[lane].enabled)}</div>
          {field('Priority',['lanes',lane,'priority'],draft.lanes[lane].priority)}
          {field('Editorial selectivity',['lanes',lane,'editorialMinimum'],draft.lanes[lane].editorialMinimum)}
          <label className="block text-sm">Optional 24-hour maximum
            <input type="number" min={1} max={500} placeholder="Unlimited" className={inputClass}
              value={draft.lanes[lane].dailyLimit ?? ''}
              onChange={e=>set(['lanes',lane,'dailyLimit'],e.target.value===''?null:Number(e.target.value))} />
            <span className="text-xs text-slate-500">Blank = no cap. An existing uncertain send counts toward the limit.</span>
          </label>
        </div>)}
      </div>
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold text-slate-900">Topics, code & voice</h3>
      <p className="text-sm text-slate-600">Show useful code and emerging projects, not just announcements. Topic scores rank discovery; they do not authorize fabricated experiences.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(draft.editorial.interests).map(([key,value])=>field(interestLabels[key]||key,['editorial','interests',key],value))}
      </div>
      <label className="block text-sm">Additional writing direction
        <textarea className={`${inputClass} min-h-24`} maxLength={2000} value={draft.editorial.voiceGuidance}
          onChange={e=>set(['editorial','voiceGuidance'],e.target.value)} />
      </label>
      {toggle('Replies first',['editorial','prioritizeReplies'],draft.editorial.prioritizeReplies)}
      <p className="text-sm"><a href="#/settings/persona" className="text-sky-700 underline">Edit detailed persona, voice and recorded beliefs →</a></p>
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold text-slate-900">Breaking-event sensitivity</h3>
      <p className="text-sm text-slate-600">Fresh likes, replies and independently observed acceleration are signals, not a fixed “viral” class. Breaking news still requires source verification.</p>
      <div>{toggle('Allow verified emergency overrides',['breakthrough','enabled'],Boolean(draft.breakthrough.enabled))}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(draft.breakthrough).filter(([key])=>key!=='enabled').map(([key,value])=>field(key.replaceAll(/([A-Z])/g,' $1'),['breakthrough',key],Number(value),1,100000))}
      </div>
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold text-slate-900">Audience growth & learning</h3>
      <p className="text-sm text-slate-600">An account with a larger, measured audience can be less restrictive about substantial timeline posts. Growth never forces output.</p>
      <div>{toggle('Adapt selectivity as audience grows',['audience','followerExpansion'],draft.audience.followerExpansion)}</div>
      <p className="text-xs text-slate-500">Current observed followers: {initial.audience.observedFollowers?.toLocaleString() ?? 'unknown or stale'} · tier {initial.audience.tier} · effective selectivity {initial.audience.selectivity}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Follower milestones (ascending, start at zero)
          <input className={inputClass} value={draft.audience.milestones.join(', ')}
            onChange={e=>set(['audience','milestones'],e.target.value.split(',').map(x=>Number(x.trim())))} />
        </label>
        <label className="text-sm">Relative selectivity by follower tier (0–100)
          <input className={inputClass} value={draft.audience.feedSelectivityByTier.join(', ')}
            onChange={e=>set(['audience','feedSelectivityByTier'],e.target.value.split(',').map(x=>Number(x.trim())))} />
        </label>
      </div>
      <div>{toggle('Use measured analytics to guide writing',['learning','enabled'],draft.learning.enabled)}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field('Analysis lookback (days)',['learning','lookbackDays'],draft.learning.lookbackDays,1,365)}
        {field('Minimum posts per comparable style',['learning','minimumSample'],draft.learning.minimumSample,2,1000)}
      </div>
      {toggle('Allow low-sample volume suggestions (caution)',['learning','allowWeakEvidenceToAdjustVolume'],draft.learning.allowWeakEvidenceToAdjustVolume)}
    </section>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={save.isPending} onClick={()=>save.mutate(draft)}
        className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{save.isPending?'Saving…':'Save publishing policy'}</button>
      <button type="button" className="rounded-lg border px-4 py-3 text-sm" onClick={()=>setDraft(initial.policy)}>Reset edits</button>
      {save.isError && <span role="alert" className="text-sm text-red-700">{save.error.message}</span>}
      {save.isSuccess && <span className="text-sm text-emerald-700">Policy saved. New scout and claims read it immediately.</span>}
    </div>
  </div>
}

function LearningReport() {
  const analysis = useGrowthAnalysis()
  const refresh = useRefreshGrowthAnalysis()
  return <section className={sectionClass}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Observed performance feedback</h3>
      <p className="text-sm text-slate-600">Only real captured metrics. An independent analytics agent can add missing snapshots via the existing analytics-record command.</p></div>
      <button type="button" className="rounded-md border px-3 py-2 text-sm" disabled={refresh.isPending} onClick={()=>refresh.mutate()}>{refresh.isPending?'Analyzing…':'Recompute insights'}</button></div>
    {refresh.isError && <p className="text-sm text-red-700">{refresh.error.message}</p>}
    {analysis.isLoading && <p className="text-sm text-slate-600">Loading measurements…</p>}
    {analysis.data && <>
      <p className="text-sm text-slate-700">Measured posts: {analysis.data.measuredPosts} · Verified comparable styles: {analysis.data.verifiedStyleGroups || 0} · Revision {analysis.data.revision || '—'}</p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">{analysis.data.recommendations.map((r,i)=><li key={i}>{r}</li>)}</ul>
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Style</th><th>Sample</th><th>Median impressions</th><th>Median engagement %</th></tr></thead><tbody>{(analysis.data.groups||[]).filter(g=>g.dimension==='style').map(g=><tr key={g.label} className="border-b"><td className="p-2">{g.label}{!g.verified?' (small sample)':''}</td><td>{g.sample}</td><td>{g.medianImpressions?.toLocaleString()??'—'}</td><td>{g.medianEngagementRate?.toFixed(2)??'—'}</td></tr>)}</tbody></table></div>
    </>}
  </section>
}

export function GrowthPolicySettings() {
  const query = useGrowthPolicy()
  if (query.isLoading) return <Loading message="Loading publishing settings…" />
  if (query.error) return <Error message={query.error.message} onRetry={()=>query.refetch()} />
  if (!query.data) return <Error message="Publishing policy is unavailable." />
  return <div className="space-y-6">
    <div><a href="#/settings" className="text-sm text-slate-500">← Settings</a>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Publishing strategy</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">A single, versioned policy used by discovery, Luna and the publication claim. No settings disable source integrity, duplicate protection, approval authority or reconciliation.</p></div>
    <Editor initial={query.data} key={JSON.stringify(query.data.policy)} />
    <LearningReport />
  </div>
}
