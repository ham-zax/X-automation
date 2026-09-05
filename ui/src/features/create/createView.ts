export interface PostSectionLike {
  id: string
  items: unknown[]
}

export interface PostView<T extends PostSectionLike> {
  id: 'attention' | 'sources' | 'drafts' | 'review' | 'approved' | 'published'
  label: string
  sections: T[]
  count: number
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'ai'
}

function selectSections<T extends PostSectionLike>(sections: T[], ids: string[]) {
  return ids.flatMap((id) => {
    const section = sections.find((candidate) => candidate.id === id)
    return section ? [section] : []
  })
}

export function buildPostViews<T extends PostSectionLike>(sections: T[]): PostView<T>[] {
  const definitions = [
    { id: 'attention', label: 'Attention', tone: 'warning', sectionIds: ['needsReview', 'approved', 'failed'] },
    { id: 'sources', label: 'Sources', tone: 'info', sectionIds: ['ideas', 'research', 'onHold'] },
    { id: 'drafts', label: 'Drafts', tone: 'ai', sectionIds: ['drafting'] },
    { id: 'review', label: 'Review', tone: 'warning', sectionIds: ['needsReview'] },
    { id: 'approved', label: 'Approved', tone: 'success', sectionIds: ['approved', 'publishing'] },
    { id: 'published', label: 'Published', tone: 'neutral', sectionIds: ['published'] },
  ] as const

  return definitions.map((definition) => {
    const matching = selectSections(sections, [...definition.sectionIds])
    return {
      id: definition.id,
      label: definition.label,
      tone: definition.tone,
      sections: matching,
      count: matching.reduce((total, section) => total + section.items.length, 0),
    }
  })
}
