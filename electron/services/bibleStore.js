/**
 * bibleStore — the Bibles the church has imported, one JSON file each in
 * <user data>/bibles, plus a small index so listing them never reads the big files.
 *
 * Nothing is bundled with the app: every translation is a file someone with the
 * right to use it chose to import.
 */
const fs = require('fs')
const path = require('path')

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,15}$/

function createBibleStore(userDataDir) {
  const dir = path.join(userDataDir, 'bibles')
  const indexFile = path.join(dir, 'index.json')
  const fileFor = (id) => path.join(dir, `${id}.json`)

  async function readIndex() {
    try {
      const list = JSON.parse(await fs.promises.readFile(indexFile, 'utf8'))
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  }

  async function writeAtomic(file, text) {
    await fs.promises.mkdir(dir, { recursive: true })
    const tmp = file + '.tmp'
    await fs.promises.writeFile(tmp, text, 'utf8')
    await fs.promises.rename(tmp, file)
  }

  return {
    /** [{ id, name, verses }] for the translation picker. */
    list: readIndex,

    /** Stores (or replaces) a translation: { id, name, books }. */
    async save({ id, name, books }) {
      if (!ID_PATTERN.test(String(id))) throw new Error('The abbreviation may use letters, numbers, dot, dash and underscore (up to 16)')
      if (!books || typeof books !== 'object') throw new Error('No Bible text to save')
      const verses = Object.values(books).reduce(
        (n, chapters) => n + Object.values(chapters).reduce((m, vs) => m + Object.keys(vs).length, 0),
        0
      )
      await writeAtomic(fileFor(id), JSON.stringify({ id, name: name || id, books }))
      const index = (await readIndex()).filter((t) => t.id !== id)
      index.push({ id, name: name || id, verses })
      index.sort((a, b) => a.id.localeCompare(b.id))
      await writeAtomic(indexFile, JSON.stringify(index))
      return { id, name: name || id, verses }
    },

    /** The whole translation { id, name, books }, or null. */
    async load(id) {
      if (!ID_PATTERN.test(String(id))) return null
      try {
        return JSON.parse(await fs.promises.readFile(fileFor(id), 'utf8'))
      } catch {
        return null
      }
    },

    async remove(id) {
      if (!ID_PATTERN.test(String(id))) return false
      await fs.promises.rm(fileFor(id), { force: true })
      await writeAtomic(indexFile, JSON.stringify((await readIndex()).filter((t) => t.id !== id)))
      return true
    }
  }
}

module.exports = { createBibleStore }
