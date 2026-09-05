import { useEffect, useMemo, useState } from 'react'
import {
  useWritingStrategy,
  useWritingStrategyRecommend,
  useWritingStrategySelect,
  type DraftEditorData,
  type WritingStrategyEvidenceRef,
  type WritingStrategyOption,
  type WritingStrategySelection,
  type WriterGenerationProvenance,
} from '../../api/client'
import { Badge, Disclosure, Pending, TechnicalDetails } from '../../components/primitives'

type BehaviorMode = 'off' | 'suggest' | 'apply' | null
type ApproachSource = 'deterministic' | 'manual'

function labelId(value: string | null | undefined) {
  if (!value) return ''
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function behaviorLabel(mode: BehaviorMode) {
  if (mode === 'off') return 'No influence'
  if (mode === 'suggest') return 'Advice only'
  if (mode === 'apply') return 'Use for this draft'
  return 'No selection'
}

function approachLabel(value: { intent?: string | null; style?: string | null; openingFeatures?: string[] } | null | undefined) {
  if (!value) return 'No approach selected'
  const parts = []
  if (value.intent) parts.push(`Intent: ${labelId(value.intent)}`)
  if (value.style) parts.push(`Style: ${labelId(value.style)}`)
  if (value.openingFeatures?.length) parts.push(`Opening: ${value.openingFeatures.map(labelId).join(' + ')}`)
  return parts.join(' · ') || 'No approach selected'
}

function sameApproach(left: { intent?: string | null; style?: string | null; openingFeatures?: string[] } | null | undefined, right: { intent?: string | null; style?: string | null; openingFeatures?: string[] } | null | undefined) {
  if (!left || !right) return false
  const leftFeatures = [...(left.openingFeatures || [])].sort()
  const rightFeatures = [...(right.openingFeatures || [])].sort()
  return (left.intent || null) === (right.intent || null)
    && (left.style || null) === (right.style || null)
    && JSON.stringify(leftFeatures) === JSON.stringify(rightFeatures)
}

function applicabilityLabel(value: WritingStrategyOption['applicability']) {
  if (value === 'strong_fit') return 'Strong fit'
  if (value === 'weak_fit') return 'Weak fit'
  return 'Possible fit'
}

function evidenceDetail(label: string, items: WritingStrategyEvidenceRef[], note?: string) {
  return (
    <div>
      <div className="font-semibold text-slate-700">{label} ({items.length})</div>
      {note && <div className="mt-0.5 text-slate-500">{note}</div>}
      {items.length ? (
        <ul className="mt-1 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <div>{item.rationale || item.id}</div>
              <div className="text-slate-400">{item.id}{item.sampleSize == null ? '' : ` · n=${item.sampleSize}`}</div>
            </li>
          ))}
        </ul>
      ) : <div className="mt-1 text-slate-400">None attached.</div>}
    </div>
  )
}

function OptionEvidence({ option }: { option: WritingStrategyOption }) {
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="info">External · observational {option.externalEvidence.length}</Badge>
        <Badge tone="neutral">Own account {option.internalEvidence.length}</Badge>
        <Badge tone="neutral">Experiment {option.experimentEvidence.length}</Badge>
        <Badge tone="neutral">Learned-rule context {option.learnedRuleEvidence.length}</Badge>
      </div>
      <Disclosure summary="Evidence, limitations, and provenance">
        <TechnicalDetails>
          <div className="space-y-3">
            {evidenceDetail('External evidence', option.externalEvidence, 'Observational evidence; not causal proof.')}
            {evidenceDetail('Own-account evidence', option.internalEvidence)}
            {evidenceDetail('Experiment evidence', option.experimentEvidence)}
            {evidenceDetail('Learned-rule context', option.learnedRuleEvidence, 'Context only; not proof and not rule acceptance.')}
            <div>
              <div className="font-semibold text-slate-700">Limitations</div>
              {option.limitations.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-5">{option.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul>
              ) : <div className="mt-1 text-slate-400">No additional limitations recorded.</div>}
            </div>
          </div>
        </TechnicalDetails>
      </Disclosure>
    </>
  )
}

