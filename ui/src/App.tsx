import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useHashRoute } from './router'
import { Today } from './features/today/Today'
import { Discover } from './features/discover/Discover'
import { Conversations } from './features/conversations/Conversations'
import { ConversationDetail } from './features/conversations/ConversationDetail'
import { Create } from './features/create/Create'
import { DraftPage } from './features/create/DraftPage'
import { Results } from './features/results/Results'
import { Audience } from './features/results/Audience'
import { Learn } from './features/learn/Learn'
import { Advanced } from './features/advanced/Advanced'
import { AISettings } from './features/settings/AISettings'
import { AutonomousRepliesSettings } from './features/settings/AutonomousRepliesSettings'
import { GrowthOperatorSettings } from './features/settings/GrowthOperatorSettings'
import { NicheSettings } from './features/settings/NicheSettings'
import { PersonaSettings } from './features/settings/PersonaSettings'
import { Settings } from './features/settings/Settings'
import { WorkspaceNav } from './components/workspace'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem('x-growth-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  return 'light'
}

const INITIAL_THEME = initialTheme()
document.documentElement.dataset.theme = INITIAL_THEME
document.documentElement.style.colorScheme = INITIAL_THEME

function RouteContent() {
  const route = useHashRoute()
  const [first, second] = route.segments

  if (!first || first === 'today') return <Today />
  if (first === 'discover') return <Discover />
  if (first === 'conversations' && second) return <ConversationDetail candidateKey={second} />
  if (first === 'conversations') return <Conversations />
  if (first === 'create') return <Create />
  if (first === 'draft' && second) return <DraftPage draftId={Number(second)} />
  if (first === 'results' && second === 'audience') return <Audience />
  if (first === 'results') return <Results />
  if (first === 'learn') return <Learn section={second} />
  if (first === 'viral') return <Learn section="external" />
  if (first === 'improve') return <Learn section="tests" />
  if (first === 'settings' && second === 'growth-focus') return <NicheSettings />
  if (first === 'settings' && second === 'persona') return <PersonaSettings />
  if (first === 'settings' && second === 'growth-operator') return <GrowthOperatorSettings />
  if (first === 'settings' && second === 'ai') return <AISettings />
  if (first === 'settings' && second === 'autonomous-replies') return <AutonomousRepliesSettings />
  if (first === 'settings' && second === 'advanced') return <Advanced />
  if (first === 'settings') return <Settings />
  if (first === 'advanced' && second === 'ai') return <AISettings />
  if (first === 'advanced' && second === 'niche') return <NicheSettings />
  if (first === 'advanced') return <Advanced />
  return <Today />
}

function Shell() {
  const route = useHashRoute()
  const [theme, setTheme] = useState<Theme>(INITIAL_THEME)
  const routeRoot = route.segments[0] || 'today'
  const active = routeRoot === 'draft'
    ? 'create'
    : ['viral', 'improve'].includes(routeRoot)
      ? 'learn'
      : routeRoot
  const settingsActive = routeRoot === 'settings' || routeRoot === 'advanced'
  const sectionLabel = ({ today: 'Overview', discover: 'Discover', conversations: 'Conversations', create: 'Posts', results: 'Results', learn: 'Learn' } as Record<string, string>)[active] || 'Settings'
  const settingsSection = route.segments[1] || ''

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { window.localStorage.setItem('x-growth-theme', theme) } catch {}
  }, [theme])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main" onClick={(event) => {
        event.preventDefault()
        document.getElementById('workspace-main')?.focus()
      }}>Skip to workspace</a>
      <aside className="app-sidebar" aria-label="Workspace navigation">
        <a href="#/today" className="app-brand" aria-label="X Growth OS home">
          <span className="app-brand-mark" aria-hidden="true">X</span>
          <span className="app-brand-copy">Growth OS<span className="app-brand-subtitle">Your network, with purpose.</span></span>
        </a>
        <p className="sidebar-label">Workspace</p>
        <WorkspaceNav active={active} />
        <nav className="sidebar-secondary" aria-label="Operator and settings">
          <a href="#/settings/growth-operator" className="app-nav-link" aria-current={settingsActive && settingsSection === 'growth-operator' ? 'page' : undefined}>Agent delegation</a>
          <a href="#/settings/persona" className="app-nav-link" aria-current={settingsActive && settingsSection === 'persona' ? 'page' : undefined}>Persona & voice</a>
          <a href="#/settings" className="app-nav-link" aria-current={settingsActive && !['growth-operator', 'persona'].includes(settingsSection) ? 'page' : undefined}>Settings</a>
        </nav>
        <div className="sidebar-footer"><strong>Agent-operated. Human-directed.</strong>Build relationships. Publish with purpose. Learn from outcomes.</div>
      </aside>
      <header className="workspace-topbar">
        <div className="workspace-location"><span>Workspace</span><span aria-hidden="true">/</span><strong>{sectionLabel}</strong></div>
        <div className="workspace-utilities">
          <div className="workspace-account"><strong>Hamza</strong> · @ham_zax</div>
          <button
            type="button"
            className="app-utility-link"
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className="theme-dot" aria-hidden="true" />
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </header>
      <main id="workspace-main" tabIndex={-1} className="app-main">
        <RouteContent />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  )
}
