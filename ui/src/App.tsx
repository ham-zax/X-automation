import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Today } from './features/today/Today'
import { Conversations } from './features/conversations/Conversations'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'discover', label: 'Discover' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'create', label: 'Create' },
  { id: 'results', label: 'Results' },
  { id: 'improve', label: 'Improve' },
  { id: 'advanced', label: 'Advanced' },
]

function Shell() {
  const [active, setActive] = useState('today')

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">X Network Growth OS</h1>
          </div>
          <nav className="flex gap-6 -mb-px overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                  active === item.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {active === 'today' ? (
          <Today />
        ) : active === 'conversations' ? (
          <Conversations />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
            <h2 className="text-2xl font-semibold mb-4 capitalize">{active}</h2>
            <p className="text-slate-600">This workspace is being migrated from the legacy dashboard.</p>
          </div>
        )}
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
