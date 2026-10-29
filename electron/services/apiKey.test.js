// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApiKeyStore, VALID } from './apiKey.js'

let dir
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-key-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('apiKey', () => {
  it('makes a readable key once and keeps it across restarts', () => {
    const a = createApiKeyStore(dir).get()
    expect(a).toMatch(VALID)
    expect(createApiKeyStore(dir).get()).toBe(a)
    expect(fs.readFileSync(path.join(dir, 'api-key.txt'), 'utf8').trim()).toBe(a)
  })

  it('a new key replaces the old one, and survives a restart', () => {
    const store = createApiKeyStore(dir)
    const a = store.get()
    const b = store.regenerate()
    expect(b).not.toBe(a)
    expect(createApiKeyStore(dir).get()).toBe(b)
  })

  it('ignores a damaged key file and makes a fresh key', () => {
    fs.writeFileSync(path.join(dir, 'api-key.txt'), 'x y!!', 'utf8')
    expect(createApiKeyStore(dir).get()).toMatch(VALID)
  })

  it('still works when the folder cannot be written', () => {
    const store = createApiKeyStore(path.join(dir, 'file-not-folder', 'x'))
    fs.writeFileSync(path.join(dir, 'file-not-folder'), 'a file', 'utf8')
    expect(store.get()).toMatch(VALID)
  })
})
