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
