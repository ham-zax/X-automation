import { useEffect, useMemo, useState } from 'react'
import {
  useBehaviorSelect,
  useDraftAction,
  useDraftMediaRemove,
  useDraftMediaUpload,
  useSession,
  type BehaviorDecision,
  type DraftEditorData,
  type GrowthPackagingReview,
} from '../../api/client'
import {
  Badge,
  Disclosure,
  GatePanel,
  Pending,
  QualityBreakdown,
  TechnicalDetails,
  useDebounced,
} from '../../components/primitives'
import { WritingApproachPanel } from './WritingApproachPanel'

const MEDIA_TYPE_OPTIONS = [
  ['none', 'No visual'],
  ['screenshot', 'Screenshot'],
  ['chart', 'Chart'],
  ['code', 'Code sample'],
  ['diagram', 'Diagram'],
] as const

interface PreviewResult {
  score: number
  gatesView: { passed: boolean; approvalFailures: { message: string }[]; warnings: { message: string }[] }
  breakdown: Record<string, number>
  weightedLength: number | null
  growthPackaging: GrowthPackagingReview | null
}

function displayRiskFlags(flags: string[], growthFitAllowed: boolean): string {
  return flags
    .filter((flag) => !(growthFitAllowed && /^weak niche fit\.?$/i.test(flag.trim())))
    .join(' · ')
}

