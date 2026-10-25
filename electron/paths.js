/**
 * paths — every file the main process loads, resolved from the app root.
 *
 * Don't build these from `__dirname` in other modules: the main process is
 * bundled into dist-electron/ for real runs but executes from electron/ in
 * tests, so a relative hop that is right in one is wrong in the other. The
 * root (the folder holding package.json — also the asar root when packaged)
 * is the same in both.
 */
const path = require('path')
const fs = require('fs')

function findRoot(from) {
  let dir = from
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error('App root (package.json) not found')
    dir = parent
  }
  return dir
}

const root = findRoot(__dirname)
const inRoot = (...parts) => path.join(root, ...parts)
const firstExisting = (...candidates) => candidates.find((p) => fs.existsSync(p)) || candidates[candidates.length - 1]

// Window icon for dev runs (packaged builds inherit the exe icon that
// electron-builder embeds from resources/icon.ico). Undefined when absent so
// Electron falls back to its default.
const iconFile = inRoot('resources', 'icon.png')

module.exports = {
  root,
  appIcon: fs.existsSync(iconFile) ? iconFile : undefined,
  preload: firstExisting(inRoot('dist-electron', 'preload.js'), inRoot('electron', 'preload.js')),
  indexHtml: inRoot('dist', 'index.html'),

  /** A static page: served from public/ in the repo, from dist/ in packaged builds (vite copies public/* there). */
  publicPage: (relative) => firstExisting(inRoot('public', relative), inRoot('dist', relative)),

  /** Folders to serve a web view from, repo copy first. */
  staticDirs: (name) => [inRoot('public', name), inRoot('dist', name)]
}
