const path = require('path')
const fs = require('fs')

// Window icon for dev runs (packaged builds inherit the exe icon that
// electron-builder embeds from resources/icon.ico). Undefined when the
// generated file is absent so Electron falls back to its default.
const devIconPath = path.join(__dirname, '../resources/icon.png')
const appIcon = fs.existsSync(devIconPath) ? devIconPath : undefined

// Repo runs serve static pages from public/; packaged builds only ship dist/
// (vite copies public/* into it).
function publicPage(relative) {
  const dev = path.join(__dirname, '../public', relative)
  return fs.existsSync(dev) ? dev : path.join(__dirname, '../dist', relative)
}

module.exports = { appIcon, publicPage }
