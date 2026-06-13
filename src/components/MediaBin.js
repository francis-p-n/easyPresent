export function createMediaBin() {
    const container = document.createElement('div');
    container.className = 'media-bin';
    container.innerHTML = `
        <div class="media-header">
            <h3>Media</h3>
            <div class="media-controls">
                <button id="import-media" class="btn-icon">
                    <i data-lucide="plus"></i>
                </button>
            </div>
        </div>
        <div class="media-grid" id="media-grid"></div>
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
                        <div class="media-item" data-id="${item.id}">
                            <div class="media-thumbnail">
                                ${item.type === 'video' ? '<i data-lucide="video"></i>' : '<i data-lucide="image"></i>'}
                            </div>
                            <div class="media-label">${item.name}</div>
                        </div>
                    `).join('');
                    
                    if (window.lucide) {
                        window.lucide.createIcons({ root: grid });
                    }
                });

                MediaManager.loadMediaLibrary();
            });
        });
    }, 0);

    return container;
}
