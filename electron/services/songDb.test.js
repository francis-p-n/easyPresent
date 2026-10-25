// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openSongDb } from './songDb.js'

let dir
let db

const song = (id, over = {}) => ({ id, title: `Song ${id}`, chordpro: `[G]Line ${id}`, updatedAt: 1000, ...over })

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-songdb-'))
  db = openSongDb(path.join(dir, 'a.db'))
})
afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('songDb', () => {
  it('stores and lists songs sorted by title', () => {
    db.upsertMany([song('b', { title: 'beta' }), song('a', { title: 'Alpha', key: 'G', category: 'Hymns' })])
    expect(db.list().map((s) => s.title)).toEqual(['Alpha', 'beta'])
    expect(db.list()[0]).toMatchObject({ id: 'a', key: 'G', category: 'Hymns', chordpro: '[G]Line a' })
  })

  it('updates in place and never lets an older copy overwrite a newer one', () => {
    db.upsertMany([song('a', { title: 'New', updatedAt: 2000 })])
    db.upsertMany([song('a', { title: 'Stale', updatedAt: 1000 })])
    expect(db.list()).toHaveLength(1)
    expect(db.list()[0].title).toBe('New')
  })

  it('removes songs', () => {
    db.upsertMany([song('a'), song('b')])
    db.remove(['a'])
    expect(db.list().map((s) => s.id)).toEqual(['b'])
    expect(db.count()).toBe(1)
  })

  it('rolls back a failed batch', () => {
    expect(() => db.upsertMany([song('a'), { id: 'x', title: null, chordpro: 'c' }])).toThrow()
    expect(db.count()).toBe(0)
  })

  it('persists meta flags', () => {
    expect(db.getMeta('seeded')).toBeNull()
    db.setMeta('seeded', '1')
    expect(db.getMeta('seeded')).toBe('1')
  })

  it('exports a standalone copy that another install can import and merge', () => {
    db.upsertMany([song('a'), song('b', { updatedAt: 5000 })])
    const exported = path.join(dir, 'export.db')
    db.exportTo(exported)

    const other = openSongDb(path.join(dir, 'b.db'))
    other.upsertMany([song('b', { title: 'Local newer', updatedAt: 9000 }), song('c')])
    expect(other.importFrom(exported)).toBe(2)

    const byId = Object.fromEntries(other.list().map((s) => [s.id, s]))
    expect(Object.keys(byId).sort()).toEqual(['a', 'b', 'c'])
    expect(byId.b.title).toBe('Local newer') // newer local edit wins
    other.close()
  })

  it('rejects files that are not song databases', () => {
    const junk = path.join(dir, 'junk.db')
    fs.writeFileSync(junk, 'not sqlite')
    expect(() => db.importFrom(junk)).toThrow()
  })
})
