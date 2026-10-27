import { state } from '../../core/StateManager.js'
import { goLive } from '../../core/navigation.js'
import { showToast } from '../../components/common/ToastManager.js'
import { parseReference, lookupPassage, buildScriptureSlides } from '../../bible/reference.js'
import { parseBibleFile } from '../../bible/importers.js'

const LAST_TRANSLATION_KEY = 'easypresent_bible_translation'
const SEARCH_DELAY_MS = 250
const SCRIPTURE_ID = 'scripture-live' // one reusable presentation: each "Send to Screen" replaces its slides

const readPref = () => {
  try {
    return localStorage.getItem(LAST_TRANSLATION_KEY)
  } catch {
    return null
  }
}
const writePref = (id) => {
  try {
    localStorage.setItem(LAST_TRANSLATION_KEY, id)
  } catch {
    /* private mode: just forget the choice */
  }
}

/** "NIV.txt" -> "NIV" : a starting point for the abbreviation field. */
const abbreviationFrom = (filename) =>
  filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, 16)

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag)
  const { style, text, ...rest } = props
  if (style) node.style.cssText = style
  if (text !== undefined) node.textContent = text
  Object.assign(node, rest)
  for (const child of children) node.append(child)
  return node
}

/**
 * BiblePanel — look up scripture and put it on the screen.
 *
 * No Bible text ships with the app. The operator adds translations (NRSV-CE, NIV, ...)
 * from files they are licensed to use; they are stored on this computer.
 */
