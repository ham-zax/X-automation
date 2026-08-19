import { useConversations, type Conversation, type Opportunity } from '../../api/client'
import { Loading, Error, Empty } from '../../components/primitives'

function ConversationCard({ conversation }: { conversation: Conversation }) {
  return (
    <a
      href={conversation.href}
      className="block rounded-lg border border-slate-200 bg-white p-6 hover:border-slate-300 transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-slate-900">@{conversation.targetUsername}</span>
            {conversation.relationshipStage && conversation.relationshipStage !== 'unknown' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {conversation.relationshipStage}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-2">
            {conversation.contribution}
          </h3>
          <p className="text-sm text-slate-600 line-clamp-2">{conversation.sourceText}</p>
          {conversation.lastActivity && (
            <p className="mt-3 text-xs text-slate-500">
              Last activity: {new Date(conversation.lastActivity).toLocaleDateString()}
            </p>
          )}
        </div>
        <span className="shrink-0 text-sm font-medium text-blue-600">Review →</span>
      </div>
    </a>
  )
}

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  return (
    <a
      href={opportunity.href}
      className="block rounded-lg border border-blue-200 bg-blue-50 p-6 hover:border-blue-300 transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-slate-900">@{opportunity.targetUsername}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              New opportunity
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-2">
            {opportunity.contribution}
          </h3>
          <p className="text-sm text-slate-600 line-clamp-2">{opportunity.sourceText}</p>
        </div>
        <span className="shrink-0 text-sm font-medium text-blue-600">Answer →</span>
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
        title="No active conversations"
        message="Check Discover for new opportunities worth answering."
      />
    )
  }

  return (
    <div className="space-y-8">
      {data.activeConversations.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Active conversations ({data.activeConversations.length})
          </h2>
          <div className="space-y-4">
            {data.activeConversations.map((conversation) => (
              <ConversationCard key={conversation.id} conversation={conversation} />
            ))}
          </div>
        </div>
      )}

      {data.newOpportunities.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            New opportunities ({data.newOpportunities.length})
          </h2>
          <div className="space-y-4">
            {data.newOpportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
