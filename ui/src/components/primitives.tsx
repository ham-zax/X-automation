import { useEffect, useState, type ReactNode } from 'react'

interface LoadingProps {
  message?: string
}

export function Loading({ message = 'Loading...' }: LoadingProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--ui-primary)] border-r-transparent"></div>
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
    <div className="notice p-5" data-tone="danger">
      <h3 className="notice-title text-sm">Something went wrong</h3>
      <p className="notice-body mt-1 text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="action-button mt-3" data-variant="danger"
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
    <div className="operator-surface px-6 py-12 text-center">
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
    </div>
  )
}

export type SemanticTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'ai'

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: SemanticTone }) {
  return (
    <span className="status-badge" data-tone={tone}>
      {children}
    </span>
  )
}

export type ActionVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger'

export function ActionButton({
  children,
  variant = 'secondary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ActionVariant }) {
  return (
    <button {...props} data-variant={variant} className={`action-button ${className}`.trim()}>
      {children}
    </button>
  )
}

export function Notice({
  tone = 'info',
  title,
  children,
  className = '',
}: { tone?: SemanticTone; title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`notice ${className}`.trim()} data-tone={tone}>
      {title && <div className="notice-title">{title}</div>}
      <div className="notice-body">{children}</div>
    </div>
  )
}

interface DisclosureProps {
  summary: string
  children: ReactNode
  className?: string
  defaultOpen?: boolean
}

export function Disclosure({ summary, children, className = '', defaultOpen = false }: DisclosureProps) {
  return (
    <details open={defaultOpen} className={`mt-3 ${className}`}>
      <summary className="cursor-pointer font-medium text-slate-500 hover:text-slate-700">{summary}</summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

export function TechnicalDetails({ children }: { children: ReactNode }) {
  return (
    <details className="operator-surface mt-3 p-3">
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
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-solid border-[var(--ui-primary)] border-r-transparent"></span>
      {label}
    </span>
  )
}

export function GatePanel({ gates }: { gates: { passed: boolean; approvalFailures: { message: string }[]; warnings: { message: string }[] } | null | undefined }) {
  if (!gates || (!gates.approvalFailures.length && !gates.warnings.length && !gates.passed)) {
    return <Notice tone="warning" title="Checks update as you edit">Generate or change the draft to see the current approval blockers.</Notice>
  }
  const ready = gates.passed === true
  return (
    <Notice tone={ready ? 'success' : 'warning'} title={ready ? 'Approval checks passed' : 'Fix before approval'}>
      {gates.approvalFailures.length > 0 && (
        <ul className="mb-0 mt-2 list-disc space-y-1 pl-5">
          {gates.approvalFailures.map((failure, index) => <li key={index}>{failure.message}</li>)}
        </ul>
      )}
      {gates.warnings.length > 0 && (
        <>
          <div className="mt-2 font-semibold">Worth checking</div>
          <ul className="mb-0 list-disc space-y-1 pl-5">
            {gates.warnings.map((warning, index) => <li key={index}>{warning.message}</li>)}
          </ul>
        </>
      )}
    </Notice>
  )
}

const LEGACY_QUALITY_SIGNALS: { key: string; label: string; max: number; description: string }[] = [
  { key: 'hook', label: 'Opening', max: 8, description: 'Whether the first line quickly gives someone a reason to keep reading.' },
  { key: 'insight', label: 'Useful insight', max: 10, description: 'Whether the post adds a concrete implication instead of repeating the source.' },
  { key: 'evidence', label: 'Support', max: 10, description: 'Whether claims are backed by source material, data, steps, or observed results.' },
  { key: 'action', label: 'Takeaway', max: 7, description: 'Whether the reader leaves with a useful next step, decision, or question.' },
  { key: 'originality', label: 'Original angle', max: 5, description: 'Whether the wording adds something distinct from the source.' },
]

const PURPOSE_QUALITY_SIGNALS: { key: string; label: string; max: number; description: string }[] = [
  { key: 'purpose', label: 'Purpose', max: 10, description: 'Whether the draft visibly fulfills the selected technical, social, relationship, or growth purpose.' },
  { key: 'clarity', label: 'Clarity', max: 10, description: 'Whether the intended act lands at its selected depth and conversation stage.' },
  { key: 'provenance', label: 'Provenance', max: 10, description: 'Whether factual and implied autobiographical claims stay inside the available evidence.' },
  { key: 'originality', label: 'Originality', max: 10, description: 'Whether the wording avoids source/recent duplication and repetitive response patterns.' },
  { key: 'realization', label: 'Realization', max: 10, description: 'Whether the final form, length, context, and behavior alignment make the selected act complete.' },
]

export function QualityBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const signals = Object.prototype.hasOwnProperty.call(breakdown, 'purpose')
    ? PURPOSE_QUALITY_SIGNALS
    : LEGACY_QUALITY_SIGNALS
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {signals.map((signal) => (
        <div key={signal.key} className="operator-surface p-3">
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
