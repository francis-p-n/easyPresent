import { TextElement } from './TextElement.js'

export class Slide {
  constructor(options = {}) {
    this.id = options.id || crypto.randomUUID()
    this.label = options.label || 'Slide'
    this.group = options.group || 'verse' // verse, chorus, bridge, pre-chorus, tag, intro, blank
    this.groupColor = options.groupColor || '#3b82f6' // Default to blue

    // Content
    this.elements = options.elements ? options.elements.map((e) => new TextElement(e)) : []

    // Background
    this.background = options.background || {
      type: 'color', // color, media
      color: '#000000',
      mediaPath: null
    }

    // Transition Overrides
    this.transition = options.transition || {
      type: 'default', // default, dissolve, cut, wipe
      duration: 0.5
    }

    // Actions (e.g. clear props, start timer)
    this.actions = options.actions || []

    // Notes (for Stage Display)
    this.notes = options.notes || ''
  }

  addTextElement(options = {}) {
    const el = new TextElement(options)
    this.elements.push(el)
    return el
  }

  removeElement(id) {
    this.elements = this.elements.filter((e) => e.id !== id)
  }

  getPlainText() {
    return this.elements.map((e) => e.text).join('\n')
  }

  toJSON() {
    return {
      id: this.id,
      label: this.label,
      group: this.group,
      groupColor: this.groupColor,
      elements: this.elements.map((e) => e.toJSON()),
      background: this.background,
      transition: this.transition,
      actions: this.actions,
      notes: this.notes
    }
  }
}
