import type { ReactNode } from 'react'
import type { SemanticTone } from './primitives'

const NAV_ITEMS = [
  { id: 'today', label: 'Today', href: '#/today' },
  { id: 'discover', label: 'Discover', href: '#/discover' },
  { id: 'conversations', label: 'Conversations', href: '#/conversations' },
  { id: 'create', label: 'Posts', href: '#/create' },
  { id: 'results', label: 'Results', href: '#/results' },
  { id: 'learn', label: 'Learn', href: '#/learn' },
] as const

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
            {item.label}
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
        <h2 className="page-title">{title}</h2>
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
