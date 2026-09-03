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
  approvalFailures: { code: string; message: string }[]
  warnings: { code: string; message: string }[]
}

export interface GrowthPackagingReview {
  ready: boolean
  blockers: { code: string; message: string }[]
  items: {
    stoppingPower: { status: string; detail: string }
    readerPayoff: { status: string; detail: string }
    distributionLeverage: { status: string; detail: string }
    sourceActionPath: { status: string; detail: string }
    interactionOpening: { status: string; detail: string }
    mediaOpportunity: { status: string; detail: string }
    strategyState: { status: string; mode: 'off' | 'suggest' | 'apply' | null; label: string; detail: string }
  }
}

export interface StrategicRelevance {
  state: 'core' | 'adjacent' | 'exploratory' | 'outside' | 'unknown'
  allowed: boolean
  topicScore: number | null
  tags: string[]
  explorationTags?: string[]
  explorationMatches?: string[]
  objective: EditorialObjective
  reasonCodes: string[]
  explanation: string
  profileRevision: number | null
  classifierVersion: number | null
  humanOverride: {
    accepted: true
    reason: string
    actor: 'human'
    at: number | null
    profileRevision: number | null
    classifierVersion: number | null
  } | null
}

export interface BehaviorDecision {
  schemaVersion?: number
  decision: 'ACT' | 'SILENT' | 'RESEARCH' | 'UNKNOWN'
  pipeline: string
  primaryPurpose: string | null
  secondaryPurposes: string[]
  socialMode: string | null
  affectStrategy: string
  affectProvenance: string
  informationDepth: string | null
  conversationStage: string
  reasonToExist: string
  selectionSource: string
  personaModelVersion: string
  provenance: {
    ownerFactsAllowed?: boolean
    ownerExperienceAllowed?: boolean
    sourceClaims?: string[]
    ownerClaims?: string[]
    restrictions?: string[]
    summary?: string
  }
  selectedAt: number | null
}

export interface PersonaModelSummary {
  schemaVersion: number
  version: string
  status: string
  identity: Record<string, unknown>
  operatorDecisions: Record<string, unknown>
  candidateBeliefs: { id?: string; statement?: string; status?: string; confidence?: string; basis?: string }[]
  knownUnknowns: string[]
  sourceArtifacts: string[]
}

export interface PersonaStanceEvent {
  id: number
  subject: string
  position: string
  confidence: 'low' | 'medium' | 'high'
  status: 'exploring' | 'provisional' | 'held' | 'revised' | 'abandoned'
  basis: string
  sourceRef: string
  provenance: Record<string, unknown>
  supersedesId: number | null
  observedAt: number
  createdAt: number
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
  editor: DraftEditorMetadata
  behavior?: BehaviorDecision | null
  personaModelVersion?: string
  gates: Record<string, unknown>
  gatesView: GatesView
  growthPackaging: GrowthPackagingReview | null
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
    growthPackaging: GrowthPackagingReview | null
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
  behavior: BehaviorDecision | null
  personaModelVersion: string
  draftId: number | null
  draft: DraftView | null
  recommendedPipeline: string | null
  recommendedPipelineLabel: string | null
  routingReason: string
  routingDecision: { accepted?: boolean; decision?: string; reason?: string; actor?: string; at?: number; recommendedPipeline?: string; routingReason?: string }
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
  growthFit: StrategicRelevance
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
    behavior: {
      purposes: string[]
      socialModes: string[]
      affectStrategies: string[]
      affectProvenance: string[]
      informationDepths: string[]
      conversationStages: string[]
    }
  }
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => fetchApi<SessionData>('/session'),
    staleTime: 60_000,
  })
}

export interface PersonaData {
  model: PersonaModelSummary
  slice?: Record<string, unknown>
  currentStances: PersonaStanceEvent[]
}

export function usePersona(consumer?: 'editorial' | 'engagement' | 'writer') {
  const suffix = consumer ? `?consumer=${consumer}` : ''
  return useQuery({
    queryKey: ['persona', consumer || 'summary'],
    queryFn: () => fetchApi<PersonaData>(`/persona${suffix}`),
    staleTime: 30_000,
  })
}

