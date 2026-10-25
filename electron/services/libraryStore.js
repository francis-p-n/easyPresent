/**
 * libraryStore — the on-disk library file plus rolling backups.
 *
 * Writes are atomic (temp file + rename) so a crash mid-save can never
 * corrupt the library, and loading falls back to the newest readable backup.
 */
const fs = require('fs')
const path = require('path')

const BACKUP_INTERVAL_MS = 10 * 60 * 1000 // snapshot at most every 10 min
const BACKUP_KEEP = 10

function createLibraryStore(userDataDir) {
  const target = path.join(userDataDir, 'library.json')
  const backupsDir = path.join(userDataDir, 'backups')

  async function listBackups() {
    try {
      const names = await fs.promises.readdir(backupsDir)
      return names
        .filter((n) => /^library-\d+\.json$/.test(n))
        .sort() // timestamp in name → lexicographic == chronological
        .map((n) => path.join(backupsDir, n))
    } catch {
      return []
    }
  }

  async function snapshot() {
    await fs.promises.mkdir(backupsDir, { recursive: true })
    await fs.promises.copyFile(target, path.join(backupsDir, `library-${Date.now()}.json`))
  }

  // Copies the current library into backups/ (rate-limited, pruned) before it
  // gets overwritten — the safety net for corruption and operator mistakes.
  async function rotateBackups() {
    let stat
    try {
      stat = await fs.promises.stat(target)
    } catch {
      return // nothing to back up yet
    }
    const backups = await listBackups()
    const last = backups[backups.length - 1]
    const lastTs = last ? parseInt(path.basename(last).match(/library-(\d+)/)[1], 10) : 0
    if (stat.mtimeMs - lastTs < BACKUP_INTERVAL_MS && backups.length > 0) return

    await snapshot()
    const all = await listBackups()
    for (const old of all.slice(0, Math.max(0, all.length - BACKUP_KEEP))) {
      await fs.promises.unlink(old).catch(() => {})
    }
  }

  async function writeAtomic(json) {
    const tmp = target + '.tmp'
    await fs.promises.writeFile(tmp, json, 'utf8')
    await fs.promises.rename(tmp, target)
  }

  return {
    async save(json) {
      await rotateBackups().catch((e) => console.error('Library backup failed:', e))
      await writeAtomic(json)
      return true
    },

    /** Library JSON, or null when there is none yet (renderer falls back to localStorage). */
    async load() {
      try {
        const json = await fs.promises.readFile(target, 'utf8')
        JSON.parse(json) // validate — a torn/corrupt file must not nuke the library
        return json
      } catch (err) {
        if (err.code === 'ENOENT') return null
        console.error('Library file unreadable, trying backups:', err.message)
        for (const backup of (await listBackups()).reverse()) {
          try {
            const json = await fs.promises.readFile(backup, 'utf8')
            JSON.parse(json)
            console.error(`Recovered library from backup: ${path.basename(backup)}`)
            return json
          } catch {
            /* try older backup */
          }
        }
        return null
      }
    },

    /** Replace the library with `json`, snapshotting whatever it replaces (ignores the rate limit). */
    async replace(json) {
      if (fs.existsSync(target)) await snapshot()
      await writeAtomic(json)
    }
  }
}

module.exports = { createLibraryStore }
