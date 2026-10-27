/**
 * ToastManager.js - Global toast notification system
 */
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

  show(message, type = 'info') {
    this.init()

    const toast = document.createElement('div')
    toast.className = `toast toast--${type}`
    toast.textContent = message

    this.container.appendChild(toast)

    // Trigger reflow for animation
    void toast.offsetWidth
    toast.classList.add('toast--visible')

    const dismiss = () => {
      toast.classList.remove('toast--visible')
      toast.addEventListener('transitionend', () => toast.remove(), { once: true })
    }

    toast.addEventListener('click', dismiss)
    setTimeout(dismiss, 1500)
  }
}

export const showToast = (message, type) => ToastManager.show(message, type)
