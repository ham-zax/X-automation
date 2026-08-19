import { useCreate, type Draft } from '../../api/client'
import { Loading, Error, Empty } from '../../components/primitives'

function DraftCard({ draft }: { draft: Draft }) {
  const statusColors = {
    draft: 'bg-slate-100 text-slate-700',
    needs_review: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    publishing: 'bg-blue-100 text-blue-700',
    published: 'bg-green-100 text-green-700',
  }

  const statusLabel = {
    draft: 'Draft',
    needs_review: 'Needs review',
    approved: 'Approved',
    publishing: 'Publishing',
    published: 'Published',
  }

  return (
    <a
      href={draft.href}
      className="block rounded-lg border border-slate-200 bg-white p-6 hover:border-slate-300 transition-all"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
          {draft.title}
        </h3>
        <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${statusColors[draft.status as keyof typeof statusColors] || 'bg-slate-100 text-slate-700'}`}>
          {statusLabel[draft.status as keyof typeof statusLabel] || draft.status}
        </span>
      </div>
      
      {draft.body && (
        <p className="text-sm text-slate-600 line-clamp-3 mb-3">{draft.body}</p>
      )}
      
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex gap-3">
          <span>Quality: {draft.qualityScore}/50</span>
          <span className="capitalize">{draft.pipeline}</span>
        </div>
        {draft.publishedAt && (
          <span>Published {new Date(draft.publishedAt).toLocaleDateString()}</span>
        )}
      </div>
    </a>
  )
}

function DraftSection({ title, drafts }: { title: string; drafts: Draft[] }) {
  if (drafts.length === 0) return null
  
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900 mb-4">
        {title} ({drafts.length})
      </h2>
      <div className="space-y-3">
        {drafts.map((draft) => (
          <DraftCard key={draft.id} draft={draft} />
        ))}
      </div>
    </div>
  )
}

export function Create() {
  const { data, isLoading, error, refetch } = useCreate()

  if (isLoading) {
    return <Loading message="Loading drafts..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data || data.total === 0) {
    return (
      <Empty
        title="No drafts yet"
        message="Check Discover for ideas worth turning into posts."
      />
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Create</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.total} {data.total === 1 ? 'draft' : 'drafts'} in progress
        </p>
      </div>

      <DraftSection title="Needs your decision" drafts={data.needsReview} />
      <DraftSection title="Approved — waiting" drafts={data.approved} />
      <DraftSection title="Publishing" drafts={data.publishing} />
      <DraftSection title="Drafting" drafts={data.drafting} />
      <DraftSection title="Ideas" drafts={data.ideas} />
      <DraftSection title="Published" drafts={data.published} />
    </div>
  )
}
