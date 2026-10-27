import { state } from '../../core/StateManager.js'
import { makeTransposer } from '../../songs/transpose.js'
import { lineSegments, sectionLabel, markContinuations } from '../../songs/chordLayout.js'

export function renderChordSheet(chordSheet) {
  chordSheet.innerHTML = ''
  const pres = state.get('selectedPresentation')
  if (!pres) return
  const transpose = makeTransposer(pres) // chords shown in the key the singer asked for

  markContinuations(pres.slides).forEach((slide) => {
    const block = document.createElement('div')
    block.style.marginBottom = '24px'

    if (slide.label) {
      const label = document.createElement('div')
      label.style.fontWeight = 'bold'
      label.style.color = 'var(--primary-color)'
      label.style.marginBottom = '12px'
      label.textContent = sectionLabel(slide)
      if (slide.cont) label.style.opacity = '0.65'
      block.appendChild(label)
    }

    if (slide.linesData && slide.linesData.length > 0) {
      slide.linesData.forEach((line) => {
        const lineDiv = document.createElement('div')
        lineDiv.style.marginBottom = '12px'
        lineDiv.style.position = 'relative'
        lineDiv.style.lineHeight = '1.4'

        if (line.chords && line.chords.length > 0) {
          // Each chord sits on top of the words it precedes: aligned in any font or script, unlike space padding
          lineDiv.style.display = 'flex'
          lineDiv.style.flexWrap = 'wrap'
          lineDiv.style.alignItems = 'flex-end'
          lineSegments(line, transpose).forEach((seg) => {
            const col = document.createElement('div')
            col.style.display = 'flex'
            col.style.flexDirection = 'column'
            const chordDiv = document.createElement('div')
            chordDiv.style.color = '#4ea8de' // blueish chords
            chordDiv.style.fontWeight = 'bold'
            chordDiv.style.minHeight = '1.2em'
            chordDiv.style.paddingRight = '0.5em' // neighbouring chords never run together
            chordDiv.style.whiteSpace = 'pre'
            chordDiv.textContent = seg.chord || ' '
            const wordsDiv = document.createElement('div')
            wordsDiv.style.whiteSpace = 'pre-wrap'
            wordsDiv.textContent = seg.text
            col.append(chordDiv, wordsDiv)
            lineDiv.appendChild(col)
          })
        } else {
          const textDiv = document.createElement('div')
          textDiv.style.whiteSpace = 'pre-wrap'
          textDiv.textContent = line.text || ' ' // keep space if empty
          lineDiv.appendChild(textDiv)
        }

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
