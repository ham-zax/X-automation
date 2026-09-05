import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveDiscoverSelection } from '../src/features/discover/discoverView.ts'

test('discover selection returns null for an empty candidate list', () => {
  assert.equal(resolveDiscoverSelection([], 'old'), null)
})

test('discover selection chooses the first candidate when there is no current selection', () => {
  assert.equal(resolveDiscoverSelection([{ key: 'a' }, { key: 'b' }], null), 'a')
})

test('discover selection preserves a current candidate that still exists', () => {
  assert.equal(resolveDiscoverSelection([{ key: 'a' }, { key: 'b' }], 'b'), 'b')
})

test('discover selection falls back to first candidate when current selection disappears', () => {
  assert.equal(resolveDiscoverSelection([{ key: 'a' }], 'b'), 'a')
})

test('discover primary action follows supported route recommendation only', async () => {
  const { resolveDiscoverPrimaryAction } = await import('../src/features/discover/discoverView.ts')
  assert.equal(resolveDiscoverPrimaryAction({ recommendedPipeline: 'quote', isX: true, canProceed: true, skipped: false }), 'quote')
  assert.equal(resolveDiscoverPrimaryAction({ recommendedPipeline: 'reply', isX: false, canProceed: true, skipped: false }), null)
  assert.equal(resolveDiscoverPrimaryAction({ recommendedPipeline: 'original', isX: true, canProceed: false, skipped: false }), null)
})

test('discover primary action keeps skip as the default for ignore recommendations', async () => {
  const { resolveDiscoverPrimaryAction } = await import('../src/features/discover/discoverView.ts')
  assert.equal(resolveDiscoverPrimaryAction({ recommendedPipeline: 'ignore', isX: true, canProceed: true, skipped: false }), 'ignore')
  assert.equal(resolveDiscoverPrimaryAction({ recommendedPipeline: 'ignore', isX: true, canProceed: true, skipped: true }), null)
})
