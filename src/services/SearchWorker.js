/**
 * SearchWorker.js - Web Worker for offloading library search off the main thread.
 *
 * Protocol: receives { query, items: [{ id, searchText }] } where searchText is
 * pre-lowercased name + tags + slide labels/text. Returns { ids: [...] } of matches.
 * Sending a flat index instead of full presentation objects keeps the structured
 * clone cost per keystroke small even for large libraries.
 */

// Lowercase and drop accents so "cafe" finds "café" and "uber" finds "Über"
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

self.onmessage = function (e) {
  const { query, items } = e.data

  if (!query) {
    self.postMessage({ ids: items.map((i) => i.id) })
    return
  }

  const q = fold(query)
  const hits = items.filter((i) => fold(i.searchText).includes(q))
  // A song whose title matches comes before one that only has the word somewhere in its lyrics
  const inTitle = (i) => !!i.name && fold(i.name).includes(q)
  const ids = [...hits.filter(inTitle), ...hits.filter((i) => !inTitle(i))].map((i) => i.id)

  self.postMessage({ ids })
}
