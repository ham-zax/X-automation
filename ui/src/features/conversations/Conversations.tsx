import { useConversations, type AutonomousReplyDecision, type ConversationListItem } from '../../api/client'
import { Loading, Error, Empty, Badge, formatDateTime } from '../../components/primitives'

function autonomousLabel(decision: string) {
  if (decision === 'sent') return 'Autonomous · sent'
  if (decision === 'dry_run_send') return 'Dry run · would send'
  if (['review', 'dry_run_review'].includes(decision)) return decision === 'review' ? 'Autonomous · human review' : 'Dry run · would review'
  if (decision === 'reconciliation_required') return 'Autonomous · reconcile'
  if (decision === 'send_failed') return 'Autonomous · send failed'
  return decision.startsWith('dry_run') ? 'Dry run · skipped' : 'Autonomous · skipped'
}

function AutonomousDecisionCard({ decision }: { decision: AutonomousReplyDecision }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-900">@{decision.targetUsername || 'unknown'}</span>
        <Badge>{decision.sourceClass.replaceAll('_', ' ')}</Badge>
        {decision.intent && <Badge>{decision.intent.replaceAll('_', ' ')}</Badge>}
        {decision.tone && <Badge>{decision.tone.replaceAll('_', ' ')}</Badge>}
        <Badge tone={decision.decision.includes('review') ? 'warning' : decision.decision.includes('send') || decision.decision === 'sent' ? 'success' : 'neutral'}>{autonomousLabel(decision.decision)}</Badge>
      </div>
      {decision.exactReply && <div className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-700">{decision.exactReply}</div>}
      {decision.reasons[0] && <div className="mt-2 text-xs text-slate-500">{decision.reasons[0].code} · {decision.reasons[0].reason}</div>}
    </div>
  )
}

function ConversationCard({ conversation }: { conversation: ConversationListItem }) {
  const isActive = conversation.engagementKind !== 'initial_reply'
  return (
    <a
      href={`#/conversations/${encodeURIComponent(conversation.key)}`}
      className={`block rounded-lg border p-6 transition-all ${
        isActive
          ? 'border-slate-200 bg-white hover:border-slate-400'
          : 'border-sky-200 bg-sky-50 hover:border-sky-400'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-900">@{conversation.targetUsername}</span>
            <Badge tone={isActive ? 'neutral' : 'info'}>{conversation.engagementKindLabel}</Badge>
            <Badge tone={conversation.status === 'needs_review' ? 'warning' : 'neutral'}>{conversation.statusLabel}</Badge>
            {conversation.priorityLabel && <Badge tone={conversation.priority >= 60 ? 'success' : 'neutral'}>{conversation.priorityLabel}</Badge>}
            {conversation.autonomousDecision && <Badge tone={conversation.autonomousDecision.decision.includes('review') ? 'warning' : conversation.autonomousDecision.decision.includes('send') || conversation.autonomousDecision.decision === 'sent' ? 'success' : 'neutral'}>{autonomousLabel(conversation.autonomousDecision.decision)}</Badge>}
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-900">{conversation.contribution}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-slate-600">{conversation.sourceText}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            {conversation.relationship && (
              <span>
                Relationship fit {conversation.relationship.targetScore} · {conversation.relationship.stage.replaceAll('_', ' ')}
              </span>
            )}
            {conversation.draftQualityScore != null && <span>Draft {conversation.draftQualityScore}/50</span>}
            {conversation.expiresAt && <span>Useful until {formatDateTime(conversation.expiresAt)}</span>}
          </div>
        </div>
        <span className="shrink-0 text-sm font-medium text-sky-700">{conversation.draftId ? 'Review reply →' : 'Review opportunity →'}</span>
      </div>
    </a>
  )
}

export function Conversations() {
  const { data, isLoading, error, refetch } = useConversations()

  if (isLoading) {
    return <Loading message="Loading conversations..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data) return <Error message="Conversations are unavailable." />
  const empty = data.activeConversations.length === 0 && data.newOpportunities.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Conversations</h2>
        <p className="mt-1 text-sm text-slate-600">
          Continue existing conversations first, then consider new ones where you have something concrete to add.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><strong className="text-slate-900">Autonomous replies</strong><Badge tone={data.autonomous.grant.state === 'running' ? 'success' : data.autonomous.grant.state === 'paused' ? 'warning' : 'neutral'}>{data.autonomous.grant.state.replaceAll('_', ' ')}</Badge><Badge>{data.autonomous.grant.mode === 'dry_run' ? 'Dry run' : 'Live'}</Badge></div>
            <div className="mt-1 text-sm text-slate-600">Last successful refresh {data.autonomous.runtime.lastSuccessfulRefreshAt ? formatDateTime(data.autonomous.runtime.lastSuccessfulRefreshAt) : 'not yet'} · next {data.autonomous.runtime.nextExpectedRefreshAt ? formatDateTime(data.autonomous.runtime.nextExpectedRefreshAt) : data.autonomous.grant.state === 'running' ? 'next daemon cycle' : 'not scheduled'}</div>
          </div>
          <a href="#/settings/autonomous-replies" className="text-sm font-medium text-sky-700 hover:underline">Configure autonomous replies →</a>
        </div>
      </section>

      {data.health.state === 'constrained' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <strong>Some actions are temporarily limited.</strong> Supported account evidence is blocking reply approval/sending until it is resolved.
        </div>
      )}
      {data.health.state === 'watch' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Something deserves attention.</strong> You can keep working normally; the warning is advisory.
        </div>
      )}

      {empty && <Empty title="No conversations or opportunities right now" message="The operator can remain active through a zero-result refresh; new X observations will appear here when they become worthwhile." />}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Active conversations</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{data.activeConversations.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">New opportunities</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{data.newOpportunities.length}</div>
        </div>
      </div>

      {data.activeConversations.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Active conversations ({data.activeConversations.length})</h3>
          <div className="space-y-4">
            {data.activeConversations.map((conversation) => (
              <ConversationCard key={conversation.key} conversation={conversation} />
            ))}
          </div>
        </section>
      )}

      {data.newOpportunities.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">New opportunities ({data.newOpportunities.length})</h3>
          <div className="space-y-4">
            {data.newOpportunities.map((conversation) => (
              <ConversationCard key={conversation.key} conversation={conversation} />
            ))}
          </div>
        </section>
      )}

      {data.autonomous.recentDecisions.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Recent autonomous decisions</h3>
              <p className="mt-1 text-sm text-slate-600">Dry-run candidates, auto-sends, human-review downgrades, and skips remain visible even after the queue item leaves the active list.</p>
            </div>
            <a href="#/settings/autonomous-replies" className="text-sm font-medium text-sky-700 hover:underline">Full history →</a>
          </div>
          <div className="space-y-3">
            {data.autonomous.recentDecisions.slice(0, 10).map((decision) => <AutonomousDecisionCard key={decision.id} decision={decision} />)}
          </div>
        </section>
      )}
    </div>
  )
}
