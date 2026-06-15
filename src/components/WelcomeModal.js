import { icon } from './Icons.js';

export class WelcomeModal {
  constructor(onDismiss) {
    this.onDismiss = onDismiss;
    this.render();
  }

  render() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    
    this.modal = document.createElement('div');
    this.modal.className = 'modal';
    this.modal.style.maxWidth = '500px';

    const header = document.createElement('div');
    header.className = 'modal__header';
    header.innerHTML = `<div class="modal__title">Welcome to EasyPresent! 👋</div>`;

    const body = document.createElement('div');
    body.className = 'modal__body';
    body.style.lineHeight = '1.6';
    body.innerHTML = `
      <p style="margin-bottom: 16px; color: var(--text-secondary);">
        Get started quickly by following these three simple steps:
      </p>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <div style="color: var(--accent-blue);">${icon('folder', 24).outerHTML}</div>
          <div>
            <strong>1. Select a Presentation</strong><br>
            <span style="color: var(--text-secondary); font-size: var(--font-size-sm);">Click a presentation from the Library (left panel) or your Playlist to view its slides.</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <div style="color: var(--accent-red);">${icon('tv', 24).outerHTML}</div>
          <div>
            <strong>2. Go Live</strong><br>
            <span style="color: var(--text-secondary); font-size: var(--font-size-sm);">Click any slide thumbnail in the center view to send it immediately to the live output screen.</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <div style="color: var(--text-primary);">${icon('edit', 24).outerHTML}</div>
          <div>
            <strong>3. Edit Content</strong><br>
            <span style="color: var(--text-secondary); font-size: var(--font-size-sm);">Click the "Edit" button in the top toolbar to modify your slides or create new ones.</span>
          </div>
        </div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    
    const btn = document.createElement('button');
    btn.className = 'btn btn--primary';
    btn.textContent = 'Get Started';
    btn.onclick = () => this.dismiss();
    
    footer.appendChild(btn);

    this.modal.appendChild(header);
    this.modal.appendChild(body);
    this.modal.appendChild(footer);
    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);
  }

  dismiss() {
    this.overlay.remove();
    if (this.onDismiss) this.onDismiss();
  }
}
