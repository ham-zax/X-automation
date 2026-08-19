import { useAudience, type AudienceProfile } from '../../api/client'
import { Loading, Error, Empty } from '../../components/primitives'

function ProfileCard({ profile }: { profile: AudienceProfile }) {
  const nicheColors = {
    in_niche: 'bg-emerald-100 text-emerald-700',
    uncertain: 'bg-amber-100 text-amber-700',
    outside_niche: 'bg-slate-100 text-slate-700',
  }

  const nicheLabels = {
    in_niche: 'In niche',
    uncertain: 'Not enough evidence',
    outside_niche: 'Outside niche',
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-semibold text-slate-900">
              @{profile.username}
            </h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${nicheColors[profile.nicheState as keyof typeof nicheColors] || 'bg-slate-100 text-slate-700'}`}>
              {nicheLabels[profile.nicheState as keyof typeof nicheLabels] || profile.nicheLabel}
            </span>
          </div>
          {profile.bio && (
            <p className="text-sm text-slate-600 line-clamp-2 mb-2">{profile.bio}</p>
          )}
        </div>
        {profile.youFollow && (
          <button className="shrink-0 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200">
            Unfollow
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>Topic fit: {(profile.topicFit * 100).toFixed(0)}%</span>
        <span>Confidence: {(profile.nicheConfidence * 100).toFixed(0)}%</span>
        {profile.followsYou && <span className="text-blue-600">Follows you</span>}
      </div>
    </div>
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

  if (!data || data.profiles.length === 0) {
    return (
      <Empty
        title="No audience profiles"
        message="Audience profiles will appear as you engage with accounts."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audience</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.total} {data.total === 1 ? 'profile' : 'profiles'} tracked
        </p>
      </div>

      <div className="space-y-3">
        {data.profiles.map((profile) => (
          <ProfileCard key={profile.username} profile={profile} />
        ))}
      </div>
    </div>
  )
}
