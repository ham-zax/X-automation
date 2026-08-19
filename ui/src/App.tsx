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
import { Improve } from './features/improve/Improve'
import { Advanced } from './features/advanced/Advanced'

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
  { id: 'results', label: 'Performance', href: '#/results' },
  { id: 'improve', label: 'Experiments', href: '#/improve' },
  { id: 'advanced', label: 'Diagnostics', href: '#/advanced' },
]

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
  if (first === 'improve') return <Improve />
  if (first === 'advanced') return <Advanced />
  return <Today />
}

function Shell() {
  const route = useHashRoute()
  const active = route.segments[0] || 'today'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <a href="#/today" className="text-xl font-semibold tracking-tight">X Network Growth OS</a>
          </div>
          <nav className="flex gap-6 -mb-px overflow-x-auto" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                  active === item.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
