import { describe, it, expect } from 'vitest'
import {
  captureTemplate,
  stampTemplate,
  addUserTemplate,
  removeUserTemplate,
  findUserTemplate,
  isUserTemplateKey,
  userTemplateKey,
  userTemplateId
} from './userTemplates.js'
import { TextElement } from '../models/TextElement.js'

describe('userTemplates', () => {
  it('captures boxes without their ids, and trims/defaults the name', () => {
    const el = new TextElement({ text: 'Hello', x: 10, y: 20, width: 300, height: 100, fontSize: 44, color: '#ff0000' })
    const t = captureTemplate('  Big red  ', [el], '#123456')
    expect(t.label).toBe('Big red')
    expect(t.bg).toBe('#123456')
    expect(t.boxes).toHaveLength(1)
    expect(t.boxes[0].id).toBeUndefined()
    expect(t.boxes[0]).toMatchObject({ x: 10, y: 20, width: 300, fontSize: 44, color: '#ff0000' })
    expect(captureTemplate('   ', [], null).label).toBe('My template')
    expect(captureTemplate('x', [], null).bg).toBe('#000000')
  })

  it('gives every capture its own id', () => {
    expect(captureTemplate('a', [], null).id).not.toBe(captureTemplate('a', [], null).id)
  })

  it('stamps boxes, carrying old text over by position and falling back to the template text', () => {
    const t = captureTemplate('t', [new TextElement({ text: 'A' }), new TextElement({ text: 'B' })], null)
    expect(stampTemplate(t, ['kept']).map((b) => b.text)).toEqual(['kept', 'B'])
    expect(stampTemplate(t, []).map((b) => b.text)).toEqual(['A', 'B'])
  })

  it('stamping does not change the saved template', () => {
    const t = captureTemplate('t', [new TextElement({ text: 'A' })], null)
    stampTemplate(t, ['x'])[0].text = 'changed'
    expect(t.boxes[0].text).toBe('A')
  })

  it('adds, finds and removes without mutating the input list', () => {
    const a = captureTemplate('a', [], null)
    const list = []
    const next = addUserTemplate(list, a)
    expect(list).toEqual([])
    expect(findUserTemplate(next, a.id)).toBe(a)
    expect(removeUserTemplate(next, a.id)).toEqual([])
    expect(findUserTemplate(next, 'nope')).toBeNull()
  })

  it('round-trips the select-value key', () => {
    expect(isUserTemplateKey(userTemplateKey('abc'))).toBe(true)
    expect(userTemplateId(userTemplateKey('abc'))).toBe('abc')
    expect(isUserTemplateKey('worship')).toBe(false)
    expect(isUserTemplateKey(undefined)).toBe(false)
  })
})
