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

describe('Outside control (HTTP API)', () => {
  const port = 8086;
  const commands = [];
  let server;

  beforeAll(async () => {
    server = startServer(port, 'localhost', { getApiKey: () => 'secretkey1', onCommand: (c) => commands.push(c) });
    await server.ready;
    server.broadcastLiveState({ title: 'Sunday', onAir: true });
  });
  afterAll(() => server.close());

  const call = (p, init) => fetch(`http://localhost:${port}/api/${p}`, init);

  it('runs a command with the right key, from a link or a header', async () => {
    const a = await call('next?key=secretkey1');
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual({ ok: true, command: 'next' });
    const b = await call('clear', { method: 'POST', headers: { 'X-Api-Key': 'secretkey1' } });
    expect(b.status).toBe(200);
    expect(commands).toEqual(['next', 'clear']);
  });

  it('refuses a missing or wrong key and runs nothing', async () => {
    const before = commands.length;
    expect((await call('next')).status).toBe(401);
    expect((await call('next?key=wrong')).status).toBe(401);
    expect((await call('next?key=secretkey')).status).toBe(401);
    expect(commands.length).toBe(before);
  });

  it('only knows the remote commands, and says which', async () => {
    const res = await call('shutdown?key=secretkey1');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('unknown-command');
    expect(body.commands).toContain('nextSong');
  });

  it('reports what is live', async () => {
    const res = await call('status?key=secretkey1');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.live.title).toBe('Sunday');
  });

  it('rejects other methods and turns away an address that keeps guessing', async () => {
    expect((await call('next?key=secretkey1', { method: 'DELETE' })).status).toBe(405);
    for (let i = 0; i < 12; i++) await call('next?key=nope');
    const locked = await call('next?key=secretkey1');
    expect(locked.status).toBe(429);
  });
});
