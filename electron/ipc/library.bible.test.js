import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const handlers = {}
let savePath, openPath
const electron = {
  ipcMain: { handle: (name, fn) => (handlers[name] = fn) },
  dialog: {
    showSaveDialog: async () => ({ canceled: false, filePath: savePath }),
    showOpenDialog: async () => ({ canceled: false, filePaths: [openPath] })
  }
}
const Module = require('module')
const origLoad = Module._load
let dir

beforeEach(() => {
  Module._load = function (request, ...rest) {
    return request === 'electron' ? electron : origLoad.call(this, request, ...rest)
  }
  delete require.cache[require.resolve('./library.js')]
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'libbible-'))
  savePath = path.join(dir, 'export.json')
  openPath = savePath
})
afterEach(() => {
  Module._load = origLoad
  fs.rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('library export/import carries Bible translations', () => {
  it('exports installed translations and restores them on import without bloating library.json', async () => {
    const { createBibleStore } = require('../services/bibleStore.js')
    const userDataDir = path.join(dir, 'a')
    fs.mkdirSync(userDataDir)
    await createBibleStore(userDataDir).save({ id: 'KJV', name: 'King James', books: { Genesis: { 1: { 1: 'In the beginning' } } } })
    require('./library.js').registerLibraryIpc({ userDataDir, getMainWindow: () => null })

    expect(await handlers['export-library']({}, JSON.stringify({ presentations: [] }))).toBe(true)
    const exported = JSON.parse(fs.readFileSync(savePath, 'utf8'))
    expect(exported.bibles).toHaveLength(1)
    expect(exported.bibles[0].id).toBe('KJV')

    // A second computer
    const other = path.join(dir, 'b')
    fs.mkdirSync(other)
    delete require.cache[require.resolve('./library.js')]
    for (const k of Object.keys(handlers)) delete handlers[k]
    require('./library.js').registerLibraryIpc({ userDataDir: other, getMainWindow: () => null })
    const returned = JSON.parse(await handlers['import-library']())
    expect(returned.bibles).toBeUndefined()
    expect(JSON.parse(fs.readFileSync(path.join(other, 'library.json'), 'utf8')).bibles).toBeUndefined()
    const got = await createBibleStore(other).load('KJV')
    expect(got.books.Genesis['1']['1']).toBe('In the beginning')
  })

  it('exports a plain library unchanged when no translation is installed', async () => {
    const userDataDir = path.join(dir, 'c')
    fs.mkdirSync(userDataDir)
    require('./library.js').registerLibraryIpc({ userDataDir, getMainWindow: () => null })
    await handlers['export-library']({}, JSON.stringify({ presentations: [] }))
    expect(JSON.parse(fs.readFileSync(savePath, 'utf8'))).toEqual({ presentations: [] })
  })
})
