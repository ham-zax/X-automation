import { useConversations, type ConversationListItem } from '../../api/client'
import { Loading, Error, Empty, Badge, formatDateTime } from '../../components/primitives'

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

  if (!data || (data.activeConversations.length === 0 && data.newOpportunities.length === 0)) {
    return (
      <Empty
        title="No conversations or opportunities right now"
        message="Check Discover for new opportunities worth answering."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Conversations</h2>
        <p className="mt-1 text-sm text-slate-600">
          Continue existing conversations first, then consider new ones where you have something concrete to add.
        </p>
      </div>

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
    </div>
  )
}
