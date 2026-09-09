export const DISCOVER_FEEDS = [
  { id: 'to-review', label: 'To review' },
  { id: 'x-for-you', label: 'X For You' },
  { id: 'creators', label: 'Creator watch' },
  { id: 'x', label: 'X latest' },
  { id: 'trending', label: 'X momentum' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'github', label: 'GitHub Trending' },
  { id: 'hn', label: 'Hacker News' },
  { id: 'saved', label: 'Bookmarks' },
  { id: 'handled', label: 'Handled' },
  { id: 'all', label: 'All sources' },
] as const

const DISCOVER_SOURCE_LABELS = [
  ['x_for_you', 'For You'],
  ['x_momentum', 'Momentum'],
  ['x_creator_latest', 'Creator watch'],
  ['x_latest', 'X latest'],
  ['github_trending', 'GitHub Trending'],
  ['hn_top', 'Hacker News'],
] as const

export function discoverSourceLabels(sourceKinds: string[] = []): string[] {
  const active = new Set(sourceKinds)
  return DISCOVER_SOURCE_LABELS.filter(([kind]) => active.has(kind)).map(([, label]) => label)
}

export function resolveDiscoverSelection<T extends { key: string }>(candidates: T[], currentKey: string | null): string | null {
  if (candidates.length === 0) return null
  if (currentKey && candidates.some((candidate) => candidate.key === currentKey)) return currentKey
  return candidates[0].key
}

export type DiscoverPrimaryAction = 'original' | 'quote' | 'thread' | 'reply' | 'ignore' | null

export function resolveDiscoverPrimaryAction({
  recommendedPipeline,
  isX,
  canProceed,
  skipped,
}: {
  recommendedPipeline?: string | null
  isX: boolean
  canProceed: boolean
  skipped: boolean
}): DiscoverPrimaryAction {
  if (recommendedPipeline === 'ignore') return skipped ? null : 'ignore'
  if (!canProceed) return null
  if (recommendedPipeline === 'original' || recommendedPipeline === 'thread') return recommendedPipeline
  if (isX && (recommendedPipeline === 'quote' || recommendedPipeline === 'reply')) return recommendedPipeline
  return null
}
