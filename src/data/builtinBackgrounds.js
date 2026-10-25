/**
 * Built-in presentation backgrounds — hand-tuned SVG gradients encoded as
 * data URLs. SVG keeps them crisp at any output resolution, tiny in the
 * library file (~1 KB each vs multi-MB photos), and safe to ship over the
 * output-sync channel (data URLs need no path resolution in the audience
 * window). All are dark enough for white lyric text to pass readability.
 */

// encodeURIComponent leaves ( ) ' ! * bare, but the SVG contains url(#g)
// references and consumers drop these URLs into CSS url(...) — sometimes
// unquoted — so those characters must be percent-encoded too.
const svgUrl = (inner) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">${inner}</svg>`
  ).replace(/[()'!*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

export const BUILTIN_BACKGROUNDS = [
  {
    id: 'midnight',
    name: 'Midnight',
    dataUrl: svgUrl(
      `<defs><radialGradient id="g" cx="50%" cy="35%" r="90%">` +
        `<stop offset="0%" stop-color="#16233f"/><stop offset="55%" stop-color="#0b1226"/><stop offset="100%" stop-color="#05070f"/>` +
        `</radialGradient></defs><rect width="1920" height="1080" fill="url(#g)"/>`
    )
  },
  {
    id: 'dawn',
    name: 'Dawn',
    dataUrl: svgUrl(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="#1a1033"/><stop offset="55%" stop-color="#4a1d4e"/><stop offset="85%" stop-color="#93393f"/><stop offset="100%" stop-color="#c96a3b"/>` +
        `</linearGradient><filter id="b"><feGaussianBlur stdDeviation="90"/></filter></defs>` +
        `<rect width="1920" height="1080" fill="url(#g)"/>` +
        `<ellipse cx="960" cy="1050" rx="700" ry="240" fill="#e8934a" opacity="0.35" filter="url(#b)"/>`
    )
  },
  {
    id: 'ocean',
    name: 'Ocean',
    dataUrl: svgUrl(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0%" stop-color="#04222e"/><stop offset="60%" stop-color="#073a4a"/><stop offset="100%" stop-color="#0a5266"/>` +
        `</linearGradient><filter id="b"><feGaussianBlur stdDeviation="70"/></filter></defs>` +
        `<rect width="1920" height="1080" fill="url(#g)"/>` +
        `<ellipse cx="420" cy="920" rx="800" ry="180" fill="#0e6b7d" opacity="0.4" filter="url(#b)"/>` +
        `<ellipse cx="1560" cy="180" rx="600" ry="200" fill="#0a4a5c" opacity="0.5" filter="url(#b)"/>`
    )
  },
  {
    id: 'ember',
    name: 'Ember',
    dataUrl: svgUrl(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="#0d0805"/><stop offset="100%" stop-color="#1c0f08"/>` +
        `</linearGradient><filter id="b"><feGaussianBlur stdDeviation="110"/></filter></defs>` +
        `<rect width="1920" height="1080" fill="url(#g)"/>` +
        `<ellipse cx="1650" cy="980" rx="640" ry="420" fill="#b4501e" opacity="0.38" filter="url(#b)"/>` +
        `<ellipse cx="1780" cy="1060" rx="300" ry="200" fill="#e8813c" opacity="0.3" filter="url(#b)"/>`
    )
  },
  {
    id: 'forest',
    name: 'Forest',
    dataUrl: svgUrl(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="#0a1f14"/><stop offset="100%" stop-color="#040d08"/>` +
        `</linearGradient><filter id="b"><feGaussianBlur stdDeviation="80"/></filter></defs>` +
        `<rect width="1920" height="1080" fill="url(#g)"/>` +
        `<ellipse cx="500" cy="100" rx="700" ry="300" fill="#14532d" opacity="0.35" filter="url(#b)"/>` +
        `<ellipse cx="1500" cy="900" rx="600" ry="260" fill="#0d3d20" opacity="0.45" filter="url(#b)"/>`
    )
  },
  {
    id: 'royal',
    name: 'Royal',
    dataUrl: svgUrl(
      `<defs><radialGradient id="g" cx="50%" cy="45%" r="85%">` +
        `<stop offset="0%" stop-color="#3b1e63"/><stop offset="60%" stop-color="#241245"/><stop offset="100%" stop-color="#0d0620"/>` +
        `</radialGradient><filter id="b"><feGaussianBlur stdDeviation="100"/></filter></defs>` +
        `<rect width="1920" height="1080" fill="url(#g)"/>` +
        `<ellipse cx="960" cy="1120" rx="900" ry="240" fill="#5b2d96" opacity="0.25" filter="url(#b)"/>`
    )
  },
  {
    id: 'slate',
    name: 'Slate',
    dataUrl: svgUrl(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0%" stop-color="#23272e"/><stop offset="100%" stop-color="#101318"/>` +
        `</linearGradient><filter id="b"><feGaussianBlur stdDeviation="90"/></filter></defs>` +
        `<rect width="1920" height="1080" fill="url(#g)"/>` +
        `<ellipse cx="1700" cy="0" rx="700" ry="300" fill="#3a4150" opacity="0.35" filter="url(#b)"/>`
    )
  },
  {
    id: 'golden-rays',
    name: 'Golden Rays',
    dataUrl: svgUrl(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="#171208"/><stop offset="100%" stop-color="#060402"/>` +
        `</linearGradient><filter id="b"><feGaussianBlur stdDeviation="60"/></filter></defs>` +
        `<rect width="1920" height="1080" fill="url(#g)"/>` +
        `<g opacity="0.30" filter="url(#b)">` +
        `<polygon points="760,-80 900,-80 1180,1160 860,1160" fill="#c9932e"/>` +
        `<polygon points="1080,-80 1170,-80 1620,1160 1380,1160" fill="#a87921" opacity="0.7"/>` +
        `<polygon points="480,-80 560,-80 620,1160 380,1160" fill="#8a6a24" opacity="0.6"/>` +
        `</g>`
    )
  }
]
