import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const { createLibraryStore } = createRequire(import.meta.url)('./libraryStore.js')

let dir, store
const png = Buffer.alloc(3000, 7)
const dataUrl = `data:image/png;base64,${png.toString('base64')}`
const lib = (media) => JSON.stringify({ version: 2, presentations: [{ bg: 'ep-media:m0' }], media })

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'libstore-'))
  store = createLibraryStore(dir)
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('libraryStore media files', () => {
  it('keeps images out of library.json and round-trips them on load', async () => {
    await store.save(lib({ m0: dataUrl }))
    const onDisk = fs.readFileSync(path.join(dir, 'library.json'), 'utf8')
    expect(onDisk).not.toContain('base64')
    expect(onDisk.length).toBeLessThan(400)
    const files = fs.readdirSync(path.join(dir, 'media'))
    expect(files).toHaveLength(1)
    expect(fs.readFileSync(path.join(dir, 'media', files[0])).equals(png)).toBe(true)

    expect(JSON.parse(await store.load()).media.m0).toBe(dataUrl)
  })

  it('stores identical images once and does not rewrite them on the next save', async () => {
    await store.save(lib({ m0: dataUrl, m1: dataUrl }))
    const [name] = fs.readdirSync(path.join(dir, 'media'))
    const before = fs.statSync(path.join(dir, 'media', name)).mtimeMs
    await store.save(lib({ m0: dataUrl }))
    expect(fs.readdirSync(path.join(dir, 'media'))).toEqual([name])
    expect(fs.statSync(path.join(dir, 'media', name)).mtimeMs).toBe(before)
  })

  it('leaves libraries without media, and old inline-media files, loading as before', async () => {
    await store.save(JSON.stringify({ version: 2, presentations: [] }))
    expect(JSON.parse(await store.load()).presentations).toEqual([])
    fs.writeFileSync(path.join(dir, 'library.json'), lib({ m0: dataUrl }))
    expect(JSON.parse(await store.load()).media.m0).toBe(dataUrl)
  })

  it('keeps the reference (not an empty value) when a media file has gone missing', async () => {
    await store.save(lib({ m0: dataUrl }))
    const [name] = fs.readdirSync(path.join(dir, 'media'))
    fs.unlinkSync(path.join(dir, 'media', name))
    expect(JSON.parse(await store.load()).media.m0).toMatch(/^ep-file:/)
  })

  it('does not delete a file just because the latest save no longer uses it (backups may)', async () => {
    await store.save(lib({ m0: dataUrl }))
    await store.save(lib({}))
    expect(fs.readdirSync(path.join(dir, 'media'))).toHaveLength(1)
  })

  it('replace() externalizes too, and recovered backups are re-inflated', async () => {
    await store.replace(lib({ m0: dataUrl }))
    expect(fs.readFileSync(path.join(dir, 'library.json'), 'utf8')).not.toContain('base64')
    await store.save(lib({ m0: dataUrl })) // makes a backup of the file above
    fs.writeFileSync(path.join(dir, 'library.json'), '{ torn')
    expect(JSON.parse(await store.load()).media.m0).toBe(dataUrl)
  })
})
