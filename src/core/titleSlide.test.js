import { describe, it, expect } from 'vitest'
import { titleDate, titleWords, createTitlePresentation, refreshTitleSlides, cloneTitleSlides, isTitlePresentation, titleKindOf } from './titleSlide.js'
import { renderSlideLayout, hasLayout } from './slideLayout.js'

const service = (meta, extra = {}) => ({ id: 'svc1', name: 'Sunday', items: [], meta, ...extra })
const meta = { church: 'Community Church', type: 'Sunday service', speaker: 'Pastor Connor Hamilton', date: '2026-08-30' }

describe('the words', () => {
  it('formats the date like the template', () => {
    expect(titleDate('2026-08-30')).toBe('2026 AUGUST 30')
    expect(titleDate('')).toBe('')
    expect(titleDate('2026-02-30')).toBe('')
  })

  it('upper-cases the church, service, speaker', () => {
    expect(titleWords(meta)).toEqual({
      church: 'COMMUNITY CHURCH',
      welcome: 'Welcome to',
      title: 'SUNDAY SERVICE',
      speaker: 'PASTOR CONNOR HAMILTON',
      date: '2026 AUGUST 30'
    })
  })

  it('copes with no details at all', () => {
    expect(titleWords(undefined)).toMatchObject({ church: '', title: 'SERVICE', speaker: '', date: '' })
  })
})

describe('the slide', () => {
  it('is a positioned layout with the five roles, tied to its service', () => {
    const p = createTitlePresentation(service(meta))
    expect(isTitlePresentation(p)).toBe(true)
    expect(p.serviceId).toBe('svc1')
    const slide = p.slides[0]
    expect(hasLayout(slide)).toBe(true)
    expect(slide.elements.map((e) => e.role)).toEqual(['church', 'welcome', 'title', 'speaker', 'date'])
    expect(slide.text).toContain('PASTOR CONNOR HAMILTON')
  })

  it('draws letter-spaced text with its own font in the layout renderer', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    renderSlideLayout(host, createTitlePresentation(service(meta)).slides[0])
    const church = [...host.querySelectorAll('div')].find((d) => d.textContent === 'COMMUNITY CHURCH' && d.style.letterSpacing)
    expect(church.style.letterSpacing).toBe('0.16em')
    expect(host.innerHTML).toContain('Great Vibes')
  })
})

describe('keeping it up to date', () => {
  it('changes only the words, keeping fonts the operator adjusted', () => {
    const svc = service(meta)
    const p = createTitlePresentation(svc)
    p.slides[0].elements.find((e) => e.role === 'title').fontFamily = 'Lobster'
    const next = refreshTitleSlides({ ...svc, meta: { ...meta, speaker: 'Jo Lee' } }, [p, { id: 'other', slides: [] }])
    const title = next[0].slides[0].elements.find((e) => e.role === 'title')
    expect(next[0].slides[0].elements.find((e) => e.role === 'speaker').text).toBe('JO LEE')
    expect(title.fontFamily).toBe('Lobster')
    expect(next[0].slides[0].text).toContain('JO LEE')
    expect(next[1]).toEqual({ id: 'other', slides: [] })
  })

  it('returns the same list when nothing changed, and ignores other services', () => {
    const p = createTitlePresentation(service(meta))
    const list = [p]
    expect(refreshTitleSlides(service(meta), list)).toBe(list)
    expect(refreshTitleSlides({ id: 'other', meta: { ...meta, speaker: 'X' } }, list)).toBe(list)
  })
})

describe('next week', () => {
  it('gets its own welcome slide, leaving last week alone', () => {
    const last = service(meta)
    const p = createTitlePresentation(last)
    const lastWithSlide = { ...last, items: [{ type: 'presentation', id: p.id }] }
    const copy = { id: 'svc2', name: 'Next', items: [...lastWithSlide.items], meta: { ...meta, date: '2026-09-06', speaker: '' } }
    const out = cloneTitleSlides(copy, [p])
    expect(out.presentations).toHaveLength(2)
    const mine = out.presentations.find((x) => x.id === out.playlist.items[0].id)
    expect(mine.id).not.toBe(p.id)
    expect(mine.serviceId).toBe('svc2')
    expect(mine.slides[0].id).not.toBe(p.slides[0].id)
    expect(mine.slides[0].elements.find((e) => e.role === 'date').text).toBe('2026 SEPTEMBER 6')
    expect(mine.slides[0].elements.find((e) => e.role === 'speaker').text).toBe('')
    expect(p.slides[0].elements.find((e) => e.role === 'speaker').text).toBe('PASTOR CONNOR HAMILTON')
  })

  it('leaves ordinary songs alone', () => {
    const copy = { id: 'svc2', items: [{ type: 'presentation', id: 'song' }, { type: 'header', text: 'h' }] }
    const songs = [{ id: 'song', slides: [] }]
    const out = cloneTitleSlides(copy, songs)
    expect(out.presentations).toBe(songs)
    expect(out.playlist.items).toEqual(copy.items)
  })
})

describe('the sermon slide', () => {
  const sermon = { ...meta, title: 'Faith under pressure', scripture: 'Hebrews 11:1-6' }

  it('shows the message title and passage, speaker and date', () => {
    const p = createTitlePresentation(service(sermon), 'sermon')
    expect(titleKindOf(p)).toBe('sermon')
    expect(p.slides[0].elements.map((e) => e.role)).toEqual(['label', 'title', 'scripture', 'speaker', 'date'])
    const text = (role) => p.slides[0].elements.find((e) => e.role === role).text
    expect(text('title')).toBe('FAITH UNDER PRESSURE')
    expect(text('scripture')).toBe('Hebrews 11:1-6')
    expect(text('speaker')).toBe('PASTOR CONNOR HAMILTON')
  })

  it('follows the details separately from the welcome slide', () => {
    const svc = service(sermon)
    const welcome = createTitlePresentation(svc)
    const msg = createTitlePresentation(svc, 'sermon')
    const next = refreshTitleSlides({ ...svc, meta: { ...sermon, title: 'Hope', scripture: 'Romans 8' } }, [welcome, msg])
    const el = (p, role) => p.slides[0].elements.find((e) => e.role === role).text
    expect(el(next[1], 'title')).toBe('HOPE')
    expect(el(next[1], 'scripture')).toBe('Romans 8')
    expect(el(next[0], 'title')).toBe('SUNDAY SERVICE') // the welcome slide's "title" is the service type
    expect(titleKindOf(welcome)).toBe('welcome')
    expect(titleKindOf({ id: 'song', slides: [] })).toBeNull()
  })

  it('next week clears the sermon but keeps the church and type', () => {
    const svc = service(sermon)
    const p = createTitlePresentation(svc, 'sermon')
    const copy = { id: 'svc2', name: 'Next', items: [{ type: 'presentation', id: p.id }], meta: { ...sermon, date: '2026-09-06', title: '', scripture: '', speaker: '' } }
    const out = cloneTitleSlides(copy, [p])
    const made = out.presentations.find((x) => x.id === out.playlist.items[0].id)
    expect(made.titleKind).toBe('sermon')
    expect(made.slides[0].elements.find((e) => e.role === 'title').text).toBe('')
    expect(p.slides[0].elements.find((e) => e.role === 'title').text).toBe('FAITH UNDER PRESSURE')
  })
})
