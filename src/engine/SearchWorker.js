/**
 * SearchWorker.js - Web Worker for offloading library search off the main thread.
 *
 * Protocol: receives { query, items: [{ id, searchText }] } where searchText is
 * pre-lowercased name + tags + slide labels/text. Returns { ids: [...] } of matches.
 * Sending a flat index instead of full presentation objects keeps the structured
 * clone cost per keystroke small even for large libraries.
 */

self.onmessage = function (e) {
  const { query, items } = e.data

  if (!query) {
    self.postMessage({ ids: items.map((i) => i.id) })
    return
  }

  const q = query.toLowerCase()
  const ids = items.filter((i) => i.searchText.includes(q)).map((i) => i.id)

  self.postMessage({ ids })
}
