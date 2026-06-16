/**
 * SearchWorker.js - Web Worker for offloading heavy library search and filtering computations
 */

self.onmessage = function (e) {
  const { query, presentations } = e.data

  if (!query) {
    self.postMessage({ results: presentations })
    return
  }

  const q = query.toLowerCase()

  // Perform fuzzy search or exact match depending on needs
  // For now, doing a comprehensive text search across all slides and titles
  const results = presentations.filter((pres) => {
    // Check title
    if (pres.name && pres.name.toLowerCase().includes(q)) return true

    // Check tags
    if (pres.tags && pres.tags.some((tag) => tag.toLowerCase().includes(q))) return true

    // Check slide content
    if (pres.slides) {
      return pres.slides.some((slide) => {
        if (slide.label && slide.label.toLowerCase().includes(q)) return true
        if (slide.text && slide.text.toLowerCase().includes(q)) return true
        return false
      })
    }

    return false
  })

  self.postMessage({ results })
}
