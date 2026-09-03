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
import { First1000MissionSettings } from './features/settings/First1000MissionSettings'
import { NicheSettings } from './features/settings/NicheSettings'
import { PersonaSettings } from './features/settings/PersonaSettings'
import { Settings } from './features/settings/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const NAV_ITEMS = [
  { id: 'today', label: 'Today', href: '#/today' },
  { id: 'discover', label: 'Discover', href: '#/discover' },
  { id: 'conversations', label: 'Conversations', href: '#/conversations' },
  { id: 'create', label: 'Posts', href: '#/create' },
  { id: 'results', label: 'Results', href: '#/results' },
  { id: 'learn', label: 'Learn', href: '#/learn' },
]

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
  if (first === 'settings' && second === 'first-1000-mission') return <First1000MissionSettings />
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { window.localStorage.setItem('x-growth-theme', theme) } catch {}
  }, [theme])

  return (
    <div className="app-shell min-h-screen text-slate-900">
      <header className="app-header sticky top-0 z-40 border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between gap-3 py-3">
            <a href="#/today" className="app-brand text-lg font-semibold tracking-tight sm:text-xl">
              <span className="app-brand-mark" aria-hidden="true">X</span>
              <span><span className="hidden sm:inline">Network </span>Growth OS</span>
            </a>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="app-utility-link"
                onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                <span aria-hidden="true">{theme === 'dark' ? '☀' : '◐'}</span>
                <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
              <a
                href="#/settings"
                aria-current={settingsActive ? 'page' : undefined}
                className="app-utility-link"
              >
                Settings
              </a>
            </div>
          </div>
          <nav className="app-primary-nav flex gap-1.5 overflow-x-auto pb-3" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={item.href}
                aria-current={active === item.id ? 'page' : undefined}
                className="app-nav-link whitespace-nowrap px-3.5 py-2 text-sm font-medium"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="app-main relative z-10 mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
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
