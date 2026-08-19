import { useResults, useRefreshPerformance } from '../../api/client'
import {
  Disclosure,
  Error,
  Loading,
  StatCard,
  TechnicalDetails,
  formatDateTime,
  formatNumber,
} from '../../components/primitives'

export function Results() {
  const { data, isLoading, error, refetch } = useResults()
  const refresh = useRefreshPerformance()

  if (isLoading) {
    return <Loading message="Loading results..." />
  }

  if (error) {
    return <Error message={error.message} onRetry={() => refetch()} />
  }

  if (!data) {
    return <Error message="Performance data is unavailable." />
  }

  const health = data.accountHealth
  const responseRate = data.conversations.responseRate
  const continuationRate = data.conversations.continuationRate

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Performance</h2>
          <p className="mt-1 text-sm text-slate-600">A plain-language view of recent outcomes. Detailed measurements remain available when you need them.</p>
        </div>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {refresh.isPending ? 'Refreshing account metrics…' : 'Refresh account metrics'}
        </button>
      </div>

      {refresh.isError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Refresh failed: {refresh.error.message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          label="Audience"
          value={data.account ? formatNumber(data.account.followers) : 'No snapshot yet'}
          note={
            data.account
              ? `${data.audience.relevantFollowers} observed followers match the target AI/developer audience${data.account.followerDelta != null ? ` · ${data.account.followerDelta >= 0 ? '+' : ''}${data.account.followerDelta} since the previous snapshot` : ''}`
              : 'Refresh account metrics to capture one.'
          }
        />
        <StatCard
          label="New follower quality · 24h"
          value={`${data.followerQuality.nicheAlignedNewFollowers} relevant / ${data.followerQuality.newlyObservedFollowers} newly observed`}
          note="First-observed follower quality, not a claimed causal follow event."
        />
        <StatCard
          label="Conversations"
          value={`${data.conversations.meaningfulInteractions7d} useful interactions · 7d`}
          note={
            responseRate == null
              ? 'Not enough conversation history for a response rate yet.'
              : `${responseRate}% of measured initial conversations received a response${continuationRate == null ? '' : ` · ${continuationRate}% continued`}.`
          }
        />
        <StatCard
          label="Account status"
          value={health.label}
          note="Internal efficiency warnings remain separate from observed platform constraints."
        />
      </div>

      {health.state !== 'healthy' ? (
        <div className={`rounded-lg border p-4 text-sm ${health.state === 'constrained' ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          <strong>{health.label}</strong> {health.explanation}
          {' '}<a href="/legacy?source=health" className="underline">Review account status</a>.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>No account intervention is currently indicated.</strong> Keep using the human-reviewed workflow and judge patterns over repeated outcomes.
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Recent measured posts</h3>
            <p className="text-sm text-slate-600">Latest available window for each recent publication.</p>
          </div>
          <a href="#/results/audience" className="text-sm font-medium text-sky-700 hover:underline">Review audience quality →</a>
        </div>
        {data.measuredPosts.length > 0 ? (
          <div className="space-y-3">
            {data.measuredPosts.map((post, index) => (
              <article key={index} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{post.title}</div>
                    <div className="text-xs text-slate-500">
                      Latest available measurement · {post.windowLabel}
                      {post.publishedAt ? ` · published ${formatDateTime(post.publishedAt)}` : ''}
                    </div>
                  </div>
                  {post.outputUrl && (
                    <a href={post.outputUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      View post ↗
                    </a>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-800">
                  <span><strong>{formatNumber(post.latest.views)}</strong> views</span>
                  <span><strong>{formatNumber(post.latest.replies)}</strong> replies</span>
                  <span><strong>{formatNumber(post.latest.reposts)}</strong> reposts</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {post.latest.followerDelta != null ? `${post.latest.followerDelta >= 0 ? '+' : ''}${post.latest.followerDelta} associated follower change` : 'Follower change unavailable'}
                  {' '}· isolation confidence {post.latest.attributionConfidence || 'unknown'}. This is associated account-level change, not direct post causality.
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No fixed-window publication measurements yet.
          </div>
        )}
      </section>

      <Disclosure summary="Technical measurements">
        <div className="space-y-4">
          {data.account && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Account snapshot</div>
              <div className="mt-1 text-sm text-slate-700">
                {formatNumber(data.account.followers)} followers · {formatNumber(data.account.following)} following · {formatNumber(data.account.posts)} posts · {formatNumber(data.account.likes)} likes given
              </div>
              {data.account.postsList.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent posts</div>
                  {data.account.postsList.map((post, index) => {
                    const engagement = Number(post.likes) + Number(post.reposts) + Number(post.replies)
                    const rate = Number(post.views) > 0 ? (engagement / Number(post.views)) * 100 : 0
                    return (
                      <div key={index} className="rounded-md border border-slate-200 p-2 text-xs text-slate-700">
                        <div>{post.text}</div>
                        <div className="mt-1 text-slate-500">
                          {formatNumber(post.views)} views · {formatNumber(post.likes)} likes · {formatNumber(post.reposts)} reposts · {formatNumber(post.replies)} replies · {rate.toFixed(2)}% visible engagement
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {data.technical.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Fixed-window publication measurements</div>
              <p className="mt-1 text-xs text-slate-500">
                15m / 1h / 6h / 24h snapshots use actual capture time. Follower deltas are associated with the measurement period and carry attribution confidence; they are not causal post attribution.
              </p>
              <div className="mt-3 space-y-3">
                {data.technical.map((series, index) => (
                  <div key={index} className="rounded-md border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900">{series.title}</div>
                    <div className="text-xs text-slate-500">{series.pipeline} · published {formatDateTime(series.publishedAt)}</div>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="pr-3">Window</th>
                            <th className="pr-3">Views</th>
                            <th className="pr-3">Views/h</th>
                            <th className="pr-3">Replies/1k</th>
                            <th className="pr-3">Reposts/1k</th>
                            <th className="pr-3">Assoc Δ followers</th>
                            <th className="pr-3">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-700">
                          {series.measurements.map((measurement, mIndex) => (
                            <tr key={mIndex} className="border-t border-slate-100">
                              <td className="pr-3">{String(measurement.windowMinutes)}m</td>
                              <td className="pr-3">{formatNumber(measurement.views as number)}</td>
                              <td className="pr-3">{measurement.viewsPerHour == null ? 'n/a' : String(measurement.viewsPerHour)}</td>
                              <td className="pr-3">{measurement.repliesPer1000Views == null ? 'n/a' : String(measurement.repliesPer1000Views)}</td>
                              <td className="pr-3">{measurement.repostsPer1000Views == null ? 'n/a' : String(measurement.repostsPer1000Views)}</td>
                              <td className="pr-3">{measurement.followerDelta == null ? 'n/a' : `${Number(measurement.followerDelta) >= 0 ? '+' : ''}${String(measurement.followerDelta)}`}</td>
                              <td className="pr-3">{String(measurement.attributionConfidence || 'unknown')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <TechnicalDetails>
            <div>Raw measurement objects are available from the API at <code>/api/results</code>.</div>
          </TechnicalDetails>
        </div>
      </Disclosure>
    </div>
  )
}
