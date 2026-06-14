import { state } from './StateManager.js'

class StorageManager {
  constructor() {
    this.SAVE_KEY = 'easy_present_data'
  }

  save() {
    try {
      const data = {
        presentations: state.get('presentations'),
        playlists: state.get('playlists'),
        themes: state.get('themes')
      }
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(data))
      console.log('Saved data to local storage')
    } catch (e) {
      console.error('Failed to save data', e)
    }
  }

  load() {
    try {
      const str = localStorage.getItem(this.SAVE_KEY)
      if (str) {
        const data = JSON.parse(str)
        if (data.presentations) state.set('presentations', data.presentations)
        if (data.playlists) state.set('playlists', data.playlists)
        if (data.themes) state.set('themes', data.themes)
        console.log('Loaded data from local storage')
      }
    } catch (e) {
      console.error('Failed to load data', e)
    }
  }

  initAutoSave() {
    // Save whenever these change
    state.on('presentations', () => this.save())
    state.on('playlists', () => this.save())
    state.on('themes', () => this.save())
  }
}

export const storageManager = new StorageManager()
