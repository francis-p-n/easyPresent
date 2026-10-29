import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { state } from '../../core/StateManager.js'
import { ServicesHome } from './ServicesHome.js'
import { toDateString, addDays } from '../../core/services.js'

const today = toDateString(new Date())
const mk = (id, name, meta, items = []) => ({ id, name, items, ...(meta ? { meta } : {}) })

let host
let home
const cards = () => [...host.querySelectorAll('.service-card')].map((c) => c.dataset.id)

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  state.set('playlists', [
    mk('old', 'Old', { date: addDays(today, -14), speaker: 'Pastor Sam' }),
    mk('soon', 'Soon', { date: addDays(today, 7), speaker: 'Jo', host: 'Ana', title: 'Faith', scripture: 'Heb 11' }, [{ type: 'presentation', id: 'p1' }]),
    mk('now', 'Now', { date: today }),
    mk('legacy', 'Legacy')
  ])
  state.set('activePlaylist', null)
  home = new ServicesHome(host)
  home.open()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ServicesHome', () => {
  it('lists upcoming by date, then undated, then past', () => {
    expect(cards()).toEqual(['now', 'soon', 'legacy', 'old'])
  })

  it('shows speaker, host, sermon and song count as text', () => {
    const card = host.querySelector('[data-id="soon"]')
    expect(card.textContent).toContain('Jo')
    expect(card.textContent).toContain('Ana')
    expect(card.textContent).toContain('Faith · Heb 11')
    expect(card.textContent).toContain('1 song')
    expect(host.querySelector('[data-id="now"]').textContent).toContain('Today')
    expect(host.querySelector('[data-id="legacy"]').textContent).toContain('No speaker or host set')
  })

  it('never turns typed text into markup', () => {
    state.set('playlists', [mk('x', '<img src=x onerror=alert(1)>', { date: today, speaker: '<b>bold</b>' })])
    home.render()
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('b')).toBeNull()
    expect(host.textContent).toContain('<b>bold</b>')
  })

  it('searches by speaker', () => {
    const search = host.querySelector('.services-search')
    search.value = 'pastor'
    search.dispatchEvent(new window.Event('input'))
    expect(cards()).toEqual(['old'])
    host.querySelector('.services-search').value = 'zzz'
    host.querySelector('.services-search').dispatchEvent(new window.Event('input'))
    expect(host.textContent).toContain('Nothing matches')
  })

  it('opening a service makes it the active one and hides the page', () => {
    host.querySelector('[data-id="soon"] .service-card__main').click()
    expect(state.get('activePlaylist').id).toBe('soon')
    expect(host.hidden).toBe(true)
  })

  it('creates a service with its details from the dialog', () => {
    host.querySelector('#services-new').click()
    const dialog = document.getElementById('service-dialog')
    const inputs = [...dialog.querySelectorAll('input,textarea,select')]
    const byLabel = (label) => inputs.find((i) => i.closest('label')?.textContent.startsWith(label))
    byLabel('Name').value = 'Easter'
    byLabel('Speaker').value = '  Pastor Lee '
    byLabel('Host').value = 'Ana'
    dialog.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }))
    const made = state.get('playlists').find((p) => p.name === 'Easter')
    expect(made.meta).toMatchObject({ speaker: 'Pastor Lee', host: 'Ana' })
    expect(made.meta.date).not.toBe('')
    expect(state.get('activePlaylist').id).toBe(made.id)
    expect(document.getElementById('service-dialog')).toBeNull()
  })

  it('"Next week" copies the songs a week on with the speaker cleared', () => {
    const [, again] = host.querySelectorAll('[data-id="soon"] .service-card__actions .btn')
    again.click()
    const copy = state.get('playlists').find((p) => p.id !== 'soon' && p.items.length === 1)
    expect(copy.meta.date).toBe(addDays(today, 14))
    expect(copy.meta.speaker).toBe('')
    expect(copy.meta.host).toBe('Ana')
    expect(document.getElementById('service-dialog')).not.toBeNull()
  })

  it('deleting needs a second click', () => {
    host.querySelector('[data-id="old"] .service-card__actions .btn').click()
    const del = document.querySelector('#service-dialog .btn--danger')
    del.click()
    expect(state.get('playlists').some((p) => p.id === 'old')).toBe(true)
    del.click()
    expect(state.get('playlists').some((p) => p.id === 'old')).toBe(false)
  })
})
