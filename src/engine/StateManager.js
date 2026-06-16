/**
 * StateManager — Centralized pub/sub state management
 * Manages all application state and notifies listeners on changes.
 */
export class StateManager {
  constructor() {
    this._listeners = new Map()
    this._state = {
      // Current view mode
      activeView: 'library', // 'library' | 'media' | 'audio'

      // Library
      presentations: [],
      selectedPresentation: null,

      // Playlist
      playlists: [],
      activePlaylist: null,

      // Slides
      slides: [],
      activeSlideIndex: -1,
      liveSlideIndex: -1,

      // Layers
      layers: {
        media: { active: false, content: null },
        slide: { active: false, content: null },
        props: { active: false, content: [] }, // Array of active props
        message: { active: false, content: null }, // message text
        audio: { active: false, content: null },
        logo: { active: false, content: null },
        announcement: { active: false, content: null }
      },

      // Show Controls
      activeControlTab: 'timers', // 'timers' | 'messages' | 'props' | 'macros' | 'stage'
      timers: [],
      messages: [],
      props: [],
      macros: [],

      // UI State
      isEditing: false,
      searchQuery: '',
      showLogo: false,
      maxLinesPerSlide: 4,

      // Themes
      themes: [],
      activeThemeId: 'default',
    }

    // Load sample data
    this._loadSampleData()
  }

  /** Get a value from state */
  get(key) {
    return this._state[key]
  }

  /** Set a value and notify listeners */
  set(key, value) {
    const oldValue = this._state[key]
    this._state[key] = value
    this._notify(key, value, oldValue)
  }

  /** Subscribe to state changes */
  on(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set())
    }
    this._listeners.get(key).add(callback)
    return () => this._listeners.get(key)?.delete(callback)
  }

  /** Notify all listeners for a key */
  _notify(key, newValue, oldValue) {
    const listeners = this._listeners.get(key)
    if (listeners) {
      listeners.forEach(cb => cb(newValue, oldValue))
    }
  }

  /** Load sample presentations for demo */
  _loadSampleData() {
    this._state.presentations = [
      {
        id: 'p1',
        name: 'Amazing Grace',
        category: 'Hymns',
        slides: [
          { id: 's1', group: 'verse', label: 'Verse 1', text: 'Amazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind but now I see' },
          { id: 's2', group: 'verse', label: 'Verse 2', text: "T'was grace that taught my heart to fear\nAnd grace my fears relieved\nHow precious did that grace appear\nThe hour I first believed" },
          { id: 's3', group: 'chorus', label: 'Chorus', text: 'My chains are gone, I\'ve been set free\nMy God, my Savior has ransomed me\nAnd like a flood His mercy reigns\nUnending love, amazing grace' },
          { id: 's4', group: 'verse', label: 'Verse 3', text: 'The Lord has promised good to me\nHis word my hope secures\nHe will my shield and portion be\nAs long as life endures' },
          { id: 's5', group: 'bridge', label: 'Bridge', text: 'The earth shall soon dissolve like snow\nThe sun forbear to shine\nBut God who called me here below\nWill be forever mine' },
        ]
      },
      {
        id: 'p2',
        name: 'How Great Is Our God',
        category: 'Worship',
        slides: [
          { id: 's6', group: 'verse', label: 'Verse 1', text: 'The splendor of the King\nClothed in majesty\nLet all the earth rejoice\nAll the earth rejoice' },
          { id: 's7', group: 'verse', label: 'Verse 2', text: 'He wraps Himself in light\nAnd darkness tries to hide\nAnd trembles at His voice\nTrembles at His voice' },
          { id: 's8', group: 'chorus', label: 'Chorus', text: 'How great is our God\nSing with me, how great is our God\nAnd all will see how great\nHow great is our God' },
          { id: 's9', group: 'bridge', label: 'Bridge', text: 'Name above all names\nWorthy of all praise\nMy heart will sing\nHow great is our God' },
        ]
      },
      {
        id: 'p3',
        name: '10,000 Reasons',
        category: 'Worship',
        slides: [
          { id: 's10', group: 'chorus', label: 'Chorus', text: 'Bless the Lord, O my soul\nO my soul, worship His holy name\nSing like never before\nO my soul, I\'ll worship Your holy name' },
          { id: 's11', group: 'verse', label: 'Verse 1', text: 'The sun comes up, it\'s a new day dawning\nIt\'s time to sing Your song again\nWhatever may pass and whatever lies before me\nLet me be singing when the evening comes' },
          { id: 's12', group: 'verse', label: 'Verse 2', text: 'You\'re rich in love and You\'re slow to anger\nYour name is great and Your heart is kind\nFor all Your goodness I will keep on singing\nTen thousand reasons for my heart to find' },
        ]
      },
      {
        id: 'p4',
        name: 'Sunday Welcome',
        category: 'Announcements',
        slides: [
          { id: 's13', group: 'intro', label: 'Welcome', text: 'Welcome to\nSunday Service' },
          { id: 's14', group: 'intro', label: 'Announcements', text: 'Announcements\n\n• Small Groups — Wednesday 7PM\n• Youth Night — Friday 6PM\n• Serve Team Meeting — After Service' },
        ]
      },
      {
        id: 'p5',
        name: 'Sermon Notes — Faith',
        category: 'Sermon',
        slides: [
          { id: 's15', group: 'intro', label: 'Title', text: 'Walking by Faith\nHebrews 11:1' },
          { id: 's16', group: 'verse', label: 'Point 1', text: '1. Faith is the substance\n   of things hoped for' },
          { id: 's17', group: 'verse', label: 'Point 2', text: '2. Faith requires action\n   James 2:17' },
          { id: 's18', group: 'verse', label: 'Point 3', text: '3. Faith grows through\n   trials and testing' },
        ]
      },
    ]

    this._state.playlists = [
      {
        id: 'pl1',
        name: 'Sunday Morning Service',
        items: [
          { type: 'header', text: 'Pre-Service' },
          { type: 'presentation', id: 'p4' },
          { type: 'header', text: 'Worship' },
          { type: 'presentation', id: 'p1' },
          { type: 'presentation', id: 'p2' },
          { type: 'presentation', id: 'p3' },
          { type: 'header', text: 'Message' },
          { type: 'presentation', id: 'p5' },
        ]
      },
    ]

    this._state.activePlaylist = this._state.playlists[0]

    this._state.themes = [
      {
        id: 'default',
        name: 'Worship Default',
        styles: {
          fontFamily: 'Inter',
          fontSize: '64px',
          color: '#ffffff',
          backgroundColor: '#000000',
          textAlign: 'center',
          justifyContent: 'center',
          fontWeight: 'bold'
        }
      },
      {
        id: 'sermon-default',
        name: 'Sermon Default',
        styles: {
          fontFamily: 'Inter',
          fontSize: '56px',
          color: '#ffffff',
          backgroundColor: '#111111',
          textAlign: 'left',
          justifyContent: 'center',
          fontWeight: 'normal'
        }
      },
      {
        id: 'announcement-default',
        name: 'Announcement Default',
        styles: {
          fontFamily: 'Inter',
          fontSize: '72px',
          color: '#ffffff',
          backgroundColor: '#001f3f',
          textAlign: 'center',
          justifyContent: 'center',
          fontWeight: 'bold'
        }
      }
    ]
  }
}

// Global singleton
export const state = new StateManager()
