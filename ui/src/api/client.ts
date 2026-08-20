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

export type EditorialObjective = 'qualified_growth' | 'reach_momentum' | 'relationships' | 'technical_authority' | 'balanced'

export interface EditorialEvidenceView {
  id: string
  claim: string
  claimType: string
  status: string
  sourceKind: string
  sourceFamily: string
  requestedUrl: string
  resolvedUrl: string
  title: string
  summary: string
  observedAt: number
}

export interface EditorialRecommendationView {
  id: number
  rank: number
  decision: 'PREPARE' | 'RESEARCH_MORE' | 'SKIP'
  pipeline: string | null
  objective: EditorialObjective
  title: string
  thesis: string
  whyNow: string
  whyThisFormat: string
  desiredReaderOutcome: string
  candidateKeys: string[]
  targetCandidateKey: string | null
  potentials: Record<string, number | string | null>
  authority: Record<string, unknown> & { value?: number }
  profileProof: { topic?: string; coverage?: string; supportingPostIds?: string[]; reason?: string }
  evidenceIds: string[]
  evidence: EditorialEvidenceView[]
  evidenceState: { count: number; statuses: Record<string, number>; sourceFamilies: string[] }
  algorithmEvidence: unknown[]
  learnedContext: Record<string, unknown>
  aiExecution: Record<string, unknown>
  risks: unknown[]
  alternatives: unknown[]
  researchQuestions: string[]
  status: string
  selectedAt: number | null
  dismissedAt: number | null
  createdAt: number
  sources: { key: string; source: string; title: string; text: string; url: string }[]
  selection: {
    id: number
    queueItemId: number
    selectedPipeline: string
    selectedAt: number
    candidateKey: string | null
    draftId: number | null
    queueStatus: string | null
  } | null
}

export interface EditorialSourceFreshness {
  kind: string
  fetchedAt: number | null
  lastRefreshAttemptAt: number | null
  error: string | null
  legacyFallback: boolean
  candidateCount: number
}

export interface EditorialPlanData {
  objective: EditorialObjective
  hasPlan: boolean
  run: {
    id: number
    status: string
    createdAt: number
    completedAt: number | null
    sourceSnapshot: Record<string, unknown>
    aiExecution: Record<string, unknown>
  } | null
  sourceFreshness: EditorialSourceFreshness[]
  recommendations: EditorialRecommendationView[]
  noStrongAction: boolean
  noStrongActionReason: string
}

export interface EditorialSelectionResult {
  recommendation: EditorialRecommendationView
  selection: { id: number; editorialRecommendationId: number; queueItemId: number; selectedPipeline: string; selectedAt: number }
  queueItem: QueueItemView
  candidateKey: string
  draftId: number | null
  research: { required: boolean; state: string; label: string; questions: string[] } | null
  idempotent: boolean
}

function invalidateEditorial(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['editorial'] })
  void queryClient.invalidateQueries({ queryKey: ['today'] })
  void queryClient.invalidateQueries({ queryKey: ['discover'] })
}

export function useEditorialPlan(objective: EditorialObjective) {
  return useQuery({
    queryKey: ['editorial', objective],
    queryFn: () => fetchApi<EditorialPlanData>(`/editorial?objective=${encodeURIComponent(objective)}`),
    staleTime: 30_000,
  })
}

export function useEditorialRecommendation(id: number | null) {
  return useQuery({
    queryKey: ['editorial', 'recommendation', id],
    queryFn: () => fetchApi<{ recommendation: EditorialRecommendationView }>(`/editorial/recommendations/${id}`),
    enabled: id != null,
    staleTime: 30_000,
  })
}

export function useEditorialRefresh() {
  const queryClient = useQueryClient()
  return useMutation<EditorialPlanData, Error, { objective: EditorialObjective; refreshSources: boolean }>({
    mutationFn: (payload) => postApi('/editorial/refresh', payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['editorial', data.objective], data)
      invalidateEditorial(queryClient)
    },
  })
}

