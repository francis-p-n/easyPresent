export function createAudioBin() {
    const container = document.createElement('div');
    container.className = 'audio-bin';
    container.innerHTML = `
        <div class="audio-header">
            <h3>Audio Playlist</h3>
            <div class="audio-controls">
                <button id="import-audio" class="btn-icon">
                    <i data-lucide="plus"></i>
                </button>
            </div>
        </div>
        <div class="audio-list" id="audio-list"></div>
    `;

    setTimeout(() => {
        const list = container.querySelector('#audio-list');
        import('../engine/MediaManager.js').then(module => {
            const MediaManager = module.default;
            import('../engine/StateManager.js').then(stateModule => {
                const state = stateModule.state;
                
                state.on('audio:loaded', (items) => {
                    list.innerHTML = items.map(item => `
                        <div class="audio-item" data-id="${item.id}">
                            <i data-lucide="music"></i>
                            <span class="audio-label">${item.name}</span>
                            <span class="audio-duration">${formatTime(item.duration)}</span>
                        </div>
                    `).join('');
                    
                    if (window.lucide) {
                        window.lucide.createIcons({ root: list });
                    }
                });

                MediaManager.loadAudioLibrary();
            });
        });
    }, 0);

    return container;
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
