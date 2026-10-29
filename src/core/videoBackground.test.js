import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isVideoFileName, fileUrlFromPath, videoLabel, isVideoBackground, placeBackgroundVideo } from './videoBackground.js'

describe('file helpers', () => {
  it('recognises video files', () => {
    expect(['a.mp4', 'a.MOV', 'a.webm'].every(isVideoFileName)).toBe(true)
    expect(isVideoFileName('a.png')).toBe(false)
  })

  it('turns Windows and POSIX paths into file URLs', () => {
    expect(fileUrlFromPath('C:\\Videos\\loop 1.mp4')).toBe('file:///C:/Videos/loop%201.mp4')
    expect(fileUrlFromPath('/home/me/a b.mp4')).toBe('file:///home/me/a%20b.mp4')
    expect(fileUrlFromPath('file:///x/y.mp4')).toBe('file:///x/y.mp4')
    expect(fileUrlFromPath('')).toBeNull()
  })

  it('names the file for the operator', () => {
    expect(videoLabel('file:///C:/Videos/loop%201.mp4')).toBe('loop 1.mp4')
  })

  it('only a video background with a path counts', () => {
    expect(isVideoBackground({ type: 'video', mediaPath: 'file:///a.mp4' })).toBe(true)
    expect(isVideoBackground({ type: 'media', mediaPath: 'data:x' })).toBe(false)
    expect(isVideoBackground({ type: 'video' })).toBe(false)
    expect(isVideoBackground(null)).toBe(false)
  })
})

describe('placeBackgroundVideo', () => {
  window.HTMLMediaElement.prototype.play = () => Promise.resolve() // jsdom has no media playback
  let host
  beforeEach(() => {
    host = document.createElement('div')
    host.innerHTML = '<div id="text">words</div>'
    document.body.appendChild(host)
  })

  afterEach(() => host.remove())

  const bg = { type: 'video', mediaPath: 'file:///a.mp4' }

  it('puts a muted looping video behind the content', () => {
    const v = placeBackgroundVideo(host, bg)
    expect(host.firstChild).toBe(v)
    expect(v.muted && v.loop && v.autoplay).toBe(true)
    expect(v.getAttribute('src')).toBe('file:///a.mp4')
    expect(v.style.zIndex).toBe('-1')
    expect(host.querySelector('#text')).not.toBeNull()
  })

  it('keeps the same playing element for the same file, replaces it for another', () => {
    const first = placeBackgroundVideo(host, bg)
    expect(placeBackgroundVideo(host, bg)).toBe(first)
    const second = placeBackgroundVideo(host, { type: 'video', mediaPath: 'file:///b.mp4' })
    expect(second).not.toBe(first)
    expect(host.querySelectorAll('video')).toHaveLength(1)
  })

  it('re-attaches a kept element after the host was cleared', () => {
    const first = placeBackgroundVideo(host, bg)
    first.remove()
    host.innerHTML = ''
    expect(placeBackgroundVideo(host, bg, 'output-bg-video', first)).toBe(first)
    expect(host.firstChild).toBe(first)
  })

  it('removes the video when the background is not a video', () => {
    placeBackgroundVideo(host, bg)
    placeBackgroundVideo(host, { type: 'color', color: '#000' })
    expect(host.querySelector('video')).toBeNull()
  })
})