function CurrentSelection({ selection, readOnly }: { selection: WritingStrategySelection | null; readOnly: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{readOnly ? 'Current queue choice' : 'Current choice'}</span>
        <Badge tone={selection?.mode === 'apply' ? 'success' : selection?.mode === 'suggest' ? 'info' : 'neutral'}>{behaviorLabel(selection?.mode ?? null)}</Badge>
        {selection && <Badge tone="neutral">{selection.selectionSource === 'manual' ? 'Manual' : 'Evidence-backed option'}</Badge>}
      </div>
      <div className="mt-1 text-sm text-slate-700">
        {selection?.mode === 'off' ? 'Writer strategy influence is explicitly disabled.' : selection ? approachLabel(selection) : 'No human writing-strategy selection is in force.'}
      </div>
      {selection?.selectionSource === 'manual' && selection.mode !== 'off' && (
        <div className="mt-1 text-xs text-slate-500">Manual choice — no evidence-backed recommendation is attached.</div>
      )}
      {readOnly && <div className="mt-1 text-xs text-slate-500">This control is read-only here and cannot rewrite the historical text.</div>}
    </div>
  )
}

function GenerationTruth({ generation, currentSelection }: { generation?: WriterGenerationProvenance; currentSelection: WritingStrategySelection | null }) {
  let message = 'No generation provenance is recorded for this draft.'
  if (generation) {
    if (generation.strategyApplied) {
      message = `Use for this draft — strategy influenced this generation: ${approachLabel(generation.strategySnapshot)}.`
    } else if (generation.strategyMode === 'suggest') {
      message = 'Advice only — guidance was selected, but it did not influence Writer for this generation.'
    } else if (generation.strategyMode === 'off') {
      message = 'No influence — the human explicitly disabled strategy influence for this generation.'
    } else if (generation.strategyMode == null) {
      message = 'No human strategy selection existed when this generation began.'
    } else {
      message = 'Strategy did not influence this generation.'
    }
  }

  const currentId = currentSelection?.id ?? null
  const generationId = generation?.strategySelectionId ?? null
  const changedSinceGeneration = Boolean(generation) && currentId !== generationId

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Last generation</div>
      <div className="mt-1 text-sm text-slate-700">{message}</div>
      {changedSinceGeneration && (
        <div className="mt-1 text-xs font-medium text-amber-700">The current choice changed after that generation. The existing text still reflects the recorded generation choice above.</div>
      )}
    </div>
  )
}

