/**
 * stageHub — owns the lazily-started stage server.
 *
 * The server starts only when a stage/presenter/PA view is opened or the operator
 * chooses to share to phones, and until they choose to share it listens on this
 * computer only. "Start sharing" restarts it on every network interface so phones on
 * the same Wi-Fi can connect; "Stop sharing" puts it back. State pushed before the
 * server starts is kept and replayed once it does.
 */
const os = require('os')
const crypto = require('crypto')
const { startServer } = require('../server/stageServer')
const { sanitizeButtons, defaultButtons } = require('./remoteButtons')

// EASYPRESENT_PORT lets a second instance (testing, or a second church PC) run alongside
const PORT = Number(process.env.EASYPRESENT_PORT) || 8080

const LOCAL_ONLY = 'localhost'
const EVERYONE = '0.0.0.0'

/** This computer's LAN IPv4 addresses (what a phone on the same Wi-Fi would type). */
function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
}

function createStageHub({ getApiKey = () => null, regenerateApiKey = () => null } = {}) {
  let server = null
  let starting = null // Promise<port> while starting / once running
  let port = PORT
  let sharing = false
  let pendingSlide = null
  let pendingLiveState = null
  let remoteHandler = null
  let remoteButtons = defaultButtons()
  const newPin = () => String(crypto.randomInt(0, 10000)).padStart(4, '0')
  let pin = newPin() // gates the phone remote; changes every time sharing starts

  /**
   * Starts the server if needed. Resolves with the bound port (which can be
   * higher than the default when that one is busy); rejects with the reason
   * if nothing could be bound, and a later call tries again.
   */
  function start() {
    if (!starting) {
      server = startServer(port, sharing ? EVERYONE : LOCAL_ONLY, {
        getPin: () => pin,
        getButtons: () => remoteButtons,
        getApiKey,
        onCommand: (cmd) => remoteHandler && remoteHandler(cmd)
      })
      if (pendingSlide) server.broadcastSlide(pendingSlide)
      if (pendingLiveState) server.broadcastLiveState(pendingLiveState)
      starting = Promise.resolve(server.ready)
        .then((bound) => (port = bound || port))
        .catch((err) => {
          server = null
          starting = null
          throw err
        })
    }
    return starting
  }

  /** Rebinds on the same port (so windows that are already open reconnect by themselves). */
  async function restart(shared) {
    sharing = shared
    if (server) {
      const old = server
      await starting.catch(() => {})
      server = null
      starting = null
      await old.close()
    }
    return start()
  }

  return {
    start,
    share: () => {
      if (sharing && server) return start()
      pin = newPin()
      return restart(true)
    },
    /** Which buttons the phone remote draws (cleaned here, so a bad list can never reach it). */
    setRemoteButtons(buttons) {
      remoteButtons = sanitizeButtons(buttons)
      if (server) server.broadcastRemoteButtons(remoteButtons)
      return remoteButtons
    },
    /** A new key for outside control; whatever used the old one stops working. */
    newApiKey: () => regenerateApiKey(),
    /** Where phone-remote commands (next/prev/clear/logo) are delivered. */
    setRemoteHandler(fn) {
      remoteHandler = fn
    },
    unshare: () => (sharing ? restart(false) : Promise.resolve(port)),
    url: (route = '') => `http://localhost:${port}${route}`,
    /** What the Screens menu shows: is it running, is it shared, and the addresses a phone would use. */
    status() {
      return {
        running: !!server,
        sharing: !!server && sharing,
        port,
        pin,
        apiKey: getApiKey(),
        api: server ? `http://localhost:${port}/api` : null,
        urls: sharing
          ? lanAddresses().map((ip) => ({
              presenter: `http://${ip}:${port}/presenter`,
              pa: `http://${ip}:${port}/pa`,
              remote: `http://${ip}:${port}/remote`,
              stage: `http://${ip}:${port}/`,
              api: `http://${ip}:${port}/api`
            }))
          : []
      }
    },
    broadcastSlide(slide) {
      if (server) server.broadcastSlide(slide)
      else pendingSlide = slide
    },
    broadcastLiveState(state) {
      if (server) server.broadcastLiveState(state)
      else pendingLiveState = state
    }
  }
}

module.exports = { createStageHub }
