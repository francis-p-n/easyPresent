import { state } from '../../core/StateManager.js'
import * as ops from '../../core/playlistOps.js'
import {
  STATUSES,
  STATUS_LABELS,
  SERVICE_TYPES,
  metaOf,
  groupServices,
  filterServices,
  songCount,
  formatDate,
  relativeLabel,
  toDateString,
  nextSunday,
  addDays
} from '../../core/services.js'
import { showToast } from '../../components/common/ToastManager.js'

const PAST_SHOWN = 8

const el = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

/**
 * ServicesHome — the page the app opens on: every service (setlist) with its date, speaker, host
 * and status, upcoming first. Opening one hands it to the editor and the live panels.
 *
 * Everything the operator typed is written with textContent, never innerHTML.
 */
export class ServicesHome {
  constructor(container) {
    this.container = container
    this.query = ''
    this.showAllPast = false
    this.visible = false
    container.className = 'services-home'
    container.id = 'services-home'
    container.setAttribute('role', 'region')
    container.setAttribute('aria-label', 'Services')
    container.hidden = true
    state.on('playlists', () => this.visible && this.render())
  }

  open() {
    this.visible = true
    this.container.hidden = false
    this.render()
    this.container.querySelector('.services-search')?.focus({ preventScroll: true })
  }

  close() {
    this.visible = false
    this.container.hidden = true
  }

  toggle() {
    if (this.visible) this.close()
    else this.open()
  }

  // ---- page ------------------------------------------------------------

  render() {
    const today = toDateString(new Date())
    const all = state.get('playlists') || []
    const filtered = filterServices(all, this.query)
    const { upcoming, past, undated } = groupServices(filtered, today)

    const page = el('div', 'services-page')

    const head = el('div', 'services-head')
    head.appendChild(el('h1', 'services-title', 'Services'))
    const search = el('input', 'input services-search')
    search.type = 'search'
    search.placeholder = 'Search by name, speaker, host, date…'
    search.setAttribute('aria-label', 'Search services')
    search.value = this.query
    search.addEventListener('input', () => {
      this.query = search.value
      const pos = search.selectionStart
      this.render()
      const next = this.container.querySelector('.services-search')
      next.focus({ preventScroll: true })
      next.setSelectionRange(pos, pos)
    })
    head.appendChild(search)
    const create = el('button', 'btn btn--primary', 'New service')
    create.id = 'services-new'
    create.addEventListener('click', () => this._editDialog(null))
    head.appendChild(create)
    if (state.get('activePlaylist')) {
      const back = el('button', 'btn', 'Back to editor')
      back.id = 'services-back'
      back.addEventListener('click', () => this.close())
      head.appendChild(back)
    }
    page.appendChild(head)

    if (!all.length) {
      page.appendChild(this._empty('No services yet', 'Create one for this Sunday. You can add the speaker, host and songs after.'))
    } else if (!filtered.length) {
      page.appendChild(this._empty('Nothing matches', `No service matches “${this.query.trim()}”.`))
    } else {
      this._section(page, 'Upcoming', upcoming, today, 'No upcoming services. Plan next week from a past one.')
      this._section(page, 'No date yet', undated, today)
      const shown = this.showAllPast || this.query.trim() ? past : past.slice(0, PAST_SHOWN)
      this._section(page, 'Past', shown, today)
      if (shown.length < past.length) {
        const more = el('button', 'btn services-more', `Show ${past.length - shown.length} earlier`)
        more.addEventListener('click', () => {
          this.showAllPast = true
          this.render()
        })
        page.appendChild(more)
      }
    }

    this.container.textContent = ''
    this.container.appendChild(page)
  }

  _empty(title, text) {
    const box = el('div', 'services-empty')
    box.append(el('div', 'services-empty__title', title), el('div', 'services-empty__text', text))
    return box
  }

  _section(page, title, list, today, emptyText) {
    if (!list.length && !emptyText) return
    const section = el('section', 'services-section')
    section.appendChild(el('h2', 'services-section__title', title))
    if (!list.length) section.appendChild(el('div', 'services-section__empty', emptyText))
    for (const playlist of list) section.appendChild(this._card(playlist, today))
    page.appendChild(section)
  }