export interface PersonaStancePayload {
  subject: string
  position: string
  confidence?: 'low' | 'medium' | 'high'
  status?: 'exploring' | 'provisional' | 'held' | 'revised' | 'abandoned'
  basis: string
  sourceRef?: string
  supersedesId?: number | null
  observedAt?: number
  confirmRecord: true
}

export function useRecordPersonaStance() {
  const queryClient = useQueryClient()
  return useMutation<{ stance: PersonaStanceEvent; current: PersonaStanceEvent[] }, Error, PersonaStancePayload>({
    mutationFn: (payload) => postApi('/persona/stances', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['persona'] })
      void queryClient.invalidateQueries({ queryKey: ['draft'] })
    },
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
  behavior: BehaviorDecision | null
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
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
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
  niche: {
    tags: { tag: string; label: string }[]
    matches: string[]
    score: number | null
    status: 'current' | 'stale' | 'unclassified'
    profileRevision: number | null
    classifierVersion: number | null
    classifiedAt: number | null
  }
  growthFit: StrategicRelevance
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
    id: number
    pipeline: string
    pipelineLabel: string
    status: string
    statusLabel: string
    recommendedPipeline: string | null
    recommendedPipelineLabel: string | null
    routingReason: string
    routingDecision: { accepted?: boolean; decision?: string; reason?: string; actor?: string; at?: number; recommendedPipeline?: string; routingReason?: string }
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
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
    },
  })
}

// ---------------------------------------------------------------------------
// First-1,000 mission
// ---------------------------------------------------------------------------

export interface First1000MissionGrant {
  state: 'stopped' | 'running' | 'paused' | 'completed'
  mode: 'dry_run' | 'live'
  targetFollowers: number
  revision: number
  updatedAt: number | null
  startedAt: number | null
  startedBy: string | null
  pausedAt: number | null
  stoppedAt: number | null
  completedAt: number | null
  completedBy: string | null
}

export interface First1000MissionData {
  grant: First1000MissionGrant
  autoPost: boolean
}

export function useFirst1000Mission() {
  return useQuery({
    queryKey: ['first-1000-mission'],
    queryFn: () => fetchApi<First1000MissionData>('/first-1000-mission'),
    staleTime: 10_000,
  })
}

export function useFirst1000MissionAction(action: 'configure' | 'start' | 'pause' | 'stop') {
  const queryClient = useQueryClient()
  return useMutation<First1000MissionData, Error, Record<string, unknown>>({
    mutationFn: (payload) => postApi(`/first-1000-mission/${action}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['first-1000-mission'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Autonomous replies / Conversations
// ---------------------------------------------------------------------------

export interface AutonomousReplyDecision {
  id: number
  candidateKey: string
  targetTweetId: string
  targetUsername: string
  sourceClass: 'active' | 'momentum' | 'normal'
  relationshipStage: string | null
  intent: string | null
  tone: string | null
  exactReply: string
  selection: Record<string, unknown>
  behavior: BehaviorDecision | null
  relationshipContext: Record<string, unknown>
  aiExecution: Record<string, unknown>
  checks: Record<string, unknown>
  reasons: { code: string; reason: string }[]
  grantRevision: number
  mode: 'dry_run' | 'live'
  decision: string
  claimedAt: number | null
  sentAt: number | null
  outputTweetId: string | null
  outputUrl: string | null
  createdAt: number
  updatedAt: number
}

export interface AutonomousReplyGrant {
  state: 'stopped' | 'running' | 'paused'
  mode: 'dry_run' | 'live'
  allowedSources: ('active' | 'momentum' | 'normal')[]
  allowedIntents: string[]
  allowedTones: string[]
  humorAllowed: boolean
  liveBudget: number | null
  budgetUsed: number
  remainingBudget: number | null
  refreshMinutes: number
  revision: number
  updatedAt: number | null
  startedAt: number | null
  discoveryWatermarkAt: number | null
  liveStartReady: boolean
}

export interface AutonomousReplyData {
  grant: AutonomousReplyGrant
  runtime: {
    lastAttemptAt: number | null
    lastSuccessfulRefreshAt: number | null
    nextExpectedRefreshAt: number | null
    lastError: string
    lastDecisionCounts: { sent: number; review: number; skipped: number }
  }
  options: { sourceClasses: string[]; intents: string[]; tones: string[]; minRefreshMinutes: number }
  recentDecisions: AutonomousReplyDecision[]
  outcomes: {
    sampleSize: number
    byIntent: { label: string; sent: number; targetResponses: number; continued: number }[]
    byTone: { label: string; sent: number; targetResponses: number; continued: number }[]
    bySourceClass: { label: string; sent: number; targetResponses: number; continued: number }[]
    byRelationshipStage: { label: string; sent: number; targetResponses: number; continued: number }[]
    note: string
  }
}

export function useAutonomousReplies() {
  return useQuery({
    queryKey: ['autonomous-replies'],
    queryFn: () => fetchApi<AutonomousReplyData>('/autonomous-replies'),
    staleTime: 10_000,
  })
}

export function useAutonomousReplyAction(action: 'configure' | 'start' | 'pause' | 'stop') {
  const queryClient = useQueryClient()
  return useMutation<AutonomousReplyData, Error, Record<string, unknown>>({
    mutationFn: (payload) => postApi(`/autonomous-replies/${action}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['autonomous-replies'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['conversation'] })
    },
  })
}

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
  autonomousDecision: AutonomousReplyDecision | null
  relationship: { stage: string; targetScore: number; theirRepliesToUs: number; meaningfulInteractions: number } | null
}

