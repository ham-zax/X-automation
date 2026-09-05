import { useConversations, type AutonomousReplyDecision, type ConversationListItem } from '../../api/client'
import { Loading, Error, Empty, Badge, Disclosure, Notice, formatDateTime } from '../../components/primitives'
import { MetricCard, PageHeader } from '../../components/workspace'

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
    <div className="operator-surface p-4" data-tone="ai">
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
  const tone = conversation.status === 'needs_review' ? 'warning' : isActive ? 'primary' : 'neutral'
  return (
    <a
      href={`#/conversations/${encodeURIComponent(conversation.key)}`}
      className="operator-surface block px-4 py-4 transition-transform hover:-translate-y-px"
      data-tone={tone}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-900">@{conversation.targetUsername}</span>
            <span className="text-xs text-slate-500">{conversation.engagementKindLabel}</span>
            {conversation.status === 'needs_review' && <Badge tone="warning">{conversation.statusLabel}</Badge>}
            {conversation.priorityLabel && <span className="text-xs text-slate-500">{conversation.priorityLabel}</span>}
            {conversation.autonomousDecision && <Badge tone={conversation.autonomousDecision.decision.includes('review') ? 'warning' : conversation.autonomousDecision.decision.includes('send') || conversation.autonomousDecision.decision === 'sent' ? 'success' : 'neutral'}>{autonomousLabel(conversation.autonomousDecision.decision)}</Badge>}
          </div>
          <h3 className={`mt-2 text-[15px] font-semibold leading-6 text-slate-900 ${isActive ? 'line-clamp-2' : 'line-clamp-1'}`}>{conversation.contribution}</h3>
          {isActive && <p className="mt-1 line-clamp-1 text-sm leading-6 text-slate-500">{conversation.sourceText}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {conversation.relationship && (
              <span>
                Relationship fit {conversation.relationship.targetScore} · {conversation.relationship.stage.replaceAll('_', ' ')}
              </span>
            )}
            {conversation.draftQualityScore != null && <span>Draft {conversation.draftQualityScore}/50</span>}
            {conversation.expiresAt && <span>Useful until {formatDateTime(conversation.expiresAt)}</span>}
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold text-indigo-700">{conversation.draftId ? 'Review reply →' : 'Review opportunity →'}</span>
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
      <PageHeader
        eyebrow="Relationship queue"
        title="Conversations"
        note="Continue existing conversations before starting new ones."
      />

      <section className="operator-surface px-4 py-3" data-tone={data.autonomous.grant.state === 'running' ? 'success' : data.autonomous.grant.state === 'paused' ? 'warning' : 'neutral'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><strong className="text-slate-900">Autonomous replies</strong><Badge tone={data.autonomous.grant.state === 'running' ? 'success' : data.autonomous.grant.state === 'paused' ? 'warning' : 'neutral'}>{data.autonomous.grant.state.replaceAll('_', ' ')}</Badge><Badge>{data.autonomous.grant.mode === 'dry_run' ? 'Dry run' : 'Live'}</Badge></div>
            <div className="mt-1 text-sm text-slate-600">Last successful refresh {data.autonomous.runtime.lastSuccessfulRefreshAt ? formatDateTime(data.autonomous.runtime.lastSuccessfulRefreshAt) : 'not yet'} · next {data.autonomous.runtime.nextExpectedRefreshAt ? formatDateTime(data.autonomous.runtime.nextExpectedRefreshAt) : data.autonomous.grant.state === 'running' ? 'next daemon cycle' : 'not scheduled'}</div>
          </div>
          <a href="#/settings/autonomous-replies" className="text-sm font-semibold text-indigo-700 hover:underline">Configure autonomous replies →</a>
        </div>
      </section>

      {data.health.state === 'constrained' && (
        <Notice tone="danger" title="Some actions are temporarily limited">
          Supported account evidence is blocking reply approval/sending until it is resolved. <a href="/legacy?source=health" className="font-semibold underline">Review account status →</a>
        </Notice>
      )}
      {data.health.state === 'watch' && <Notice tone="warning" title="Something deserves attention">You can keep working normally; the warning is advisory.</Notice>}

      {empty && <Empty title="No conversations or opportunities right now" message="The operator can remain active through a zero-result refresh; new X observations will appear here when they become worthwhile." />}

      <div className="grid grid-cols-2 gap-x-6">
        <MetricCard label="Active conversations" value={data.activeConversations.length} tone="primary" />
        <MetricCard label="New opportunities" value={data.newOpportunities.length} tone="info" />
      </div>

      {data.activeConversations.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Active conversations ({data.activeConversations.length})</h3>
          <div className="space-y-3">
            {data.activeConversations.map((conversation) => (
              <ConversationCard key={conversation.key} conversation={conversation} />
            ))}
          </div>
        </section>
      )}

      {data.newOpportunities.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">New opportunities ({data.newOpportunities.length})</h3>
          <div className="space-y-2">
            {data.newOpportunities.map((conversation) => (
              <ConversationCard key={conversation.key} conversation={conversation} />
            ))}
          </div>
        </section>
      )}

      {data.autonomous.recentDecisions.length > 0 && (
        <Disclosure summary={`Recent autonomous decisions · ${data.autonomous.recentDecisions.length}`} className="compact-disclosure">
          <div className="mt-2 space-y-2">
            {data.autonomous.recentDecisions.slice(0, 10).map((decision) => <AutonomousDecisionCard key={decision.id} decision={decision} />)}
          </div>
          <a href="#/settings/autonomous-replies" className="mt-3 inline-block text-sm font-semibold text-indigo-700 hover:underline">Full history →</a>
        </Disclosure>
      )}

    </div>
  )
}
