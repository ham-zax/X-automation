import { useResults, useRefreshPerformance, type StrategyOutcomeCohort } from '../../api/client'
import {
  Disclosure,
  Error,
  Loading,
  Notice,
  TechnicalDetails,
  formatDateTime,
  formatNumber,
} from '../../components/primitives'
import { MetricCard, PageHeader } from '../../components/workspace'
import { describeGrowthConstraint } from './resultsView'

function distributionText(distribution: { values: Record<string, { count: number; share: number }> }) {
  const entries = Object.entries(distribution.values || {})
  return entries.length ? entries.map(([value, item]) => `${value}: ${item.count} (${Math.round(item.share * 100)}%)`).join(' · ') : 'not recorded'
}

function outcomeLabel(value: string) {
  return value === 'no_selection' ? 'No selection' : value.replaceAll('_', ' ')
}

function StrategyOutcomeGroups({ title, groups, showBookmarks }: { title: string; groups: { value: string; summary: StrategyOutcomeCohort }[]; showBookmarks: boolean }) {
  if (!groups.length) return null
  return (
    <div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.value} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <strong className="capitalize text-slate-900">{outcomeLabel(group.value)}</strong>
              <span className="text-xs text-slate-500">n={group.summary.sampleSize}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <div>Views/h: <strong>{group.summary.metrics.views_per_hour ?? 'n/a'}</strong></div>
              <div>Replies/1k: <strong>{group.summary.metrics.replies_per_1000_views ?? 'n/a'}</strong></div>
              <div>Reposts/1k: <strong>{group.summary.metrics.reposts_per_1000_views ?? 'n/a'}</strong></div>
              <div>Visible engagement/1k: <strong>{group.summary.metrics.visible_engagement_per_1000_views ?? 'n/a'}</strong></div>
              <div>Assoc. follows/1k: <strong>{group.summary.metrics.associated_follows_per_1000_views ?? 'n/a'}</strong></div>
              {showBookmarks && <div>Bookmarks/1k: <strong>{group.summary.metrics.bookmarks_per_1000_views ?? 'n/a'}</strong></div>}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Relevant/new follower associations: {group.summary.newFollowerQuality.relevantFollowerAssociations} / {group.summary.newFollowerQuality.newlyObservedFollowerAssociations}
              {' '}across {group.summary.newFollowerQuality.observationWindows} measured window{group.summary.newFollowerQuality.observationWindows === 1 ? '' : 's'}.
            </div>
            <div className="mt-1 text-xs text-slate-500">Attribution confidence: {distributionText(group.summary.attributionConfidence)}</div>
            <Disclosure summary="Measured posts and attribution context">
              <div className="space-y-2 text-xs text-slate-600">
                {group.summary.sourcePublications.map((source) => (
                  <div key={source.measurementId}>
                    {source.outputUrl ? <a href={source.outputUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 underline">{source.title}</a> : <strong>{source.title}</strong>}
                    {source.publishedAt ? ` · ${formatDateTime(source.publishedAt)}` : ''}
                  </div>
                ))}
                <div>Follower-quality windows are period associations and may overlap; counts are not unique post-attributed follows.</div>
                {Object.keys(group.summary.confounders || {}).map((key) => (
                  <div key={key}><strong>{outcomeLabel(key)}:</strong> {distributionText(group.summary.confounders[key])}</div>
                ))}
              </div>
            </Disclosure>
          </div>
        ))}
      </div>
    </div>
  )
}

