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

describe('Phone remote', () => {
  const port = 8086;
  let server;
  const received = [];
  const connect = async () => {
    const c = Client(`http://localhost:${port}`);
    await new Promise((resolve) => c.on('connect', resolve));
    return c;
  };
  const ask = (c, msg) => new Promise((resolve) => c.emit('remote-command', msg, resolve));

  beforeAll(async () => {
    server = startServer(port, 'localhost', { getPin: () => '4821', onCommand: (cmd) => received.push(cmd) });
    await server.ready;
  });
  afterAll(() => server.close());

  it('serves the remote page', async () => {
    const res = await fetch(`http://localhost:${port}/remote/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('remote-command');
  });

  it('relays commands carrying the right PIN', async () => {
    const c = await connect();
    expect(await ask(c, { cmd: 'next', pin: '4821' })).toEqual({ ok: true });
    expect(await ask(c, { cmd: 'clear', pin: '4821' })).toEqual({ ok: true });
    expect(received).toEqual(['next', 'clear']);
    c.disconnect();
  });

  it('rejects a wrong or missing PIN and relays nothing', async () => {
    received.length = 0;
    const c = await connect();
    expect((await ask(c, { cmd: 'next', pin: '0000' })).ok).toBe(false);
    expect((await ask(c, { cmd: 'next' })).ok).toBe(false);
    expect((await ask(c, null)).ok).toBe(false);
    expect(received).toEqual([]);
    c.disconnect();
  });

  it('only relays whitelisted commands; check validates the PIN without acting', async () => {
    received.length = 0;
    const c = await connect();
    expect(await ask(c, { cmd: 'delete-everything', pin: '4821' })).toEqual({ ok: false, error: 'bad-command' });
    expect(await ask(c, { cmd: 'check', pin: '4821' })).toEqual({ ok: true });
    expect(received).toEqual([]);
    c.disconnect();
  });

  it('drops a connection that keeps guessing', async () => {
    const c = await connect();
    const closed = new Promise((resolve) => c.on('disconnect', resolve));
    for (let i = 0; i < 5; i++) c.emit('remote-command', { cmd: 'next', pin: String(1000 + i) }, () => {});
    await closed;
    expect(c.connected).toBe(false);
  });

  it('is disabled when no PIN is configured', async () => {
    const other = startServer(8087, 'localhost', { onCommand: (cmd) => received.push(cmd) });
    await other.ready;
    const c = Client('http://localhost:8087');
    await new Promise((resolve) => c.on('connect', resolve));
    expect((await new Promise((r) => c.emit('remote-command', { cmd: 'next', pin: '' }, r))).ok).toBe(false);
    c.disconnect();
    await other.close();
  });
});
