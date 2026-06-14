const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

let io;
let currentSlideData = null;

function startServer(port = 8080) {
  const app = express();
  const server = http.createServer(app);
  io = new Server(server, {
    cors: { origin: '*' }
  });

  // Serve static files for the stage display
  app.use(express.static(path.join(__dirname, '../public/stage')));

  io.on('connection', (socket) => {
    console.log('Stage display connected');
    if (currentSlideData) {
      socket.emit('slide-update', currentSlideData);
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
    }
  };
}

module.exports = { startServer };
