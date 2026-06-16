import { state } from '../../engine/StateManager.js'
import { icon } from '../../components/common/Icons.js'

export function createBiblePanel(container) {
  container.className = 'bible-panel'
  container.style.display = 'none'
  container.style.flexDirection = 'column'
  container.style.height = '100%'
  container.style.background = 'var(--bg-panel)'

  container.innerHTML = `
    <div class="bible-header" style="padding: 15px; border-bottom: 1px solid var(--border-color); display: flex; gap: 10px; align-items: center;">
      <select id="bible-translation" class="input" style="width: 100px;">
        <option value="esv">ESV</option>
        <option value="niv">NIV</option>
      </select>
      <input type="text" id="bible-search" class="input input--search" placeholder="e.g. John 3:16" style="flex: 1;" />
      <button class="btn btn--primary" id="bible-search-btn">Search</button>
    </div>
    <div class="bible-results" id="bible-results" style="flex: 1; overflow-y: auto; padding: 15px;">
      <div style="color: #888; text-align: center; margin-top: 50px;">Enter a scripture reference to search</div>
    </div>
  `

  const searchBtn = container.querySelector('#bible-search-btn')
  const searchInput = container.querySelector('#bible-search')
  const translationSelect = container.querySelector('#bible-translation')
  const resultsDiv = container.querySelector('#bible-results')

  const performSearch = async () => {
    const query = searchInput.value.trim()
    if (!query) return

    const translation = translationSelect.value

    // Parse "Book Chap:Verse" (e.g. John 3:16 or just John 1)
    const match = query.match(/([a-zA-Z\s]+)\s+(\d+)(?::(\d+))?/)
    if (!match) {
      resultsDiv.innerHTML =
        '<div style="color: #d13438;">Invalid format. Use "Book Chapter[:Verse]" (e.g. John 3:16)</div>'
      return
    }

    let book = match[1].trim()
    // Capitalize book properly for our dummy data
    book = book.charAt(0).toUpperCase() + book.slice(1).toLowerCase()
    const chap = match[2]
    const verse = match[3] || '1'

    try {
      // eslint-disable-next-line no-undef
      const dataModule = await import(`../../data/bible-${translation}.json`, {
        assert: { type: 'json' }
      })
      const bibleData = dataModule.default || dataModule

      if (bibleData[book] && bibleData[book][chap] && bibleData[book][chap][verse]) {
        const text = bibleData[book][chap][verse]
        const displayRef = `${book} ${chap}${match[3] ? ':' + verse : ''} ${translation.toUpperCase()}`

        resultsDiv.innerHTML = `
          <div class="bible-verse" style="background: var(--bg-toolbar); padding: 15px; border-radius: 4px; margin-bottom: 10px;">
            <div style="font-weight: bold; margin-bottom: 5px; color: var(--accent-color);">${displayRef}</div>
            <div style="font-size: 16px;">${text}</div>
            <div style="margin-top: 10px; display: flex; gap: 10px;">
              <button class="btn btn--primary bible-send-btn" data-text="${text}" data-ref="${displayRef}">Send to Screen</button>
            </div>
          </div>
        `

        resultsDiv.querySelector('.bible-send-btn').addEventListener('click', (e) => {
          const verseText = e.target.dataset.text
          const ref = e.target.dataset.ref
          // Create an ad-hoc slide for the verse
          const slide = {
            id: 'bible-' + Date.now(),
            text: `${verseText}\n\n${ref}`,
            type: 'text'
          }

          const layers = { ...state.get('layers') }
          layers.slide = { active: true, content: slide }
          state.set('layers', layers)

          // Optionally send to stage display
          if (window.electronAPI && window.electronAPI.broadcastSlide) {
            window.electronAPI.broadcastSlide(slide)
          }
        })
      } else {
        resultsDiv.innerHTML =
          '<div style="color: #888;">Verse not found in dummy data. (Try Genesis 1:1 or John 3:16)</div>'
      }
    } catch (e) {
      console.error(e)
      resultsDiv.innerHTML = '<div style="color: #d13438;">Error loading bible data</div>'
    }
  }

  searchBtn.addEventListener('click', performSearch)
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch()
  })

  // Listen to view changes
  state.on('activeView', (view) => {
    if (view === 'bible') {
      container.style.display = 'flex'
    } else {
      container.style.display = 'none'
    }
  })

  return container
}