export interface ConversationsData {
  activeConversations: ConversationListItem[]
  newOpportunities: ConversationListItem[]
  health: { state: string; label: string; explanation: string }
  autonomous: { grant: AutonomousReplyGrant; runtime: AutonomousReplyData['runtime']; recentDecisions: AutonomousReplyDecision[] }
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
  growthFit: StrategicRelevance
  analysis: { score: number; gates: Record<string, unknown>; gatesView: GatesView; breakdown: Record<string, number>; growthPackaging: GrowthPackagingReview | null }
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
  autonomousDecision: AutonomousReplyDecision | null
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

export function useBehaviorSelect() {
  const queryClient = useQueryClient()
  return useMutation<{
    behavior: BehaviorDecision
    queueItem: QueueItemView
    draft: DraftEditorData | null
  }, Error, { key: string; behavior: Partial<BehaviorDecision> }>({
    mutationFn: (payload) => postApi('/behavior/select', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['create'] })
      void queryClient.invalidateQueries({ queryKey: ['draft'] })
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
      void queryClient.invalidateQueries({ queryKey: ['conversation'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useRelevanceDecision() {
  const queryClient = useQueryClient()
  return useMutation<{ queueItem: QueueItemView; growthFit: StrategicRelevance }, Error, { queueItemId?: number; key?: string; decision: 'use_anyway' | 'clear_override'; reason?: string }>({
    mutationFn: (payload) => postApi('/work/relevance-decision', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['create'] })
      void queryClient.invalidateQueries({ queryKey: ['draft'] })
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
      void queryClient.invalidateQueries({ queryKey: ['conversation'] })
    },
  })
}

export function useRoutingDecision() {
  const queryClient = useQueryClient()
  return useMutation<{ queueItem: QueueItemView }, Error, { queueItemId?: number; key?: string; decision: 'use_anyway' | 'clear_override'; reason?: string }>({
    mutationFn: (payload) => postApi('/work/routing-decision', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['create'] })
      void queryClient.invalidateQueries({ queryKey: ['draft'] })
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })
}

export function useDraftMediaUpload(id: number | null) {
  const queryClient = useQueryClient()
  return useMutation<{ draft: DraftView; editor: DraftEditorData }, Error, File>({
    mutationFn: (file) => request(`/drafts/${id}/media`, {
      method: 'POST',
      headers: {
        'content-type': file.type,
        'x-file-name': encodeURIComponent(file.name),
      },
      body: file,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['draft', id] })
      void queryClient.invalidateQueries({ queryKey: ['create'] })
    },
  })
}

export function useDraftMediaRemove(id: number | null) {
  const queryClient = useQueryClient()
  return useMutation<{ draft: DraftView; editor: DraftEditorData }, Error, void>({
    mutationFn: () => request(`/drafts/${id}/media`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['draft', id] })
      void queryClient.invalidateQueries({ queryKey: ['create'] })
    },
  })
}

