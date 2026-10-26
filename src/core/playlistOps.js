/**
 * playlistOps — pure operations on setlists.
 *
 * Every function returns new objects and never mutates its input, so callers
 * can hand the result straight to state.set().
 *
 * A playlist is { id, name, items }; an item is one of
 *   { type: 'presentation', id } | { type: 'header', text } | { type: 'note', text }
 */

const newId = () => `pl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function createPlaylist(name) {
  return { id: newId(), name: name.trim(), items: [] }
}

export function renamePlaylist(playlist, name) {
  return { ...playlist, name: name.trim() }
}

/** A copy with a new id and a "(copy)" name — the starting point for next week's setlist. */
export function duplicatePlaylist(playlist, name = `${playlist.name} (copy)`) {
  return { id: newId(), name, items: playlist.items.map((item) => ({ ...item })) }
}

/** Removes a playlist; returns the remaining list and the playlist to show next (or null). */
export function deletePlaylist(playlists, id) {
  const index = playlists.findIndex((p) => p.id === id)
  const remaining = playlists.filter((p) => p.id !== id)
  const next = remaining[Math.min(Math.max(index, 0), remaining.length - 1)] || null
  return { playlists: remaining, next }
}

export function addItem(playlist, item, at = playlist.items.length) {
  const items = [...playlist.items]
  items.splice(Math.min(Math.max(at, 0), items.length), 0, item)
  return { ...playlist, items }
}

export function removeItem(playlist, index) {
  if (index < 0 || index >= playlist.items.length) return playlist
  return { ...playlist, items: playlist.items.filter((_, i) => i !== index) }
}

/** Moves the item at `index` one place up (-1) or down (+1); out-of-range moves are a no-op. */
export function moveItem(playlist, index, direction) {
  const to = index + direction
  if (index < 0 || index >= playlist.items.length || to < 0 || to >= playlist.items.length) return playlist
  const items = [...playlist.items]
  ;[items[index], items[to]] = [items[to], items[index]]
  return { ...playlist, items }
}

/** Replaces a playlist inside a list by id. */
export function replacePlaylist(playlists, updated) {
  return playlists.map((p) => (p.id === updated.id ? updated : p))
}
