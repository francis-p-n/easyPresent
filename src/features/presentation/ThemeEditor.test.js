import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { state } from '../../engine/StateManager.js'
import { createThemeEditor } from './ThemeEditor.js'

const baseThemes = () => [
  { id: 'default', name: 'Worship Lyrics', styles: { fontFamily: 'Inter', fontSize: '64px', color: '#ffffff', backgroundColor: '#000000' } },
  { id: 'sermon', name: 'Sermon Notes', styles: { fontFamily: 'Open Sans', fontSize: '56px', color: '#eeeeee', backgroundColor: '#111111' } }
]

beforeEach(() => {
  state.set('themes', baseThemes())
  state.set('activeThemeId', 'default')
})

afterEach(() => {
  document.getElementById('theme-editor-overlay')?.remove()
})

const overlay = () => document.getElementById('theme-editor-overlay')

describe('ThemeEditor — opening', () => {
  it('lists every theme and preselects the active one', () => {
    createThemeEditor()
    const select = overlay().querySelector('#theme-editor-select')
    expect([...select.options].map((o) => o.value)).toEqual(['default', 'sermon'])
    expect(select.value).toBe('default')
  })

  it('seeds the color/font inputs from the active theme', () => {
    createThemeEditor()
    expect(overlay().querySelector('#theme-editor-bg-color').value).toBe('#000000')
    expect(overlay().querySelector('#theme-editor-text-color').value).toBe('#ffffff')
    expect(overlay().querySelector('#theme-editor-font-select').value).toBe('Inter')
  })

  it('switching the theme dropdown reseeds the inputs from the newly selected theme', () => {
    createThemeEditor()
    const select = overlay().querySelector('#theme-editor-select')
    select.value = 'sermon'
    select.dispatchEvent(new window.Event('change'))

    expect(overlay().querySelector('#theme-editor-bg-color').value).toBe('#111111')
    expect(overlay().querySelector('#theme-editor-font-select').value).toBe('Open Sans')
  })
})

describe('ThemeEditor — Apply (regression: editing the active theme in place)', () => {
  it('writes font/color changes back into the theme object', () => {
    createThemeEditor()
    overlay().querySelector('#theme-editor-font-select').value = 'Georgia'
    overlay().querySelector('#theme-editor-text-color').value = '#ff0000'
    overlay().querySelector('#theme-editor-apply').click()

    const saved = state.get('themes').find((t) => t.id === 'default')
    expect(saved.styles.fontFamily).toBe('Georgia')
    expect(saved.styles.color).toBe('#ff0000')
  })

  it('fires activeThemeId even when the edited theme was already active (this is what SlideView/PreviewPanel react to)', () => {
    createThemeEditor()
    let fired = false
    const unsub = state.on('activeThemeId', () => { fired = true })

    overlay().querySelector('#theme-editor-font-select').value = 'Georgia'
    overlay().querySelector('#theme-editor-apply').click()

    expect(fired).toBe(true)
    unsub()
  })

  it('fires themes with content that actually reflects the edit (not just the same reference)', () => {
    createThemeEditor()
    let latestThemes = null
    const unsub = state.on('themes', (themes) => { latestThemes = themes })

    overlay().querySelector('#theme-editor-font-select').value = 'Georgia'
    overlay().querySelector('#theme-editor-apply').click()

    expect(latestThemes.find((t) => t.id === 'default').styles.fontFamily).toBe('Georgia')
    unsub()
  })

  it('closes the overlay after applying', () => {
    createThemeEditor()
    overlay().querySelector('#theme-editor-apply').click()
    expect(document.getElementById('theme-editor-overlay')).toBeNull()
  })
})

describe('ThemeEditor — closing without applying', () => {
  it('the × button closes without persisting changes', () => {
    createThemeEditor()
    overlay().querySelector('#theme-editor-font-select').value = 'Georgia'
    overlay().querySelector('.btn--icon').click() // close (x) button

    expect(document.getElementById('theme-editor-overlay')).toBeNull()
    expect(state.get('themes').find((t) => t.id === 'default').styles.fontFamily).toBe('Inter')
  })
})
