/**
 * userTemplates — slide layouts the operator saves themselves.
 *
 * Nothing here ships preset: a template is just "the boxes and background of a
 * slide I built", captured from the editor and stamped onto other slides. Pure
 * functions over plain arrays so the editor and the tests share one definition.
 */

export const USER_TEMPLATE_PREFIX = 'user:'

export const isUserTemplateKey = (key) => typeof key === 'string' && key.startsWith(USER_TEMPLATE_PREFIX)
export const userTemplateKey = (id) => USER_TEMPLATE_PREFIX + id
export const userTemplateId = (key) => key.slice(USER_TEMPLATE_PREFIX.length)

/** Turns the editor's boxes + background into a saved template. Box ids are dropped so each stamp gets fresh ones. */
export function captureTemplate(name, elements, bg) {
  const boxes = (elements || []).map((e) => {
    const json = typeof e.toJSON === 'function' ? e.toJSON() : { ...e }
    delete json.id
    return json
  })
  return {
    id: 'ut-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    label: String(name || '').trim() || 'My template',
    bg: bg || '#000000',
    boxes
  }
}

/**
 * Box definitions to stamp onto a slide. Existing text carries over box by box
 * (like the built-in templates); boxes beyond the old text keep the template's own text.
 */
export function stampTemplate(template, oldTexts = []) {
  return (template.boxes || []).map((box, i) => ({
    ...box,
    text: oldTexts[i] || box.text || 'Text'
  }))
}

export const addUserTemplate = (list, template) => [...(list || []), template]
export const removeUserTemplate = (list, id) => (list || []).filter((t) => t.id !== id)
export const findUserTemplate = (list, id) => (list || []).find((t) => t.id === id) || null
