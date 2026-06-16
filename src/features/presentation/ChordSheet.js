import { state } from '../../engine/StateManager.js'

export function renderChordSheet(chordSheet) {
  chordSheet.innerHTML = ''
  const pres = state.get('selectedPresentation')
  if (!pres) return

  pres.slides.forEach((slide) => {
    const block = document.createElement('div')
    block.style.marginBottom = '24px'

    if (slide.label) {
      const label = document.createElement('div')
      label.style.fontWeight = 'bold'
      label.style.color = 'var(--primary-color)'
      label.style.marginBottom = '12px'
      label.textContent = slide.label
      block.appendChild(label)
    }

    if (slide.linesData && slide.linesData.length > 0) {
      slide.linesData.forEach((line) => {
        const lineDiv = document.createElement('div')
        lineDiv.style.marginBottom = '12px'
        lineDiv.style.position = 'relative'
        lineDiv.style.lineHeight = '1.4'

        if (line.chords && line.chords.length > 0) {
          const chordsDiv = document.createElement('div')
          chordsDiv.style.color = '#4ea8de' // blueish chords
          chordsDiv.style.fontWeight = 'bold'
          chordsDiv.style.height = '1.2em'
          chordsDiv.style.whiteSpace = 'pre'

          // Build chord line with spaces
          let chordLine = ''
          let lastPos = 0
          line.chords.forEach((c) => {
            const spaces = Math.max(0, c.pos - lastPos)
            chordLine += ' '.repeat(spaces) + c.chord
            lastPos = c.pos + c.chord.length
          })
          chordsDiv.textContent = chordLine
          lineDiv.appendChild(chordsDiv)
        }

        const textDiv = document.createElement('div')
        textDiv.style.whiteSpace = 'pre'
        textDiv.textContent = line.text || ' ' // keep space if empty
        lineDiv.appendChild(textDiv)

        block.appendChild(lineDiv)
      })
    } else {
      // Fallback for presentations without linesData
      const textDiv = document.createElement('div')
      textDiv.style.whiteSpace = 'pre-wrap'
      textDiv.textContent = slide.text
      block.appendChild(textDiv)
    }

    chordSheet.appendChild(block)
  })
}
