import assert from 'node:assert/strict'
import test from 'node:test'
import { describeGrowthConstraint } from '../src/features/results/resultsView.ts'

test('zero continuation after measured responses is framed as the current constraint', () => {
  const brief = describeGrowthConstraint({ responseRate: 16.7, continuationRate: 0, meaningfulInteractions7d: 3 })
  assert.match(brief.title, /conversations are not continuing/i)
  assert.match(brief.body, /16\.7%/)
  assert.match(brief.body, /0%/)
  assert.match(brief.body, /measurement target/i)
  assert.doesNotMatch(brief.body, /caused|because of the posts/i)
})

test('missing response-rate history is described as insufficient evidence', () => {
  const brief = describeGrowthConstraint({ responseRate: null, continuationRate: null, meaningfulInteractions7d: 0 })
  assert.match(brief.title, /evidence/i)
  assert.equal(brief.level, 'limited')
})

test('positive continuation does not claim a zero-continuation constraint', () => {
  const brief = describeGrowthConstraint({ responseRate: 25, continuationRate: 12.5, meaningfulInteractions7d: 4 })
  assert.doesNotMatch(`${brief.title} ${brief.body}`, /not continuing|0% continued/i)
  assert.match(brief.body, /12\.5%/)
})
