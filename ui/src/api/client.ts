import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
const API_BASE = '/api'

interface ApiResponse<T> {
  state: 'success' | 'error'
  data?: T
  code?: string
  message?: string
  details?: unknown
}

export class ApiError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  let json: ApiResponse<T>
  try {
    json = await res.json()
  } catch {
    throw new ApiError(`The server returned an unreadable response (${res.status}).`)
  }
  if (json.state === 'error' || !res.ok) {
    throw new ApiError(json.message || `Request failed (${res.status}).`, json.code)
  }
  return json.data as T
}

async function fetchApi<T>(path: string): Promise<T> {
  return request<T>(path)
}

async function postApi<T>(path: string, body: object = {}): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------
export interface GatesView {
  passed: boolean
  writingFailures: { code: string; message: string }[]
  humanConfirmations: { code: string; message: string }[]
  warnings: { code: string; message: string }[]
}

export interface DraftView {
  id: number
  candidateKey: string
  hook: string
  insight: string
  evidence: string
  action: string
  body: string
  threadParts: string[]
  editor: Record<string, unknown>
  gates: Record<string, unknown>
  gatesView: GatesView
  qualityScore: number
  status: string
  scheduledAt: number | null
  publishedTweetId: string | null
  publishedAt: number | null
  liveAnalysis?: {
    score: number
    gates: Record<string, unknown>
    gatesView: GatesView
    breakdown: Record<string, number>
    weightedLength: number | null
  }
}

export interface QueueItemView {
  id: number
  candidateKey: string
  title: string
  text: string
  url: string
  source: string
  pipeline: string
  pipelineLabel: string
  status: string
  statusLabel: string
  lane: string
  targetUsername: string | null
  draftId: number | null
  draft: DraftView | null
  recommendedPipeline: string | null
  recommendedPipelineLabel: string | null
  routingReason: string
  expiresAt: number | null
  scheduledAt: number | null
  scheduleUrgency: string
  scheduleSource: string
  humanApprovedAt: number | null
  approvedText: string | null
  publishStartedAt: number | null
  publishedAt: number | null
  publishedTweetId: string | null
  outputUrl: string | null
  publishError: string | null
  potentials: { reach: number; follow: number; conversation: number; relationship: number }
  schedule?: SchedulePlan | null
}

export interface SchedulePlan {
  recommendedAt: number | null
  eligible: boolean
  reason: string
  blockers?: { code: string; message: string }[]
  warnings?: { code: string; message: string }[]
  conflicts?: { code: string; message: string }[]
  priority?: number | null
  manualOnly?: boolean
  scheduledAt?: number | null
  expiresAt?: number | null
  scheduleUrgency?: string
  scheduleSource?: string
  automation?: boolean
}

export interface SessionData {
  automation: boolean
  account: string
  health: { state: string; label: string; explanation: string }
  nextScheduled: { recommendedAt: number; title: string } | null
  labels: {
    statuses: Record<string, string>
    pipelines: Record<string, string>
    evidence: Record<string, string>
    dimensions: Record<string, string>
    metrics: Record<string, string>
    healthStates: Record<string, string>
    qualitySignals: Record<string, string>
    dimensionGroups: { content: string[]; network: string[] }
    metricsByKind: { content: string[]; network: string[] }
  }
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => fetchApi<SessionData>('/session'),
    staleTime: 60_000,
  })
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

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
  stats: {
    activeConversations: number
    waitingForReview: number
    meaningfulInteractions7d: number
    newRelevantFollowers24h: number
    newlyObservedFollowers24h: number
  }
  accountHealth: { state: string; label: string }
  nextScheduled: { recommendedAt: number; item: { candidateKey: string; title: string } } | null
  automation: boolean
}

export function useToday() {
  return useQuery({
    queryKey: ['today'],
    queryFn: () => fetchApi<TodayData>('/today'),
    staleTime: 30_000,
  })
}

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------

