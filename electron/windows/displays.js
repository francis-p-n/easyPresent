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
const { appIcon, publicPage, preload } = require('../paths')

const ROLE_TITLES = { presenter: 'Presenter View', pa: 'PA View' }

// When there is no spare display the outputs open as ordinary windows. Each gets
// its own cascade slot and a size smaller than the operator window, so none hides
// another and the operator window stays reachable.
const WINDOWED = {
  audience: { x: 40, y: 40, width: 960, height: 540 },
  presenter: { x: 110, y: 90, width: 900, height: 560 },
  pa: { x: 180, y: 140, width: 900, height: 560 }
}

function createDisplayManager({ stageHub, getMainWindow = () => null }) {
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

  // Outputs must never take the keyboard from the operator: shortcuts only work
  // while the operator window has focus.
  function focusOperator() {
    const main = getMainWindow()
    if (main && !main.isDestroyed?.()) main.focus()
  }

  // A new window grabs focus while it shows and again when its page finishes loading,
  // so the operator window gets it back at both moments
  function keepOperatorFocused(win) {
    win.once?.('ready-to-show', focusOperator)
    win.webContents?.once?.('did-finish-load', () => setTimeout(focusOperator, 150))
  }

  function openAudience(requestedId) {
    const primary = screen.getPrimaryDisplay()
    const picked = pickDisplay(requestedId)
    const target = picked || primary
    // Project fullscreen whenever the target isn't the operator's own screen
    const projecting = !!picked && picked.id !== primary.id

    audienceWindow = new BrowserWindow({
      x: target.bounds.x + WINDOWED.audience.x,
      y: target.bounds.y + WINDOWED.audience.y,
      width: projecting ? target.bounds.width : WINDOWED.audience.width,
      height: projecting ? target.bounds.height : WINDOWED.audience.height,
      fullscreen: projecting,
      frame: !projecting,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      title: 'Audience Output',
      icon: appIcon,
      webPreferences: {
        preload,
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    audienceWindow.__displayId = target.id

    audienceWindow.loadFile(publicPage('output/audience.html'))
    audienceWindow.webContents.on('did-finish-load', () => {
      if (lastAudiencePayload) audienceWindow.webContents.send('audience-update', lastAudiencePayload)
    })
    keepOperatorFocused(audienceWindow)
    audienceWindow.on('closed', () => {
      audienceWindow = null
      focusOperator()
    })
  }

  const opening = new Set() // roles whose window is waiting on the server, so a double click can't open two

  async function openRole(role, requestedId) {
    opening.add(role)
    try {
      await stageHub.start()
    } catch (err) {
      const why = err.code === 'EADDRINUSE' ? 'no free network port (8080-8090 are all in use)' : err.message
      throw new Error(`Couldn't start the screen server: ${why}`, { cause: err })
    } finally {
      opening.delete(role)
    }
    const display = pickDisplay(requestedId)
    const target = display || screen.getPrimaryDisplay()
    const slot = WINDOWED[role]
    const win = new BrowserWindow({
      x: target.bounds.x + (display ? 0 : slot.x),
      y: target.bounds.y + (display ? 0 : slot.y),
      width: display ? target.bounds.width : slot.width,
      height: display ? target.bounds.height : slot.height,
      fullscreen: !!display,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      title: ROLE_TITLES[role],
      icon: appIcon,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })
    win.__displayId = target.id
    win.loadURL(stageHub.url(`/${role}/`))
    keepOperatorFocused(win)
    win.on('closed', () => {
      roleWindows[role] = null
      focusOperator()
    })
    roleWindows[role] = win
    return true
  }

  /** Returns true when the window is now open, false when it was closed (a Promise for Presenter/PA, which wait for the server). */
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
    if (opening.has(role)) return Promise.resolve(true)
    return openRole(role, displayId)
  }

  function updateAudience(payload) {
    lastAudiencePayload = payload
    if (audienceWindow) audienceWindow.webContents.send('audience-update', payload)
  }

  /** The classic stage display: chords + lyrics for the band, served by the stage server. */
  async function openStageDisplay() {
    await stageHub.start()
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