function OutcomeGroups({ title, groups }: { title: string; groups: { value: string; summary: { sampleSize: number; metrics: Record<string, number | null>; attributionConfidence: { values: Record<string, { count: number; share: number }> }; confounders: Record<string, { values: Record<string, { count: number; share: number }> }> } }[] }) {
  if (!groups.length) return null
  return (
    <div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.value} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-slate-900">{group.value.replaceAll('_', ' ')}</strong>
              <span className="text-xs text-slate-500">n={group.summary.sampleSize}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <div>Views/h: <strong>{group.summary.metrics.views_per_hour ?? 'n/a'}</strong></div>
              <div>Replies/1k: <strong>{group.summary.metrics.replies_per_1000_views ?? 'n/a'}</strong></div>
              <div>Reposts/1k: <strong>{group.summary.metrics.reposts_per_1000_views ?? 'n/a'}</strong></div>
              <div>Assoc. follows/1k: <strong>{group.summary.metrics.associated_follows_per_1000_views ?? 'n/a'}</strong></div>
            </div>
            <div className="mt-2 text-xs text-slate-500">Attribution confidence: {distributionText(group.summary.attributionConfidence)}</div>
            {Object.keys(group.summary.confounders || {}).length > 0 && (
              <Disclosure summary="Attribution context / confounders">
                <div className="space-y-1 text-xs text-slate-600">
                  {Object.entries(group.summary.confounders).map(([key, distribution]) => (
                    <div key={key}><strong>{key.replaceAll('_', ' ')}:</strong> {distributionText(distribution)}</div>
                  ))}
                </div>
              </Disclosure>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

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
    return <Error message="Results data is unavailable." />
  }

  const health = data.accountHealth
  const responseRate = data.conversations.responseRate
  const continuationRate = data.conversations.continuationRate
  const growthBrief = describeGrowthConstraint({
    responseRate,
    continuationRate,
    meaningfulInteractions7d: data.conversations.meaningfulInteractions7d,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Measured outcomes"
        title="Results"
        note="Are we gaining relevant followers and building conversations that last? Compare observed outcomes, not just how much the agent posted."
        right={(
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="action-button" data-variant="secondary"
          >
            {refresh.isPending ? 'Refreshing account metrics…' : 'Refresh account metrics'}
          </button>
        )}
      />

      {refresh.isError && <Notice tone="warning" title="Refresh failed">{refresh.error.message}</Notice>}

      <Notice tone={growthBrief.level === 'watch' ? 'warning' : 'neutral'} title={<><span className="block text-[11px] uppercase tracking-[0.12em] opacity-75">Growth brief</span><span className="mt-1 block text-lg tracking-tight text-slate-900">{growthBrief.title}</span></>}>
        <span className="max-w-4xl text-sm leading-6">{growthBrief.body}</span>
      </Notice>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Audience"
          value={data.account ? formatNumber(data.account.followers) : 'No snapshot'}
          note={data.account
            ? `${data.audience.relevantFollowers} observed match target audience${data.account.followerDelta != null ? ` · ${data.account.followerDelta >= 0 ? '+' : ''}${data.account.followerDelta} since previous snapshot` : ''}`
            : 'Refresh metrics to capture a snapshot.'}
          tone="primary"
        />
        <MetricCard
          label="Follower quality · 24h"
          value={`${data.followerQuality.nicheAlignedNewFollowers} / ${data.followerQuality.newlyObservedFollowers}`}
          note="Relevant / newly observed; not a causal follow claim."
          tone="success"
        />
        <MetricCard
          label="Useful interactions · 7d"
          value={data.conversations.meaningfulInteractions7d}
          note={responseRate == null ? 'Response rate not established yet.' : `${responseRate}% initial response${continuationRate == null ? '' : ` · ${continuationRate}% continued`}`}
          tone={continuationRate === 0 ? "warning" : "info"}
        />
        <MetricCard
          label="Account status"
          value={health.label}
          note="Efficiency warnings remain separate from platform constraints."
          tone={health.state === "healthy" ? "success" : health.state === "constrained" ? "danger" : "warning"}
        />
      </div>

      {health.state !== 'healthy' ? (
        <Notice tone={health.state === 'constrained' ? 'danger' : 'warning'} title={health.label}>
          <span>{health.state === 'constrained' ? 'Some actions are currently constrained.' : 'Advisory diagnostics need attention.'} <a href="/legacy?source=health" className="font-semibold underline">Review status →</a></span>
          <p className="mt-2 text-sm leading-7 text-slate-600">{health.explanation}</p>
        </Notice>
      ) : (
        <Notice tone="success" title="Account healthy">No intervention is currently indicated.</Notice>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Recent measured posts</h3>
            <p className="text-sm text-slate-600">Latest window per post. Follower deltas are associated account change, not direct post causality.</p>
          </div>
          <a href="#/results/audience" className="text-sm font-semibold text-indigo-700 hover:underline">Review audience quality →</a>
        </div>
        {data.measuredPosts.length > 0 ? (
          <div className="space-y-3">
            {data.measuredPosts.map((post, index) => (
              <article key={index} className="operator-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{post.title}</div>
                    <div className="text-xs text-slate-500">
                      Latest available measurement · {post.windowLabel}
                      {post.publishedAt ? ` · published ${formatDateTime(post.publishedAt)}` : ''}
                    </div>
                  </div>
                  {post.outputUrl && (
                    <a href={post.outputUrl} target="_blank" rel="noopener noreferrer" className="action-button !min-h-0 !px-2.5 !py-1 text-xs" data-variant="ghost">
                      View post ↗
                    </a>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-800">
                  <span><strong>{formatNumber(post.latest.views)}</strong> views</span>
                  <span><strong>{formatNumber(post.latest.replies)}</strong> replies</span>
                  <span><strong>{formatNumber(post.latest.reposts)}</strong> reposts</span>
                  {data.measurementCapabilities.bookmarks.available && post.latest.bookmarks != null && <span><strong>{formatNumber(post.latest.bookmarks)}</strong> bookmarks</span>}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {post.latest.followerDelta != null ? `${post.latest.followerDelta >= 0 ? '+' : ''}${post.latest.followerDelta} associated followers` : 'Follower change unavailable'}
                  {' '}· {post.latest.attributionConfidence || 'unknown'} isolation confidence.
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

      <Disclosure summary={`Writing approach outcomes · ${data.writingStrategyOutcomes.observationCount} observations`} defaultOpen className="operator-surface p-5">
        <div className="mb-4">
          <p className="text-sm text-slate-600">
            Observed {data.writingStrategyOutcomes.windowMinutes / 60}h outcomes for published work. These are associations, not proof that a writing approach caused performance.
          </p>
          <div className="mt-1 text-xs text-slate-500">
            {data.measurementCapabilities.bookmarks.available ? 'Bookmarks are captured by the current owned-post reader.' : 'Bookmarks are unavailable.'}
            {' '}Profile clicks and URL clicks are unavailable from the current owned-post measurement path.
          </div>
        </div>

        {data.writingStrategyOutcomes.availability === 'available' ? (
          <div className="space-y-5">
            <div className="text-sm text-slate-700">
              {data.writingStrategyOutcomes.observationCount} publication observation{data.writingStrategyOutcomes.observationCount === 1 ? '' : 's'} with recorded generation provenance; {data.writingStrategyOutcomes.appliedObservationCount} used an Apply strategy in Writer.
              {data.writingStrategyOutcomes.truncated && (
                <> Showing the latest {data.writingStrategyOutcomes.measurementCount} of {data.writingStrategyOutcomes.totalMeasurementCount} mature measurements.</>
              )}
            </div>
            <StrategyOutcomeGroups title="Intent · Apply generations only" groups={data.writingStrategyOutcomes.byIntent} showBookmarks={data.measurementCapabilities.bookmarks.available} />
            <StrategyOutcomeGroups title="Presentation style · Apply generations only" groups={data.writingStrategyOutcomes.byStyle} showBookmarks={data.measurementCapabilities.bookmarks.available} />
            <StrategyOutcomeGroups title="Opening feature · Apply generations only" groups={data.writingStrategyOutcomes.byOpeningFeature} showBookmarks={data.measurementCapabilities.bookmarks.available} />
            <Disclosure summary="Generation mode observations">
              <div className="space-y-5">
                <StrategyOutcomeGroups title="Mode at generation" groups={data.writingStrategyOutcomes.byStrategyMode} showBookmarks={data.measurementCapabilities.bookmarks.available} />
                <StrategyOutcomeGroups title="Selection origin at generation" groups={data.writingStrategyOutcomes.bySelectionSource} showBookmarks={data.measurementCapabilities.bookmarks.available} />
              </div>
            </Disclosure>
            <Disclosure summary="Publication and generation provenance">
              <div className="space-y-3 text-xs text-slate-600">
                {data.writingStrategyOutcomes.observations.map((observation) => (
                  <div key={observation.sourcePublication.measurementId} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="font-semibold text-slate-800">{observation.sourcePublication.title}</div>
                    <div className="mt-1">
                      Generation: {observation.strategyMode ?? 'no selection'} · applied to Writer: {observation.strategyApplied ? 'yes' : 'no'} · generation selection #{observation.generation.strategySelectionId ?? 'none'}.
                    </div>
                    <div>
                      At publication: {observation.publicationSelection.mode ?? 'no selection'} · source {observation.publicationSelection.selectionSource} · selection #{observation.publicationSelection.selectionId ?? 'none'}.
                    </div>
                    <div>
                      Pipeline: {observation.finalPublishedPipeline || 'not recorded'} · objective: {observation.editorialObjective || 'not recorded'} · Growth Focus revision: {observation.growthFocus?.profileRevision ?? 'not recorded'} · classifier revision/version: {observation.candidateClassification?.profileRevision ?? 'not recorded'}/{observation.candidateClassification?.classifierVersion ?? 'not recorded'}.
                    </div>
                  </div>
                ))}
                <div><code>strategyApplied=true</code> means the strategy was supplied to Writer generation. Manual edits after generation are not quantified.</div>
              </div>
            </Disclosure>
          </div>
        ) : (
          <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {data.writingStrategyOutcomes.availability === 'no_measurements'
              ? 'No mature 24h publication measurements exist yet, so there are no writing-approach outcome observations.'
              : `No mature publication measurement has recorded Writer-generation strategy provenance yet. Existing historical measurements are left unknown rather than attributed from today’s selection. (${data.writingStrategyOutcomes.unavailable.strategyProvenanceNotRecorded} without strategy metadata; ${data.writingStrategyOutcomes.unavailable.generationProvenanceNotRecorded} without generation provenance.)`}
          </div>
        )}
      </Disclosure>

      <div className="text-sm text-slate-500">Compare external patterns, account evidence, and explicit tests in <a href="#/learn" className="font-semibold text-indigo-700 hover:underline">Learn →</a></div>

      {data.editorialOutcomes && (
        <Disclosure summary={`Editorial outcome observations · ${data.editorialOutcomes.observationCount}`} defaultOpen className="operator-surface p-5">
          <div className="mb-4">
            <p className="text-sm text-slate-600">
              {data.editorialOutcomes.observationCount} real {data.editorialOutcomes.windowMinutes / 60}h publication observations. These cohorts are descriptive associations, not causal proof that a recommendation or format caused the outcome.
            </p>
          </div>
          <div className="space-y-5">
            <OutcomeGroups title="AI recommended format" groups={data.editorialOutcomes.byRecommendedPipeline} />
            <OutcomeGroups title="Human selected format" groups={data.editorialOutcomes.bySelectedPipeline} />
            <OutcomeGroups title="Final published format" groups={data.editorialOutcomes.byFinalPublishedPipeline} />
            <Disclosure summary="Objective cohorts">
              <OutcomeGroups title="Editorial objective" groups={data.editorialOutcomes.byObjective} />
            </Disclosure>
          </div>
        </Disclosure>
      )}

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
                            {data.measurementCapabilities.bookmarks.available && <th className="pr-3">Bookmarks/1k</th>}
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
                              {data.measurementCapabilities.bookmarks.available && <td className="pr-3">{measurement.bookmarksPer1000Views == null ? 'n/a' : String(measurement.bookmarksPer1000Views)}</td>}
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
            <div className="mt-1">Writing-strategy external/own-account/test evidence is exposed side by side in <code>writingStrategyEvidence</code> for a future interpretation surface. No automatic agreement verdict is assigned.</div>
            <div className="mt-1">Profile clicks: unavailable · URL clicks: unavailable on the current owned-post reader.</div>
          </TechnicalDetails>
        </div>
      </Disclosure>
    </div>
  )
}