export interface DiscoveredCandidate {
  key: string
  title: string
  text: string
  displayText: string
  url: string
  source: string
  timestamp: number | null
  score: number
  saved: boolean
  metrics: Record<string, number | string> & { kind: string }
  niche: { tags: { tag: string; label: string }[]; matches: string[]; score: number | null }
  viral: { tier: string; label: string; ageHours: number; viewsPerHour: number; engagementsPerHour: number; score: number } | null
  queue: {
    pipeline: string
    pipelineLabel: string
    status: string
    statusLabel: string
    recommendedPipeline: string | null
    recommendedPipelineLabel: string | null
    routingReason: string
    draftId: number | null
    draftQualityScore: number | null
    potentials: { reach: number; follow: number; conversation: number; relationship: number }
  } | null
  completion: { action: string; label: string; summary: string; outputUrl: string | null; occurredAt: number | null } | null
  actions: { action: string; label: string; summary: string; outputUrl: string | null; occurredAt: number | null }[]
}

export interface DiscoverData {
  feed: string
  refreshable: string | null
  snapshotAt: number | null
  topicFilters: { value: string; label: string }[]
  candidates: DiscoveredCandidate[]
  total: number
}

export function useDiscover(feed: string, tag: string) {
  return useQuery({
    queryKey: ['discover', feed, tag],
    queryFn: () => fetchApi<DiscoverData>(`/discover?feed=${encodeURIComponent(feed)}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`),
    staleTime: 30_000,
  })
}

export function useDiscoverRefresh() {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (feed: string) => postApi('/discover/refresh', { feed }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
    },
  })
}

export type TriageAction = 'original' | 'quote' | 'thread' | 'reply' | 'repost' | 'research' | 'watch' | 'ignore' | 'discard' | 'save' | 'unsave'

export interface TriageResult {
  action: string
  generated?: boolean
  draftId?: number | null
  queueItem: QueueItemView | null
}

export function useDiscoverTriage() {
  const queryClient = useQueryClient()
  return useMutation<TriageResult, Error, { key: string; action: TriageAction }>({
    mutationFn: ({ key, action }) => postApi('/discover/triage', { key, action }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['create'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
      if (vars.action === 'save' || vars.action === 'unsave' || vars.action === 'ignore' || vars.action === 'discard') return
    },
  })
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export interface ConversationListItem {
  key: string
  targetUsername: string
  engagementKind: string
  engagementKindLabel: string
  status: string
  statusLabel: string
  priority: number
  priorityLabel: string
  contribution: string
  sourceText: string
  sourceUrl: string
  draftId: number | null
  draftQualityScore: number | null
  expiresAt: number | null
  relationship: { stage: string; targetScore: number; theirRepliesToUs: number; meaningfulInteractions: number } | null
}

export interface ConversationsData {
  activeConversations: ConversationListItem[]
  newOpportunities: ConversationListItem[]
  health: { state: string; label: string; explanation: string }
}

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => fetchApi<ConversationsData>('/conversations'),
    staleTime: 30_000,
  })
}

export interface DraftEditorData {
  mode: 'conversation' | 'create'
  draft: DraftView
  candidate: { key: string; title: string; text: string; url: string; source: string }
  pipeline: string
  pipelineLabel: string
  queueItem: QueueItemView | null
  analysis: { score: number; gates: Record<string, unknown>; gatesView: GatesView; breakdown: Record<string, number> }
  flags: {
    engagementReply: boolean
    engagementConstrained: boolean
    readOnly: boolean
    canReview: boolean
    canApprove: boolean
    canApproveSend: boolean
    canSendApproved: boolean
    approvedMainFeed: boolean
  }
  relationship: { username: string; stage: string; targetScore: number; classes: string[]; theirRepliesToUs: number; meaningfulInteractions: number } | null
  schedule: SchedulePlan | null
}

export interface ConversationDetailData {
  key: string
  targetUsername: string
  engagementKind: string
  engagementKindLabel: string
  status: string
  statusLabel: string
  priority: number
  priorityLabel: string
  contribution: string
  replyArchetype: string
  expiresAt: number | null
  freshness: Record<string, unknown> | null
  rejectionReasons: string[]
  expiry: Record<string, unknown>
  softPressure: Record<string, unknown> | null
  saturationSummary: Record<string, unknown> | null
  repetitionSummary: Record<string, unknown> | null
  learnedAdjustment: Record<string, unknown> | null
  components: Record<string, number>
  candidate: { key: string; title: string; text: string; url: string } | null
  relationship: {
    username: string
    displayName: string
    stage: string
    targetScore: number
    targetScoreLabel: string
    classes: string[]
    theirRepliesToUs: number
    meaningfulInteractions: number
  } | null
  editor: DraftEditorData | null
  health: { state: string; constrained: boolean }
  flags: { canReview: boolean; canApproveSend: boolean; approved: boolean }
}

