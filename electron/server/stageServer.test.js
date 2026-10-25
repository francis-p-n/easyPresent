import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './stageServer';
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

  it('replays the latest live-state to late joiners and serves role views', async () => {
    const live = { title: 'Sunday', onAir: true, current: { label: 'Verse 1', text: 'hi' }, next: null };
    stageServer.broadcastLiveState(live);

    const late = Client(`http://localhost:${port}`);
    const got = await new Promise((resolve) => late.on('live-state', resolve));
    late.disconnect();
    expect(got).toEqual(live);

    for (const view of ['presenter', 'pa']) {
      const res = await fetch(`http://localhost:${port}/${view}/`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('live-state');
    }
  });
});
