import { state } from './StateManager.js'

class MediaManager {
  constructor() {
    this.mediaItems = []
    this.audioItems = []
  }

  async loadMediaLibrary() {
    // In a real app, read from disk / indexedDB
    this.mediaItems = [
      {
        id: '1',
        name: 'Worship Background 1',
        path: 'C:\\Videos\\bg1.mp4',
        type: 'video',
        thumbnail: ''
      },
      {
        id: '2',
        name: 'Nature Loop',
        path: 'C:\\Videos\\nature.mp4',
        type: 'video',
        thumbnail: ''
      },
      { id: '3', name: 'Church Logo', path: 'C:\\Images\\logo.png', type: 'image', thumbnail: '' }
    ]

    state.set('media:loaded', this.mediaItems)
  }

  async loadAudioLibrary() {
    this.audioItems = [
      { id: 'a1', name: 'Pre-service Mix', path: 'C:\\Audio\\preservice.mp3', duration: 180 },
      { id: 'a2', name: 'Sermon Walk-on', path: 'C:\\Audio\\walkon.wav', duration: 15 }
    ]

    state.set('audio:loaded', this.audioItems)
  }

  async importMedia(filePaths) {
    // Stub for importing files
    filePaths.forEach((path) => {
      const name = path.split('\\').pop()
      this.mediaItems.push({ id: Date.now().toString(), name, path, type: 'video', thumbnail: '' })
    })
    state.set('media:updated', this.mediaItems)
  }
}

export default new MediaManager()