export function useConversationDetail(key: string | null) {
  return useQuery({
    queryKey: ['conversation', key],
    queryFn: () => fetchApi<ConversationDetailData>(`/conversations/${encodeURIComponent(key ?? '')}`),
    enabled: Boolean(key),
    staleTime: 15_000,
  })
}

export function useConversationAction(action: string, key: string | null) {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: (payload) => postApi(`/conversations/${encodeURIComponent(key ?? '')}/${action}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversation', key] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
      void queryClient.invalidateQueries({ queryKey: ['create'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateSection {
  id: string
  title: string
  note: string
  statuses: string[]
  items: QueueItemView[]
}

export interface CreateData {
  sections: CreateSection[]
  counts: { ideas: number; drafting: number; review: number; approvedWaiting: number }
  automation: boolean
}

export function useCreate() {
  return useQuery({
    queryKey: ['create'],
    queryFn: () => fetchApi<CreateData>('/create'),
    staleTime: 30_000,
  })
}

export function useDraftEditor(id: number | null) {
  return useQuery({
    queryKey: ['draft', id],
    queryFn: () => fetchApi<DraftEditorData>(`/drafts/${id}`),
    enabled: id != null && Number.isFinite(id),
    staleTime: 15_000,
  })
}

export function useQueueAction(action: string) {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: (payload) => postApi(`/queue/${action}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['create'] })
      void queryClient.invalidateQueries({ queryKey: ['draft'] })
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
      void queryClient.invalidateQueries({ queryKey: ['conversation'] })
    },
  })
}

export interface DraftActionPayload {
  body?: string
  threadParts?: string[]
  mediaType?: string
  mediaRequired?: boolean
  mediaReason?: string
  mediaSource?: string
  mediaAltText?: string
  scheduledAt?: number | null
  op?: string
}

