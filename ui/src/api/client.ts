import { useQuery } from '@tanstack/react-query'

const API_BASE = '/api'

interface ApiResponse<T> {
  state: 'success' | 'error'
  data?: T
  code?: string
  message?: string
  details?: unknown
}

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  const json: ApiResponse<T> = await res.json()
  
  if (json.state === 'error') {
    throw new Error(json.message || 'API error')
  }
  
  return json.data!
}

export interface TodayAction {
  eyebrow: string
  title: string
  body: string
  note?: string
  href: string
  action: string
  tone: 'primary' | 'success' | 'warning' | 'danger'
}

export interface TodayData {
  taskCount: number
  actions: TodayAction[]
  accountHealth: {
    health: {
      state: 'healthy' | 'constrained' | 'unknown'
      explanation?: string
    }
  } | null
  followerQuality: unknown
  nextScheduled: {
    recommendedAt: number
    item: unknown
  } | null
  automation: boolean
}

export function useToday() {
  return useQuery({
    queryKey: ['today'],
    queryFn: () => fetchApi<TodayData>('/today'),
    staleTime: 30_000,
  })
}
