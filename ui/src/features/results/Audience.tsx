import { useState } from 'react'
import { useAudience, useAudienceUnfollow, type AudienceProfile } from '../../api/client'
import { Badge, Disclosure, Error, Loading, Pending, StatCard, formatDateTime } from '../../components/primitives'

const FIT_LABELS: Record<string, string> = {
  in_niche: 'In niche',
  uncertain: 'Not enough profile evidence',
  outside_niche: 'Outside current niche',
}

const FIT_TONES: Record<string, 'success' | 'neutral' | 'danger'> = {
  in_niche: 'success',
  uncertain: 'neutral',
  outside_niche: 'danger',
}

function ProfileRow({ profile }: { profile: AudienceProfile }) {
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
            {profile.followsYou && <Badge tone="warning">follows you too</Badge>}
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
            <Badge tone="success">Unfollowed</Badge>
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
      <div>
        <a href="#/results" className="text-sm font-medium text-slate-500 hover:text-slate-700">← Back to Results</a>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Audience quality</h2>
        <p className="mt-1 text-sm text-slate-600">
          Raw follower/following observations and niche alignment. These are observations, not recommendations to act on.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Observed followers" value={data.summary.followers} />
        <StatCard label="Niche followers" value={data.counts.inNicheFollowers} />
        <StatCard label="Niche following" value={data.counts.inNicheFollowing} />
        <StatCard label="Outside-niche following" value={data.counts.outsideFollowing} />
      </div>

      {data.counts.outsideFollowing > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <strong>Cleanup review: 10 at a time.</strong> Each Unfollow button performs one explicit unfollow immediately.
          {' '}Accounts that follow you back are flagged for extra review. Nothing is removed until X and local state confirm the unfollow.
        </div>
      )}

      <BucketSection
        title="Accounts you follow outside your niche"
        note="Profiles with clear outside-focus signals and no matching technical context, plus explicit exclusions such as engagement spam, gambling, or adult content. Review the profile before using the single-account unfollow action."
        profiles={data.outsideFollowing}
      />

      <BucketSection
        title="Accounts with uncertain fit"
        note="These profiles either lack recognizable signals or mention deprioritized topics without enough technical context. They are uncertain rather than confirmed low fit — review individually before deciding to unfollow."
        profiles={data.uncertainFollowing}
      />

      <BucketSection
        title="In-niche accounts you follow"
        note="Relevant accounts you follow that do not currently follow you. Strategic classes and stages live in Relationships."
        profiles={data.targets}
        batchSize={40}
      />

      <BucketSection
        title="Niche-aligned followers"
        note="Current followers already close to the AI/developer/builder audience we want more of."
        profiles={data.relevantFollowers}
        batchSize={20}
      />

      <Disclosure summary="What do the fit buckets mean?">
        <div className="space-y-2 text-sm text-slate-600">
          <div><strong>In niche:</strong> the profile shows developer/technical signals matching the target audience.</div>
          <div><strong>Not enough profile evidence:</strong> no recognizable signals — uncertain, not low fit.</div>
          <div><strong>Outside current niche:</strong> explicit exclusion signals or clearly non-technical focus.</div>
        </div>
      </Disclosure>
    </div>
  )
}
