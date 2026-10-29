import { describe, it, expect } from 'vitest'
import {
  isImageFileName,
  isVideoFileName,
  isAudioFileName,
  nameFromFile,
  cleanMediaLibrary,
  cleanAudioLibrary,
  addMediaItem,
  addAudioItem,
  removeItem,
  formatDuration
} from './mediaLibrary.js'

const IMG = 'data:image/png;base64,AAAA'

describe('file kinds and names', () => {
  it('sorts files by extension', () => {
    expect(['a.PNG', 'b.jpeg', 'c.svg'].every(isImageFileName)).toBe(true)
    expect(['a.mp4', 'b.webm', 'c.MOV'].every(isVideoFileName)).toBe(true)
    expect(['a.mp3', 'b.wav', 'c.m4a'].every(isAudioFileName)).toBe(true)
    expect(isImageFileName('a.mp4')).toBe(false)
    expect(isAudioFileName('')).toBe(false)
  })

  it('makes a readable name', () => {
    expect(nameFromFile('Worship_loop-2.mp4')).toBe('Worship loop 2')
    expect(nameFromFile('.mp4')).toBe('Untitled')
  })
})

describe('cleaning', () => {
  it('keeps only real pictures and videos', () => {
    const list = cleanMediaLibrary([
      { id: 'a', name: 'Sky.png', type: 'image', src: IMG },
      { id: 'b', name: 'Loop.mp4', type: 'video', src: 'file:///C:/v/loop.mp4' },
      { id: 'c', name: 'Bad', type: 'video', src: 'http://evil/x.mp4' }, // only files on this computer
      { id: 'd', name: 'Bad', type: 'image', src: 'javascript:alert(1)' },
      { id: 'e', name: 'Bad', type: 'audio', src: IMG },
      null
    ])
    expect(list.map((m) => m.id)).toEqual(['a', 'b'])
    expect(list[0].name).toBe('Sky')
    expect(cleanMediaLibrary('nope')).toEqual([])
  })

  it('keeps only audio files on this computer, with a usable length', () => {
    const list = cleanAudioLibrary([
      { id: 'a', name: 'Walk-on.mp3', src: 'file:///C:/a/walk.mp3', duration: 15.4 },
      { id: 'b', name: 'x', src: 'https://evil/x.mp3' },
      { name: 'No id', src: 'file:///C:/a/b.wav', duration: -3 }
    ])
    expect(list).toHaveLength(2)
    expect(list[1].id).toMatch(/^audio-/)
    expect(list[1].duration).toBe(0)
  })

  it('adds and removes items', () => {
    let m = addMediaItem([], { name: 'Sky', type: 'image', src: IMG })
    m = addMediaItem(m, { name: 'Loop', type: 'video', src: 'file:///C:/v/loop.mp4' })
    expect(m).toHaveLength(2)
    expect(removeItem(m, m[0].id)).toHaveLength(1)
    expect(addAudioItem([], { name: 'a', src: 'file:///C:/a.mp3', duration: 5 })).toHaveLength(1)
    expect(addMediaItem([], { name: 'bad', type: 'image', src: 'x' })).toEqual([])
  })

  it('formats lengths', () => {
    expect(formatDuration(185)).toBe('3:05')
    expect(formatDuration(0)).toBe('')
    expect(formatDuration('x')).toBe('')
  })
})
