import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
after(() => vite.close())
const { request, ApiError } = await vite.ssrLoadModule('/src/api/client.ts')
const { parseHash } = await vite.ssrLoadModule('/src/router.ts')

test('malformed route encoding remains readable instead of crashing the dashboard', () => {
  assert.deepEqual(parseHash('#/draft/%E0%A4%A').segments, ['draft', '%E0%A4%A'])
  assert.deepEqual(parseHash('#/conversations/a%2Fb').segments, ['conversations', 'a/b'])
})

test('API timeout aborts the request and preserves uncertainty about server writes', async (t) => {
  const controller = new AbortController()
  t.mock.method(AbortSignal, 'timeout', (ms) => { assert.equal(ms, 120_000); return controller.signal })
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.ok(init.signal)
    controller.abort(new DOMException('Timed out', 'TimeoutError'))
    throw controller.signal.reason
  })
  await assert.rejects(request('/drafts/1/save', { method: 'POST' }), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.code, 'REQUEST_TIMEOUT')
    assert.match(error.message, /may have completed on the server/)
    return true
  })
})

test('API caller cancellation is passed to fetch without being called a timeout', async (t) => {
  const controller = new AbortController()
  controller.abort(new DOMException('Cancelled', 'AbortError'))
  t.mock.method(globalThis, 'fetch', async (_url, init) => { throw init.signal.reason })
  await assert.rejects(request('/drafts/1', { signal: controller.signal }), { name: 'AbortError' })
})

test('API rejects unreadable responses instead of exposing JSON parser failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ status: 502, json: async () => { throw new SyntaxError('HTML response') } }))
  await assert.rejects(request('/drafts/1'), /unreadable response \(502\)/)
})
