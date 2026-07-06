import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { state } from '../../engine/StateManager.js'
import { arrangementEditor } from './ArrangementEditor.js'
import { MASTER_ARRANGEMENT_ID } from '../../engine/arrangement.js'

const makePres = () => ({
  id: 'pres-1',
  name: 'Test Song',
  slides: [
    { id: 's1', label: 'Verse 1', text: 'v1' },
    { id: 's2', label: 'Chorus', text: 'c' },
    { id: 's3', label: 'Verse 2', text: 'v2' },
    { id: 's4', label: 'Bridge', text: 'b' }
  ]
})

beforeEach(() => {
  const pres = makePres()
  state.set('presentations', [pres])
  state.set('selectedPresentation', pres)
})

afterEach(() => {
  arrangementEditor.close()
})

const panel = () => document.getElementById('arrangement-editor-panel')
const sequenceRows = () => [...panel().querySelectorAll('#arr-sequence > div')]
const availableButtons = () => [...panel().querySelectorAll('#arr-available button')]

describe('ArrangementEditor — opening', () => {
  it('renders Master as the only tab and a read-only note when no custom arrangement exists', () => {
    arrangementEditor.open('pres-1')
    const tabs = [...panel().querySelectorAll('#arr-tabs button')]
    // Master tab + the "new arrangement" (+) button
    expect(tabs.some((b) => b.textContent === 'Master')).toBe(true)
    expect(panel().querySelector('#arr-sequence').textContent).toContain('Master reflects your slide order')
  })

  it('lists every master slide in Add Slide', () => {
    arrangementEditor.open('pres-1')
    expect(availableButtons()).toHaveLength(4)
    expect(availableButtons().map((b) => b.textContent)).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Bridge'])
  })

  it('does nothing for an unknown presentation id', () => {
    arrangementEditor.open('does-not-exist')
    expect(document.getElementById('arrangement-editor-overlay')).toBeNull()
  })
})

describe('ArrangementEditor — building a custom arrangement', () => {
  it('creating a new arrangement switches to it and shows an empty sequence', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('[title="New arrangement"]').click()
    expect(sequenceRows().some((r) => r.textContent.includes('Empty'))).toBe(true)
  })

  it('clicking an available slide appends it to the sequence, supporting repeats', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('[title="New arrangement"]').click()

    availableButtons()[1].click() // Chorus
    availableButtons()[0].click() // Verse 1
    availableButtons()[1].click() // Chorus again — repeat

    const rows = sequenceRows()
    expect(rows).toHaveLength(3)
    expect(rows[0].textContent).toContain('Chorus')
    expect(rows[1].textContent).toContain('Verse 1')
    expect(rows[2].textContent).toContain('Chorus')
  })

  it('remove (x) deletes only that occurrence', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('[title="New arrangement"]').click()
    availableButtons()[0].click() // Verse 1
    availableButtons()[1].click() // Chorus
    availableButtons()[0].click() // Verse 1 again

    sequenceRows()[1].querySelector('[title="Remove"]').click() // remove the Chorus in the middle

    const rows = sequenceRows()
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Verse 1')
    expect(rows[1].textContent).toContain('Verse 1')
  })

  it('reorders with the up/down chevrons', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('[title="New arrangement"]').click()
    availableButtons()[0].click() // Verse 1
    availableButtons()[1].click() // Chorus

    sequenceRows()[1].querySelector('[title="Move up"]').click()

    const rows = sequenceRows()
    expect(rows[0].textContent).toContain('Chorus')
    expect(rows[1].textContent).toContain('Verse 1')
  })

  it('move up at index 0 / move down at the last index are no-ops', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('[title="New arrangement"]').click()
    availableButtons()[0].click()
    availableButtons()[1].click()

    sequenceRows()[0].querySelector('[title="Move up"]').click()
    expect(sequenceRows()[0].textContent).toContain('Verse 1') // unchanged

    sequenceRows()[1].querySelector('[title="Move down"]').click()
    expect(sequenceRows()[1].textContent).toContain('Chorus') // unchanged
  })

  it('Master cannot be edited (no add/remove/reorder controls)', () => {
    arrangementEditor.open('pres-1')
    // Master tab is already active on open
    expect(panel().querySelectorAll('#arr-sequence [title="Remove"]')).toHaveLength(0)
  })
})

describe('ArrangementEditor — managing arrangements', () => {
  it('renames the active custom arrangement', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('[title="New arrangement"]').click()
    panel().querySelector('[title="Rename"]').click()

    const input = panel().querySelector('#arr-tabs input')
    input.value = 'Radio Edit'
    input.blur()

    const tabs = [...panel().querySelectorAll('#arr-tabs button')]
    expect(tabs.some((b) => b.textContent === 'Radio Edit')).toBe(true)
  })

  it('deleting the active custom arrangement falls back to Master', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('[title="New arrangement"]').click()
    panel().querySelector('[title="Delete arrangement"]').click()

    expect(panel().querySelector('#arr-sequence').textContent).toContain('Master reflects your slide order')
  })

  it('Master has no rename/delete controls', () => {
    arrangementEditor.open('pres-1')
    expect(panel().querySelector('[title="Rename"]')).toBeNull()
    expect(panel().querySelector('[title="Delete arrangement"]')).toBeNull()
  })
})

describe('ArrangementEditor — save/cancel', () => {
  it('Save writes the arrangement and active id back to the presentation, stripping Master out of storage', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('[title="New arrangement"]').click()
    availableButtons()[1].click() // Chorus
    availableButtons()[0].click() // Verse 1
    availableButtons()[1].click() // Chorus repeat

    panel().querySelector('#arr-save').click()

    const saved = state.get('presentations').find((p) => p.id === 'pres-1')
    expect(saved.arrangements).toHaveLength(1)
    expect(saved.arrangements[0].sequence).toEqual(['s2', 's1', 's2'])
    expect(saved.activeArrangementId).toBe(saved.arrangements[0].id)
    expect(saved.arrangements.some((a) => a.id === MASTER_ARRANGEMENT_ID)).toBe(false)

    // selectedPresentation is refreshed too, since it was the edited one
    expect(state.get('selectedPresentation').arrangements).toHaveLength(1)
  })

  it('closes the overlay after saving', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('#arr-save').click()
    expect(document.getElementById('arrangement-editor-overlay')).toBeNull()
  })

  it('Cancel discards edits — nothing is persisted', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('[title="New arrangement"]').click()
    availableButtons()[0].click()

    panel().querySelector('#arr-cancel').click()

    const saved = state.get('presentations').find((p) => p.id === 'pres-1')
    expect(saved.arrangements).toBeUndefined()
    expect(document.getElementById('arrangement-editor-overlay')).toBeNull()
  })

  it('the close (×) button also discards edits', () => {
    arrangementEditor.open('pres-1')
    panel().querySelector('[title="New arrangement"]').click()
    panel().querySelector('#arr-close').click()

    const saved = state.get('presentations').find((p) => p.id === 'pres-1')
    expect(saved.arrangements).toBeUndefined()
  })
})
