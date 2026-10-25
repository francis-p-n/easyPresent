/**
 * songDb — the local SQLite chart store (one file in the user-data dir).
 *
 * Charts are stored as ChordPro text, a plain-text standard every chord tool
 * reads, so the database is portable: export() writes a self-contained .db
 * copy, import() merges another .db in (newest edit per song wins).
 *
 * Uses Node's built-in `node:sqlite` (bundled with Electron) — no native
 * module to rebuild per platform.
 */
const { DatabaseSync } = require('node:sqlite')

const SCHEMA_VERSION = 1

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS songs (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    category   TEXT NOT NULL DEFAULT 'Worship',
    song_key   TEXT,
    chordpro   TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`

const UPSERT = `
  INSERT INTO songs (id, title, category, song_key, chordpro, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, category = excluded.category, song_key = excluded.song_key,
    chordpro = excluded.chordpro, updated_at = excluded.updated_at
  WHERE excluded.updated_at >= songs.updated_at`

function toRow(song) {
  if (!song || !song.id || !song.title || typeof song.chordpro !== 'string') {
    throw new Error('Invalid song: id, title and chordpro are required')
  }
  return [
    String(song.id),
    String(song.title),
    song.category || 'Worship',
    song.key || null,
    String(song.chordpro),
    Number.isFinite(song.updatedAt) ? song.updatedAt : Date.now()
  ]
}

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  category: r.category,
  key: r.song_key,
  chordpro: r.chordpro,
  updatedAt: r.updated_at
})

function openSongDb(file) {
  const db = new DatabaseSync(file)
  db.exec(SCHEMA)
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)

  const inTransaction = (fn) => {
    db.exec('BEGIN')
    try {
      fn()
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }

  return {
    list: () => db.prepare('SELECT * FROM songs ORDER BY title COLLATE NOCASE').all().map(fromRow),

    count: () => db.prepare('SELECT COUNT(*) AS n FROM songs').get().n,

    /** Insert or update (an older copy never overwrites a newer one). */
    upsertMany(songs) {
      const stmt = db.prepare(UPSERT)
      inTransaction(() => songs.forEach((s) => stmt.run(...toRow(s))))
    },

    remove(ids) {
      const stmt = db.prepare('DELETE FROM songs WHERE id = ?')
      inTransaction(() => ids.forEach((id) => stmt.run(String(id))))
    },

    getMeta: (key) => db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null,
    setMeta: (key, value) =>
      db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value)),

    /** Write a consistent, standalone copy to `target` (must not exist). */
    exportTo(target) {
      db.prepare('VACUUM INTO ?').run(target)
    },

    /** Merge songs from another EasyPresent .db. Returns how many rows it held. */
    importFrom(source) {
      const other = new DatabaseSync(source, { readOnly: true })
      let rows
      try {
        const hasTable = other.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='songs'").get()
        if (!hasTable) throw new Error('Not an EasyPresent songs database')
        rows = other.prepare('SELECT * FROM songs').all().map(fromRow)
      } finally {
        other.close()
      }
      const stmt = db.prepare(UPSERT)
      inTransaction(() => rows.forEach((s) => stmt.run(...toRow(s))))
      return rows.length
    },

    close: () => db.close()
  }
}

module.exports = { openSongDb, SCHEMA_VERSION }
