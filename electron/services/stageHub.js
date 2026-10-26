/**
 * stageHub — owns the lazily-started stage server.
 *
 * The server listens on every network interface with open CORS, which is
 * needless exposure (and startup work) until a stage/presenter/PA view is
 * actually opened or the operator chooses to share to phones. State pushed
 * before that is kept and replayed once the server starts.
 */
const os = require('os')
const { startServer } = require('../server/stageServer')

// EASYPRESENT_PORT lets a second instance (testing, or a second church PC) run alongside
const PORT = Number(process.env.EASYPRESENT_PORT) || 8080

/** This computer's LAN IPv4 addresses (what a phone on the same Wi-Fi would type). */
function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
}

function createStageHub() {
  let server = null
  let starting = null // Promise<port> while starting / once running
  let port = PORT
  let pendingSlide = null
  let pendingLiveState = null

  /**
   * Starts the server if needed. Resolves with the bound port (which can be
   * higher than the default when that one is busy); rejects with the reason
   * if nothing could be bound, and a later call tries again.
   */
  function start() {
    if (!starting) {
      server = startServer(PORT)
      if (pendingSlide) server.broadcastSlide(pendingSlide)
      if (pendingLiveState) server.broadcastLiveState(pendingLiveState)
      starting = Promise.resolve(server.ready)
        .then((bound) => (port = bound || PORT))
        .catch((err) => {
          server = null
          starting = null
          throw err
        })
    }
    return starting
  }

  return {
    start,
    url: (route = '') => `http://localhost:${port}${route}`,
    /** What the Screens menu shows: is it running, and the addresses a phone would use. */
    status() {
      return {
        running: !!server,
        port,
        urls: lanAddresses().map((ip) => ({
          presenter: `http://${ip}:${port}/presenter`,
          pa: `http://${ip}:${port}/pa`
        }))
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
