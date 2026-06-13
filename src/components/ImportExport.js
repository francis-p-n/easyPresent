export function createImportExport() {
    const container = document.createElement('div');
    container.className = 'import-export-panel';
    container.innerHTML = `
        <div class="import-export-header">
            <h3>Import/Export</h3>
        </div>
        <div class="import-export-actions">
            <button class="btn btn-primary" id="btn-import-file">Import Presentation...</button>
            <button class="btn btn-secondary" id="btn-import-lyrics">Import Lyrics (Text)...</button>
            <hr>
            <button class="btn btn-secondary" id="btn-export-bundle">Export Bundle...</button>
        </div>
    `;

    setTimeout(() => {
        container.querySelector('#btn-import-file').addEventListener('click', () => {
            console.log('Import file dialog triggered');
        });
    }, 0);

    return container;
}
