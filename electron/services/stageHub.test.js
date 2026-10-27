import { describe, it, expect, afterAll } from 'vitest'
import net from 'node:net'
import os from 'node:os'

// The hub reads its port when it loads, so pick one that is unlikely to be taken
process.env.EASYPRESENT_PORT = '18431'
const { createStageHub } = await import('./stageHub.js')

const lan = Object.values(os.networkInterfaces())
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address

/** Can a TCP connection be made to host:port right now? */
const reachable = (host, port) =>
  new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: 1500 })
    s.once('connect', () => (s.destroy(), resolve(true)))
    s.once('error', () => resolve(false))
    s.once('timeout', () => (s.destroy(), resolve(false)))
  })

const hub = createStageHub()
afterAll(async () => {
  await hub.unshare()
})

describe('stageHub sharing', () => {
  it('is not shared when it starts, and lists no phone addresses', async () => {
    const port = await hub.start()
    const status = hub.status()
    expect(status.running).toBe(true)
    expect(status.sharing).toBe(false)
    expect(status.urls).toEqual([])
    expect(await reachable('localhost', port)).toBe(true)
  })

  it.skipIf(!lan)('only answers on this computer until sharing is switched on, and again once it is switched off', async () => {
    const port = await hub.start()
    expect(await reachable(lan, port)).toBe(false)

    await hub.share()
    expect(hub.status().sharing).toBe(true)
    expect(hub.status().urls.length).toBeGreaterThan(0)
    expect(await reachable(lan, hub.status().port)).toBe(true)

    await hub.unshare()
    expect(hub.status().sharing).toBe(false)
    expect(await reachable(lan, hub.status().port)).toBe(false)
    expect(await reachable('localhost', hub.status().port)).toBe(true)
  })
})
