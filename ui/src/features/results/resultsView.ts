export interface GrowthConstraintInput {
  responseRate: number | null
  continuationRate: number | null
  meaningfulInteractions7d: number
}

export interface GrowthConstraintBrief {
  title: string
  body: string
  level: 'limited' | 'watch' | 'measured'
}

export function describeGrowthConstraint(input: GrowthConstraintInput): GrowthConstraintBrief {
  if (input.responseRate == null) {
    return {
      title: 'Conversation evidence is still limited',
      body: 'There is not enough measured conversation history to identify a stable response or continuation pattern yet.',
      level: 'limited',
    }
  }

  if (input.responseRate > 0 && input.continuationRate === 0) {
    return {
      title: 'Current constraint: conversations are not continuing',
      body: `${input.responseRate}% of measured initial conversations received a response, while 0% continued. Treat continuation as the next measurement target, not as a causal conclusion about any individual post or reply.`,
      level: 'watch',
    }
  }

  if (input.continuationRate != null && input.continuationRate > 0) {
    return {
      title: 'Conversation continuation is measurable',
      body: `${input.responseRate}% of measured initial conversations received a response and ${input.continuationRate}% continued. Keep the sample-size and attribution limits attached to any strategy interpretation.`,
      level: 'measured',
    }
  }

  return {
    title: 'Initial response is the clearest conversation signal',
    body: `${input.responseRate}% of measured initial conversations received a response. Continuation evidence is not yet strong enough to treat as a stable pattern.`,
    level: 'limited',
  }
}
