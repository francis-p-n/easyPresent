/**
 * ToastManager.js - Global toast notification system
 */
export const ToastManager = {
  container: null,

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type = 'info') {
    this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;

    this.container.appendChild(toast);

    // Trigger reflow for animation
    void toast.offsetWidth;
    toast.classList.add('toast--visible');

    setTimeout(() => {
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      });
    }, 3000);
  }
};

export const showToast = (message, type) => ToastManager.show(message, type);