export function useDraftAction(id: number | null, action: string) {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, DraftActionPayload>({
    mutationFn: (payload) => postApi(`/drafts/${id}/${action}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['draft', id] })
      void queryClient.invalidateQueries({ queryKey: ['create'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface MeasuredPost {
  title: string
  pipeline: string
  publishedAt: number | null
  outputUrl: string | null
  windowLabel: string
  latest: {
    windowMinutes: number
    views: number
    replies: number
    reposts: number
    followerDelta: number | null
    attributionConfidence: string
    capturedAt: number
  }
}

export interface ResultsData {
  account: {
    followers: number
    following: number
    posts: number
    likes: number
    followerDelta: number | null
    capturedAt: number | null
    postsList: { text: string; views: number; likes: number; reposts: number; replies: number; publishedAt: number | null }[]
  } | null
  audience: { followers: number; relevantFollowers: number }
  followerQuality: { nicheAlignedNewFollowers: number; newlyObservedFollowers: number }
  conversations: { meaningfulInteractions7d: number; responseRate: number | null; continuationRate: number | null }
  accountHealth: { state: string; label: string; explanation: string }
  measuredPosts: MeasuredPost[]
  technical: { title: string; pipeline: string; publishedAt: number | null; outputUrl: string | null; measurements: Record<string, unknown>[] }[]
}

export function useResults() {
  return useQuery({
    queryKey: ['results'],
    queryFn: () => fetchApi<ResultsData>('/results'),
    staleTime: 60_000,
  })
}

export function useRefreshPerformance() {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, void>({
    mutationFn: () => postApi('/results/refresh-performance', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['results'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

export interface AudienceProfile {
  username: string
  displayName: string
  bio: string
  followsYou: boolean
  youFollow: boolean
  fitBucket: string
  relevanceScore: number
  nicheTags: string[]
  matchedKeywords: string[]
  exclusionMatches: string[]
  deprioritizationMatches: string[]
  signals: { kind: string; terms: string[] }
  lastSeenAt: number | null
  firstSeenAt: number | null
}

export interface AudienceData {
  summary: { followers: number; following: number; relevantFollowers: number; relevantFollowing: number; targetAccounts: number }
  counts: { outsideFollowing: number; uncertainFollowing: number; inNicheFollowing: number; inNicheFollowers: number }
  outsideFollowing: AudienceProfile[]
  uncertainFollowing: AudienceProfile[]
  targets: AudienceProfile[]
  relevantFollowers: AudienceProfile[]
}

interface AudienceUnfollowJob {
  jobId: string
  username: string
  status: 'pending' | 'success' | 'failed'
  profile?: AudienceProfile | null
  error?: string | null
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useAudience() {
  return useQuery({
    queryKey: ['audience'],
    queryFn: () => fetchApi<AudienceData>('/audience'),
    staleTime: 60_000,
  })
}

export function useAudienceUnfollow() {
  const queryClient = useQueryClient()
  return useMutation<AudienceUnfollowJob, Error, string>({
    mutationFn: async (username: string) => {
      const started = await postApi<AudienceUnfollowJob>('/audience/unfollow', { username, confirmUnfollow: true })
      const deadline = Date.now() + 60_000
      while (Date.now() < deadline) {
        const job = await fetchApi<AudienceUnfollowJob>(`/audience/unfollow/${encodeURIComponent(started.jobId)}`)
        if (job.status === 'success') return job
        if (job.status === 'failed') throw new ApiError(job.error || `X did not complete the unfollow for @${username}.`)
        await wait(750)
      }
      throw new ApiError(`Unfollow for @${username} is still running in the background. Refresh Audience shortly to see the final state.`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['audience'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Improve
// ---------------------------------------------------------------------------

export interface TestSummary {
  label: string
  summary: {
    primaryMetric: string
    primaryMetricLabel: string
    primaryMetricValues: Record<string, number | null>
    completedByVariant: Record<string, number>
    cohorts: Record<string, unknown>
    evidence: { state: string; label: string; sampleSize?: number } | null
  } | null
}

export interface TestView {
  id: number
  name: string
  hypothesis: string
  dimension: string
  dimensionLabel: string
  primaryMetric: string
  primaryMetricLabel: string
  secondaryMetrics: string[]
  population: Record<string, unknown>
  minimumCompletedPerVariant: number
  status: string
  isNetwork: boolean
  variants: string[]
  summaries: TestSummary[]
  assignments: { candidateKey: string; variantLabel: string; lane: string; pipeline: string; status: string; statusLabel: string; assignedAt: number | null }[]
  assignableItems: { key: string; label: string; status: string; statusLabel: string }[]
}

export interface LearnedRuleView {
  id: number
  ruleId: string
  status: string
  statusLabel: string
  scope: string
  key: string
  finding: string
  recommendation: string
  primaryMetric: string | null
  primaryMetricLabel: string | null
  evidence: { state: string; label: string; sampleSize?: number }
  comparison: { baselineLabel?: string; baselineValue?: number | null; comparisonLabel?: string; comparisonValue?: number | null }
  adjustment: { target?: string; component?: string | null; proposed?: number; effective?: number }
  match: Record<string, unknown>
  mechanismTags: string[]
  acceptance: { eligible?: boolean } | null
  review: { reviewRequired?: boolean; reasons?: { code: string; message: string }[] }
}

export interface ImproveData {
  tests: TestView[]
  learning: {
    suggested: number
    accepted: number
    retired: number
    rules: LearnedRuleView[]
  }
}

export function useImprove() {
  return useQuery({
    queryKey: ['improve'],
    queryFn: () => fetchApi<ImproveData>('/improve'),
    staleTime: 30_000,
  })
}

export function useTestCreate() {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: (payload) => postApi('/tests', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['improve'] })
    },
  })
}

export function useTestAction(action: string) {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, { id: number } & Record<string, unknown>>({
    mutationFn: ({ id, ...payload }) => postApi(`/tests/${id}/${action}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['improve'] })
      void queryClient.invalidateQueries({ queryKey: ['create'] })
    },
  })
}

export function useLearningAction(action: string) {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: (payload) => postApi(`/learning/${action}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['improve'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })
}
