const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

let io;
let currentSlideData = null;
let currentLiveState = null;

function startServer(port = 8080) {
  const app = express();
  const server = http.createServer(app);
  io = new Server(server, {
    cors: { origin: '*' }
  });

  // Serve static files for the stage display. public/stage is the source of
  // truth in the repo; packaged builds only ship dist/ (vite copies public/*
  // into it), so fall through to dist/stage when public/ isn't present.
  app.use(express.static(path.join(__dirname, '../public/stage')));
  app.use(express.static(path.join(__dirname, '../dist/stage')));

  // Role views: /presenter (pastor: current + next + clock) and /pa (PA team:
  // output confirmation, cue list, timers). Both are read-only clients of the
  // same socket feed, so they work on any phone/laptop on the venue Wi-Fi.
  for (const view of ['presenter', 'pa']) {
    app.use('/' + view, express.static(path.join(__dirname, '../public/' + view)));
    app.use('/' + view, express.static(path.join(__dirname, '../dist/' + view)));
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

  server.listen(port, () => {
    console.log(`Live Stage Server running on http://localhost:${port}`);
  });

  return {
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