export function WritingApproachPanel({
  data,
  hasDraftContent,
  generating,
  onGenerate,
}: {
  data: DraftEditorData
  hasDraftContent: boolean
  generating: boolean
  onGenerate: () => void
}) {
  const queueItemId = data.queueItem?.id ?? null
  const strategy = useWritingStrategy(queueItemId)
  const recommend = useWritingStrategyRecommend()
  const select = useWritingStrategySelect()
  const preview = strategy.data
  const currentSelection = preview?.currentSelection ?? null
  const generation = data.draft.editor?.generation
  const readOnly = data.flags.readOnly

  const [source, setSource] = useState<ApproachSource>('deterministic')
  const [mode, setMode] = useState<BehaviorMode>(null)
  const [optionIndex, setOptionIndex] = useState<number | null>(null)
  const [manualIntent, setManualIntent] = useState('')
  const [manualStyle, setManualStyle] = useState('')
  const [manualOpeningFeatures, setManualOpeningFeatures] = useState<string[]>([])
  const [localTouched, setLocalTouched] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const options = preview?.shortlist.options || []
  const intentChoices = useMemo(() => [...new Set([
    ...options.map((option) => option.intent),
    currentSelection?.intent || null,
  ].filter((value): value is string => Boolean(value)))].sort(), [options, currentSelection?.intent])
  const styleChoices = useMemo(() => [...new Set([
    ...options.map((option) => option.style),
    currentSelection?.style || null,
  ].filter((value): value is string => Boolean(value)))].sort(), [options, currentSelection?.style])
  const openingChoices = useMemo(() => [...new Set(options.flatMap((option) => option.openingFeatures))].sort(), [options])

  const syncFromPreview = (nextPreview: typeof preview) => {
    if (!nextPreview) return
    const selection = nextPreview.currentSelection
    setMode(selection?.mode ?? null)
    if (selection?.selectionSource === 'recommended' && selection.mode !== 'off') {
      const index = nextPreview.shortlist.options.findIndex((option) => sameApproach(option, selection))
      setSource('deterministic')
      setOptionIndex(index >= 0 ? index : (nextPreview.shortlist.options.length ? 0 : null))
    } else if (selection?.selectionSource === 'manual' && selection.mode !== 'off') {
      setSource('manual')
      setManualIntent(selection.intent || '')
      setManualStyle(selection.style || '')
      setManualOpeningFeatures([...(selection.openingFeatures || [])])
    } else {
      setSource('deterministic')
      setOptionIndex(nextPreview.shortlist.options.length ? 0 : null)
      setManualIntent('')
      setManualStyle('')
      setManualOpeningFeatures([])
    }
    setLocalTouched(false)
  }

  useEffect(() => {
    syncFromPreview(preview)
    // Sync only when the authoritative persisted selection changes; recommendation refreshes must not erase local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.queueItem.id, preview?.currentSelection?.id])

  const selectedOption = optionIndex == null ? null : options[optionIndex] || null
  const recommendedResult = recommend.data
  const aiOption = recommendedResult?.status === 'recommended' ? recommendedResult.recommendation?.option || null : null
  const matchedAiOptionIndex = aiOption ? options.findIndex((option) => sameApproach(option, aiOption)) : -1
  const aiOptionIndex = matchedAiOptionIndex >= 0
    && JSON.stringify(options[matchedAiOptionIndex]?.selectionSnapshot) === JSON.stringify(aiOption?.selectionSnapshot)
    ? matchedAiOptionIndex
    : -1
  const aiRecommendationStale = Boolean(aiOption) && aiOptionIndex < 0

  const manualHasApproach = Boolean(manualIntent || manualStyle || manualOpeningFeatures.length)
  const selectedApproachAvailable = source === 'deterministic' ? Boolean(selectedOption) : manualHasApproach
  const canSave = !readOnly
    && Boolean(queueItemId)
    && preview?.availability.selectable === true
    && mode != null
    && (mode === 'off' || selectedApproachAvailable)
    && localTouched

  const change = (action: () => void) => {
    action()
    select.reset()
    setLocalTouched(true)
    setSaveMessage('')
  }

  const saveSelection = () => {
    if (!queueItemId || !mode || !canSave) return
    const mutationCallbacks = {
      onSuccess: async () => {
        const refreshed = await strategy.refetch()
        syncFromPreview(refreshed.data)
        setSaveMessage('Writing choice saved.')
      },
      onError: async () => {
        const refreshed = await strategy.refetch()
        syncFromPreview(refreshed.data)
      },
    }
    if (mode === 'off') {
      select.mutate({
        queueItemId,
        draftId: data.draft.id,
        mode: 'off',
        selectionSource: 'manual',
      }, mutationCallbacks)
      return
    }

    if (source === 'deterministic' && selectedOption) {
      select.mutate({
        queueItemId,
        draftId: data.draft.id,
        mode,
        intent: selectedOption.intent,
        style: selectedOption.style,
        openingFeatures: selectedOption.openingFeatures,
        selectionSource: 'recommended',
        guidanceSnapshot: selectedOption.selectionSnapshot,
      }, mutationCallbacks)
      return
    }

    select.mutate({
      queueItemId,
      draftId: data.draft.id,
      mode,
      intent: manualIntent || null,
      style: manualStyle || null,
      openingFeatures: manualOpeningFeatures,
      selectionSource: 'manual',
    }, mutationCallbacks)
  }

  const generationBlockedByChoice = select.isPending || localTouched || (preview?.availability.selectable === true && !currentSelection)

  return (
    <div className="operator-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-600">Writing approach</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={currentSelection?.mode === 'apply' ? 'ai' : currentSelection?.mode === 'suggest' ? 'info' : 'neutral'}>{behaviorLabel(currentSelection?.mode ?? null)}</Badge>
            {currentSelection?.mode && currentSelection.mode !== 'off' && <span className="text-xs text-slate-500">{approachLabel(currentSelection)}</span>}
          </div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || generationBlockedByChoice || strategy.isLoading}
            className="action-button"
            data-variant="primary"
          >
            {generating ? 'Generating…' : hasDraftContent ? 'Regenerate with AI' : 'Generate with AI'}
          </button>
        )}
      </div>
      {!readOnly && generationBlockedByChoice && (
        <div className="mt-2 text-xs text-amber-700">Save the writing choice before generating.</div>
      )}
      <Disclosure summary="Change approach & evidence" className="compact-disclosure">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-600">Optional guidance for the next Writer generation. It never approves or publishes.</div>
        </div>
        {!readOnly && preview?.availability.selectable && options.length > 0 && (
          <button
            type="button"
            onClick={() => queueItemId && recommend.mutate({ queueItemId })}
            disabled={recommend.isPending || select.isPending || generating}
            className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
          >
            {recommend.isPending ? 'Asking AI…' : 'Ask AI to recommend'}
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <CurrentSelection selection={currentSelection} readOnly={readOnly} />
        <GenerationTruth generation={generation} currentSelection={currentSelection} />
      </div>

      {strategy.isLoading && <div className="mt-4"><Pending label="Loading writing guidance…" /></div>}
      {strategy.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Writing guidance could not be loaded: {strategy.error.message}
          <button type="button" onClick={() => strategy.refetch()} className="ml-2 font-semibold underline">Retry</button>
        </div>
      )}

      {preview && !preview.availability.selectable && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>Writing approach controls are unavailable.</strong> {preview.availability.reason || 'This draft is not currently eligible for writing-strategy selection.'}
        </div>
      )}

      {preview?.availability.status === 'not_applicable' && (
        <div className="mt-2 text-xs text-slate-500">No active strategy controls are shown because this content type has no applicable authored-body strategy.</div>
      )}

      {!readOnly && preview?.availability.selectable && (
        <>
          <div className="mt-5 border-t border-violet-100 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI recommendation</div>
            <div className="mt-1 text-xs text-slate-500">Optional token-spending action. AI can only choose and explain one current deterministic option; it cannot save a human choice or generate text.</div>

            {!recommend.data && !recommend.isPending && !recommend.error && (
              <div className="mt-2 text-sm text-slate-600">No AI recommendation requested.</div>
            )}
            {recommend.isPending && <div className="mt-2"><Pending label="AI is comparing the current options…" /></div>}
            {recommend.error && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">Recommendation request failed: {recommend.error.message}. Deterministic options remain available below.</div>
            )}
            {recommendedResult?.status === 'failed' && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">Recommendation failed: {recommendedResult.error?.message || 'The AI result was invalid.'} Deterministic options remain available.</div>
            )}
            {recommendedResult?.status === 'not_available' && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">No AI recommendation is available: {recommendedResult.reason || 'No current deterministic option is eligible.'}</div>
            )}
            {recommendedResult?.status === 'no_recommendation' && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <strong>AI returned no recommendation.</strong>{recommendedResult.rationale ? ` ${recommendedResult.rationale}` : ''}
                {recommendedResult.limitations?.length ? <div className="mt-1 text-xs text-slate-500">{recommendedResult.limitations.join(' · ')}</div> : null}
              </div>
            )}
            {recommendedResult?.status === 'recommended' && recommendedResult.recommendation && aiRecommendationStale && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                The previous AI recommendation was based on older guidance. Ask AI again if you want a recommendation over the current deterministic options.
              </div>
            )}
            {recommendedResult?.status === 'recommended' && recommendedResult.recommendation && !aiRecommendationStale && (
              <div className="mt-2 rounded-lg border border-violet-200 bg-white px-3 py-3 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="ai">AI recommendation</Badge><strong>{approachLabel(recommendedResult.recommendation.option)}</strong></div>
                <div className="mt-1">{recommendedResult.recommendation.rationale}</div>
                {recommendedResult.recommendation.limitations.length > 0 && (
                  <div className="mt-1 text-xs text-slate-500">Limitations: {recommendedResult.recommendation.limitations.join(' · ')}</div>
                )}
                <button
                  type="button"
                  onClick={() => change(() => {
                    setSource('deterministic')
                    setOptionIndex(aiOptionIndex >= 0 ? aiOptionIndex : recommendedResult.recommendation!.optionIndex)
                  })}
                  className="mt-2 rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                >
                  Review this option
                </button>
                <span className="ml-2 text-xs text-slate-500">This does not save or apply it.</span>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-violet-100 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Available options</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => change(() => setSource('deterministic'))}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${source === 'deterministic' ? 'border-violet-400 bg-violet-100 text-violet-900' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                Evidence-backed options
              </button>
              <button
                type="button"
                onClick={() => change(() => setSource('manual'))}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${source === 'manual' ? 'border-violet-400 bg-violet-100 text-violet-900' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                Choose manually
              </button>
            </div>

            {source === 'deterministic' ? (
              options.length ? (
                <div className="mt-3">
                  <label className="text-sm font-medium text-slate-700">
                    Evidence-backed approach
                    <select
                      value={optionIndex ?? ''}
                      onChange={(event) => change(() => setOptionIndex(Number(event.target.value)))}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                    >
                      {options.map((option, index) => (
                        <option key={`${index}-${approachLabel(option)}`} value={index}>
                          {approachLabel(option)} · {applicabilityLabel(option.applicability)}{aiOptionIndex === index ? ' · AI recommended' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedOption && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{approachLabel(selectedOption)}</strong>
                        <Badge tone={selectedOption.applicability === 'strong_fit' ? 'success' : selectedOption.applicability === 'weak_fit' ? 'warning' : 'info'}>{applicabilityLabel(selectedOption.applicability)}</Badge>
                        {aiOptionIndex === optionIndex && <Badge tone="ai">AI recommended</Badge>}
                      </div>
                      <div className="mt-1">{selectedOption.rationale}</div>
                      <OptionEvidence option={selectedOption} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-600">No deterministic writing approach currently has enough applicable evidence.</div>
              )
            ) : (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-sm font-semibold text-slate-800">Manual approach</div>
                <div className="mt-1 text-xs text-slate-500">Manual choices are saved without evidence-backed recommendation claims. Canonical IDs are persisted; these display labels are local and provisional.</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    Intent
                    <select value={manualIntent} onChange={(event) => change(() => setManualIntent(event.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
                      <option value="">No intent preference</option>
                      {intentChoices.map((id) => <option key={id} value={id}>{labelId(id)}</option>)}
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    Presentation style
                    <select value={manualStyle} onChange={(event) => change(() => setManualStyle(event.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
                      <option value="">No style preference</option>
                      {styleChoices.map((id) => <option key={id} value={id}>{labelId(id)}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-3">
                  <div className="text-sm text-slate-700">Opening features</div>
                  {openingChoices.length ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {openingChoices.map((feature) => (
                        <label key={feature} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={manualOpeningFeatures.includes(feature)}
                            onChange={(event) => change(() => setManualOpeningFeatures((current) => event.target.checked ? [...current, feature] : current.filter((item) => item !== feature)))}
                          />
                          {labelId(feature)}
                        </label>
                      ))}
                    </div>
                  ) : <div className="mt-1 text-xs text-slate-500">No current deterministic opening-feature IDs are available to expose as manual controls.</div>}
                </div>
                <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">Manual choice — no evidence-backed recommendation attached.</div>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-violet-100 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Behavior for the next generation</div>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {([
                ['off', 'No influence', 'Persist Off. No writing strategy enters Writer.'],
                ['suggest', 'Advice only', 'Keep the selected approach visible, but do not pass it to Writer.'],
                ['apply', 'Use for this draft', 'Pass the saved selected approach to Writer for the next generation.'],
              ] as const).map(([value, label, note]) => (
                <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${mode === value ? 'border-violet-400 bg-white text-slate-900' : 'border-slate-200 bg-white/70 text-slate-700'}`}>
                  <div className="flex items-start gap-2">
                    <input type="radio" name={`writing-mode-${data.draft.id}`} value={value} checked={mode === value} onChange={() => change(() => setMode(value))} className="mt-0.5" />
                    <span><strong>{label}</strong><span className="mt-0.5 block text-xs text-slate-500">{note}</span></span>
                  </div>
                </label>
              ))}
            </div>
            {mode == null && <div className="mt-2 text-xs text-slate-500">No behavior is preselected when no human selection exists.</div>}
            {mode !== 'off' && mode != null && !selectedApproachAvailable && <div className="mt-2 text-xs font-medium text-amber-700">Choose an evidence-backed or manual approach before saving Advice only or Use for this draft.</div>}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveSelection}
                disabled={!canSave || select.isPending}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {select.isPending ? 'Saving choice…' : 'Save writing choice'}
              </button>
              {localTouched && <span className="text-xs font-medium text-amber-700">Unsaved writing choice</span>}
              {saveMessage && !localTouched && <span className="text-xs font-medium text-emerald-700">{saveMessage}</span>}
            </div>
            {select.error && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                Could not save the writing choice: {select.error.message} Guidance was refreshed; review the current options and try again.
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-3 text-xs text-slate-500">
        {currentSelection?.mode === 'apply'
          ? `Next generation uses: ${approachLabel(currentSelection)}.`
          : currentSelection?.mode === 'suggest'
            ? 'Advice remains visible but does not enter Writer.'
            : currentSelection?.mode === 'off'
              ? 'Writing-strategy influence is off.'
              : 'No writing-strategy selection is in force.'}
      </div>
      </Disclosure>
    </div>
  )
}
