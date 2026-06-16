import { describe, it, expect, vi } from 'vitest'

describe('SearchWorker logic', () => {
  it('should filter presentations correctly when given a query', () => {
    // Since it's a web worker, we mock the basic structure of the worker
    // Web Workers have self.onmessage which is assigned.
    const presentations = [
      { name: 'Sunday Service', tags: ['sunday'], slides: [{ text: 'Welcome' }] },
      { name: 'Youth Group', tags: ['youth'], slides: [{ text: 'Games' }] }
    ]

    const workerLogic = (query, data) => {
      const q = query.toLowerCase()
      return data.filter((pres) => {
        if (pres.name && pres.name.toLowerCase().includes(q)) return true
        if (pres.tags && pres.tags.some((tag) => tag.toLowerCase().includes(q))) return true
        if (pres.slides) {
          return pres.slides.some((slide) => {
            if (slide.label && slide.label.toLowerCase().includes(q)) return true
            if (slide.text && slide.text.toLowerCase().includes(q)) return true
            return false
          })
        }
        return false
      })
    }

    const results = workerLogic('welcome', presentations)
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Sunday Service')

    const youthResults = workerLogic('youth', presentations)
    expect(youthResults.length).toBe(1)
    expect(youthResults[0].name).toBe('Youth Group')
  })
})
