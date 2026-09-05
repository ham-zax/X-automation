import type { ReactNode } from 'react'
import type { SemanticTone } from './primitives'

const NAV_ITEMS = [
  { id: 'today', label: 'Overview', href: '#/today' },
  { id: 'discover', label: 'Discover', href: '#/discover' },
  { id: 'conversations', label: 'Conversations', href: '#/conversations' },
  { id: 'create', label: 'Posts', href: '#/create' },
  { id: 'results', label: 'Results', href: '#/results' },
  { id: 'learn', label: 'Learn', href: '#/learn' },
] as const

const NAV_ICONS: Record<string, string> = {
  today: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  discover: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M16 8l-2 6-6 2 2-6 6-2Z',
  conversations: 'M21 11a8 8 0 0 1-8 8H8l-5 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z M7 9h10 M7 13h6',
  create: 'M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9 M9 15l1-4L18 3l3 3-8 8-4 1Z',
  results: 'M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-8',
  learn: 'M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3V4Z M12 6v15',
}

export function WorkspaceNav({ active }: { active: string }) {
  return (
    <div className="workspace-nav-wrap">
      <nav className="workspace-nav app-primary-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            aria-current={active === item.id ? 'page' : undefined}
            data-active={active === item.id ? 'true' : undefined}
            className="app-nav-link"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={NAV_ICONS[item.id]} /></svg>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  note,
  right,
}: {
  eyebrow?: string
  title: string
  note?: ReactNode
  right?: ReactNode
}) {
  return (
    <header className="page-heading">
      <div className="min-w-0">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {note && <div className="page-note">{note}</div>}
      </div>
      {right && <div className="page-heading-action">{right}</div>}
    </header>
  )
}

export interface SegmentedTabItem {
  id: string
  label: string
  count?: number
  tone?: SemanticTone
}

export function SegmentedTabs({
  items,
  active,
  onChange,
  ariaLabel = 'View',
}: {
  items: SegmentedTabItem[]
  active: string
  onChange: (id: string) => void
  ariaLabel?: string
}) {
  return (
    <div className="segmented-tabs" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={active === item.id}
          className="segmented-tab"
          data-tone={item.tone || 'neutral'}
          onClick={() => onChange(item.id)}
        >
          <span>{item.label}</span>
          {item.count != null && <span className="segmented-tab-count">{item.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: ReactNode
  value: ReactNode
  note?: ReactNode
  tone?: SemanticTone
}) {
  return (
    <div className="metric-card" data-tone={tone}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {note && <div className="metric-note">{note}</div>}
    </div>
  )
}
