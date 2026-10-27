const express = require('express');
const http = require('http');
const net = require('net');
const { Server } = require('socket.io');
const { staticDirs } = require('../paths');

let io;
let currentSlideData = null;
let currentLiveState = null;

const PORT_ATTEMPTS = 10 // if 8080 is taken, try 8081 ... 8090 before giving up

/**
 * Is something already answering on this port, on any local address? Binding the specific
 * address we want can succeed even while another program holds the same port on all
 * interfaces (Windows allows it), so asking first is the only reliable check.
 */
function portAnswers(port) {
  const tryHost = (host) =>
    new Promise((resolve) => {
      const s = net.connect({ host, port, timeout: 400 })
      s.once('connect', () => (s.destroy(), resolve(true)))
      s.once('error', () => resolve(false))
      s.once('timeout', () => (s.destroy(), resolve(false)))
    })
  return Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then((r) => r.some(Boolean))
}

/** Listens on `port`, moving to the next port when one is in use. Resolves with the port actually bound. */
function listenWithFallback(server, port, host, attemptsLeft = PORT_ATTEMPTS) {
  return new Promise((resolve, reject) => {
    const attempt = async (p, left) => {
      if (left > 0 && (await portAnswers(p))) return attempt(p + 1, left - 1)
      const onError = (err) => {
        server.removeListener('listening', onListening)
        if (err.code === 'EADDRINUSE' && left > 0) attempt(p + 1, left - 1)
        else reject(err)
      }
      const onListening = () => {
        server.removeListener('error', onError)
        resolve(p)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(p, host)
    }
    attempt(port, attemptsLeft)
  })
}

/**
 * Starts the stage/presenter/PA web server. Returns the broadcast functions
 * immediately plus `ready`, a promise for the port that was actually bound
 * (it rejects, with the reason, if no port could be used).
 *
 * `host` decides who can connect: 'localhost' (the default) keeps it to this computer's own
 * windows; '0.0.0.0' also lets phones and tablets on the same Wi-Fi in.
 */
function startServer(port = 8080, host = 'localhost') {
  const app = express();
  const server = http.createServer(app);
  io = new Server(server, {
    cors: { origin: '*' }
  });

  // Serve static files for the stage display. public/stage is the source of
  // truth in the repo; packaged builds only ship dist/ (vite copies public/*
  // into it), so fall through to dist/stage when public/ isn't present.
  for (const dir of staticDirs('stage')) app.use(express.static(dir));

  // Role views: /presenter (pastor: current + next + clock) and /pa (PA team:
  // output confirmation, cue list, timers). Both are read-only clients of the
  // same socket feed, so they work on any phone/laptop on the venue Wi-Fi.
  for (const view of ['presenter', 'pa']) {
    for (const dir of staticDirs(view)) app.use('/' + view, express.static(dir));
  }

  io.on('connection', (socket) => {
    console.log('Stage display connected');
    if (currentSlideData) {
      socket.emit('slide-update', currentSlideData);
    }
    if (currentLiveState) {
      socket.emit('live-state', currentLiveState);
    }

    socket.on('disconnect', () => {
      console.log('Stage display disconnected');
    });
  });

  const ready = listenWithFallback(server, port, host).then((bound) => {
    console.log(`Live Stage Server running on http://${host}:${bound}`);
    return bound;
  });
  ready.catch(() => {}); // callers surface the error; this just prevents an unhandled-rejection warning

  return {
    ready,
    // closeAllConnections: open keep-alive connections would otherwise hold the port, and a restart would wait on them
    close: () => new Promise((resolve) => { io.close(); server.close(() => resolve()); server.closeAllConnections?.(); }),
    broadcastSlide: (slideData) => {
      currentSlideData = slideData;
      if (io) {
        io.emit('slide-update', slideData);
      }
    },
    broadcastLiveState: (state) => {
      currentLiveState = state;
      if (io) {
        io.emit('live-state', state);
      }
    }
  };
}

module.exports = { startServer };
