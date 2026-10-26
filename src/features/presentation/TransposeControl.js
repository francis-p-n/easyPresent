import { keyOptions, describeShift, normalizeSemitones, transposeKey } from '../../songs/transpose.js'

/**
 * TransposeControl — the key changer in the song header.
 *
 *   [ − ]  [ Key: A ▾ ]  [ + ]  [ Original ]
 *
 * The song keeps its written chords; this only sets how many half steps they
 * are shown/printed/sent to the band above or below that. `onChange(semitones)`
 * receives the new total (-6..+5), 0 meaning the original key.
 */
export function createTransposeControl(presentation, onChange) {
  const shift = normalizeSemitones(presentation.transpose || 0)
  const wrap = document.createElement('span')
  wrap.id = 'transpose-controls'
  wrap.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;'

  const step = (id, glyph, title, delta) => {
    const b = document.createElement('button')
    b.className = 'btn btn--icon'
    b.id = id
    b.textContent = glyph
    b.title = title
    b.setAttribute('aria-label', title)
    b.style.cssText = 'min-width:28px;height:28px;padding:0;font-size:15px;'
    b.addEventListener('click', () => onChange(normalizeSemitones(shift + delta)))
    return b
  }

  wrap.appendChild(step('transpose-down', '−', 'Lower the key by a half step', -1))

  if (presentation.key) {
    // Known original key: pick the key the singer asked for by name
    const select = document.createElement('select')
    select.id = 'transpose-key'
    select.className = 'input'
    select.title = `Written in ${presentation.key}. Choose the key to play in.`
    select.setAttribute('aria-label', 'Key')
    select.style.cssText = 'height:28px;padding:0 4px;width:auto;'
    for (const { semitones, label } of keyOptions(presentation.key)) {
      const option = document.createElement('option')
      option.value = String(semitones)
      option.textContent = semitones === 0 ? `${label} (original)` : label
      option.selected = semitones === shift
      select.appendChild(option)
    }
    select.addEventListener('change', () => onChange(Number(select.value)))
    wrap.appendChild(select)
  } else {
    // No key on file: show how far from the written chords instead
    const label = document.createElement('span')
    label.id = 'transpose-shift'
    label.title = 'This song has no key on file, so the shift is shown in half steps'
    label.style.cssText = 'min-width:56px;text-align:center;'
    label.textContent = `Key ${describeShift(shift)}`
    wrap.appendChild(label)
  }

  wrap.appendChild(step('transpose-up', '+', 'Raise the key by a half step', 1))

  if (shift !== 0) {
    const reset = document.createElement('button')
    reset.className = 'btn'
    reset.id = 'transpose-reset'
    reset.textContent = presentation.key ? `Back to ${presentation.key}` : 'Original'
    reset.title = 'Go back to the written key'
    reset.style.cssText = 'height:28px;padding:0 8px;'
    reset.addEventListener('click', () => onChange(0))
    wrap.appendChild(reset)
  }

  // When a key is known, say what the chords are now (e.g. "Key of Bb")
  if (presentation.key && shift !== 0) wrap.title = `Playing in ${transposeKey(presentation.key, shift)}`
  return wrap
}
