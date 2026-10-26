const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { staticDirs } = require('../paths');

let io;
let currentSlideData = null;
let currentLiveState = null;

const PORT_ATTEMPTS = 10 // if 8080 is taken, try 8081 ... 8090 before giving up

/** Listens on `port`, moving to the next port when one is in use. Resolves with the port actually bound. */
function listenWithFallback(server, port, attemptsLeft = PORT_ATTEMPTS) {
  return new Promise((resolve, reject) => {
    const attempt = (p, left) => {
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
      server.listen(p)
    }
    attempt(port, attemptsLeft)
  })
}

/**
 * Starts the stage/presenter/PA web server. Returns the broadcast functions
 * immediately plus `ready`, a promise for the port that was actually bound
 * (it rejects, with the reason, if no port could be used).
 */
function startServer(port = 8080) {
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

  const ready = listenWithFallback(server, port).then((bound) => {
    console.log(`Live Stage Server running on http://localhost:${bound}`);
    return bound;
  });
  ready.catch(() => {}); // callers surface the error; this just prevents an unhandled-rejection warning

  return {
    ready,
    close: () => new Promise((resolve) => { io.close(); server.close(() => resolve()); }),
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
