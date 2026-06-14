import { icon } from './Icons.js'

export function createSongImporter(onImport) {
  // Create overlay
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0', left: '0', right: '0', bottom: '0',
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '1000'
  })

  // Create modal container
  const modal = document.createElement('div')
  modal.className = 'modal-content'
  Object.assign(modal.style, {
    backgroundColor: 'var(--bg-panel)',
    borderRadius: '8px',
    width: '600px',
    maxWidth: '90%',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
  })

  // Header
  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)'
  })

  const title = document.createElement('h3')
  title.textContent = 'Import Song'
  title.style.margin = '0'
  title.style.fontSize = '16px'

  // Ellipse menu container
  const menuContainer = document.createElement('div')
  menuContainer.style.position = 'relative'

  const menuBtn = document.createElement('button')
  menuBtn.className = 'btn btn--icon'
  menuBtn.innerHTML = icon('moreVertical', 16).outerHTML
  
  const dropdown = document.createElement('div')
  Object.assign(dropdown.style, {
    display: 'none',
    position: 'absolute',
    right: '0',
    top: '100%',
    backgroundColor: 'var(--bg-toolbar)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    padding: '4px 0',
    minWidth: '150px',
    zIndex: '10'
  })

  const templateOption = document.createElement('div')
  templateOption.className = 'dropdown-item'
  templateOption.textContent = 'Download Template'
  Object.assign(templateOption.style, {
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px'
  })
  
  templateOption.addEventListener('mouseenter', () => templateOption.style.backgroundColor = 'var(--bg-hover)')
  templateOption.addEventListener('mouseleave', () => templateOption.style.backgroundColor = 'transparent')

  templateOption.addEventListener('click', () => {
    dropdown.style.display = 'none'
    downloadTemplate()
  })

  dropdown.appendChild(templateOption)
  menuContainer.appendChild(menuBtn)
  menuContainer.appendChild(dropdown)

  menuBtn.addEventListener('click', () => {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none'
  })
  
  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!menuContainer.contains(e.target)) dropdown.style.display = 'none'
  })

  const closeBtn = document.createElement('button')
  closeBtn.className = 'btn btn--icon'
  closeBtn.innerHTML = icon('x', 16).outerHTML
  closeBtn.addEventListener('click', () => overlay.remove())

  const headerActions = document.createElement('div')
  headerActions.style.display = 'flex'
  headerActions.style.gap = '8px'
  headerActions.appendChild(menuContainer)
  headerActions.appendChild(closeBtn)

  header.appendChild(title)
  header.appendChild(headerActions)

  // Body
  const body = document.createElement('div')
  Object.assign(body.style, {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  })

  const inputsRow = document.createElement('div')
  inputsRow.style.display = 'flex'
  inputsRow.style.gap = '12px'

  const titleInput = document.createElement('input')
  titleInput.className = 'input'
  titleInput.placeholder = 'Song Title'
  titleInput.style.flex = '2'

  const categoryInput = document.createElement('input')
  categoryInput.className = 'input'
  categoryInput.placeholder = 'Category (e.g. Worship)'
  categoryInput.style.flex = '1'

  inputsRow.appendChild(titleInput)
  inputsRow.appendChild(categoryInput)

  const lyricsArea = document.createElement('textarea')
  lyricsArea.className = 'input'
  lyricsArea.placeholder = 'Paste lyrics here...\n\n[Verse 1]\n[C]Amazing grace how [F]sweet the [C]sound\nThat saved a wretch like me'
  Object.assign(lyricsArea.style, {
    height: '300px',
    resize: 'vertical',
    fontFamily: 'monospace'
  })

  body.appendChild(inputsRow)
  body.appendChild(lyricsArea)

  // Footer
  const footer = document.createElement('div')
  Object.assign(footer.style, {
    padding: '16px 20px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
  })

  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'btn'
  cancelBtn.textContent = 'Cancel'
  cancelBtn.addEventListener('click', () => overlay.remove())

  const importBtn = document.createElement('button')
  importBtn.className = 'btn btn--primary'
  importBtn.textContent = 'Import Song'
  
  importBtn.addEventListener('click', () => {
    const rawText = lyricsArea.value
    if (!rawText.trim() || !titleInput.value.trim()) {
      alert('Please enter a title and lyrics.')
      return
    }

    const slides = parseChordProToSlides(rawText)
    if (slides.length > 0) {
      onImport({
        name: titleInput.value.trim(),
        category: categoryInput.value.trim() || 'Worship',
        slides: slides
      })
      overlay.remove()
    } else {
      alert('Could not parse any slides.')
    }
  })

  footer.appendChild(cancelBtn)
  footer.appendChild(importBtn)

  modal.appendChild(header)
  modal.appendChild(body)
  modal.appendChild(footer)
  overlay.appendChild(modal)

  document.body.appendChild(overlay)
}

function parseChordProToSlides(text) {
  // Split text into blocks by blank lines or bracket headers like [Verse 1]
  const lines = text.split(/\r?\n/)
  const slides = []
  
  let currentGroup = 'Verse'
  let currentLabel = 'Verse 1'
  let currentTextLines = []

  const commitSlide = () => {
    if (currentTextLines.length > 0) {
      slides.push({
        id: 'slide-' + Math.random().toString(36).substr(2, 9),
        group: currentGroup.toLowerCase(),
        label: currentLabel,
        text: currentTextLines.join('\n')
      })
      currentTextLines = []
    }
  }

  lines.forEach(line => {
    const trimmed = line.trim()
    
    // Check for Section Header like [Chorus] or Verse 1:
    const headerMatch = trimmed.match(/^\[?(Verse|Chorus|Bridge|Pre-Chorus|Intro|Outro|Tag)(?:[\s:]+(.+))?\]?:?$/i)
    
    if (headerMatch) {
      // It's a new section header
      commitSlide()
      currentGroup = headerMatch[1]
      currentLabel = headerMatch[0].replace(/[[\]]/g, '') // remove brackets for label
    } else if (trimmed === '') {
      // Blank line means new slide within the same group
      commitSlide()
    } else {
      // Standard lyric/chord line
      currentTextLines.push(trimmed)
    }
  })

  // Commit last
  commitSlide()

  return slides
}

function downloadTemplate() {
  const template = `Title: Example Song
Category: Worship

[Verse 1]
[C]Amazing grace how [F]sweet the [C]sound
That saved a wretch like [G]me
I [C]once was lost, but [F]now am [C]found
Was blind but [G]now I [C]see

[Chorus]
My [F]chains are gone, I've [C]been set free
My [F]God, my Savior has [C]ransomed me
And [F]like a flood His [C]mercy reigns
Unending [G]love, amazing [C]grace
`
  const blob = new Blob([template], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'song_template.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
