/**
 * displays — the three output windows and where they go.
 *
 *   audience   fullscreen projection, fed over IPC from the operator window
 *   presenter  the pastor's confirmation monitor (current + next slide, clock)
 *   pa         the sound desk (output check, cues, timers)
 *
 * Presenter and PA are local clients of the stage server, so the same pages
 * also open on any phone/laptop at http://<this-pc>:8080/presenter and /pa.
 */
const { BrowserWindow, screen } = require('electron')
const path = require('path')
const { appIcon, publicPage } = require('../assets')

const ROLE_TITLES = { presenter: 'Presenter View', pa: 'PA View' }
const WINDOWED_SIZE = { presenter: [1100, 650], pa: [1100, 650] }

function createDisplayManager({ stageHub }) {
  let audienceWindow = null
  let lastAudiencePayload = null
  const roleWindows = { presenter: null, pa: null }

  const allWindows = () => [audienceWindow, roleWindows.presenter, roleWindows.pa]
  const inUse = (display) => allWindows().some((w) => w && w.__displayId === display.id)

  // Explicit choice wins; otherwise the first external display nothing else is
  // using; otherwise null (caller falls back to a window on the primary one).
  function pickDisplay(requestedId) {
    const displays = screen.getAllDisplays()
    if (requestedId != null) {
      const asked = displays.find((d) => d.id === requestedId)
      if (asked) return asked
    }
    const primary = screen.getPrimaryDisplay()
    return displays.find((d) => d.id !== primary.id && !inUse(d)) || null
  }

  function listDisplays() {
    const primary = screen.getPrimaryDisplay()
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: `Display ${i + 1}${d.id === primary.id ? ' (main)' : ''} - ${d.bounds.width}x${d.bounds.height}`,
      primary: d.id === primary.id
    }))
  }

  // Windows can be closed from their own title bar, so callers ask rather
  // than trusting their own bookkeeping.
  function openRoles() {
    return [...(audienceWindow ? ['audience'] : []), ...Object.keys(roleWindows).filter((r) => roleWindows[r])]
  }

  function openAudience(requestedId) {
    const primary = screen.getPrimaryDisplay()
    const picked = pickDisplay(requestedId)
    const target = picked || primary
    // Project fullscreen whenever the target isn't the operator's own screen
    const projecting = !!picked && picked.id !== primary.id

    audienceWindow = new BrowserWindow({
      x: target.bounds.x + 40,
      y: target.bounds.y + 40,
      width: projecting ? target.bounds.width : 960,
      height: projecting ? target.bounds.height : 540,
      fullscreen: projecting,
      frame: !projecting,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      title: 'Audience Output',
      icon: appIcon,
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    audienceWindow.__displayId = target.id

    audienceWindow.loadFile(publicPage('output/audience.html'))
    audienceWindow.webContents.on('did-finish-load', () => {
      if (lastAudiencePayload) audienceWindow.webContents.send('audience-update', lastAudiencePayload)
    })
    audienceWindow.on('closed', () => {
      audienceWindow = null
    })
  }

  function openRole(role, requestedId) {
    stageHub.ensure()
    const display = pickDisplay(requestedId)
    const target = display || screen.getPrimaryDisplay()
    const [width, height] = WINDOWED_SIZE[role]
    const win = new BrowserWindow({
      x: target.bounds.x + (display ? 0 : 60),
      y: target.bounds.y + (display ? 0 : 60),
      width: display ? target.bounds.width : width,
      height: display ? target.bounds.height : height,
      fullscreen: !!display,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      title: ROLE_TITLES[role],
      icon: appIcon,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })
    win.__displayId = target.id
    win.loadURL(stageHub.url(`/${role}/`))
    win.on('closed', () => {
      roleWindows[role] = null
    })
    roleWindows[role] = win
  }

  /** Returns true when the window is now open, false when it was closed. */
  function toggle(role, displayId) {
    if (role === 'audience') {
      if (audienceWindow) {
        audienceWindow.close()
        audienceWindow = null
        return false
      }
      openAudience(displayId)
      return true
    }
    if (!(role in roleWindows)) throw new Error(`Unknown display role: ${role}`)
    if (roleWindows[role]) {
      roleWindows[role].close()
      roleWindows[role] = null
      return false
    }
    openRole(role, displayId)
    return true
  }

  function updateAudience(payload) {
    lastAudiencePayload = payload
    if (audienceWindow) audienceWindow.webContents.send('audience-update', payload)
  }

  /** The classic stage display: chords + lyrics for the band, served by the stage server. */
  function openStageDisplay() {
    stageHub.ensure()
    const win = new BrowserWindow({
      width: 1280,
      height: 720,
      title: 'Stage Display',
      icon: appIcon,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })
    win.loadURL(stageHub.url())
  }

  return { listDisplays, openRoles, toggle, updateAudience, openStageDisplay }
}

module.exports = { createDisplayManager }
