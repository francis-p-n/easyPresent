/**
 * stageHub — owns the lazily-started stage server.
 *
 * The server binds 0.0.0.0:8080 with open CORS, which is needless exposure
 * (and startup work) until a stage/presenter/PA view is actually opened. State
 * pushed before that is kept and replayed once the server starts.
 */
const { startServer } = require('../server/stageServer')

// EASYPRESENT_PORT lets a second instance (testing, or a second church PC) run alongside
const PORT = Number(process.env.EASYPRESENT_PORT) || 8080

function createStageHub() {
  let server = null
  let pendingSlide = null
  let pendingLiveState = null

  function ensure() {
    if (!server) {
      server = startServer(PORT)
      if (pendingSlide) server.broadcastSlide(pendingSlide)
      if (pendingLiveState) server.broadcastLiveState(pendingLiveState)
    }
    return server
  }

  return {
    ensure,
    url: (route = '') => `http://localhost:${PORT}${route}`,
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