export function useEditorialSelect() {
  const queryClient = useQueryClient()
  return useMutation<EditorialSelectionResult, Error, { recommendationId: number; pipelineOverride?: string | null }>({
    mutationFn: ({ recommendationId, pipelineOverride }) => postApi(`/editorial/recommendations/${recommendationId}/select`, { pipelineOverride }),
    onSuccess: () => {
      invalidateEditorial(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['create'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useEditorialDismiss() {
  const queryClient = useQueryClient()
  return useMutation<{ recommendation: EditorialRecommendationView }, Error, number>({
    mutationFn: (recommendationId) => postApi(`/editorial/recommendations/${recommendationId}/dismiss`),
    onSuccess: () => invalidateEditorial(queryClient),
  })
}

export function useEditorialAddResearchSource() {
  const queryClient = useQueryClient()
  return useMutation<{ evidence: EditorialEvidenceView; recommendation: EditorialRecommendationView }, Error, { recommendationId: number; url: string; claim: string; claimType?: string }>({
    mutationFn: ({ recommendationId, ...payload }) => postApi(`/editorial/recommendations/${recommendationId}/research-source`, payload),
    onSuccess: () => invalidateEditorial(queryClient),
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
  sourceMomentum: {
    snapshotKind: string
    current: { observedAt: number; rank: number | null; metrics: Record<string, unknown> }
    previous: { observedAt: number; rank: number | null; metrics: Record<string, unknown> } | null
    intervalMs: number | null
    intervalHours: number | null
    deltas: Record<string, unknown> | null
    reason: string | null
  } | null
  editorialPlan: {
    recommendationId: number
    rank: number
    decision: 'PREPARE' | 'RESEARCH_MORE' | 'SKIP'
    pipeline: string | null
    status: string
    title: string
  } | null
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
  sourceKind: string | null
  snapshotAt: number | null
  lastRefreshAttemptAt: number | null
  sourceError: string | null
  legacyFallback: boolean
  editorialObjective: EditorialObjective
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
  return useMutation<{ refreshedFeed: string; refresh: unknown }, Error, string>({
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

export interface EditorialOutcomeDistribution {
  total: number
  values: Record<string, { count: number; share: number }>
}

export interface EditorialOutcomeCohort {
  kind: 'content'
  sampleSize: number
  totals: Record<string, number>
  metrics: Record<string, number | null>
  attributionConfidence: EditorialOutcomeDistribution
  confounders: Record<string, EditorialOutcomeDistribution>
  context: Record<string, unknown>
  causalClaimAllowed: false
}

export interface EditorialOutcomeSummary {
  windowMinutes: number
  observationCount: number
  byObjective: { value: string; summary: EditorialOutcomeCohort }[]
  byRecommendedPipeline: { value: string; summary: EditorialOutcomeCohort }[]
  bySelectedPipeline: { value: string; summary: EditorialOutcomeCohort }[]
  byFinalPublishedPipeline: { value: string; summary: EditorialOutcomeCohort }[]
  byTopic: { value: string; summary: EditorialOutcomeCohort }[]
  causalClaimAllowed: false
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
  editorialOutcomes: EditorialOutcomeSummary | null
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

export interface AudienceReviewSuggestion {
  rank: number
  username: string
  decision: 'consider_unfollow' | 'needs_human_review'
  confidence: 'high' | 'medium' | 'low'
  reason: string
  signals: string[]
  profile: AudienceProfile
}

export interface AudienceReview {
  reviewedAt: number
  reviewedCount: number
  totalFollowing: number
  summary: string
  suggestions: AudienceReviewSuggestion[]
  execution: { runtime: string; provider: string; model: string; reasoning: string; profileId: number | null; fallbackUsed: boolean } | null
}

export interface AudienceData {
  summary: { followers: number; following: number; relevantFollowers: number; relevantFollowing: number; targetAccounts: number }
  counts: { outsideFollowing: number; uncertainFollowing: number; inNicheFollowing: number; inNicheFollowers: number }
  outsideFollowing: AudienceProfile[]
  uncertainFollowing: AudienceProfile[]
  targets: AudienceProfile[]
  relevantFollowers: AudienceProfile[]
  aiReview: AudienceReview | null
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

export function useAudienceReview() {
  const queryClient = useQueryClient()
  return useMutation<AudienceReview, Error, void>({
    mutationFn: () => postApi<AudienceReview>('/audience/review', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['audience'] })
    },
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

// ---------------------------------------------------------------------------
// AI Settings
// ---------------------------------------------------------------------------

export type AICapability = 'supported' | 'compatible_fallback' | 'unknown' | 'unsupported'

export interface AIProfileView {
  id: number | null
  name: string
  runtime: 'direct_api' | 'codex' | 'opencode' | 'opencode2' | 'agy'
  providerKind: 'openai' | 'openrouter' | 'openai_compatible' | 'runtime_managed'
  baseUrl: string
  protocol: 'responses' | 'chat_completions' | 'runtime_native'
  model: string
  reasoning: string
  runtimeProfile: string
  settings: Record<string, string>
  enabled: boolean
  compatibility: boolean
  capability: AICapability
  secret: { source: 'file' | 'env' | null; hasSecret: boolean }
  createdAt: number | null
  updatedAt: number | null
}

export interface AIRoleView {
  role: 'continuous_scan' | 'editorial_scan' | 'editorial_final' | 'audience_review' | 'writer'
  activity: 'not_active' | 'configured' | 'unconfigured'
  primaryProfileId: number | null
  fallbackProfileId: number | null
  primaryProfile: AIProfileView | null
  fallbackProfile: AIProfileView | null
  resolvedProfile: AIProfileView | null
  resolutionSource: 'explicit' | 'role' | 'global' | 'compatibility' | 'unconfigured'
}

export interface AISettingsData {
  profiles: AIProfileView[]
  defaultProfileId: number | null
  defaultProfile: AIProfileView | null
  roles: AIRoleView[]
}

export interface AIRuntimeAvailability {
  runtime: 'direct_api' | 'codex' | 'opencode' | 'opencode2' | 'agy'
  installed: boolean
  version: string | null
  structuredOutput: AICapability
  reason: string | null
}

export interface AIModelCatalogEntry {
  id: string
  name: string
  provider?: string
  runtime?: string
  contextLength?: number | null
  pricing?: Record<string, string | number> | null
  supportedParameters?: string[]
  structuredOutput?: AICapability
  inputModalities?: string[] | null
  outputModalities?: string[] | null
  defaultReasoning?: string | null
  reasoningLevels?: string[]
}

export interface AICatalogData {
  models: AIModelCatalogEntry[]
  fetchedAt: number | null
  manualModelEntry: boolean
  capability?: AICapability
  error?: { code: string; message?: string }
}

export interface AIConnectionCheck {
  runtimeAvailable: boolean
  providerReachable: boolean | null
  authenticated: boolean | null
  modelFound: boolean | null
  structuredOutputPath: string
  latencyMs: number
  error: { code: string; httpStatus?: number | null } | null
}

export interface AIProfileTestResult {
  ok: boolean
  runtime: string
  provider: string
  model: string
  reasoning: string
  structuredOutputPath: string
  latencyMs: number
  inputTokens: number | null
  outputTokens: number | null
  costUsd: number | null
  requestCount: number
}

export interface AIRunView {
  id: number
  invocationId: string
  attempt: number
  attemptKind: 'primary' | 'fallback'
  role: string
  profileId: number | null
  profileName: string | null
  profileSource: string | null
  runtime: string
  providerKind: string
  model: string
  reasoning: string
  fallbackProfileId: number | null
  fallbackUsed: boolean
  status: 'running' | 'complete' | 'failed'
  errorCode: string
  startedAt: number
  completedAt: number | null
  durationMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  costUsd: number | null
  requestCount: number | null
  repairAttempted: boolean
}

function invalidateAI(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['ai'] })
}

export function useAISettings() {
  return useQuery({
    queryKey: ['ai', 'settings'],
    queryFn: () => fetchApi<AISettingsData>('/ai/settings'),
    staleTime: 15_000,
  })
}

export function useAIRuntimeAvailability() {
  return useQuery({
    queryKey: ['ai', 'runtimes'],
    queryFn: () => fetchApi<{ runtimes: AIRuntimeAvailability[] }>('/ai/runtimes'),
    staleTime: 60_000,
  })
}

export function useAIRuns(limit = 50) {
  return useQuery({
    queryKey: ['ai', 'runs', limit],
    queryFn: () => fetchApi<{ runs: AIRunView[] }>(`/ai/runs?limit=${limit}`),
    staleTime: 15_000,
  })
}

export function useAIProfileSave() {
  const queryClient = useQueryClient()
  return useMutation<{ profile: AIProfileView }, Error, { id?: number; payload: Record<string, unknown> }>({
    mutationFn: ({ id, payload }) => postApi(id == null ? '/ai/profiles' : `/ai/profiles/${id}`, payload),
    onSuccess: () => invalidateAI(queryClient),
  })
}

export function useAIProfileEnabled() {
  const queryClient = useQueryClient()
  return useMutation<{ profile: AIProfileView }, Error, { id: number; enabled: boolean }>({
    mutationFn: ({ id, enabled }) => postApi(`/ai/profiles/${id}/enabled`, { enabled }),
    onSuccess: () => invalidateAI(queryClient),
  })
}

export function useAIProfileDelete() {
  const queryClient = useQueryClient()
  return useMutation<{ deletedProfileId: number }, Error, number>({
    mutationFn: (id) => postApi(`/ai/profiles/${id}/delete`),
    onSuccess: () => invalidateAI(queryClient),
  })
}

export function useAISecretReplace() {
  const queryClient = useQueryClient()
  return useMutation<{ profile: AIProfileView }, Error, { id: number; apiKey: string }>({
    mutationFn: ({ id, apiKey }) => postApi(`/ai/profiles/${id}/secret`, { apiKey }),
    onSuccess: () => invalidateAI(queryClient),
  })
}

export function useAISecretRemove() {
  const queryClient = useQueryClient()
  return useMutation<{ profile: AIProfileView }, Error, number>({
    mutationFn: (id) => postApi(`/ai/profiles/${id}/secret/remove`),
    onSuccess: () => invalidateAI(queryClient),
  })
}

export function useAIDefaultSave() {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, { profileId: number | null; confirmUnknownCapability?: boolean }>({
    mutationFn: ({ profileId, confirmUnknownCapability }) => profileId == null
      ? postApi('/ai/default/clear')
      : postApi('/ai/default', { profileId, confirmUnknownCapability }),
    onSuccess: () => invalidateAI(queryClient),
  })
}

export function useAIRoleSave() {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, { role: string; primaryProfileId: number | null; fallbackProfileId: number | null; confirmUnknownCapability?: boolean }>({
    mutationFn: ({ role, ...payload }) => postApi(`/ai/roles/${encodeURIComponent(role)}`, payload),
    onSuccess: () => invalidateAI(queryClient),
  })
}

export function useAICatalog(profileId: number | null) {
  return useQuery({
    queryKey: ['ai', 'catalog', profileId],
    queryFn: () => fetchApi<AICatalogData>(`/ai/profiles/${profileId}/catalog`),
    enabled: profileId != null,
    staleTime: 5 * 60_000,
  })
}

export function useAICatalogPreview() {
  return useMutation<AICatalogData, Error, { runtime: AIProfileView['runtime']; runtimeProfile?: string }>({
    mutationFn: (payload) => postApi('/ai/catalog-preview', payload),
  })
}

export function useAICatalogRefresh() {
  const queryClient = useQueryClient()
  return useMutation<AICatalogData, Error, number>({
    mutationFn: (profileId) => postApi(`/ai/profiles/${profileId}/catalog`),
    onSuccess: (catalog, profileId) => {
      queryClient.setQueryData(['ai', 'catalog', profileId], catalog)
    },
  })
}

export function useAIConnectionCheck() {
  return useMutation<AIConnectionCheck, Error, number>({
    mutationFn: (profileId) => postApi(`/ai/profiles/${profileId}/check`),
  })
}

export function useAIProfileTest() {
  return useMutation<AIProfileTestResult, Error, number>({
    mutationFn: (profileId) => postApi(`/ai/profiles/${profileId}/test`),
  })
}

// ---------------------------------------------------------------------------
// Viral Styles research
// ---------------------------------------------------------------------------

export type ViralEvidenceClass = 'INSUFFICIENT' | 'DIRECTIONAL' | 'REPEATED_ASSOCIATION' | 'STRONG_REPEATED_ASSOCIATION'

export interface ViralResearchGroup {
  groupType: string
  label: string
  evidenceClass: ViralEvidenceClass
  sampleSize: number
  uniqueAuthors: number
  medianViewsPerFollower: number | null
  medianEngagementsPerView: number | null
  medianBookmarksPerView: number | null
  medianRepostsPerView: number | null
  medianRepliesPerView: number | null
  medianViewsPerHour: number | null
  authorComparableCount: number
  authorWinCount: number
  authorWinRate: number | null
  authorWinRate90CiLow: number | null
  authorWinRate90CiHigh: number | null
  medianAuthorViewsLift: number | null
  cohortComparableCount: number
  cohortBreakoutCount: number
  cohortBreakoutRate: number | null
  cohortBreakoutRate90CiLow: number | null
  cohortBreakoutRate90CiHigh: number | null
}

export interface ViralResearchPost {
  tweetId: string
  username: string
  url: string
  text: string
  sampleKind: string
  sourceQuery: string
  createdAt: number | null
  createdAtIso: string
  publicationUtcHour: number | null
  publicationUtcDay: string
  mediaType: string
  threadLength: number
  threadExpectedLength: number | null
  threadComplete: boolean | null
  postAgeMinutes: number | null
  views: number | null
  likes: number | null
  reposts: number | null
  replies: number | null
  bookmarks: number | null
  authorFollowers: number | null
  followerCohort: string
  viewsPerFollower: number | null
  engagementsPerView: number | null
  bookmarksPerView: number | null
  repostsPerView: number | null
  repliesPerView: number | null
  viewsPerHour: number | null
  authorViewsLift: number | null
  cohortPercentile: number | null
  hookLabels: string[]
  styleLabels: string[]
  nicheTags: string[]
  nicheMatches: string[]
  aiPrimaryIntent: string | null
  aiSecondaryIntents: string[]
  aiSemanticStyle: string | null
  aiAudienceGoal: string | null
  aiReaderAction: string | null
  aiAngle: string | null
  aiIntentConfidence: number | null
  aiIntentRationale: string
  aiIntentEvidenceSpans: string[]
  aiIntentModel: string | null
  styleFeatures: Record<string, unknown>
}

export interface ViralResearchJob {
  id: string
  status: 'running' | 'stopping' | 'complete' | 'failed' | 'stopped'
  stage: 'collecting' | 'intent' | 'analyzing' | 'exporting' | 'complete' | 'failed' | 'stopped'
  checkpoint: 'queued' | 'discovering' | 'enriching' | 'controls' | 'threads' | 'intent_ai' | 'analyzing' | 'exporting' | 'complete' | 'stopped' | 'failed'
  progressPercent: number
  events: {
    at: number
    checkpoint: ViralResearchJob['checkpoint']
    message: string
    details: Record<string, unknown>
  }[]
  startedAt: number
  completedAt: number | null
  stopRequested: boolean
  config: {
    days: number
    niches: string[]
    thresholds: string[]
    limitPerQuery: number
    controlsPerSeed: number
    threads: boolean
    intent: {
      enabled: boolean
      mode: 'profile' | 'runtime'
      profileId?: number
      profileName?: string
      runtime?: string
      model?: string
      reasoning?: string
    }
  }
  progress: {
    totalJobs: number
    completedJobs: number
    totalSeeds: number
    totalErrors: number
    current?: { nicheTag: string; nicheLabel: string; threshold: string; since: string; until: string } | null
    currentCandidate?: {
      completed: number
      total: number | null
      candidateId: string | null
      collectedSeeds: number
      message: string
    } | null
  }
  intentProgress: {
    totalBatches: number
    completedBatches: number
    classified: number
    currentBatchSize?: number
  } | null
  summary: Record<string, unknown> | null
  error: string | null
}

export interface ViralResearchData {
  options: {
    windows: number[]
    niches: { tag: string; label: string }[]
    thresholds: { name: string; minFaves: number; minRetweets: number; minReplies: number }[]
    runtimeTypes: string[]
  }
  job: ViralResearchJob | null
  report: {
    generatedAt: number
    windowDays: number
    maturityHours: number
    confidence: number
    interpretation: string
    dataset: {
      totalStoredPosts: number
      totalStoredSnapshots: number
      totalStoredThreads: number
      eligiblePosts: number
      eligibleAuthors: number
      eligibleBySampleKind: Record<string, number>
      authorComparablePosts: number
      cohortComparablePosts: number
      aiIntentLabeledPosts: number
    }
    supportedGroups: ViralResearchGroup[]
    directionalGroups: ViralResearchGroup[]
    insufficientGroups: ViralResearchGroup[]
    intentGroups: ViralResearchGroup[]
    semanticStyleGroups: ViralResearchGroup[]
    nicheGroups: ViralResearchGroup[]
    timing: { utcHour: number; sampleSize: number; uniqueAuthors: number; medianViewsPerFollower: number | null; medianEngagementsPerView: number | null; medianBookmarksPerView: number | null; medianViewsPerHour: number | null }[]
    threads: { sampleSize: number; evidenceClass: string; completeCount: number; partialCount: number; unknownCompletenessCount: number; medianThreadLength: number | null; medianViewsPerFollower: number | null }
    posts: ViralResearchPost[]
  }
}

export interface ViralResearchRunPayload {
  days: number
  niches: string[]
  thresholds: string[]
  limitPerQuery: number
  controlsPerSeed: number
  threads: boolean
  intent: {
    enabled: boolean
    mode: 'profile' | 'runtime'
    profileId?: number
    runtime?: string
    model?: string
    reasoning?: string
  }
}

export function useViralResearch(days = 21) {
  return useQuery({
    queryKey: ['viral-research', days],
    queryFn: () => fetchApi<ViralResearchData>(`/viral-research?days=${days}`),
    staleTime: 10_000,
  })
}

export function useViralResearchStatus() {
  return useQuery({
    queryKey: ['viral-research', 'status'],
    queryFn: () => fetchApi<{ job: ViralResearchJob | null }>('/viral-research/status'),
    refetchInterval: 2_000,
  })
}

export function useViralResearchRun() {
  const queryClient = useQueryClient()
  return useMutation<{ job: ViralResearchJob }, Error, ViralResearchRunPayload>({
    mutationFn: (payload) => postApi('/viral-research/run', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['viral-research', 'status'] })
    },
  })
}

export function useViralResearchStop() {
  const queryClient = useQueryClient()
  return useMutation<{ job: ViralResearchJob | null }, Error, void>({
    mutationFn: () => postApi('/viral-research/stop'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['viral-research', 'status'] })
    },
  })
}