export interface DraftActionPayload {
  body?: string
  threadParts?: string[]
  operatorContext?: string
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
    bookmarks: number | null
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

export interface StrategyOutcomeSourcePublication {
  measurementId: number
  queueItemId: number
  tweetId: string
  title: string
  outputUrl: string | null
  publishedAt: number | null
  capturedAt: number
}

export interface StrategyFollowerQualitySummary {
  observationWindows: number
  newlyObservedFollowerAssociations: number
  relevantFollowerAssociations: number
  alignmentRate: number | null
  attribution: 'period_association_only'
  overlappingWindowsMayDoubleCount: true
}

export interface StrategyOutcomeCohort extends EditorialOutcomeCohort {
  newFollowerQuality: StrategyFollowerQualitySummary
  sourcePublications: StrategyOutcomeSourcePublication[]
}

export interface PublicationStrategySelectionProvenance {
  state: 'selected' | 'none'
  selectionId: number | null
  selectedAt: number | null
  mode: 'off' | 'suggest' | 'apply' | null
  selectionSource: 'recommended' | 'manual' | 'none'
  intent: string | null
  style: string | null
  openingFeatures: string[]
  guidanceSnapshot: WritingStrategySelectionSnapshot | null
}

export interface PublicationStrategyGenerationProvenance {
  state: 'recorded' | 'not_recorded'
  generatedAt: number | null
  generationPreparedAt: number | null
  strategySelectionId: number | null
  strategyMode: 'off' | 'suggest' | 'apply' | null
  strategyApplied: boolean | null
  strategySnapshot: WritingStrategySelectionSnapshot | null
  writerExecutionSource: string | null
  writerAiExecution: Record<string, unknown> | null
}

export interface WritingStrategyOutcomeObservation {
  sourcePublication: StrategyOutcomeSourcePublication
  strategyApplied: boolean
  strategyMode: 'off' | 'suggest' | 'apply' | null
  selectionSource: 'recommended' | 'manual' | 'none' | 'unknown'
  approach: { intent: string | null; style: string | null; openingFeatures: string[] }
  newFollowerQuality: {
    newlyObservedFollowers: number
    nicheAlignedNewFollowers: number
    alignmentRate: number | null
    attribution: string
  }
  publicationSelection: PublicationStrategySelectionProvenance
  generation: PublicationStrategyGenerationProvenance
  editorialObjective: string | null
  finalPublishedPipeline: string | null
  growthFocus: { state: string | null; allowed: boolean; objective: string | null; profileRevision: number | null } | null
  candidateClassification: { status: string | null; profileRevision: number | null; classifierVersion: number | null; classifiedAt: number | null } | null
  limitations: string[]
}

export interface WritingStrategyOutcomeSummary {
  windowMinutes: number
  availability: 'available' | 'generation_provenance_unavailable' | 'no_measurements'
  measurementCount: number
  totalMeasurementCount: number
  truncated: boolean
  observationCount: number
  appliedObservationCount: number
  unavailable: {
    strategyProvenanceNotRecorded: number
    generationProvenanceNotRecorded: number
    publishedQueueItemUnavailable: number
  }
  byIntent: { value: string; summary: StrategyOutcomeCohort }[]
  byStyle: { value: string; summary: StrategyOutcomeCohort }[]
  byOpeningFeature: { value: string; summary: StrategyOutcomeCohort }[]
  byStrategyMode: { value: string; summary: StrategyOutcomeCohort }[]
  bySelectionSource: { value: string; summary: StrategyOutcomeCohort }[]
  observations: WritingStrategyOutcomeObservation[]
  comparisonEvidenceState: null
  causalClaimAllowed: false
  limitations: string[]
}

export interface WritingStrategyEvidenceReadModel {
  windowMinutes: number
  externalEvidence: {
    available: boolean
    generatedAt: number | null
    windowDays: number
    maturityHours: number
    confidence: number
    dataset: Record<string, unknown> | null
    evidence: WritingStrategyEvidenceRef[]
    error: string | null
  }
  experimentEvidence: {
    experimentId: number
    name: string
    status: string
    dimension: string
    windowMinutes: number
    variants: { id: number; experimentId: number; label: string; config: Record<string, unknown> }[]
    sampleSize: number
    completedByVariant: Record<string, number>
    primaryMetric: string
    primaryMetricValues: Record<string, number | null>
    secondaryMetricValues: Record<string, Record<string, number | null>>
    evidence: Record<string, unknown> | null
    interpretation: Record<string, unknown>
  }[]
  comparisons: {
    dimension: 'intent' | 'style' | 'opening_feature'
    value: string
    externalEvidence: WritingStrategyEvidenceRef[]
    ownAccount: StrategyOutcomeCohort | null
    agreementState: null
    limitations: string[]
  }[]
  agreementInterpretation: null
  limitations: string[]
}

export interface OwnedPostMeasurementCapabilities {
  bookmarks: { available: true; field: string; source: string }
  profileClicks: { available: false; reason: string }
  urlClicks: { available: false; reason: string }
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
  writingStrategyOutcomes: WritingStrategyOutcomeSummary
  writingStrategyEvidence: WritingStrategyEvidenceReadModel
  measurementCapabilities: OwnedPostMeasurementCapabilities
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
// Growth Focus
// ---------------------------------------------------------------------------

export interface GrowthFocusGroup {
  tag: string
  label: string
  weight: number
  role?: 'core' | 'adjacent' | 'off'
  targetShare?: number
  researchTier?: number
  discover?: boolean
  requiresTechnicalContext?: boolean
  terms: string[]
}

export interface GrowthFocusProfile {
  schemaVersion: number
  defaultObjective: EditorialObjective
  topicBalance: {
    windowSize: number
    strength: number
    maxAdjustment: number
  }
  exploration: {
    enabled: boolean
    weight: number
    maxSearchQueries: number
  }
  discovery: {
    latestQueryBudget: number
    momentumQueryBudget: number
    rotationMinutes: number
  }
  contentGroups: GrowthFocusGroup[]
  audienceGroups: GrowthFocusGroup[]
  deprioritizedTerms: string[]
  exclusionTerms: string[]
}

export interface CandidateClassificationSummary {
  totalCandidates: number
  rescored: number
  current: number
  currentZeroScore: number
  profileRevision: number
  classifierVersion: number
  classifiedAt: number
}

export interface GrowthFocusSettingsData {
  profile: GrowthFocusProfile
  customized: boolean
  updatedAt: number | null
  revision: number
  classifierVersion: number
  classification?: CandidateClassificationSummary
}

export function useGrowthFocus() {
  return useQuery({
    queryKey: ['growth-focus'],
    queryFn: () => fetchApi<GrowthFocusSettingsData>('/growth-focus'),
    staleTime: 60_000,
  })
}

export function useGrowthFocusSave() {
  const queryClient = useQueryClient()
  return useMutation<GrowthFocusSettingsData, Error, GrowthFocusProfile>({
    mutationFn: (profile) => postApi<GrowthFocusSettingsData>('/growth-focus', { profile }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['growth-focus'] })
      void queryClient.invalidateQueries({ queryKey: ['audience'] })
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['create'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })
}

export function useGrowthFocusReset() {
  const queryClient = useQueryClient()
  return useMutation<GrowthFocusSettingsData, Error, void>({
    mutationFn: () => postApi<GrowthFocusSettingsData>('/growth-focus/reset', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['growth-focus'] })
      void queryClient.invalidateQueries({ queryKey: ['audience'] })
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['create'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })
}

export function useGrowthFocusObjective() {
  const queryClient = useQueryClient()
  return useMutation<GrowthFocusSettingsData, Error, EditorialObjective>({
    mutationFn: (objective) => postApi<GrowthFocusSettingsData>('/growth-focus/objective', { objective }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['growth-focus'] })
      void queryClient.invalidateQueries({ queryKey: ['editorial'] })
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })
}

export function useCandidateRescore() {
  const queryClient = useQueryClient()
  return useMutation<CandidateClassificationSummary, Error, void>({
    mutationFn: () => postApi<CandidateClassificationSummary>('/growth-focus/rescore-candidates', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['discover'] })
      void queryClient.invalidateQueries({ queryKey: ['create'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
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
// Writing strategy evidence + human selection
// ---------------------------------------------------------------------------

export interface WritingStrategyEvidenceRef {
  id: string
  lane: 'external' | 'internal' | 'experiment' | 'learned_rule'
  state: 'supported' | 'directional' | 'insufficient'
  sourceState: string | null
  strategy: { intent: string | null; style: string | null; openingFeatures: string[] }
  sampleSize: number | null
  rationale: string | null
  limitations: string[]
  scope: { objectives: string[]; pipelines: string[]; topicTags: string[] }
  contextMatch: boolean
  contextMismatchReason: string | null
  learnedRuleStatus: string | null
  learnedRuleMatch: Record<string, unknown> | null
}

export interface WritingStrategyContext {
  queueItemId: number
  candidateKey: string
  objective: EditorialObjective
  pipeline: string
  growthFit: StrategicRelevance
  classification: {
    status: 'current' | 'stale' | 'unclassified'
    score: number | null
    tags: string[]
    matches: string[]
    profileRevision: number | null
    classifierVersion: number | null
    classifiedAt: number | null
  }
  editorialRecommendation: {
    id: number
    objective: EditorialObjective
    pipeline: string
    title: string
    storyKey: string
    selectedPipeline: string
    selectedAt: number
  } | null
}

export interface WritingStrategyProvenance {
  taxonomyVersion: number
  external?: {
    generatedAt?: number
    windowDays: number
    maturityHours: number
    confidence: number
    dataset: Record<string, unknown>
  }
  internal?: { labeledPublishedContent: number; measuredOutcomeReferences: number }
  experiments?: { references: string[] }
  learnedRules?: { references: string[] }
}

export interface WritingStrategySelectionSnapshot {
  selectionSource: 'recommended' | 'manual'
  context: WritingStrategyContext
  intent: string | null
  style: string | null
  openingFeatures: string[]
  applicability: 'strong_fit' | 'possible_fit' | 'weak_fit' | 'manual'
  rationale: string
  externalEvidence: WritingStrategyEvidenceRef[]
  internalEvidence: WritingStrategyEvidenceRef[]
  experimentEvidence: WritingStrategyEvidenceRef[]
  learnedRuleContext: WritingStrategyEvidenceRef[]
  limitations: string[]
  provenance: WritingStrategyProvenance
}

export interface WritingStrategyOption {
  intent: string | null
  style: string | null
  openingFeatures: string[]
  applicability: 'strong_fit' | 'possible_fit' | 'weak_fit'
  rationale: string
  externalEvidence: WritingStrategyEvidenceRef[]
  internalEvidence: WritingStrategyEvidenceRef[]
  experimentEvidence: WritingStrategyEvidenceRef[]
  learnedRuleEvidence: WritingStrategyEvidenceRef[]
  limitations: string[]
  selectionSnapshot: WritingStrategySelectionSnapshot
}

export interface WritingStrategySelection {
  id: number
  queueItemId: number
  draftId: number | null
  mode: 'off' | 'suggest' | 'apply'
  intent: string | null
  style: string | null
  openingFeatures: string[]
  guidance: WritingStrategySelectionSnapshot
  selectionSource: 'recommended' | 'manual'
  selectedBy: 'human'
  selectedAt: number
}

export interface WritingStrategyPreview {
  queueItem: { id: number; candidateKey: string; draftId: number | null; pipeline: string; status: string }
  context: WritingStrategyContext
  availability: { status: string; selectable: boolean; reason: string | null }
  evidenceSummary: { external: number; internal: number; experiment: number; learnedRuleContext: number; rejected: number }
  shortlist: {
    status: 'applicable' | 'insufficient_evidence' | 'not_applicable'
    reason: string | null
    options: WritingStrategyOption[]
    rejectedEvidence: { id: string; lane: string; reason: string }[]
  }
  provenance: WritingStrategyProvenance
  currentSelection: WritingStrategySelection | null
}

export interface WritingStrategySelectPayload {
  queueItemId: number
  draftId?: number | null
  mode: 'off' | 'suggest' | 'apply'
  intent?: string | null
  style?: string | null
  openingFeatures?: string[]
  selectionSource: 'recommended' | 'manual'
  guidanceSnapshot?: WritingStrategySelectionSnapshot
}

export interface WriterGenerationProvenance {
  generatedAt: number
  generationPreparedAt: number
  strategySelectionId: number | null
  strategyMode: 'off' | 'suggest' | 'apply' | null
  strategyApplied: boolean
  strategySnapshot: WritingStrategySelectionSnapshot | null
  writerExecutionSource: string
  writerAiExecution: Record<string, unknown> | null
}

export interface DraftEditorMetadata extends Record<string, unknown> {
  behavior?: BehaviorDecision | null
  personaModelVersion?: string
  generation?: WriterGenerationProvenance
  generationHistory?: WriterGenerationProvenance[]
}

export interface WritingStrategyRecommendationResult {
  status: 'recommended' | 'no_recommendation' | 'not_available' | 'failed'
  recommendation: {
    optionIndex: number
    option: WritingStrategyOption
    rationale: string
    evidenceIds: string[]
    limitations: string[]
  } | null
  rationale?: string
  evidenceIds?: string[]
  limitations?: string[]
  reason?: string
  error?: { code: string; message: string }
  preview: WritingStrategyPreview
  aiExecution: Record<string, unknown> | null
}

export interface ContentStyleLabel {
  id: number
  queueItemId: number
  contentHash: string
  taxonomyVersion: number
  primaryIntent: string
  semanticStyle: string
  audienceGoal: string
  readerAction: string
  confidence: number
  evidenceSpans: string[]
  aiExecution: Record<string, unknown>
  classifiedAt: number
}

export interface PublishedStyleClassificationResult {
  taxonomyVersion: number
  requested: number
  classified: number
  reused: number
  labels: ContentStyleLabel[]
  invalid: { tweetId: string; reason: string }[]
  aiExecution: Record<string, unknown> | null
}

export function useWritingStrategy(queueItemId: number | null) {
  return useQuery({
    queryKey: ['writing-strategy', queueItemId],
    queryFn: () => fetchApi<WritingStrategyPreview>(`/writing-strategy?queueItemId=${queueItemId}`),
    enabled: queueItemId != null && Number.isFinite(queueItemId),
    staleTime: 30_000,
  })
}

export function useWritingStrategyRecommend() {
  const queryClient = useQueryClient()
  return useMutation<WritingStrategyRecommendationResult, Error, { queueItemId: number; profileId?: number | null }>({
    mutationFn: (payload) => postApi('/writing-strategy/recommend', payload),
    onSuccess: (result, payload) => {
      queryClient.setQueryData(['writing-strategy', payload.queueItemId], result.preview)
    },
  })
}

export function useWritingStrategySelect() {
  const queryClient = useQueryClient()
  return useMutation<{ selection: WritingStrategySelection }, Error, WritingStrategySelectPayload>({
    mutationFn: (payload) => postApi('/writing-strategy/select', payload),
    onSuccess: (_result, payload) => {
      void queryClient.invalidateQueries({ queryKey: ['writing-strategy', payload.queueItemId] })
    },
  })
}

export function useClassifyPublishedContent() {
  const queryClient = useQueryClient()
  return useMutation<PublishedStyleClassificationResult, Error, { queueItemIds?: number[]; limit?: number; profileId?: number | null }>({
    mutationFn: (payload) => postApi('/learn/classify-published', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['writing-strategy'] })
    },
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
