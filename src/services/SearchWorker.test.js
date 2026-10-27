import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Tests the REAL worker module. In jsdom, `self` is the window, so importing
 * SearchWorker.js installs its onmessage handler on the global — we stub
 * postMessage to capture replies and invoke onmessage directly.
 */

let replies

beforeEach(async () => {
  replies = []
  vi.resetModules()
  self.postMessage = (msg) => replies.push(msg)
  await import('./SearchWorker.js')
})

const send = (query, items) => self.onmessage({ data: { query, items } })

const INDEX = [
  { id: 'p1', searchText: 'sunday service\nwelcome to church' },
  { id: 'p2', searchText: 'youth group\ngames night' },
  { id: 'p3', searchText: 'amazing grace\nhow sweet the sound' }
]

describe('SearchWorker (real module)', () => {
  it('returns all ids for an empty query', () => {
    send('', INDEX)
    expect(replies[0].ids).toEqual(['p1', 'p2', 'p3'])
  })

  it('matches case-insensitively against the flat index', () => {
    send('WELCOME', INDEX)
    expect(replies[0].ids).toEqual(['p1'])
  })

  it('matches slide text, not just names', () => {
    send('sweet the sound', INDEX)
    expect(replies[0].ids).toEqual(['p3'])
  })

  it('returns an empty list when nothing matches', () => {
    send('zzz-no-match', INDEX)
    expect(replies[0].ids).toEqual([])
  })

  it('handles an empty library', () => {
    send('anything', [])
    expect(replies[0].ids).toEqual([])
  })
})

describe('SearchWorker — title matches rank first', () => {
  it('lists songs whose title matches before songs that only contain the word in their text', () => {
    const items = [
      { id: 'lyrics-only', name: 'betapa hatiku', searchText: 'betapa hatiku\nkau rajaku in the words' },
      { id: 'title-match', name: 'kau rajaku', searchText: 'kau rajaku\nanything' },
      { id: 'none', name: 'other', searchText: 'other' }
    ]
    send('kau', items)
    expect(replies[0].ids).toEqual(['title-match', 'lyrics-only'])
  })
})