  _card(playlist, today) {
    const m = metaOf(playlist)
    const card = el('div', 'service-card')
    card.dataset.id = playlist.id
    if (m.date && m.date === today) card.classList.add('service-card--today')
    if (state.get('activePlaylist')?.id === playlist.id) card.classList.add('service-card--open')

    const open = el('button', 'service-card__main')
    open.type = 'button'
    open.setAttribute('aria-label', `Open ${playlist.name}`)
    open.addEventListener('click', () => this.openService(playlist.id))

    const date = el('div', 'service-card__date')
    if (m.date) {
      const [y, mo, d] = m.date.split('-').map(Number)
      const when = new Date(Date.UTC(y, mo - 1, d))
      date.append(
        el('span', 'service-card__month', when.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })),
        el('span', 'service-card__day', String(d)),
        el('span', 'service-card__weekday', when.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }))
      )
    } else {
      date.appendChild(el('span', 'service-card__nodate', 'No date'))
    }

    const body = el('div', 'service-card__body')
    const titleRow = el('div', 'service-card__titlerow')
    titleRow.appendChild(el('span', 'service-card__name', playlist.name))
    const rel = relativeLabel(m.date, today)
    if (rel) titleRow.appendChild(el('span', 'service-card__rel', rel))
    body.appendChild(titleRow)
    if (m.title) body.appendChild(el('div', 'service-card__sermon', m.scripture ? `${m.title} · ${m.scripture}` : m.title))

    const facts = el('div', 'service-card__facts')
    const fact = (label, value) => {
      if (!value) return
      const f = el('span', 'service-card__fact')
      f.append(el('span', 'service-card__label', label), document.createTextNode(value))
      facts.appendChild(f)
    }
    fact('Speaker', m.speaker)
    fact('Host', m.host)
    fact('Team', m.team)
    fact('Type', m.type)
    if (!facts.childNodes.length) facts.appendChild(el('span', 'service-card__missing', 'No speaker or host set'))
    body.appendChild(facts)

    const side = el('div', 'service-card__side')
    const status = el('span', `service-status service-status--${m.status}`, STATUS_LABELS[m.status])
    const songs = songCount(playlist)
    side.append(status, el('span', 'service-card__songs', `${songs} ${songs === 1 ? 'song' : 'songs'}${m.time ? ' · ' + m.time : ''}`))

    open.append(date, body, side)

    const actions = el('div', 'service-card__actions')
    const details = el('button', 'btn', 'Details')
    details.setAttribute('aria-label', `Edit details of ${playlist.name}`)
    details.addEventListener('click', () => this._editDialog(playlist))
    const again = el('button', 'btn', 'Next week')
    again.title = 'Same songs a week later, with the speaker and sermon cleared'
    again.setAttribute('aria-label', `Plan next week from ${playlist.name}`)
    again.addEventListener('click', () => this.planNextWeek(playlist))
    actions.append(details, again)

    card.append(open, actions)
    return card
  }

  // ---- actions ---------------------------------------------------------

  openService(id) {
    const playlist = (state.get('playlists') || []).find((p) => p.id === id)
    if (!playlist) return
    state.set('activePlaylist', playlist)
    state.set('activeView', 'library')
    this.close()
  }

  planNextWeek(playlist) {
    const m = metaOf(playlist)
    const date = m.date ? addDays(m.date, 7) : nextSunday()
    const copy = ops.carryForwardPlaylist({ ...playlist, meta: { ...m, date: m.date || addDays(date, -7) } }, `Service ${formatDate(date)}`)
    state.set('playlists', [...(state.get('playlists') || []), copy])
    showToast(`Planned ${formatDate(copy.meta.date)} from "${playlist.name}"`, 'success')
    this._editDialog(copy)
  }

  _save(existing, name, meta) {
    const playlists = state.get('playlists') || []
    const finalName = name.trim() || [meta.type, formatDate(meta.date)].filter((s) => s && s !== 'No date').join(' ') || 'New service'
    if (existing) {
      const updated = { ...ops.setMeta(existing, meta), name: finalName }
      state.set('playlists', ops.replacePlaylist(playlists, updated))
      if (state.get('activePlaylist')?.id === existing.id) state.set('activePlaylist', updated)
      return
    }
    const created = ops.createPlaylist(finalName, meta)
    state.set('playlists', [...playlists, created])
    state.set('activePlaylist', created)
  }

  _delete(playlist) {
    const { playlists, next } = ops.deletePlaylist(state.get('playlists') || [], playlist.id)
    state.set('playlists', playlists)
    if (state.get('activePlaylist')?.id === playlist.id) state.set('activePlaylist', next)
  }

  // ---- details dialog --------------------------------------------------

  _editDialog(playlist) {
    document.getElementById('service-dialog')?.remove()
    const isNew = !playlist || !(state.get('playlists') || []).some((p) => p.id === playlist.id)
    const m = metaOf(playlist)
    if (!playlist) m.date = nextSunday()

    const overlay = el('div', 'service-dialog-overlay')
    overlay.id = 'service-dialog'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', isNew ? 'New service' : 'Service details')
    const close = () => overlay.remove()
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close()
    })
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    })

    const box = el('form', 'service-dialog')
    box.appendChild(el('h3', 'service-dialog__title', isNew && !playlist ? 'New service' : 'Service details'))
    const fields = {}
    const grid = el('div', 'service-dialog__grid')
    const field = (key, label, type = 'text', opts = {}) => {
      const wrap = el('label', `service-field${opts.wide ? ' service-field--wide' : ''}`)
      wrap.appendChild(el('span', 'service-field__label', label))
      const input = type === 'textarea' ? el('textarea', 'input') : el('input', 'input')
      if (type !== 'textarea') input.type = type
      else input.rows = 3
      if (opts.placeholder) input.placeholder = opts.placeholder
      if (opts.list) input.setAttribute('list', opts.list)
      input.value = opts.value ?? ''
      fields[key] = input
      wrap.appendChild(input)
      grid.appendChild(wrap)
      return input
    }
    field('name', 'Name', 'text', { wide: true, value: playlist ? playlist.name : '', placeholder: 'Leave blank to name it from the date' })
    field('date', 'Date', 'date', { value: m.date })
    field('time', 'Time', 'time', { value: m.time })
    field('type', 'Service type', 'text', { value: m.type, list: 'service-types', placeholder: 'Sunday service' })
    const typeList = el('datalist')
    typeList.id = 'service-types'
    for (const t of SERVICE_TYPES) typeList.appendChild(Object.assign(document.createElement('option'), { value: t }))
    box.appendChild(typeList)
    const statusWrap = el('label', 'service-field')
    statusWrap.appendChild(el('span', 'service-field__label', 'Status'))
    const statusSel = el('select', 'input')
    for (const s of STATUSES) statusSel.appendChild(Object.assign(document.createElement('option'), { value: s, textContent: STATUS_LABELS[s], selected: s === m.status }))
    fields.status = statusSel
    statusWrap.appendChild(statusSel)
    grid.appendChild(statusWrap)
    field('speaker', 'Speaker', 'text', { value: m.speaker })
    field('host', 'Host', 'text', { value: m.host })
    field('title', 'Sermon title', 'text', { value: m.title, wide: true })
    field('scripture', 'Scripture', 'text', { value: m.scripture, placeholder: 'e.g. Hebrews 11:1-6' })
    field('team', 'Band / tech team', 'text', { value: m.team })
    field('notes', 'Notes', 'textarea', { value: m.notes, wide: true })
    box.appendChild(grid)

    const row = el('div', 'service-dialog__actions')
    if (!isNew) {
      const del = el('button', 'btn btn--danger', 'Delete')
      del.type = 'button'
      del.addEventListener('click', () => {
        if (del.dataset.armed !== '1') {
          del.dataset.armed = '1'
          del.textContent = 'Really delete?'
          return
        }
        this._delete(playlist)
        close()
      })
      row.appendChild(del)
    }
    row.appendChild(el('span', 'service-dialog__spacer'))
    const cancel = el('button', 'btn', 'Cancel')
    cancel.type = 'button'
    cancel.addEventListener('click', close)
    const save = el('button', 'btn btn--primary', isNew ? 'Create' : 'Save')
    save.type = 'submit'
    row.append(cancel, save)
    box.appendChild(row)

    box.addEventListener('submit', (e) => {
      e.preventDefault()
      const meta = {}
      for (const key of Object.keys(fields)) if (key !== 'name') meta[key] = fields[key].value
      this._save(isNew ? null : playlist, fields.name.value, meta)
      close()
      if (isNew) this.close() // a service just made is made to be worked on
    })

    overlay.appendChild(box)
    document.body.appendChild(overlay)
    ;(fields.name.value ? fields.speaker : fields.name).focus()
  }
}
