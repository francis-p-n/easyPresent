/**
 * libraryStore — the on-disk library file plus rolling backups.
 *
 * Writes are atomic (temp file + rename) so a crash mid-save can never
 * corrupt the library, and loading falls back to the newest readable backup.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const FILE_REF = 'ep-file:' // media entry stored as a file in media/: ep-file:<sha1>:<mime>
const PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000 // backups may still reference a file, so only old orphans go

const BACKUP_INTERVAL_MS = 10 * 60 * 1000 // snapshot at most every 10 min
const BACKUP_KEEP = 10

function createLibraryStore(userDataDir) {
  const target = path.join(userDataDir, 'library.json')
  const backupsDir = path.join(userDataDir, 'backups')
  const mediaDir = path.join(userDataDir, 'media')
  let recovery = null // set when load() had to work around a damaged library file

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

  /**
   * Moves the library's inline `data:` media out of the JSON into media/ as real
   * binary files (no base64 overhead, and the JSON — plus every backup of it —
   * stays small). The renderer never sees this: load() puts them back.
   */
  async function externalizeMedia(json) {
    let data
    try {
      data = JSON.parse(json)
    } catch {
      return json // not ours to judge; the caller's write decides
    }
    if (!data || typeof data.media !== 'object' || !data.media) return json
    const used = new Set()
    for (const [key, value] of Object.entries(data.media)) {
      const m = typeof value === 'string' && value.match(/^data:([^;,]+);base64,(.*)$/s)
      if (!m) continue
      const buf = Buffer.from(m[2], 'base64')
      const hash = crypto.createHash('sha1').update(buf).digest('hex')
      const file = path.join(mediaDir, hash)
      await fs.promises.mkdir(mediaDir, { recursive: true })
      if (!fs.existsSync(file)) {
        await fs.promises.writeFile(file + '.tmp', buf)
        await fs.promises.rename(file + '.tmp', file)
      }
      used.add(hash)
      data.media[key] = `${FILE_REF}${hash}:${m[1]}`
    }
    await pruneMedia(used)
    return JSON.stringify(data)
  }

  async function pruneMedia(used) {
    let names
    try {
      names = await fs.promises.readdir(mediaDir)
    } catch {
      return
    }
    for (const name of names) {
      if (used.has(name) || name.endsWith('.tmp')) continue
      try {
        const st = await fs.promises.stat(path.join(mediaDir, name))
        if (Date.now() - st.mtimeMs > PRUNE_AFTER_MS) await fs.promises.unlink(path.join(mediaDir, name))
      } catch {
        /* best effort */
      }
    }
  }

  /** Inverse of externalizeMedia(). A missing file leaves its reference in place, so a loss is visible rather than silent. */
  async function inflateMedia(json) {
    const data = JSON.parse(json)
    if (!data || typeof data.media !== 'object' || !data.media) return json
    let changed = false
    for (const [key, value] of Object.entries(data.media)) {
      if (typeof value !== 'string' || !value.startsWith(FILE_REF)) continue
      const [hash, mime] = value.slice(FILE_REF.length).split(':')
      if (!/^[0-9a-f]{40}$/.test(hash)) continue
      try {
        const buf = await fs.promises.readFile(path.join(mediaDir, hash))
        data.media[key] = `data:${mime};base64,${buf.toString('base64')}`
        changed = true
      } catch (e) {
        console.error(`Media file missing for ${key}:`, e.message)
      }
    }
    return changed ? JSON.stringify(data) : json
  }

  async function writeAtomic(json) {
    const tmp = target + '.tmp'
    await fs.promises.writeFile(tmp, json, 'utf8')
    await fs.promises.rename(tmp, target)
  }

  return {
    async save(json) {
      await rotateBackups().catch((e) => console.error('Library backup failed:', e))
      await writeAtomic(await externalizeMedia(json))
      return true
    },

    /** Library JSON, or null when there is none yet (renderer falls back to localStorage). */
    async load() {
      try {
        const raw = await fs.promises.readFile(target, 'utf8')
        JSON.parse(raw) // validate — a torn/corrupt file must not nuke the library
        return await inflateMedia(raw)
      } catch (err) {
        if (err.code === 'ENOENT') return null
        console.error('Library file unreadable, trying backups:', err.message)
        // The next save would overwrite the damaged file; keep it for manual recovery
        const corruptCopy = `${target}.corrupt-${Date.now()}`
        await fs.promises.copyFile(target, corruptCopy).catch(() => {})
        for (const backup of (await listBackups()).reverse()) {
          try {
            const json = await inflateMedia(await fs.promises.readFile(backup, 'utf8'))
            console.error(`Recovered library from backup: ${path.basename(backup)}`)
            recovery = { kind: 'backup', corruptCopy }
            return json
          } catch {
            /* try older backup */
          }
        }
        recovery = { kind: 'reset', corruptCopy }
        return null
      }
    },

    /** What load() had to do about a damaged file ({ kind: 'backup' | 'reset', corruptCopy }), once; then null. */
    takeRecovery() {
      const r = recovery
      recovery = null
      return r
    },

    /** Replace the library with `json`, snapshotting whatever it replaces (ignores the rate limit). */
    async replace(json) {
      if (fs.existsSync(target)) await snapshot()
      await writeAtomic(await externalizeMedia(json))
    }
  }
}

module.exports = { createLibraryStore }
