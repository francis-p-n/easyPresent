import { state } from '../../engine/StateManager.js'
import { icon } from '../../components/common/Icons.js'

export function createThemeEditor() {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '1000'
  })

  const modal = document.createElement('div')
  modal.className = 'modal-content'
  Object.assign(modal.style, {
    backgroundColor: 'var(--bg-panel)',
    borderRadius: '8px',
    width: '400px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
  })

  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)'
  })

  const title = document.createElement('h3')
  title.textContent = 'Theme Editor'
  title.style.margin = '0'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'btn btn--icon'
  closeBtn.innerHTML = icon('x', 16).outerHTML
  closeBtn.addEventListener('click', () => overlay.remove())

  header.appendChild(title)
  header.appendChild(closeBtn)

  const body = document.createElement('div')
  Object.assign(body.style, {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  })

  // Theme selection
  const themes = state.get('themes')
  let activeThemeId = state.get('activeThemeId')
  let currentTheme = themes.find((t) => t.id === activeThemeId) || themes[0]

  const selectGroup = document.createElement('div')
  selectGroup.innerHTML =
    '<label class="text-xs text-muted" style="display:block;margin-bottom:4px">Select Theme</label>'
  const themeSelect = document.createElement('select')
  themeSelect.className = 'input'
  themes.forEach((t) => {
    const opt = document.createElement('option')
    opt.value = t.id
    opt.textContent = t.name
    if (t.id === currentTheme.id) opt.selected = true
    themeSelect.appendChild(opt)
  })
  selectGroup.appendChild(themeSelect)

  // Style inputs
  const bgColorGroup = document.createElement('div')
  bgColorGroup.innerHTML =
    '<label class="text-xs text-muted" style="display:block;margin-bottom:4px">Background Color</label>'
  const bgColorInput = document.createElement('input')
  bgColorInput.type = 'color'
  bgColorInput.className = 'input'
  bgColorInput.value = currentTheme.styles.backgroundColor || '#000000'
  bgColorGroup.appendChild(bgColorInput)

  const colorGroup = document.createElement('div')
  colorGroup.innerHTML =
    '<label class="text-xs text-muted" style="display:block;margin-bottom:4px">Text Color</label>'
  const colorInput = document.createElement('input')
  colorInput.type = 'color'
  colorInput.className = 'input'
  colorInput.value = currentTheme.styles.color || '#ffffff'
  colorGroup.appendChild(colorInput)

  const fontGroup = document.createElement('div')
  fontGroup.innerHTML =
    '<label class="text-xs text-muted" style="display:block;margin-bottom:4px">Font Family</label>'
  const fontSelect = document.createElement('select')
  fontSelect.className = 'input'
  const fonts = ['Inter', 'Open Sans', 'Montserrat', 'Arial', 'Georgia']
  fonts.forEach((f) => {
    const opt = document.createElement('option')
    opt.value = f
    opt.textContent = f
    if (f === currentTheme.styles.fontFamily) opt.selected = true
    fontSelect.appendChild(opt)
  })
  fontGroup.appendChild(fontSelect)

  body.appendChild(selectGroup)
  body.appendChild(bgColorGroup)
  body.appendChild(colorGroup)
  body.appendChild(fontGroup)

  const footer = document.createElement('div')
  Object.assign(footer.style, {
    padding: '16px 20px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
  })

  const applyBtn = document.createElement('button')
  applyBtn.className = 'btn btn--primary'
  applyBtn.textContent = 'Apply Theme'
  applyBtn.addEventListener('click', () => {
    // Update theme
    currentTheme.styles.backgroundColor = bgColorInput.value
    currentTheme.styles.color = colorInput.value
    currentTheme.styles.fontFamily = fontSelect.value

    // Trigger update
    state.set('themes', themes)
    state.set('activeThemeId', currentTheme.id)

    // Force preview re-render
    const layers = state.get('layers')
    state.set('layers', { ...layers })
    overlay.remove()
  })

  themeSelect.addEventListener('change', (e) => {
    activeThemeId = e.target.value
    currentTheme = themes.find((t) => t.id === activeThemeId)
    bgColorInput.value = currentTheme.styles.backgroundColor || '#000000'
    colorInput.value = currentTheme.styles.color || '#ffffff'
    fontSelect.value = currentTheme.styles.fontFamily || 'Inter'
  })

  footer.appendChild(applyBtn)

  modal.appendChild(header)
  modal.appendChild(body)
  modal.appendChild(footer)
  overlay.appendChild(modal)

  document.body.appendChild(overlay)
}
