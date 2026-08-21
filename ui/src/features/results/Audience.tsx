import { useState } from 'react'
import { useAudience, useAudienceReview, useAudienceUnfollow, type AudienceProfile, type AudienceReviewSuggestion } from '../../api/client'
import { Badge, Disclosure, Error, Loading, Pending, StatCard, formatDateTime } from '../../components/primitives'

const FIT_LABELS: Record<string, string> = {
  in_niche: 'Aligned',
  uncertain: 'Not enough profile evidence',
  outside_niche: 'Outside current audience focus',
}

const FIT_TONES: Record<string, 'success' | 'neutral' | 'danger'> = {
  in_niche: 'success',
  uncertain: 'neutral',
  outside_niche: 'danger',
}

function ProfileRow({ profile, review = null }: { profile: AudienceProfile; review?: AudienceReviewSuggestion | null }) {
  const unfollow = useAudienceUnfollow()
  const pending = unfollow.isPending && unfollow.variables === profile.username
  const failed = unfollow.isError && unfollow.variables === profile.username ? unfollow.error : null
  const signalsText = profile.signals.kind === 'exclusion'
    ? `Exclusion signals: ${profile.signals.terms.join(', ')}`
    : profile.signals.kind === 'deprioritized'
      ? `Outside current focus: ${profile.signals.terms.join(', ')}`
      : profile.signals.terms.length
        ? profile.signals.terms.join(', ')
        : 'No recognizable profile signals'

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{profile.displayName}</span>
            <span className="text-sm text-slate-500">@{profile.username}</span>
            <Badge tone={FIT_TONES[profile.fitBucket]}>{FIT_LABELS[profile.fitBucket]} · {profile.relevanceScore}/50</Badge>
            {profile.followsYou && <Badge tone="info">Follows you too</Badge>}
          </div>
          <div className="mt-1 break-words text-sm text-slate-600">{profile.bio || 'No bio observed.'}</div>
          <div className="mt-1 text-xs text-slate-500">{signalsText}</div>
          <div className="mt-1 text-xs text-slate-400">
            Last seen {profile.lastSeenAt ? formatDateTime(profile.lastSeenAt) : 'unknown'}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {pending ? (
            <Pending label="Unfollowing…" />
          ) : profile.youFollow ? (
            <button
              onClick={() => unfollow.mutate(profile.username)}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Unfollow
            </button>
          ) : (
            <Badge tone="neutral">Not following</Badge>
          )}
          <a
            href={`https://x.com/${encodeURIComponent(profile.username)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            View profile ↗
          </a>
        </div>
      </div>
      {review && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <div className="flex flex-wrap items-center gap-2">
            <strong>AI review #{review.rank}</strong>
            <Badge tone={review.decision === 'consider_unfollow' ? 'danger' : 'neutral'}>
              {review.decision === 'consider_unfollow' ? 'Consider unfollowing' : 'Human review'}
            </Badge>
            <span className="text-xs text-amber-800">{review.confidence} confidence</span>
          </div>
          <p className="mt-1">{review.reason}</p>
          {review.signals.length > 0 && <p className="mt-1 text-xs text-amber-800">Signals: {review.signals.join(' · ')}</p>}
        </div>
      )}
      {failed && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{failed.message}</div>
      )}
    </div>
  )
}

function BucketSection({ title, note, profiles, batchSize = 10 }: { title: string; note: string; profiles: AudienceProfile[]; batchSize?: number }) {
  const [showAll, setShowAll] = useState(false)
  if (profiles.length === 0) return null
  const visible = showAll ? profiles : profiles.slice(0, batchSize)
  return (
    <section>
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-slate-900">{title} <span className="text-sm font-normal text-slate-500">({profiles.length})</span></h3>
        <p className="text-sm text-slate-600">{note}</p>
      </div>
      <div className="space-y-2">
        {visible.map((profile) => <ProfileRow key={profile.username} profile={profile} />)}
      </div>
      {profiles.length > batchSize && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 text-sm font-medium text-sky-700 hover:underline"
        >
          Show remaining {profiles.length - batchSize}
        </button>
      )}
    </section>
  )
}

export function Audience() {
  const { data, isLoading, error, refetch } = useAudience()
  const aiReview = useAudienceReview()

  if (isLoading) {
    return <Loading message="Loading audience profiles..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data) {
    return <Error message="Audience data is unavailable." />
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a href="#/results" className="text-sm font-medium text-slate-500 hover:text-slate-700">← Back to Results</a>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Audience quality</h2>
          <p className="mt-1 text-sm text-slate-600">
            Review observed follower/following relationships and target-audience alignment. Classifications are advisory; nothing is unfollowed automatically.
          </p>
        </div>
        <a href="#/settings/growth-focus" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Review Growth Focus</a>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Observed followers" value={data.summary.followers} />
        <StatCard label="Aligned followers" value={data.counts.inNicheFollowers} />
        <StatCard label="Aligned following" value={data.counts.inNicheFollowing} />
        <StatCard label="Outside-focus following" value={data.counts.outsideFollowing} />
      </div>

      <section className="rounded-lg border border-sky-200 bg-sky-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h3 className="text-lg font-semibold text-slate-900">AI following review</h3>
            <p className="mt-1 text-sm text-slate-700">
              Send the current following list, audience/topic signals, mutual status, and known relationship context to the configured Audience review model. The AI only suggests accounts to inspect; it cannot unfollow anyone.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => aiReview.mutate()}
              disabled={aiReview.isPending}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {aiReview.isPending ? 'Reviewing following…' : 'Ask AI to review following'}
            </button>
            <a href="#/settings/ai" className="text-sm font-medium text-sky-700 hover:underline">AI settings</a>
          </div>
        </div>
        {aiReview.isError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{aiReview.error.message}</div>
        )}
        {data.aiReview && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-slate-700">
              <strong>{data.aiReview.suggestions.length} suggestions from {data.aiReview.reviewedCount} followed accounts.</strong> {data.aiReview.summary}
            </div>
            <div className="text-xs text-slate-500">
              Reviewed {formatDateTime(data.aiReview.reviewedAt)}
              {data.aiReview.execution ? ` · ${data.aiReview.execution.runtime} · ${data.aiReview.execution.model}${data.aiReview.execution.reasoning ? ` / ${data.aiReview.execution.reasoning}` : ''}` : ''}
            </div>
            {data.aiReview.suggestions.length > 0 ? (
              <div className="space-y-2">
                {data.aiReview.suggestions.map((suggestion) => (
                  <ProfileRow key={`ai-${suggestion.username}`} profile={suggestion.profile} review={suggestion} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">The latest AI review did not identify a strong removal candidate.</p>
            )}
          </div>
        )}
      </section>

      {data.counts.outsideFollowing > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <strong>Cleanup review: 10 at a time.</strong> Each Unfollow button queues one explicit unfollow in the background and shows a pending state immediately.
          {' '}Accounts that follow you back are flagged for extra review. Nothing is removed locally until X confirms the unfollow.
        </div>
      )}

      <BucketSection
        title="Accounts you follow outside the current audience focus"
        note="Profiles with clear outside-focus signals and no matching technical context, plus explicit exclusions such as engagement spam, gambling, or adult content. Review the profile before using the single-account unfollow action."
        profiles={data.outsideFollowing}
      />

      <BucketSection
        title="Accounts with uncertain fit"
        note="These profiles either lack recognizable signals or mention deprioritized topics without enough technical context. They are uncertain rather than confirmed low fit — review individually before deciding to unfollow."
        profiles={data.uncertainFollowing}
      />

      <BucketSection
        title="Aligned accounts you follow"
        note="Relevant accounts you follow that do not currently follow you. Strategic classes and stages live in Relationships."
        profiles={data.targets}
        batchSize={40}
      />

      <BucketSection
        title="Target-audience followers"
        note="Current followers already close to the AI/developer/builder audience we want more of."
        profiles={data.relevantFollowers}
        batchSize={20}
      />

      <Disclosure summary="What do the fit buckets mean?">
        <div className="space-y-2 text-sm text-slate-600">
          <div><strong>Aligned:</strong> the profile shows developer/technical signals matching the target audience.</div>
          <div><strong>Not enough profile evidence:</strong> no recognizable signals — uncertain, not low fit.</div>
          <div><strong>Outside current audience focus:</strong> explicit exclusion signals or clearly non-technical focus.</div>
        </div>
      </Disclosure>
    </div>
  )
}