function GrowthPackagingPanel({ review }: { review: GrowthPackagingReview | null }) {
  if (!review) return null
  const rows = [
    ['Stopping power', review.items.stoppingPower],
    ['Reader payoff', review.items.readerPayoff],
    ['Distribution leverage', review.items.distributionLeverage],
    ['Source / action path', review.items.sourceActionPath],
    ['Interaction opening', review.items.interactionOpening],
    ['Media opportunity', review.items.mediaOpportunity],
    ['Strategy state', review.items.strategyState],
  ] as const
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Growth Packaging</div>
          <div className="mt-1 text-sm text-slate-700">Inspect reader payoff and distribution packaging separately from writing correctness.</div>
          <div className="mt-1 text-xs text-slate-500">This is not a prediction of engagement, virality, or follower growth.</div>
        </div>
        <Badge tone={review.ready ? 'success' : 'warning'}>{review.ready ? 'Ready for approval review' : 'Needs packaging work'}</Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map(([label, item]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm text-slate-800">{label}</strong>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.status.replaceAll('_', ' ')}</span>
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</div>
          </div>
        ))}
      </div>
      {review.blockers.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <strong>Approval blockers:</strong>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {review.blockers.map((blocker) => <li key={blocker.code}>{blocker.message}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function humanizeBehaviorValue(value: string | null | undefined): string {
  if (!value) return 'Not selected'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function BehaviorPanel({ data, readOnly }: { data: DraftEditorData; readOnly: boolean }) {
  const session = useSession()
  const selectBehavior = useBehaviorSelect()
  const current = useMemo<BehaviorDecision | null>(() => {
    const queueBehavior = data.queueItem?.behavior
    if (queueBehavior?.decision === 'ACT') return queueBehavior
    const draftBehavior = data.draft.behavior || data.draft.editor?.behavior
    return draftBehavior?.decision === 'ACT' ? draftBehavior : null
  }, [data])
  const options = session.data?.labels.behavior
  const purposes = options?.purposes || ['technical_value', 'profile_proof', 'discovery', 'relationship', 'support', 'celebration', 'humor', 'taste', 'judgment', 'learning', 'correction', 'de_escalation', 'social_presence']
  const modes = options?.socialModes || ['builder', 'experimenter', 'explainer', 'curious_peer', 'enthusiast', 'skeptic', 'opinionated_peer', 'taste_maker', 'supporter', 'humorist', 'listener', 'personal_update']
  const affects = options?.affectStrategies || ['neutral', 'match', 'amplify', 'contrast', 'de_escalate', 'bridge', 'reward', 'energize', 'understate']
  const affectSources = options?.affectProvenance || ['none', 'known', 'inferred', 'strategic']
  const depths = options?.informationDepths || ['social_only', 'judgment', 'compact_reason', 'technical_explanation', 'reusable_artifact']
  const stages = options?.conversationStages || ['initial', 'reciprocal', 'ongoing', 'familiar', 'self_extension']

  const [primaryPurpose, setPrimaryPurpose] = useState(current?.primaryPurpose || 'technical_value')
  const [secondaryPurposes, setSecondaryPurposes] = useState<string[]>(current?.secondaryPurposes || [])
  const [socialMode, setSocialMode] = useState(current?.socialMode || 'explainer')
  const [affectStrategy, setAffectStrategy] = useState(current?.affectStrategy || 'neutral')
  const [affectProvenance, setAffectProvenance] = useState(current?.affectProvenance || 'none')
  const [informationDepth, setInformationDepth] = useState(current?.informationDepth || 'compact_reason')
  const [conversationStage, setConversationStage] = useState(current?.conversationStage || 'initial')
  const [reasonToExist, setReasonToExist] = useState(current?.reasonToExist || data.queueItem?.routingReason || '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setPrimaryPurpose(current?.primaryPurpose || 'technical_value')
    setSecondaryPurposes(current?.secondaryPurposes || [])
    setSocialMode(current?.socialMode || 'explainer')
    setAffectStrategy(current?.affectStrategy || 'neutral')
    setAffectProvenance(current?.affectProvenance || 'none')
    setInformationDepth(current?.informationDepth || 'compact_reason')
    setConversationStage(current?.conversationStage || 'initial')
    setReasonToExist(current?.reasonToExist || data.queueItem?.routingReason || '')
    setSaved(false)
  }, [current, data.queueItem?.routingReason])

  const toggleSecondary = (purpose: string) => {
    setSaved(false)
    setSecondaryPurposes((values) => values.includes(purpose)
      ? values.filter((value) => value !== purpose)
      : [...values, purpose])
  }

  const saveBehavior = () => {
    if (!reasonToExist.trim() || !data.queueItem) return
    selectBehavior.mutate({
      key: data.draft.candidateKey,
      behavior: {
        decision: 'ACT',
        pipeline: data.pipeline,
        primaryPurpose,
        secondaryPurposes: secondaryPurposes.filter((purpose) => purpose !== primaryPurpose),
        socialMode,
        affectStrategy,
        affectProvenance,
        informationDepth,
        conversationStage,
        reasonToExist: reasonToExist.trim(),
        selectionSource: 'human',
        personaModelVersion: current?.personaModelVersion || '',
        provenance: current?.provenance || {},
        selectedAt: Date.now(),
      },
    }, { onSuccess: () => setSaved(true) })
  }

  if (readOnly) {
    return (
      <Disclosure summary={`Behavior & persona · ${humanizeBehaviorValue(current?.primaryPurpose)} · ${humanizeBehaviorValue(current?.socialMode)} · ${humanizeBehaviorValue(current?.informationDepth)}`}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Purpose</dt><dd className="mt-1 text-slate-800">{humanizeBehaviorValue(current?.primaryPurpose)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mode</dt><dd className="mt-1 text-slate-800">{humanizeBehaviorValue(current?.socialMode)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Affect</dt><dd className="mt-1 text-slate-800">{humanizeBehaviorValue(current?.affectStrategy)} ({humanizeBehaviorValue(current?.affectProvenance)})</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Depth</dt><dd className="mt-1 text-slate-800">{humanizeBehaviorValue(current?.informationDepth)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Conversation</dt><dd className="mt-1 text-slate-800">{humanizeBehaviorValue(current?.conversationStage)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Persona</dt><dd className="mt-1 text-slate-800">{current?.personaModelVersion || data.draft.personaModelVersion || 'Legacy / unknown'}</dd></div>
        </dl>
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{current?.reasonToExist || 'No behavior rationale was recorded.'}</div>
      </Disclosure>
    )
  }

  return (
    <Disclosure summary={`Behavior & persona · ${humanizeBehaviorValue(primaryPurpose)} · ${humanizeBehaviorValue(socialMode)} · ${humanizeBehaviorValue(informationDepth)}`}>
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
        <div className="text-sm font-semibold text-slate-900">Choose the act before editing the prose</div>
        <p className="mt-1 text-sm leading-6 text-slate-600">Every action needs a purpose. A social-only reply may be complete; a technical correction still needs evidence. Saving a change invalidates stale review gates but does not approve or publish.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">Primary purpose
            <select value={primaryPurpose} onChange={(event) => { setPrimaryPurpose(event.target.value); setSaved(false) }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {purposes.map((value) => <option key={value} value={value}>{humanizeBehaviorValue(value)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Social mode
            <select value={socialMode} onChange={(event) => { setSocialMode(event.target.value); setSaved(false) }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {modes.map((value) => <option key={value} value={value}>{humanizeBehaviorValue(value)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Information depth
            <select value={informationDepth} onChange={(event) => { setInformationDepth(event.target.value); setSaved(false) }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {depths.map((value) => <option key={value} value={value}>{humanizeBehaviorValue(value)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Affect strategy
            <select value={affectStrategy} onChange={(event) => {
              const value = event.target.value
              setAffectStrategy(value)
              if (value !== 'neutral' && affectProvenance === 'none') setAffectProvenance('strategic')
              if (value === 'neutral' && affectProvenance === 'strategic') setAffectProvenance('none')
              setSaved(false)
            }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {affects.map((value) => <option key={value} value={value}>{humanizeBehaviorValue(value)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Affect provenance
            <select value={affectProvenance} onChange={(event) => { setAffectProvenance(event.target.value); setSaved(false) }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {affectSources.map((value) => <option key={value} value={value}>{humanizeBehaviorValue(value)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Conversation stage
            <select value={conversationStage} onChange={(event) => { setConversationStage(event.target.value); setSaved(false) }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {stages.map((value) => <option key={value} value={value}>{humanizeBehaviorValue(value)}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Reason to exist
          <textarea value={reasonToExist} onChange={(event) => { setReasonToExist(event.target.value); setSaved(false) }} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Why this exact action belongs in this exact context" />
        </label>
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secondary purposes</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {purposes.filter((purpose) => purpose !== primaryPurpose).map((purpose) => {
              const selected = secondaryPurposes.includes(purpose)
              return (
                <button key={purpose} type="button" onClick={() => toggleSecondary(purpose)} className={`rounded-full border px-3 py-1 text-xs font-medium ${selected ? 'border-indigo-400 bg-indigo-100 text-indigo-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                  {humanizeBehaviorValue(purpose)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={saveBehavior} disabled={!data.queueItem || !reasonToExist.trim() || selectBehavior.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {selectBehavior.isPending ? 'Saving behavior…' : 'Save behavior'}
          </button>
          <span className="text-xs text-slate-500">Persona: {current?.personaModelVersion || data.draft.personaModelVersion || 'active model on save'}</span>
          {saved && <span className="text-xs font-semibold text-emerald-700">Behavior saved; review gates reset.</span>}
          {selectBehavior.error && <span className="text-xs text-red-700">{selectBehavior.error.message}</span>}
        </div>
      </div>
    </Disclosure>
  )
}

export function DraftEditor({ data }: { data: DraftEditorData }) {
  const { draft, pipeline, flags } = data
  const isThread = pipeline === 'thread'
  const readOnly = flags.readOnly
  const editorMeta = (draft.editor || {}) as {
    decision?: string
    riskFlags?: string[]
    semanticAnchors?: string[]
    evidenceUsed?: string[]
    operatorContext?: string
    media?: {
      required?: boolean
      type?: string
      reason?: string
      source?: string
      altText?: string
      attachment?: { fileName?: string; mimeType?: string; size?: number; attachedAt?: number; provenance?: string }
    }
  }

  const [body, setBody] = useState(draft.body)
  const [threadParts, setThreadParts] = useState<string[]>(draft.threadParts?.length ? draft.threadParts : ['', ''])
  const [operatorContext, setOperatorContext] = useState(editorMeta.operatorContext || '')
  const [contextDirty, setContextDirty] = useState(false)
  const [mediaRequired, setMediaRequired] = useState(Boolean(editorMeta.media?.required))
  const [mediaType, setMediaType] = useState(editorMeta.media?.type || 'none')
  const [mediaReason, setMediaReason] = useState(editorMeta.media?.reason || '')
  const [mediaSource, setMediaSource] = useState(editorMeta.media?.source || '')
  const [mediaAltText, setMediaAltText] = useState(editorMeta.media?.altText || '')
  const [dirty, setDirty] = useState(false)
  const [generationOutcome, setGenerationOutcome] = useState<{ decision: string; riskFlags: string[] } | null>(null)

  const [confirmReset, setConfirmReset] = useState(0)
  useEffect(() => {
    if (dirty || contextDirty) return
    setBody(draft.body)
    setThreadParts(draft.threadParts?.length ? draft.threadParts : ['', ''])
    setOperatorContext(editorMeta.operatorContext || '')
    setMediaRequired(Boolean(editorMeta.media?.required))
    setMediaType(editorMeta.media?.type || 'none')
    setMediaReason(editorMeta.media?.reason || '')
    setMediaSource(editorMeta.media?.source || '')
    setMediaAltText(editorMeta.media?.altText || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, confirmReset])

  const previewPayload = useMemo(() => ({
    ...(isThread ? { threadParts } : { body }),
    mediaRequired,
    mediaType,
    ...(mediaReason ? { mediaReason } : {}),
    ...(mediaSource ? { mediaSource } : {}),
    ...(mediaAltText ? { mediaAltText } : {}),
  }), [isThread, body, threadParts, mediaRequired, mediaType, mediaReason, mediaSource, mediaAltText])

  const debouncedPayload = useDebounced(previewPayload, 600)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewPending, setPreviewPending] = useState(false)

  const save = useDraftAction(draft.id, 'save')
  const generate = useDraftAction(draft.id, 'generate')
  const mediaUpload = useDraftMediaUpload(draft.id)
  const mediaRemove = useDraftMediaRemove(draft.id)
  const previewMutation = useDraftAction(draft.id, 'preview')

  useEffect(() => {
    if (!dirty) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewPending(true)
    previewMutation.mutate(debouncedPayload as never, {
      onSuccess: (result) => {
        if (cancelled) return
        setPreview(result as PreviewResult)
        setPreviewPending(false)
      },
      onError: () => {
        if (!cancelled) setPreviewPending(false)
      },
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPayload, dirty])

  const gatesView = dirty && preview ? preview.gatesView : data.draft.gatesView ?? data.analysis.gatesView
  const score = dirty && preview ? preview.score : data.draft.qualityScore
  const breakdown = dirty && preview ? preview.breakdown : data.analysis.breakdown
  const growthPackaging = dirty && preview ? preview.growthPackaging : (data.analysis.growthPackaging ?? data.draft.growthPackaging)
  const qualityClass = score >= 40 ? 'bg-emerald-100 text-emerald-800' : score >= 30 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'

  const hasDraftContent = isThread
    ? threadParts.some((part) => String(part || '').trim())
    : Boolean(body.trim())

  const markDirty = () => setDirty(true)

  const handleSave = () => {
    save.mutate({ ...previewPayload, operatorContext } as never, {
      onSuccess: () => {
        setDirty(false)
        setContextDirty(false)
        setConfirmReset((value) => value + 1)
      },
    })
  }

  const handleGenerate = async () => {
    if (dirty && !window.confirm('Regenerate with AI? Your unsaved edits will be replaced by a new generated draft.')) return
    setGenerationOutcome(null)
    if (contextDirty) {
      try {
        await save.mutateAsync({ operatorContext })
        setContextDirty(false)
      } catch {
        return
      }
    }
    generate.mutate({} as never, {
      onSuccess: (result) => {
        const generated = result as {
          output?: { decision?: string; riskFlags?: string[] }
          editor?: DraftEditorData | null
        }
        const nextDraft = generated.editor?.draft
        if (nextDraft) {
          const nextEditor = (nextDraft.editor || {}) as typeof editorMeta
          setBody(nextDraft.body)
          setThreadParts(nextDraft.threadParts?.length ? nextDraft.threadParts : ['', ''])
          setOperatorContext(nextEditor.operatorContext || '')
          setMediaRequired(Boolean(nextEditor.media?.required))
          setMediaType(nextEditor.media?.type || 'none')
          setMediaReason(nextEditor.media?.reason || '')
          setMediaSource(nextEditor.media?.source || '')
          setMediaAltText(nextEditor.media?.altText || '')
        }
        setGenerationOutcome({
          decision: generated.output?.decision || 'POST',
          riskFlags: generated.output?.riskFlags || [],
        })
        setDirty(false)
        setConfirmReset((value) => value + 1)
      },
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {readOnly ? (flags.engagementReply ? 'Sent reply' : 'Published post') : flags.engagementReply ? 'Reply draft' : 'Post draft'}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{data.candidate.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{data.pipelineLabel}</span>
            <span>·</span>
            <span>{data.queueItem?.statusLabel || draft.status}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${qualityClass}`}>
            {readOnly ? 'Recorded writing quality' : 'Writing quality / structure'} {score}/50 {!readOnly && <>· approval threshold 40 {previewPending && dirty ? '· checking…' : ''}</>}
          </span>
          {data.candidate.url && (
            <a
              href={data.candidate.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open source ↗
            </a>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <strong>{flags.engagementReply ? 'This is the reply that was sent.' : 'This is the text that was published.'}</strong>
          {' '}It is kept as read-only history so later edits cannot rewrite what actually went out.
          {data.queueItem?.outputUrl && (
            <> <a href={data.queueItem.outputUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 underline">View on X ↗</a></>
          )}
        </div>
      )}

      <BehaviorPanel data={data} readOnly={readOnly} />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Additional context for AI</div>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Paste thread details, documentation excerpts, corrections, or facts you already know. The Writer uses this as human-supplied context; it does not browse or independently verify it.
            </p>
          </div>
          <span className="text-xs text-slate-400">{operatorContext.length}/12,000</span>
        </div>
        <textarea
          rows={4}
          value={operatorContext}
          readOnly={readOnly}
          maxLength={12000}
          onChange={(event) => {
            setOperatorContext(event.target.value)
            setContextDirty(true)
          }}
          placeholder="Optional: add missing context from the thread, docs, release notes, your own knowledge, or a correction before generating."
          className={`mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none ${readOnly ? 'bg-slate-50' : 'bg-white'}`}
        />
        {!readOnly && contextDirty && (
          <div className="mt-2 text-xs text-amber-700">This context will be saved before the next Generate/Regenerate action.</div>
        )}
      </section>

      <WritingApproachPanel
        data={data}
        hasDraftContent={hasDraftContent}
        generating={generate.isPending}
        onGenerate={handleGenerate}
      />

      {!readOnly && (
        <>
          {generate.isPending && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
              <Pending label="Generating a draft with AI…" />
            </div>
          )}

          {generationOutcome && !generate.isPending && (
            generationOutcome.decision === 'DO_NOT_POST' ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>AI caution: review this draft.</strong>
                <div className="mt-1">{displayRiskFlags(generationOutcome.riskFlags, data.growthFit.allowed) || 'The Writer could not find a useful thesis from the current context.'}</div>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <strong>Generation completed.</strong> The editor below has been updated with the new AI draft.
              </div>
            )
          )}

          {!generationOutcome && (editorMeta.decision === 'DO_NOT_POST' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>AI caution: review this draft.</strong>
              <div className="mt-1">{displayRiskFlags(editorMeta.riskFlags || [], data.growthFit.allowed) || 'The Writer could not find a useful thesis from the current context.'}</div>
            </div>
          ) : (editorMeta.decision || body) ? (
            <div className="text-sm text-slate-500">
              AI prepared this candidate. Review the exact text and complete the confirmations that apply before approval.
            </div>
          ) : null)}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Approval readiness</div>
            <GatePanel gates={gatesView} />
          </div>
        </>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {flags.engagementReply ? 'Reply text' : isThread ? 'Thread parts' : 'Post text'}
          </label>
          {preview?.weightedLength != null && (
            <span className="text-xs font-medium text-slate-400">{preview.weightedLength}/280</span>
          )}
        </div>
        {isThread ? (
          <div className="space-y-4">
            {threadParts.map((part, index) => (
              <div key={index}>
                <label className="mb-1 block text-xs font-medium text-slate-500">Thread part {index + 1}</label>
                <textarea
                  rows={4}
                  value={part}
                  readOnly={readOnly}
                  onChange={(event) => {
                    markDirty()
                    setThreadParts((parts) => parts.map((p, i) => (i === index ? event.target.value : p)))
                  }}
                  className={`w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none ${readOnly ? 'bg-slate-50' : 'bg-white'}`}
                />
              </div>
            ))}
            {!readOnly && (
              <div className="flex gap-2">
                <button
                  onClick={() => { markDirty(); setThreadParts((parts) => parts.length < 6 ? [...parts, ''] : parts) }}
                  disabled={threadParts.length >= 6}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Add part
                </button>
                <button
                  onClick={() => { markDirty(); setThreadParts((parts) => parts.length > 2 ? parts.slice(0, -1) : parts) }}
                  disabled={threadParts.length <= 2}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Remove last
                </button>
              </div>
            )}
          </div>
        ) : (
          <textarea
            rows={7}
            value={body}
            readOnly={readOnly}
            onChange={(event) => { markDirty(); setBody(event.target.value) }}
            placeholder="Generate a draft or edit the final text here."
            className={`w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none ${readOnly ? 'bg-slate-50' : 'bg-white'}`}
          />
        )}
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Writing quality / structure</div>
        {readOnly ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Recorded writing quality at completion: <strong>{draft.qualityScore}/50</strong>. Component scores are not shown as historical facts because they are recalculated by the current scorer; this score was never a growth or virality prediction.
          </div>
        ) : hasDraftContent
          ? <QualityBreakdown breakdown={breakdown} />
          : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Quality feedback will appear after AI writes a draft or you start typing.
            </div>
          )}
        {!readOnly && (
          <div className="mt-2 text-xs text-slate-500">
            The five writing dimensions total 40 raw points and are proportionally normalized to the 50-point writing-quality scale. This is not predicted engagement, virality, or follower growth; Growth Packaging and Growth fit are evaluated separately.
          </div>
        )}
      </div>

      {!readOnly && <GrowthPackagingPanel review={growthPackaging} />}

      {!readOnly && !flags.engagementReply && (
        <Disclosure summary="Visual plan">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={mediaRequired} onChange={(event) => { markDirty(); setMediaRequired(event.target.checked) }} />
            This post needs a visual before publishing
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              Visual type
              <select value={mediaType} onChange={(event) => { markDirty(); setMediaType(event.target.value) }} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                {MEDIA_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Why add it?
              <input value={mediaReason} onChange={(event) => { markDirty(); setMediaReason(event.target.value) }} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-sm text-slate-600">
              Source or file reference
              <input value={mediaSource} onChange={(event) => { markDirty(); setMediaSource(event.target.value) }} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-sm text-slate-600">
              Description for accessibility
              <input value={mediaAltText} onChange={(event) => { markDirty(); setMediaAltText(event.target.value) }} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-800">Attached image</div>
            <div className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP, or GIF up to 5 MB. The same authenticated X transport uploads it at publication time and applies the accessibility description above as alt text.</div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={mediaUpload.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) mediaUpload.mutate(file)
                event.currentTarget.value = ''
              }}
              className="mt-3 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
            />
            {mediaUpload.isPending && <div className="mt-2"><Pending label="Attaching image…" /></div>}
            {mediaUpload.error && <div className="mt-2 text-xs text-red-700">{mediaUpload.error.message}</div>}
            {editorMeta.media?.attachment && (
              <div className="mt-3">
                <img
                  src={`/api/drafts/${draft.id}/media?v=${editorMeta.media.attachment.attachedAt || 0}`}
                  alt={mediaAltText || 'Attached draft media preview'}
                  className="max-h-72 rounded-lg border border-slate-200 object-contain"
                />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>
                    {editorMeta.media.attachment.fileName || 'Attached image'}
                    {editorMeta.media.attachment.size ? ` · ${(editorMeta.media.attachment.size / 1024).toFixed(0)} KB` : ''}
                    {' · operator upload'}
                  </span>
                  <button
                    type="button"
                    disabled={mediaRemove.isPending}
                    onClick={() => mediaRemove.mutate()}
                    className="font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {mediaRemove.isPending ? 'Removing…' : 'Remove image'}
                  </button>
                </div>
                {mediaRemove.error && <div className="mt-1 text-xs text-red-700">{mediaRemove.error.message}</div>}
              </div>
            )}
            {mediaRequired && !editorMeta.media?.attachment && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This visual is required, so approval remains blocked until an image is attached and the visual plan is complete.
              </div>
            )}
          </div>
        </Disclosure>
      )}

      <Disclosure summary="AI draft details">
        <TechnicalDetails>
          <div><strong>How AI built this draft</strong></div>
          <div className="mt-1"><strong>Key topics:</strong> {(editorMeta.semanticAnchors || []).join(', ') || 'None recorded'}</div>
          <div><strong>Source material used:</strong> {(editorMeta.evidenceUsed || []).join('; ') || 'None recorded'}</div>
          <div><strong>AI decision:</strong> {editorMeta.decision || 'n/a'}</div>
        </TechnicalDetails>
      </Disclosure>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <div className="max-w-2xl text-sm text-slate-500">
          {readOnly
            ? 'Completed text is preserved as a read-only historical snapshot.'
            : flags.engagementReply
              ? 'This exact reply sends only after explicit approval. It is never scheduled.'
              : 'Saving does not publish. Approval and the publishing plan remain separate decisions.'}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-3">
            {(dirty || contextDirty) && <span className="text-xs text-amber-600">Unsaved changes</span>}
            <button
              onClick={handleSave}
              disabled={save.isPending}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </div>

      {save.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{save.error.message}</div>
      )}
      {generate.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{generate.error.message}</div>
      )}

      {data.relationship && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Talking to <strong>@{data.relationship.username}</strong> · relationship stage {data.relationship.stage.replaceAll('_', ' ')} ·
          {' '}{data.relationship.theirRepliesToUs} prior replies · {data.relationship.meaningfulInteractions} useful interactions
        </div>
      )}
    </div>
  )
}
