import { describe, it, expect, afterEach, vi } from 'vitest'

const toasts = []
vi.mock('../../components/common/ToastManager.js', () => ({ showToast: (message, type) => toasts.push({ message, type }) }))

const { createSongImporter } = await import('./SongImporter.js')
import { withoutChordOnlySlides, parseChordProSong } from '../../songs/chordpro.js'

// A chord chart in the form chord websites paste: chords above the words, an intro, a tag and an instrumental.
// The words are written for this test.
const CHART = `[Intro]
Em G C G   Em G C G

[Verse 1]
Em          G
Walk beside me in the morning
C        G
Light the road ahead

[Instrumental]
Em G C G

[Chorus]
Em         C
Sing it out together
G           D
Sing it out again

[Tag (x3)]
Em G C G
C D G`

let imported
const open = () => {
  imported = null
  createSongImporter((song) => (imported = song))
  const dialog = document.querySelector('.modal-overlay')
  return {
    dialog,
    paste: (text) => {
      dialog.querySelector('textarea').value = text
    },
    title: (text) => {
      dialog.querySelector('input').value = text
    },
    importNow: () => [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Import Song').click()
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  toasts.length = 0
})

describe('importing a chart with an intro, a tag and an instrumental', () => {
  it('makes slides only for the parts with words', () => {
    const ui = open()
    ui.title('Test Song')
    ui.paste(CHART)
    ui.importNow()
    expect(imported).not.toBeNull()
    expect(imported.slides.map((s) => s.label)).toEqual(['Verse 1', 'Chorus'])
    expect(imported.slides.every((s) => s.text.trim() !== '')).toBe(true)
    expect(imported.slides[0].text).toContain('Walk beside me in the morning')
  })

  it('says what it left out', () => {
    const ui = open()
    ui.title('Test Song')
    ui.paste(CHART)
    ui.importNow()
    const toast = toasts.map((t) => t.message).join(' ')
    expect(toast).toContain('Intro')
    expect(toast).toContain('Instrumental')
    expect(toast).toContain('Tag (x3)')
  })

  it('a chart that is only chords is refused with a clear reason', () => {
    const ui = open()
    ui.title('Chords Only')
    ui.paste('[Intro]\n[Em] [G] [C]\n\n[Tag]\n[C] [D] [G]')
    ui.importNow()
    expect(imported).toBeNull()
    expect(toasts.map((t) => t.message).join(' ')).toContain('chords but no words')
  })

  it('a chart with no such parts imports as before', () => {
    const ui = open()
    ui.title('Plain')
    ui.paste('[Verse 1]\nEm          G\nWalk beside me in the morning\n')
    ui.importNow()
    expect(imported.slides.map((s) => s.label)).toEqual(['Verse 1'])
  })
})

describe('withoutChordOnlySlides', () => {
  it('drops slides with no words and reports their labels', () => {
    const { slides } = parseChordProSong('[Intro]\n[Em] [G] [C]\n\n[Verse 1]\n[Em]Walk beside me\n\n[Outro]\n[G] [C]')
    const result = withoutChordOnlySlides(slides)
    expect(result.slides.map((s) => s.label)).toEqual(['Verse 1'])
    expect(result.leftOut).toEqual(['Intro', 'Outro'])
  })

  it('keeps a section that was split in two as two slides of one section', () => {
    const lines = Array.from({ length: 6 }, (_, i) => `[G]Line number ${i + 1}`).join('\n')
    const { slides } = parseChordProSong(`[Verse 1]\n${lines}`, 4)
    expect(slides).toHaveLength(2)
    const result = withoutChordOnlySlides(slides)
    expect(result.slides).toHaveLength(2)
    expect(result.leftOut).toEqual([])
  })

  it('copes with nothing', () => {
    expect(withoutChordOnlySlides(undefined)).toEqual({ slides: [], leftOut: [] })
  })
})
