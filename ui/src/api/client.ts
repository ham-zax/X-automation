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


// Conversations types
export interface Conversation {
  id: string
  targetUsername: string
  targetTweetId: string
  contribution: string
  sourceText: string
  relationshipStage: string
  lastActivity: number | null
  href: string
}

export interface Opportunity {
  id: string
  targetUsername: string
  contribution: string
  sourceText: string
  href: string
}

export interface ConversationsData {
  activeConversations: Conversation[]
  newOpportunities: Opportunity[]
}

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => fetchApi<ConversationsData>('/conversations'),
    staleTime: 30_000,
  })
}


// Create types
export interface Draft {
  id: number
  candidateKey: string
  title: string
  body: string
  hook: string
  insight: string
  evidence: string
  action: string
  qualityScore: number
  pipeline: string
  status: string
  scheduledAt: number | null
  publishedTweetId: string | null
  publishedAt: number | null
  gates: Record<string, unknown>
  href: string
}

export interface CreateData {
  ideas: Draft[]
  drafting: Draft[]
  needsReview: Draft[]
  approved: Draft[]
  publishing: Draft[]
  published: Draft[]
  total: number
}

export function useCreate() {
  return useQuery({
    queryKey: ['create'],
    queryFn: () => fetchApi<CreateData>('/create'),
    staleTime: 30_000,
  })
}


// Discover types
export interface DiscoveredCandidate {
  key: string
  title: string
  text: string
  url: string
  source: string
  score: number
  viralScore: number
  viralTier: string
  nicheLabel: string
  nicheMatches: string[]
  saved: boolean
  discoveredAt: number
}

export interface DiscoverData {
  candidates: DiscoveredCandidate[]
  total: number
}

export function useDiscover() {
  return useQuery({
    queryKey: ['discover'],
    queryFn: () => fetchApi<DiscoverData>('/discover'),
    staleTime: 30_000,
  })
}


// Audience types
export interface AudienceProfile {
  username: string
  displayName: string
  bio: string
  followsYou: boolean
  youFollow: boolean
  nicheState: string
  nicheLabel: string
  nicheConfidence: number
  topicFit: number
  firstSeenAt: number
  lastSeenAt: number
}

export interface AudienceData {
  profiles: AudienceProfile[]
  total: number
}

export function useAudience() {
  return useQuery({
    queryKey: ['audience'],
    queryFn: () => fetchApi<AudienceData>('/audience'),
    staleTime: 30_000,
  })
}
