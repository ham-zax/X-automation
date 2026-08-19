import { useEffect, useMemo, useState } from 'react'
import { useDraftAction, type DraftEditorData } from '../../api/client'
import {
  Disclosure,
  GatePanel,
  Pending,
  QualityBreakdown,
  TechnicalDetails,
  useDebounced,
} from '../../components/primitives'

const MEDIA_TYPE_OPTIONS = [
  ['none', 'No visual'],
  ['screenshot', 'Screenshot'],
  ['chart', 'Chart'],
  ['code', 'Code sample'],
  ['diagram', 'Diagram'],
] as const

interface PreviewResult {
  score: number
  gatesView: { passed: boolean; writingFailures: { message: string }[]; humanConfirmations: { message: string }[]; warnings: { message: string }[] }
  breakdown: Record<string, number>
  weightedLength: number | null
}

export function DraftEditor({ data }: { data: DraftEditorData }) {
  const { draft, pipeline, flags } = data
  const isThread = pipeline === 'thread'
  const editorMeta = (draft.editor || {}) as {
    decision?: string
    riskFlags?: string[]
    semanticAnchors?: string[]
    evidenceUsed?: string[]
    media?: { required?: boolean; type?: string; reason?: string; source?: string; altText?: string }
  }

  const [body, setBody] = useState(draft.body)
  const [threadParts, setThreadParts] = useState<string[]>(draft.threadParts?.length ? draft.threadParts : ['', ''])
  const [mediaRequired, setMediaRequired] = useState(Boolean(editorMeta.media?.required))
  const [mediaType, setMediaType] = useState(editorMeta.media?.type || 'none')
  const [mediaReason, setMediaReason] = useState(editorMeta.media?.reason || '')
  const [mediaSource, setMediaSource] = useState(editorMeta.media?.source || '')
  const [mediaAltText, setMediaAltText] = useState(editorMeta.media?.altText || '')
  const [dirty, setDirty] = useState(false)

  const [confirmReset, setConfirmReset] = useState(0)
  useEffect(() => {
    if (dirty) return
    setBody(draft.body)
    setThreadParts(draft.threadParts?.length ? draft.threadParts : ['', ''])
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
  const previewMutation = useDraftAction(draft.id, 'preview')
  const threadPartsMutation = useDraftAction(draft.id, 'thread-parts')

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
  const qualityClass = score >= 40 ? 'bg-emerald-100 text-emerald-800' : score >= 30 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'

  const hasDraftContent = isThread
    ? threadParts.some((part) => String(part || '').trim())
    : Boolean(body.trim())

  const markDirty = () => setDirty(true)

  const handleSave = () => {
    save.mutate(previewPayload as never, {
      onSuccess: () => {
        setDirty(false)
        setConfirmReset((value) => value + 1)
      },
    })
  }

  const handleGenerate = () => {
    generate.mutate({} as never, {
      onSuccess: () => {
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
            {flags.engagementReply ? 'Conversation reply' : 'Create'}
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
            {score}/50 {previewPending && dirty ? '· checking…' : ''}
          </span>
          <button
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
          >
            {generate.isPending ? 'Generating…' : 'Generate with AI'}
          </button>
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

      {generate.isPending && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
          <Pending label="Generating a draft with AI…" />
        </div>
      )}

      {editorMeta.decision === 'DO_NOT_POST' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>AI recommends not posting this source.</strong>
          <div className="mt-1">{(editorMeta.riskFlags || []).join(' · ') || 'There is not enough verified additive value in the current packet.'}</div>
          <div className="mt-2 text-xs text-amber-800">You do not need to fill a scaffold. Add stronger evidence/source context, or move on.</div>
        </div>
      ) : (editorMeta.decision || body) ? (
        <div className="text-sm text-slate-500">
          AI prepared this candidate. Your job is to review the exact text and confirm facts/evidence before approval — not fill a scaffold.
        </div>
      ) : null}

      <GatePanel gates={gatesView} />

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
                  onChange={(event) => {
                    markDirty()
                    setThreadParts((parts) => parts.map((p, i) => (i === index ? event.target.value : p)))
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => threadPartsMutation.mutate({ op: 'add' } as never)}
                disabled={threadParts.length >= 6 || threadPartsMutation.isPending}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Add part
              </button>
              <button
                onClick={() => threadPartsMutation.mutate({ op: 'remove' } as never)}
                disabled={threadParts.length <= 2 || threadPartsMutation.isPending}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Remove last
              </button>
            </div>
          </div>
        ) : (
          <textarea
            rows={7}
            value={body}
            onChange={(event) => { markDirty(); setBody(event.target.value) }}
            placeholder="Generate a draft or edit the final text here."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
        )}
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Writing quality</div>
        {hasDraftContent
          ? <QualityBreakdown breakdown={breakdown} />
          : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Quality feedback will appear after AI writes a draft or you start typing.
            </div>
          )}
        <div className="mt-2 text-xs text-slate-500">
          This feedback updates from the exact text you are editing. It helps improve the draft; the approval checks above decide whether it is ready.
        </div>
      </div>

      {!flags.engagementReply && (
        <Disclosure summary="Add a visual or see AI context">
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
          {mediaRequired && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              A required visual currently blocks scheduling/publishing until a real attachment readiness path exists.
            </div>
          )}
          <TechnicalDetails>
            <div><strong>How AI built this draft</strong></div>
            <div className="mt-1"><strong>Key topics:</strong> {(editorMeta.semanticAnchors || []).join(', ') || 'None recorded'}</div>
            <div><strong>Source material used:</strong> {(editorMeta.evidenceUsed || []).join('; ') || 'None recorded'}</div>
            <div><strong>AI decision:</strong> {editorMeta.decision || 'n/a'}</div>
          </TechnicalDetails>
        </Disclosure>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <div className="max-w-2xl text-sm text-slate-500">
          {flags.engagementReply
            ? 'This exact reply sends only after explicit approval. It is never scheduled.'
            : 'Saving does not publish. Approval and the publishing plan remain separate decisions.'}
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          <button
            onClick={handleSave}
            disabled={save.isPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
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
