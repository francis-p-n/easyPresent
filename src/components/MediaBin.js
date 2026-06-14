import { icon } from './Icons.js';

export function createMediaBin() {
    const container = document.createElement('div');
    container.className = 'media-bin';
    container.innerHTML = `
        <div class="media-header" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-active);">
            <h3 style="font-size: var(--font-size-sm); font-weight: 600; margin: 0; color: var(--text-primary);">Media</h3>
            <div class="media-controls">
                <button id="import-media" class="btn btn--icon">
                    ${icon('plus', 16).outerHTML}
                </button>
            </div>
        </div>
        <div class="media-grid" id="media-grid" style="padding: 8px;"></div>
    `;

    // Wait for DOM
    setTimeout(() => {
        const grid = container.querySelector('#media-grid');
        import('../engine/MediaManager.js').then(module => {
            const MediaManager = module.default;
            
            import('../engine/StateManager.js').then(stateModule => {
                const state = stateModule.state;
                
                state.on('media:loaded', (items) => {
                    grid.innerHTML = items.map(item => `
                        <div class="list-item media-item" data-id="${item.id}">
                            <div class="list-item__icon">
                                ${item.type === 'video' ? icon('play', 16).outerHTML : icon('image', 16).outerHTML}
                            </div>
                            <div class="media-label text-ellipsis flex-1">${item.name}</div>
                        </div>
                    `).join('');
                });

                MediaManager.loadMediaLibrary();
            });
        });
    }, 0);

    return container;
}
