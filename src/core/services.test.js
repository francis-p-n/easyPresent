import { describe, it, expect } from 'vitest'
import {
  isValidDate,
  normalizeMeta,
  addDays,
  nextSunday,
  formatDate,
  relativeLabel,
  groupServices,
  filterServices,
  songCount,
  carryForwardMeta,
  nextService
} from './services.js'
import { createPlaylist, duplicatePlaylist, carryForwardPlaylist, setMeta } from './playlistOps.js'

const svc = (id, name, meta, items = []) => ({ id, name, items, ...(meta ? { meta } : {}) })

describe('dates', () => {
  it('accepts only real calendar dates', () => {
    expect(isValidDate('2026-03-01')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026-3-1')).toBe(false)
    expect(isValidDate('')).toBe(false)
    expect(isValidDate(null)).toBe(false)
  })

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('nope', 7)).toBe('')
  })

  it('finds the coming Sunday, or today when it is Sunday', () => {
    expect(nextSunday(new Date(2026, 9, 29))).toBe('2026-11-01') // Thursday
    expect(nextSunday(new Date(2026, 10, 1))).toBe('2026-11-01') // Sunday
    expect(nextSunday(new Date(2026, 10, 2))).toBe('2026-11-08') // Monday
  })

  it('labels dates', () => {
    expect(formatDate('2026-11-01', 'en-GB')).toContain('Nov')
    expect(formatDate('', 'en-GB')).toBe('No date')
    expect(relativeLabel('2026-11-01', '2026-11-01')).toBe('Today')
    expect(relativeLabel('2026-11-02', '2026-11-01')).toBe('Tomorrow')
    expect(relativeLabel('2026-11-06', '2026-11-01')).toBe('In 5 days')
    expect(relativeLabel('2026-10-29', '2026-11-01')).toBe('3 days ago')
    expect(relativeLabel('', '2026-11-01')).toBe('')
  })
})

describe('normalizeMeta', () => {
  it('fills every field and drops junk', () => {
    expect(normalizeMeta(undefined)).toMatchObject({ date: '', time: '', status: 'draft', speaker: '', host: '' })
    const m = normalizeMeta({ date: '2026-02-30', time: '25:00', status: 'bogus', speaker: '  Pastor Sam  ', extra: 1, host: 5 })
    expect(m.date).toBe('')
    expect(m.time).toBe('')
    expect(m.status).toBe('draft')
    expect(m.speaker).toBe('Pastor Sam')
    expect(m.host).toBe('')
    expect(m.extra).toBeUndefined()
  })

  it('caps very long text', () => {
    expect(normalizeMeta({ speaker: 'x'.repeat(500) }).speaker).toHaveLength(120)
    expect(normalizeMeta({ notes: 'x'.repeat(5000) }).notes).toHaveLength(2000)
  })
})

describe('grouping and filtering', () => {
  const today = '2026-11-01'
  const list = [
    svc('a', 'Old', { date: '2026-10-18' }),
    svc('b', 'Next', { date: '2026-11-08', time: '10:00' }),
    svc('c', 'Today', { date: '2026-11-01' }),
    svc('d', 'Legacy setlist'), // saved before details existed
    svc('e', 'Newer past', { date: '2026-10-25', speaker: 'Pastor Sam', host: 'Ana' })
  ]

  it('puts upcoming soonest first, past newest first, and undated last', () => {
    const g = groupServices(list, today)
    expect(g.upcoming.map((p) => p.id)).toEqual(['c', 'b'])
    expect(g.past.map((p) => p.id)).toEqual(['e', 'a'])
    expect(g.undated.map((p) => p.id)).toEqual(['d'])
  })

  it('searches names and details, every word must match', () => {
    expect(filterServices(list, 'sam').map((p) => p.id)).toEqual(['e'])
    expect(filterServices(list, 'ana pastor').map((p) => p.id)).toEqual(['e'])
    expect(filterServices(list, 'sam nobody')).toEqual([])
    expect(filterServices(list, '  ')).toBe(list)
  })

  it('opens on today or the next service', () => {
    expect(nextService(list, today).id).toBe('c')
    expect(nextService(list, '2027-01-01')).toBeNull()
  })

  it('counts songs only', () => {
    expect(songCount(svc('x', 'x', null, [{ type: 'header', text: 'h' }, { type: 'presentation', id: 'p1' }, { type: 'note', text: 'n' }]))).toBe(1)
  })
})

describe('carrying a service forward', () => {
  const week = svc('w', 'Sunday', { date: '2026-11-01', time: '10:00', type: 'Sunday service', speaker: 'Pastor Sam', title: 'Faith', scripture: 'Heb 11', host: 'Ana', team: 'Band A', notes: 'n', status: 'done' }, [{ type: 'presentation', id: 'p1' }])

  it('keeps the repeating details and clears the weekly ones', () => {
    const m = carryForwardMeta(week.meta)
    expect(m).toMatchObject({ date: '2026-11-08', time: '10:00', type: 'Sunday service', host: 'Ana', team: 'Band A', speaker: '', title: '', scripture: '', notes: '', status: 'draft' })
  })

  it('copies the songs into a new service without touching the original', () => {
    const next = carryForwardPlaylist(week, 'Sunday 8 Nov')
    expect(next.id).not.toBe(week.id)
    expect(next.items).toEqual(week.items)
    expect(next.items).not.toBe(week.items)
    expect(next.meta.date).toBe('2026-11-08')
    expect(week.meta.speaker).toBe('Pastor Sam')
  })

  it('plain duplicate keeps the details; create and setMeta normalise them', () => {
    expect(duplicatePlaylist(week).meta.speaker).toBe('Pastor Sam')
    expect(duplicatePlaylist(svc('z', 'z')).meta).toBeUndefined()
    expect(createPlaylist('New', { date: '2026-11-08', speaker: ' Jo ' }).meta).toMatchObject({ date: '2026-11-08', speaker: 'Jo' })
    expect(createPlaylist('Plain').meta).toBeUndefined()
    expect(setMeta(week, { host: 'Bo' }).meta.host).toBe('Bo')
  })
})
