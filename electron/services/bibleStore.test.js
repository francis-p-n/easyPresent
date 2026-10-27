// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createBibleStore } from './bibleStore.js'

let dir
let store
const books = { John: { 3: { 16: 'Sample sixteen.', 17: 'Sample seventeen.' } }, Tobit: { 1: { 1: 'Sample.' } } }

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-bible-'))
  store = createBibleStore(dir)
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('bibleStore', () => {
  it('starts empty', async () => {
    expect(await store.list()).toEqual([])
  })

  it('saves a translation, lists it with its verse count, and loads it back', async () => {
    const saved = await store.save({ id: 'NRSV-CE', name: 'Sample Edition', books })
    expect(saved).toEqual({ id: 'NRSV-CE', name: 'Sample Edition', verses: 3 })
    expect(await store.list()).toEqual([saved])
    const loaded = await store.load('NRSV-CE')
    expect(loaded.books.John[3][17]).toBe('Sample seventeen.')
  })

  it('keeps several translations, sorted, and replaces one saved again', async () => {
    await store.save({ id: 'NIV', books })
    await store.save({ id: 'NRSV-CE', books })
    await store.save({ id: 'NIV', name: 'Second import', books: { John: { 1: { 1: 'Only.' } } } })
    const list = await store.list()
    expect(list.map((t) => t.id)).toEqual(['NIV', 'NRSV-CE'])
    expect(list[0]).toMatchObject({ name: 'Second import', verses: 1 })
  })

  it('removes a translation', async () => {
    await store.save({ id: 'NIV', books })
    expect(await store.remove('NIV')).toBe(true)
    expect(await store.list()).toEqual([])
    expect(await store.load('NIV')).toBeNull()
  })

  it('refuses ids that could escape the folder, and empty text', async () => {
    await expect(store.save({ id: '../evil', books })).rejects.toThrow(/abbreviation/)
    await expect(store.save({ id: '', books })).rejects.toThrow()
    await expect(store.save({ id: 'OK', books: null })).rejects.toThrow(/No Bible text/)
    expect(await store.load('../evil')).toBeNull()
    expect(fs.existsSync(path.join(dir, 'evil.json'))).toBe(false)
  })
})
