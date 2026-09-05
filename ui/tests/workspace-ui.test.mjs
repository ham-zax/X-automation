import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

after(async () => {
  await vite.close()
})

const workspace = await vite.ssrLoadModule('/src/components/workspace.tsx')
const primitives = await vite.ssrLoadModule('/src/components/primitives.tsx')

function render(element) {
  return renderToStaticMarkup(element)
}

test('workspace navigation exposes all primary destinations and current route', () => {
  const html = render(React.createElement(workspace.WorkspaceNav, { active: 'discover' }))
  for (const label of ['Today', 'Discover', 'Conversations', 'Posts', 'Results', 'Learn']) {
    assert.match(html, new RegExp(`>${label}<`))
  }
  assert.match(html, /aria-current="page"[^>]*data-active="true"[^>]*>Discover</)
})

test('page header keeps the current action and explanation in one hierarchy', () => {
  const html = render(React.createElement(workspace.PageHeader, {
    eyebrow: 'Now',
    title: 'Needs your attention',
    note: 'Two decisions are waiting.',
    right: React.createElement('a', { href: '#/discover' }, 'Find new signals'),
  }))
  assert.match(html, />Now</)
  assert.match(html, />Needs your attention</)
  assert.match(html, />Two decisions are waiting\.</)
  assert.match(html, />Find new signals</)
})

test('segmented tabs expose active state and lifecycle destinations', () => {
  const html = render(React.createElement(workspace.SegmentedTabs, {
    active: 'attention',
    onChange: () => {},
    items: [
      { id: 'attention', label: 'Attention', count: 3 },
      { id: 'published', label: 'Published', count: 24 },
    ],
  }))
  assert.match(html, /aria-pressed="true"[^>]*><span>Attention<\/span>/)
  assert.match(html, />Published/)
  assert.match(html, />24</)
})

test('metric card renders label value and note without decorative badge semantics', () => {
  const html = render(React.createElement(workspace.MetricCard, {
    label: 'Useful interactions',
    value: '3',
    note: 'Last 7 days',
  }))
  assert.match(html, />Useful interactions</)
  assert.match(html, />3</)
  assert.match(html, />Last 7 days</)
})

test('semantic badges expose tone to the design system', () => {
  const html = render(React.createElement(primitives.Badge, { tone: 'success' }, 'Ready'))
  assert.match(html, /status-badge/)
  assert.match(html, /data-tone="success"/)
  assert.match(html, />Ready</)
})

test('action buttons expose stable semantic variants', () => {
  const primary = render(React.createElement(primitives.ActionButton, { variant: 'primary' }, 'Publish'))
  const danger = render(React.createElement(primitives.ActionButton, { variant: 'danger' }, 'Discard'))
  assert.match(primary, /action-button/)
  assert.match(primary, /data-variant="primary"/)
  assert.match(danger, /data-variant="danger"/)
})

test('notices encode attention meaning without page-specific color utilities', () => {
  const html = render(React.createElement(primitives.Notice, { tone: 'warning', title: 'Needs attention' }, 'Review this item.'))
  assert.match(html, /notice/)
  assert.match(html, /data-tone="warning"/)
  assert.match(html, />Needs attention</)
  assert.match(html, />Review this item\.</)
})

test('segmented tabs and metrics support semantic tones', () => {
  const tabs = render(React.createElement(workspace.SegmentedTabs, {
    active: 'approved',
    onChange: () => {},
    items: [
      { id: 'review', label: 'Review', count: 1, tone: 'warning' },
      { id: 'approved', label: 'Approved', count: 2, tone: 'success' },
    ],
  }))
  const metric = render(React.createElement(workspace.MetricCard, {
    label: 'Conversations',
    value: '3',
    note: 'Last 7 days',
    tone: 'info',
  }))
  assert.match(tabs, /data-tone="warning"/)
  assert.match(tabs, /data-tone="success"/)
  assert.match(metric, /data-tone="info"/)
})
