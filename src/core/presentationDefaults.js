/**
 * presentationDefaults — a presentation can carry its own theme and transition.
 *
 * Precedence, most specific first:  slide  >  presentation  >  the app-wide setting.
 * A presentation with neither set behaves exactly as before.
 */

/** The theme to draw `pres` with: its own if it names one that still exists, else the app's active theme. */
export function themeFor(pres, themes, activeThemeId) {
  const list = themes || []
  return (
    (pres && pres.themeId && list.find((t) => t.id === pres.themeId)) ||
    list.find((t) => t.id === activeThemeId) ||
    list[0] ||
    null
  )
}

/** The presentation that is on the projector (not merely selected), falling back to the selected one. */
export function livePresentation(presentations, livePresentationId, selected) {
  return (presentations || []).find((p) => p.id === livePresentationId) || selected || null
}

export const PRESENTATION_TRANSITIONS = ['cut', 'dissolve', 'wipe']

/** The presentation's own transition, or undefined when it has none (or a value we do not know). */
export const presentationTransition = (pres) => (pres && PRESENTATION_TRANSITIONS.includes(pres.transition) ? pres.transition : undefined)
