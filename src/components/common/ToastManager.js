/**
 * ToastManager.js - Global toast notification system
 */
// Short confirmations vanish quickly; long messages (a damaged-library notice, an error) stay long enough to read
const toastMs = (message) => Math.min(8000, 1500 + Math.max(0, message.length - 30) * 60)

export const ToastManager = {
  container: null,

  init() {
    if (this.container) return
    this.container = document.createElement('div')
    this.container.className = 'toast-container'
    this.container.setAttribute('role', 'status') // read out by screen readers
    this.container.setAttribute('aria-live', 'polite')
    document.body.appendChild(this.container)
  },

  /** `action` ({ label, onClick }) adds a button, e.g. Undo; such a toast stays long enough to be used. */
  show(message, type = 'info', action = null) {
    this.init()

    // The same message again just keeps the toast already on screen a little longer,
    // so five quick imports show one toast, not five stacked over the preview
    const same = action ? null : [...this.container.children].find((t) => t.textContent === message && t.className.includes(`toast--${type}`) && !t._leaving)
    if (same) {
      same._extend()
      return
    }
    // Never more than three at once: retire the oldest
    const live = [...this.container.children].filter((t) => !t._leaving)
    if (live.length >= 3) live[0]._dismiss()

    const toast = document.createElement('div')
    toast.className = `toast toast--${type}`
    toast.textContent = message
    if (action) {
      const btn = document.createElement('button')
      btn.className = 'toast__action'
      btn.textContent = action.label
      btn.style.cssText = 'margin-left:12px;background:none;border:0;color:inherit;font-weight:700;text-decoration:underline;cursor:pointer;'
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        toast._dismiss()
        action.onClick()
      })
      toast.appendChild(btn)
    }

    this.container.appendChild(toast)

    // Trigger reflow for animation
    void toast.offsetWidth
    toast.classList.add('toast--visible')

    let timer
    toast._dismiss = () => {
      if (toast._leaving) return
      toast._leaving = true
      clearTimeout(timer)
      toast.classList.remove('toast--visible')
      // transitionend never fires when motion is reduced, so don't wait for it
      toast.addEventListener('transitionend', () => toast.remove(), { once: true })
      setTimeout(() => toast.remove(), 400)
    }
    toast._extend = () => {
      clearTimeout(timer)
      timer = setTimeout(toast._dismiss, action ? 8000 : toastMs(message))
    }

    toast.addEventListener('click', toast._dismiss)
    toast._extend()
  }
}

export const showToast = (message, type, action) => ToastManager.show(message, type, action)
