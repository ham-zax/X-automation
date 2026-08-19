import { useEffect, useState, type ReactNode } from 'react'

interface LoadingProps {
  message?: string
}

export function Loading({ message = 'Loading...' }: LoadingProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-slate-900 border-r-transparent"></div>
        <p className="mt-4 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  )
}

interface ErrorProps {
  message: string
  onRetry?: () => void
}

export function Error({ message, onRetry }: ErrorProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <h3 className="text-sm font-medium text-red-900">Something went wrong</h3>
      <p className="mt-2 text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  )
}

interface EmptyProps {
  title: string
  message?: string
}

export function Empty({ title, message }: EmptyProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
    </div>
  )
}

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'ai'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-sky-100 text-sky-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  ai: 'bg-violet-100 text-violet-700',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  )
}

interface DisclosureProps {
  summary: string
  children: ReactNode
  className?: string
}

export function Disclosure({ summary, children, className = '' }: DisclosureProps) {
  return (
    <details className={`mt-3 ${className}`}>
      <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">{summary}</summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

export function TechnicalDetails({ children }: { children: ReactNode }) {
  return (
    <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Technical details</summary>
      <div className="mt-2 text-xs text-slate-600">{children}</div>
    </details>
  )
}

export function SectionHeader({ title, note, right }: { title: string; note?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {note && <p className="mt-1 text-sm text-slate-600">{note}</p>}
      </div>
      {right}
    </div>
  )
}

export function StatCard({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
    </div>
  )
}

export function Pending({ label = 'Working…' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-solid border-slate-400 border-r-transparent"></span>
      {label}
    </span>
  )
}

interface ConfirmCheckboxesProps {
  factuality: boolean
  evidence: boolean
  onChange: (flags: { factualityConfirmed: boolean; evidenceConfirmed: boolean }) => void
}

export function ConfirmCheckboxes({ factuality, evidence, onChange }: ConfirmCheckboxesProps) {
  return (
    <div className="my-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
      <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <input
          className="mt-0.5"
          type="checkbox"
          checked={factuality}
          onChange={(event) => onChange({ factualityConfirmed: event.target.checked, evidenceConfirmed: evidence })}
        />
        <span>
          <strong>I checked the facts</strong>
          <br />
          <span className="text-xs text-slate-500">The final wording matches the source and context I reviewed.</span>
        </span>
      </label>
      <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <input
          className="mt-0.5"
          type="checkbox"
          checked={evidence}
          onChange={(event) => onChange({ factualityConfirmed: factuality, evidenceConfirmed: event.target.checked })}
        />
        <span>
          <strong>I checked the supporting proof</strong>
          <br />
          <span className="text-xs text-slate-500">Any benchmark, result, or capability claim has real support.</span>
        </span>
      </label>
    </div>
  )
}

export function GatePanel({ gates }: { gates: { passed: boolean; writingFailures: { message: string }[]; humanConfirmations: { message: string }[]; warnings: { message: string }[] } | null | undefined }) {
  if (!gates || (!gates.writingFailures.length && !gates.warnings.length && !gates.humanConfirmations.length && !gates.passed)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-semibold">Checks update as you edit.</div>
        <div className="mt-1">Generate or change the draft to see the current approval blockers.</div>
      </div>
    )
  }
  const ready = gates.writingFailures.length === 0
  return (
    <div className={`rounded-xl p-4 text-sm ${ready ? 'border border-emerald-200 bg-emerald-50 text-emerald-900' : 'border border-amber-200 bg-amber-50 text-amber-950'}`}>
      <strong>{ready ? 'Writing checks passed' : 'Fix before approval'}</strong>
      {gates.writingFailures.length > 0 && (
        <ul className="mt-2 mb-0 list-disc space-y-1 pl-5">
          {gates.writingFailures.map((failure, index) => <li key={index}>{failure.message}</li>)}
        </ul>
      )}
      {gates.warnings.length > 0 && (
        <>
          <div className="mt-2">Worth checking</div>
          <ul className="mb-0 list-disc space-y-1 pl-5">
            {gates.warnings.map((warning, index) => <li key={index}>{warning.message}</li>)}
          </ul>
        </>
      )}
      {gates.humanConfirmations.length > 0 && (
        <div className="mt-2 text-sky-800">
          Before you approve, review the finished post and tick the two confirmation boxes below. You do not need to add any extra text.
        </div>
      )}
    </div>
  )
}

const QUALITY_SIGNALS: { key: string; label: string; max: number; description: string }[] = [
  { key: 'niche', label: 'Topic fit', max: 10, description: 'How closely this matches your AI/dev/builder focus.' },
  { key: 'hook', label: 'Opening', max: 8, description: 'Whether the first line quickly gives someone a reason to keep reading.' },
  { key: 'insight', label: 'Useful insight', max: 10, description: 'Whether the post adds a concrete implication instead of repeating the source.' },
  { key: 'evidence', label: 'Support', max: 10, description: 'Whether claims are backed by source material, data, steps, or observed results.' },
  { key: 'action', label: 'Takeaway', max: 7, description: 'Whether the reader leaves with a useful next step, decision, or question.' },
  { key: 'originality', label: 'Original angle', max: 5, description: 'Whether the wording adds something distinct from the source.' },
]

export function QualityBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {QUALITY_SIGNALS.map((signal) => (
        <div key={signal.key} className="rounded-xl border border-slate-200 bg-white p-3">
          <dt className="text-sm font-medium text-slate-800">{signal.label}</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">
            {breakdown[signal.key] ?? 0}
            <span className="text-xs font-medium text-slate-400">/{signal.max}</span>
          </dd>
          <div className="mt-1 text-xs text-slate-500">{signal.description}</div>
        </div>
      ))}
    </dl>
  )
}

export function formatNumber(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString()
}

export function formatDateTime(value: number | null | undefined): string {
  if (!value) return ''
  return new Date(Number(value)).toLocaleString()
}

// datetime-local input value helper
export function toDatetimeLocal(value: number | null | undefined): string {
  if (!value) return ''
  const date = new Date(Number(value))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocal(value: string): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
