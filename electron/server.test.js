import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './server';
import { io as Client } from 'socket.io-client';

describe('Stage Server Integration', () => {
  let stageServer;
  let clientSocket;
  const port = 8085; // use different port for testing

  beforeAll(async () => {
    stageServer = startServer(port);
    clientSocket = Client(`http://localhost:${port}`);
    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterAll(() => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  it('should broadcast slide updates to connected clients', () => {
    return new Promise((resolve) => {
      const testSlide = { text: 'Hello Stage' };

      clientSocket.on('slide-update', (data) => {
        expect(data).toEqual(testSlide);
        resolve();
      });

      stageServer.broadcastSlide(testSlide);
    });
  });
});
