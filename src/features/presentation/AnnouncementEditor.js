import { state } from '../../engine/StateManager.js'

/**
 * AnnouncementEditor — Quick inline editor overlay for announcement slides.
 * Double-click an announcement slide thumbnail to open.
 */
export class AnnouncementEditor {
  constructor() {
    this.overlay = null
    this.currentSlideIndex = -1
  }

  open(slideIndex) {
    this.currentSlideIndex = slideIndex
    const pres = state.get('selectedPresentation')
    if (!pres || !pres.slides[slideIndex]) return

    const slide = pres.slides[slideIndex]
    if (this.overlay) this.close()

    this.overlay = document.createElement('div')
    this.overlay.id = 'announcement-editor-overlay'
    this.overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.75)',
      'z-index:5000',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'backdrop-filter:blur(4px)',
    ].join(';')

    const data = slide.announcementData || { headline: '', body: '', time: '', location: '' }

    const panel = document.createElement('div')
    panel.style.cssText = [
      'background:var(--bg-panel)',
      'border-radius:12px',
      'padding:28px',
      'width:540px',
      'max-width:95vw',
      'box-shadow:0 20px 60px rgba(0,0,0,0.5)',
      'border:1px solid var(--border-color)',
    ].join(';')

    const headline = this._esc(data.headline || '')
    const body = this._esc(data.body || '')
    const time = this._esc(data.time || '')
    const location = this._esc(data.location || '')

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <h2 style="margin:0;font-size:16px;color:var(--text-primary);">Edit Announcement</h2>
        <button id="ann-close" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:20px;line-height:1;padding:4px;">&#x2715;</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:14px;">
        <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">
          Headline
          <input id="ann-headline" class="input" value="${headline}" placeholder="ANNOUNCEMENT TITLE"
            style="font-size:18px;font-weight:700;height:48px;" />
        </label>

        <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">
          Details
          <textarea id="ann-body" class="input" rows="3" placeholder="What's happening..."
            style="resize:vertical;font-size:14px;">${body}</textarea>
        </label>

        <div style="display:flex;gap:12px;">
          <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;flex:1;">
            Time
            <input id="ann-time" class="input" value="${time}" placeholder="7:00 PM" style="font-size:14px;" />
          </label>
          <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;flex:1;">
            Location
            <input id="ann-location" class="input" value="${location}" placeholder="Main Hall" style="font-size:14px;" />
          </label>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:24px;">
        <button id="ann-save" class="btn btn--primary" style="flex:1;height:44px;font-size:14px;">Save &amp; Update Slide</button>
        <button id="ann-cancel" class="btn" style="height:44px;padding:0 20px;font-size:14px;">Cancel</button>
      </div>
    `

    this.overlay.appendChild(panel)
    document.body.appendChild(this.overlay)

    panel.querySelector('#ann-close').addEventListener('click', () => this.close())
    panel.querySelector('#ann-cancel').addEventListener('click', () => this.close())

    panel.querySelector('#ann-save').addEventListener('click', () => {
      const headlineVal = panel.querySelector('#ann-headline').value
      const bodyVal = panel.querySelector('#ann-body').value
      const timeVal = panel.querySelector('#ann-time').value
      const locationVal = panel.querySelector('#ann-location').value

      const parts = [headlineVal]
      if (bodyVal) parts.push('', bodyVal)
      if (timeVal || locationVal) parts.push('')
      if (timeVal) parts.push(`Time: ${timeVal}`)
      if (locationVal) parts.push(`Location: ${locationVal}`)

      const pres = state.get('selectedPresentation')
      if (pres && pres.slides[this.currentSlideIndex]) {
        const updated = state.updatePresentation(pres.id, (p) => {
          p.slides[this.currentSlideIndex].text = parts.join('\n')
          p.slides[this.currentSlideIndex].announcementData = {
            headline: headlineVal,
            body: bodyVal,
            time: timeVal,
            location: locationVal,
          }
        })

        const layers = state.get('layers')
        if (updated && layers.slide.active && state.get('liveSlideIndex') === this.currentSlideIndex) {
          layers.slide.content = updated.slides[this.currentSlideIndex]
          state.set('layers', { ...layers })
        }
      }

      this.close()
    })

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })

    setTimeout(() => panel.querySelector('#ann-headline')?.focus(), 50)
  }

  close() {
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }
  }

  _esc(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}

export const announcementEditor = new AnnouncementEditor()
