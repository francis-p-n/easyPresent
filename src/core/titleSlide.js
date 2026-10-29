/**
 * titleSlide — the welcome slide of a service, filled in from its details.
 *
 * Layout (1920x1080): the church name small and widely spaced at the top, a script "Welcome to"
 * overlapping the large service name in the middle, the speaker bottom left and the date bottom right.
 * It is an ordinary positioned-layout slide, so it takes the service's background and can be restyled.
 *
 * Each text box has a `role`. When the service's details change only the words are replaced, so
 * fonts, sizes and positions the operator has adjusted are kept.
 */

import { metaOf, isValidDate } from './services.js'

export const TITLE_CATEGORY = 'Service'
export const TITLE_FONTS = { script: 'Great Vibes', display: 'Playfair Display', small: 'Montserrat' }

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

/** "2026-08-30" -> "2026 AUGUST 30" (blank when there is no date). */
export function titleDate(dateStr) {
  if (!isValidDate(dateStr)) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y} ${MONTHS[m - 1]} ${d}`
}

/** The words each role shows, from a service's details. */
export function titleWords(meta) {
  const m = metaOf({ meta })
  return {
    church: m.church.toUpperCase(),
    welcome: 'Welcome to',
    title: (m.type || 'Service').toUpperCase(),
    speaker: m.speaker.toUpperCase(),
    date: titleDate(m.date)
  }
}

const slideId = () => 'slide-' + Math.random().toString(36).slice(2, 11)
const presentationId = () => 'title-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/** The five text boxes, positioned like the reference design. */
export function titleElements(words) {
  const base = { vAlign: 'center', lineSpacing: 1.1, color: '#ffffff' }
  return [
    { ...base, role: 'church', text: words.church, x: 0, y: 56, width: 1920, height: 70, fontSize: 34, fontFamily: TITLE_FONTS.small, bold: true, hAlign: 'center', letterSpacing: 0.16 },
    { ...base, role: 'welcome', text: words.welcome, x: 160, y: 300, width: 1600, height: 320, fontSize: 200, fontFamily: TITLE_FONTS.script, bold: false, hAlign: 'center' },
    { ...base, role: 'title', text: words.title, x: 60, y: 440, width: 1800, height: 300, fontSize: 200, fontFamily: TITLE_FONTS.display, bold: false, hAlign: 'center' },
    { ...base, role: 'speaker', text: words.speaker, x: 90, y: 930, width: 900, height: 70, fontSize: 32, fontFamily: TITLE_FONTS.small, bold: true, hAlign: 'left', letterSpacing: 0.12 },
    { ...base, role: 'date', text: words.date, x: 930, y: 930, width: 900, height: 70, fontSize: 32, fontFamily: TITLE_FONTS.small, bold: true, hAlign: 'right', letterSpacing: 0.12 }
  ]
}

const joinText = (elements) => elements.map((e) => e.text).filter(Boolean).join('\n')

/** A new library entry holding the welcome slide for `playlist`. */
export function createTitlePresentation(playlist) {
  const elements = titleElements(titleWords(playlist.meta))
  return {
    id: presentationId(),
    name: 'Welcome',
    category: TITLE_CATEGORY,
    serviceId: playlist.id,
    slides: [{ id: slideId(), group: 'intro', label: 'Welcome', text: joinText(elements), elements }]
  }
}

/** Is this library entry a generated welcome slide? */
export const isTitlePresentation = (p) => !!p && typeof p.serviceId === 'string' && p.category === TITLE_CATEGORY

/**
 * Puts the service's current details into its welcome slides. Returns the same array when nothing
 * changed, so callers can skip a state update.
 */
export function refreshTitleSlides(playlist, presentations) {
  const words = titleWords(playlist.meta)
  let changed = false
  const next = (presentations || []).map((p) => {
    if (!isTitlePresentation(p) || p.serviceId !== playlist.id) return p
    const slides = p.slides.map((slide) => {
      let touched = false
      const elements = (slide.elements || []).map((el) => {
        if (!el.role || !(el.role in words) || el.text === words[el.role]) return el
        touched = true
        return { ...el, text: words[el.role] }
      })
      if (!touched) return slide
      return { ...slide, elements, text: joinText(elements) }
    })
    if (slides.every((s, i) => s === p.slides[i])) return p
    changed = true
    return { ...p, slides }
  })
  return changed ? next : presentations
}

/**
 * For a service copied from another: gives the copy its own welcome slides (a copy of each one the
 * source uses, tied to the new service) so changing next week's speaker never changes last week's slide.
 * Returns { playlist, presentations }.
 */
export function cloneTitleSlides(copy, presentations) {
  const added = []
  const items = copy.items.map((item) => {
    if (item.type !== 'presentation') return item
    const source = (presentations || []).find((p) => p.id === item.id)
    if (!isTitlePresentation(source)) return item
    const clone = {
      ...source,
      id: presentationId(),
      serviceId: copy.id,
      slides: source.slides.map((s) => ({ ...s, id: slideId(), elements: (s.elements || []).map((e) => ({ ...e })) }))
    }
    added.push(clone)
    return { ...item, id: clone.id }
  })
  const playlist = { ...copy, items }
  if (!added.length) return { playlist: copy, presentations }
  return { playlist, presentations: refreshTitleSlides(playlist, [...(presentations || []), ...added]) }
}