export function createBiblePanel(container) {
  container.className = 'bible-panel'
  container.style.display = 'none'
  container.style.flexDirection = 'column'
  container.style.height = '100%'
  container.style.background = 'var(--bg-panel)'

  const select = el('select', { id: 'bible-translation', className: 'input', style: 'width:130px;' })
  select.setAttribute('aria-label', 'Bible translation')
  const addBtn = el('button', { id: 'bible-add-btn', className: 'btn', text: 'Add Bible…', title: 'Add a translation from a file you are licensed to use' })
  const removeBtn = el('button', { id: 'bible-remove-btn', className: 'btn', text: 'Remove', title: 'Remove the selected translation from this computer' })
  const input = el('input', {
    id: 'bible-search',
    type: 'text',
    className: 'input input--search',
    placeholder: 'e.g. John 3:16-18, Ps 23, 1 Cor 13',
    style: 'flex:1;'
  })
  input.setAttribute('aria-label', 'Scripture reference')
  const searchBtn = el('button', { id: 'bible-search-btn', className: 'btn btn--primary', text: 'Look up' })
  const results = el('div', { id: 'bible-results', style: 'flex:1;overflow-y:auto;padding:15px;' })

  const header = el('div', { style: 'padding:15px;border-bottom:1px solid var(--border-color);display:flex;gap:10px;align-items:center;flex-wrap:wrap;' }, [
    select,
    input,
    searchBtn,
    addBtn,
    removeBtn
  ])
  const hint = el('div', {
    id: 'bible-hint',
    style: 'padding:6px 15px;font-size:11px;color:var(--text-secondary);border-bottom:1px solid var(--border-color);',
    text: 'Type a reference to look it up. Press Enter to put it on the screen, then use the arrow keys to move between verses.'
  })
  container.append(header, hint, results)

  let translations = [] // [{ id, name, verses }]
  const loaded = new Map() // id -> full translation, loaded on first use
  let current = null // { passage, translationId, query }

  const message = (text, color = 'var(--text-secondary)') => {
    results.textContent = ''
    results.append(el('div', { style: `color:${color};text-align:center;margin-top:50px;line-height:1.6;`, text }))
  }

  // ---- translations ----------------------------------------------------

  async function refreshTranslations(selectId) {
    translations = (await window.electronAPI?.bibleList?.()) || []
    select.textContent = ''
    for (const t of translations) {
      const option = el('option', { value: t.id, text: t.id, title: t.name })
      select.append(option)
    }
    const wanted = selectId || readPref()
    if (wanted && translations.some((t) => t.id === wanted)) select.value = wanted
    const none = translations.length === 0
    select.disabled = none
    removeBtn.disabled = none
    searchBtn.disabled = none
    if (none) {
      current = null
      message(
        'No Bible added yet.\nUse "Add Bible…" and choose a file of a translation you are licensed to use (for example NRSV-CE or NIV).',
        'var(--text-secondary)'
      )
    } else if (!current) {
      message('Enter a scripture reference above.')
    }
  }

  async function translation() {
    const id = select.value
    if (!id) return null
    if (!loaded.has(id)) loaded.set(id, await window.electronAPI.bibleLoad(id))
    return loaded.get(id)
  }

  async function addBible() {
    if (!window.electronAPI?.biblePickFile) return showToast('Adding a Bible needs the desktop app', 'error')
    const file = await window.electronAPI.biblePickFile()
    if (!file) return
    let parsed
    try {
      parsed = parseBibleFile(file.text, file.filename)
    } catch (err) {
      return showToast(err.message, 'error')
    }
    askNameThenSave(file.filename, parsed)
  }

  function askNameThenSave(filename, parsed) {
    document.getElementById('bible-add-overlay')?.remove()
    const overlay = el('div', {
      id: 'bible-add-overlay',
      style: 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;'
    })
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    const abbreviation = el('input', { className: 'input', value: abbreviationFrom(filename), placeholder: 'Abbreviation, e.g. NIV' })
    abbreviation.setAttribute('aria-label', 'Abbreviation')
    const fullName = el('input', { className: 'input', placeholder: 'Full name (optional), e.g. New Revised Standard Version, Catholic Edition' })
    fullName.setAttribute('aria-label', 'Full name')
    const close = () => overlay.remove()
    const save = async () => {
      const id = abbreviation.value.trim()
      try {
        const saved = await window.electronAPI.bibleSave({ id, name: fullName.value.trim() || id, books: parsed.books })
        loaded.delete(id)
        close()
        current = null
        await refreshTranslations(id)
        showToast(`Added ${saved.id}: ${saved.verses.toLocaleString()} verses`, 'success')
      } catch (err) {
        showToast(String(err.message).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'error')
      }
    }
    const box = el('div', { style: 'background:var(--bg-panel);border-radius:10px;padding:20px;width:420px;max-width:90vw;border:1px solid var(--border-color);display:flex;flex-direction:column;gap:12px;' }, [
      el('h3', { style: 'margin:0;font-size:14px;color:var(--text-primary);', text: 'Add this Bible' }),
      el('div', { style: 'font-size:12px;color:var(--text-secondary);', text: `${filename}: ${parsed.verseCount.toLocaleString()} verses in ${parsed.bookCount} books.` }),
      abbreviation,
      fullName,
      el('div', { style: 'font-size:11px;color:var(--text-secondary);', text: 'Adding a translation with an abbreviation you already have replaces it.' }),
      el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;' }, [
        el('button', { className: 'btn', text: 'Cancel', onclick: close }),
        el('button', { className: 'btn btn--primary', text: 'Add', onclick: save })
      ])
    ])
    overlay.append(box)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close()
    })
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close()
      if (e.key === 'Enter') save()
    })
    document.body.append(overlay)
    abbreviation.focus()
    abbreviation.select()
  }

  async function removeBible() {
    const id = select.value
    if (!id) return
    if (!window.confirm(`Remove ${id} from this computer? You can add it again from its file.`)) return
    await window.electronAPI.bibleRemove(id)
    loaded.delete(id)
    current = null
    await refreshTranslations()
  }

  // ---- look up and send ------------------------------------------------

  async function lookUp() {
    const query = input.value.trim()
    if (!query) {
      current = null
      return message('Enter a scripture reference above.')
    }
    const ref = parseReference(query)
    if (ref.error) {
      current = null
      return message(ref.error, 'var(--accent-red, #d13438)')
    }
    const bible = await translation()
    if (!bible) return message('Add a Bible first.')
    const passage = lookupPassage(bible, ref)
    if (passage.error) {
      current = null
      return message(passage.error, 'var(--accent-red, #d13438)')
    }
    current = { passage, translationId: bible.id, query }
    render()
  }

  function render() {
    const { passage, translationId } = current
    results.textContent = ''
    const sendAll = el('button', { className: 'btn btn--primary', id: 'bible-send-btn', text: 'Send to Screen' })
    sendAll.addEventListener('click', () => send(0))
    const card = el('div', { className: 'bible-verse', style: 'background:var(--bg-toolbar);padding:15px;border-radius:4px;' }, [
      el('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:10px;' }, [
        el('div', { style: 'font-weight:bold;color:var(--accent-color);flex:1;', text: `${passage.reference} ${translationId}` }),
        sendAll
      ])
    ])
    passage.verses.forEach((v, i) => {
      const row = el('div', { className: 'bible-verse-row', style: 'display:flex;gap:8px;padding:6px 4px;font-size:16px;line-height:1.5;cursor:pointer;border-radius:4px;' }, [
        el('span', { style: 'min-width:28px;color:var(--text-secondary);font-size:12px;padding-top:3px;', text: String(v.number) }),
        el('span', { text: v.text })
      ])
      row.title = 'Start on the screen from this verse'
      row.addEventListener('click', () => send(i))
      card.append(row)
    })
    results.append(card)
  }

  /** One slide per verse, taken live from verse `from`; the arrow keys then walk the passage. */
  function send(from) {
    if (!current) return
    const { passage, translationId } = current
    const slides = buildScriptureSlides(passage, translationId)
    const presentation = {
      id: SCRIPTURE_ID,
      name: `${passage.reference} ${translationId}`,
      category: 'Scripture',
      slides
    }
    const others = (state.get('presentations') || []).filter((p) => p.id !== SCRIPTURE_ID)
    state.set('presentations', [...others, presentation])
    state.set('selectedPresentation', presentation)
    goLive(from)
    const button = results.querySelector('#bible-send-btn')
    if (button) {
      button.textContent = slides.length > 1 ? `On screen: ${slides.length} verses, use ← →` : 'On screen'
    }
  }

  // ---- events ------------------------------------------------------------

  let timer = null
  input.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(lookUp, SEARCH_DELAY_MS) // results appear as you type
  })
  input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    clearTimeout(timer)
    // Enter looks the reference up; Enter again, with the same text, puts it on the screen
    if (current && current.query === input.value.trim() && current.translationId === select.value) send(0)
    else await lookUp()
  })
  searchBtn.addEventListener('click', lookUp)
  select.addEventListener('change', () => {
    writePref(select.value)
    current = null
    lookUp()
  })
  addBtn.addEventListener('click', addBible)
  removeBtn.addEventListener('click', removeBible)

  state.on('activeView', (view) => {
    container.style.display = view === 'bible' ? 'flex' : 'none'
    if (view === 'bible') refreshTranslations()
  })

  message('Enter a scripture reference above.')
  refreshTranslations()
  return container
}
