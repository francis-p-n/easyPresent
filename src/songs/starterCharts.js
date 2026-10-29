/**
 * Songs added to a library on first launch of this version.
 *
 * None are bundled with the app. Songs are the operator's own: add them through Import Song.
 * (Developers can keep test songs in the git-ignored `local-songs/` folder; nothing in it is committed.)
 *
 * Each entry looks like { id, name, category, key, sheet } where `sheet` is chords-over-lyrics text
 * (what chord sites paste as), converted to ChordPro at install time (see chordSheetParse.js).
 */
export const STARTER_SONGS = []

/** A setlist created on first launch from the bundled songs above (none, so none is created). */
export const STARTER_SETLIST = {
  id: 'starter-setlist-this-week',
  name: 'This Week',
  songIds: []
}
