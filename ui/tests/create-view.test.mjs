import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPostViews } from '../src/features/create/createView.ts'

const sections = [
  { id: 'ideas', items: [{ id: 1 }] },
  { id: 'research', items: [{ id: 2 }] },
  { id: 'onHold', items: [] },
  { id: 'drafting', items: [{ id: 3 }, { id: 4 }] },
  { id: 'needsReview', items: [{ id: 5 }] },
  { id: 'approved', items: [{ id: 6 }] },
  { id: 'publishing', items: [{ id: 7 }] },
  { id: 'failed', items: [{ id: 8 }, { id: 9 }] },
  { id: 'published', items: [{ id: 10 }] },
]

test('attention combines review approved and failed work only', () => {
  const views = buildPostViews(sections)
  const attention = views.find((view) => view.id === 'attention')
  assert.equal(attention.count, 4)
  assert.deepEqual(attention.sections.map((section) => section.id), ['needsReview', 'approved', 'failed'])
})

test('source view keeps undecided research and on-hold source stages together', () => {
  const views = buildPostViews(sections)
  const source = views.find((view) => view.id === 'sources')
  assert.equal(source.count, 2)
  assert.deepEqual(source.sections.map((section) => section.id), ['ideas', 'research', 'onHold'])
})

test('approved view includes in-flight publishing without changing section objects', () => {
  const views = buildPostViews(sections)
  const approved = views.find((view) => view.id === 'approved')
  assert.equal(approved.count, 2)
  assert.strictEqual(approved.sections[0], sections[5])
  assert.strictEqual(approved.sections[1], sections[6])
})

test('published view exposes only published history', () => {
  const views = buildPostViews(sections)
  const published = views.find((view) => view.id === 'published')
  assert.deepEqual(published.sections.map((section) => section.id), ['published'])
})

test('post lifecycle views expose presentation-only semantic tones', () => {
  const views = buildPostViews(sections)
  const tones = Object.fromEntries(views.map((view) => [view.id, view.tone]))
  assert.deepEqual(tones, {
    attention: 'warning',
    sources: 'info',
    drafts: 'ai',
    review: 'warning',
    approved: 'success',
    published: 'neutral',
  })
})
