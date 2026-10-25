/**
 * mediaStore — content-dedupes inline `data:` URLs at the persistence boundary.
 *
 * PPTX imports embed each slide's background as a base64 data URL, and a deck
 * built from one template repeats the same background on every slide. A real
 * 10-slide import measured 3.13 MB of which 3.11 MB (99%) was data URLs and
 * only 0.63 MB was distinct — the same 283 KB JPEG stored ten times over.
 *
 * Rather than change the slide model (which would ripple into the renderer, the
 * PIXI preview, the stage server and the dependency-free audience script), this
 * runs only on the way to and from disk:
 *
 *   save : dehydrate() lifts every data URL into a `media` dictionary and
 *          leaves a short `ep-media:<key>` reference behind
 *   load : rehydrate() puts them back
 *
 * In-memory the app still sees ordinary data URLs, so nothing downstream knows
 * this exists. Rehydration also hands the *same* string reference to every
 * slide that shares an image, so the duplication doesn't come back in RAM.
 */

export const MEDIA_REF_PREFIX = 'ep-media:'

/**
 * Only strings at least this long are worth lifting. Below it the reference
 * would cost about as much as the value, and we'd churn tiny inline SVGs.
 */
export const MEDIA_MIN_LENGTH = 256

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Deep-copies `value`, replacing large `data:` strings with references into
 * `media` (which is populated as a side effect).
 *
 * Keys are sequential rather than content hashes on purpose: the Map compares
 * strings by value, so identical images collapse exactly, with no risk of a
 * hash collision quietly swapping one background for another. Keys need not be
 * stable across saves — the file is always rewritten whole.
 *
 * The copy is cheap despite the payload size: large strings are shared by
 * reference, so only the (small) object/array spine is duplicated.
 */
export function dehydrate(value, media = {}, seen = new Map()) {
  const walk = (node) => {
    if (typeof node === 'string') {
      if (node.length < MEDIA_MIN_LENGTH || !node.startsWith('data:')) return node
      let key = seen.get(node)
      if (key === undefined) {
        key = 'm' + seen.size
        seen.set(node, key)
        media[key] = node
      }
      return MEDIA_REF_PREFIX + key
    }
    if (Array.isArray(node)) return node.map(walk)
    if (isPlainObject(node)) {
      const out = {}
      for (const k of Object.keys(node)) out[k] = walk(node[k])
      return out
    }
    return node
  }
  return { value: walk(value), media }
}

/**
 * Inverse of dehydrate(). A reference whose key is missing from `media` is left
 * as-is rather than nulled: the slide degrades to no background either way, and
 * keeping the marker makes a truncated library file obvious instead of silent.
 */
export function rehydrate(value, media) {
  if (!media || typeof media !== 'object') return value
  const walk = (node) => {
    if (typeof node === 'string') {
      if (!node.startsWith(MEDIA_REF_PREFIX)) return node
      const key = node.slice(MEDIA_REF_PREFIX.length)
      return Object.prototype.hasOwnProperty.call(media, key) ? media[key] : node
    }
    if (Array.isArray(node)) return node.map(walk)
    if (isPlainObject(node)) {
      const out = {}
      for (const k of Object.keys(node)) out[k] = walk(node[k])
      return out
    }
    return node
  }
  return walk(value)
}
