const AdmZip = require('adm-zip');
const path = require('path');

// Electron's nativeImage (main-process only) lets us downscale oversized
// decorations/backgrounds so a 4 MB PNG doesn't bloat the library file. In the
// unit tests (plain Node) require('electron') yields a path string, not the
// API, so we feature-detect and fall back to the raw-buffer size cap.
let nativeImage = null;
try {
  const electron = require('electron');
  if (electron && typeof electron.nativeImage?.createFromBuffer === 'function') {
    nativeImage = electron.nativeImage;
  }
} catch (_) { /* not running under Electron (tests) */ }

// When we can't downscale, raster images larger than this are skipped so the
// library file doesn't balloon (they'd be stored as base64 data URLs).
const MAX_BG_BYTES = 2.5 * 1024 * 1024;
// Sanity ceiling on the source buffer we're willing to read + re-encode.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

const RASTER_EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

// The app's fixed design space. Imported EMU geometry and point sizes convert
// into this pixel space so positioned shapes land where the renderer draws.
const RENDER_WIDTH = 1920;
const RENDER_HEIGHT = 1080;

const SCHEME_COLOR_ALIAS = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };

const PPTX_ALIGN = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };
const PPTX_ANCHOR = { t: 'top', ctr: 'center', b: 'bottom' };

// Clamp for the legacy whole-slide `style` field, kept for slides that carry no
// positioned elements. Design-tool exports (e.g. Canva) sometimes scale a
// shape's text via its own vector transform rather than the authored `sz`, so
// the raw XML value can be wildly larger than what rendered. Positioned
// elements use ELEMENT_FONT_MAX instead, since a real box makes overflow
// self-evident and honoring the authored size preserves the design.
const MIN_FONT_SIZE = 24;
const MAX_FONT_SIZE = 110;
const ELEMENT_FONT_MAX = 300; // matches the editor's autosize ceiling

function decodeXmlEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, '&');
}

/** Parses ppt/theme/theme1.xml for the color scheme and major/minor Latin fonts. */
function extractTheme(zipEntries) {
  const themeEntry = zipEntries.find(e => /^ppt\/theme\/theme\d+\.xml$/.test(e.entryName));
  if (!themeEntry) return { colors: {}, majorFont: null, minorFont: null };

  const xml = themeEntry.getData().toString('utf8');
  const colors = {};
  const schemeMatch = xml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/);
  if (schemeMatch) {
    const colorRegex = /<a:(dk1|lt1|dk2|lt2|accent1|accent2|accent3|accent4|accent5|accent6|hlink|folHlink)>\s*(?:<a:srgbClr val="([0-9a-fA-F]{6})"|<a:sysClr val="\w+" lastClr="([0-9a-fA-F]{6})")/g;
    let m;
    while ((m = colorRegex.exec(schemeMatch[1])) !== null) {
      colors[m[1]] = `#${m[2] || m[3]}`;
    }
  }

  const majorMatch = xml.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
  const minorMatch = xml.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);

  return {
    colors,
    majorFont: majorMatch ? majorMatch[1] : null,
    minorFont: minorMatch ? minorMatch[1] : null
  };
}

/** Resolves a schemeClr name (with the standard bg/tx aliasing) to a hex color, or null if unknown. */
function resolveSchemeColor(name, theme) {
  const resolved = SCHEME_COLOR_ALIAS[name] || name;
  return theme.colors[resolved] || null;
}

/** Resolves an <a:solidFill> block's inner XML to a hex color, or null. */
function resolveFillColor(fillInner, theme) {
  if (!fillInner) return null;
  const srgb = fillInner.match(/<a:srgbClr val="([0-9a-fA-F]{6})"/);
  if (srgb) return `#${srgb[1]}`;
  const scheme = fillInner.match(/<a:schemeClr val="(\w+)"/);
  if (scheme) return resolveSchemeColor(scheme[1], theme);
  return null;
}

/** Resolves a typeface attribute (which may be a theme placeholder like "+mn-lt") to a real font name. */
function resolveFontFamily(typeface, theme) {
  if (!typeface) return null;
  if (typeface === '+mn-lt') return theme.minorFont;
  if (typeface === '+mj-lt') return theme.majorFont;
  return typeface;
}

/**
 * Extracts the slide's own background color from <p:bg>. Returns a hex color or
 * null when there's no color background (picture fill or nothing declared).
 */
function extractSlideBgColor(xmlData, theme) {
  const bgMatch = xmlData.match(/<p:bg\b[^>]*>([\s\S]*?)<\/p:bg>/);
  if (!bgMatch) return null;
  const bg = bgMatch[1];
  if (/<(?:a|p):blipFill\b/.test(bg)) return null; // picture-fill background — handled as an image
  const solid = bg.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/);
  if (solid) return resolveFillColor(solid[1], theme);
  const bgRef = bg.match(/<p:bgRef\b[^>]*>([\s\S]*?)<\/p:bgRef>/);
  if (bgRef) {
    const scheme = bgRef[1].match(/<a:schemeClr val="(\w+)"/);
    if (scheme) return resolveSchemeColor(scheme[1], theme);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Relationship + inheritance helpers (slide → layout → master)
// ---------------------------------------------------------------------------

/** Reads a .rels part into a Map<rId, { target, type }>. Attribute order varies. */
function readRelTargets(zipEntries, relsPath) {
  const map = new Map();
  const entry = zipEntries.find(e => e.entryName === relsPath);
  if (!entry) return map;
  const xml = entry.getData().toString('utf8');
  const tagRe = /<Relationship\b([^>]*?)\/?>/g;
  let m;
  while ((m = tagRe.exec(xml)) !== null) {
    const attrs = m[1];
    const id = (attrs.match(/\bId="([^"]+)"/) || [])[1];
    const target = (attrs.match(/\bTarget="([^"]+)"/) || [])[1];
    const type = (attrs.match(/\bType="([^"]+)"/) || [])[1];
    if (id && target) map.set(id, { target, type });
  }
  return map;
}

/** Normalizes a relationship Target (possibly with ../) against its part's base dir. */
function normalizeTarget(baseDir, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = (baseDir + target).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

/**
 * Resolves a slide's effective background color, walking the PPTX inheritance
 * chain: the slide's own <p:bg>, then its layout, then the master (which is
 * where most decks actually declare the page color, e.g. a white bgRef). This
 * is why content decks stopped importing on a black canvas.
 */
function resolveBgColor(slideXml, slideEntryName, zipEntries, theme) {
  const direct = extractSlideBgColor(slideXml, theme);
  if (direct) return direct;

  const slideFile = slideEntryName.split('/').pop();
  const slideRels = readRelTargets(zipEntries, `ppt/slides/_rels/${slideFile}.rels`);
  const layoutRel = [...slideRels.values()].find(r => /slideLayout/.test(r.target));
  if (!layoutRel) return null;

  const layoutPath = normalizeTarget('ppt/slides/', layoutRel.target);
  const layoutEntry = zipEntries.find(e => e.entryName === layoutPath);
  if (!layoutEntry) return null;

  const layoutColor = extractSlideBgColor(layoutEntry.getData().toString('utf8'), theme);
  if (layoutColor) return layoutColor;

  const layoutFile = layoutPath.split('/').pop();
  const layoutRels = readRelTargets(zipEntries, `ppt/slideLayouts/_rels/${layoutFile}.rels`);
  const masterRel = [...layoutRels.values()].find(r => /slideMaster/.test(r.target));
  if (!masterRel) return null;

  const masterPath = normalizeTarget('ppt/slideLayouts/', masterRel.target);
  const masterEntry = zipEntries.find(e => e.entryName === masterPath);
  if (!masterEntry) return null;

  return extractSlideBgColor(masterEntry.getData().toString('utf8'), theme);
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** Extracts sections (PowerPoint 2010+ p14) → Map<slideId, sectionName>. */
function extractSections(zipEntries) {
  const sectionByRid = new Map();
  const presEntry = zipEntries.find(e => e.entryName === 'ppt/presentation.xml');
  if (!presEntry) return sectionByRid;

  const xml = presEntry.getData().toString('utf8');
  const sectionsMatch = xml.match(/<p14:sectionLst\b[^>]*>([\s\S]*?)<\/p14:sectionLst>/);
  if (!sectionsMatch) return sectionByRid;

  const sectionRegex = /<p14:section\b([^>]*?)>([\s\S]*?)<\/p14:section>/g;
  let m;
  while ((m = sectionRegex.exec(sectionsMatch[1])) !== null) {
    const nameMatch = m[1].match(/\bname="([^"]*)"/);
    const name = nameMatch ? decodeXmlEntities(nameMatch[1]) : 'Section';
    const rids = [...m[2].matchAll(/<p14:sldId\b[^>]*\bid="([^"]+)"/g)].map(x => x[1]);
    rids.forEach(rid => sectionByRid.set(rid, name));
  }

  return sectionByRid;
}

/** Builds a map from ppt/slides/slideN.xml → slide id (the p14:sldId reference). */
function buildSlideIdMap(zipEntries) {
  const idByEntry = new Map();
  const presEntry = zipEntries.find(e => e.entryName === 'ppt/presentation.xml');
  const relsEntry = zipEntries.find(e => e.entryName === 'ppt/_rels/presentation.xml.rels');
  if (!presEntry || !relsEntry) return idByEntry;

  const presXml = presEntry.getData().toString('utf8');
  const relsXml = relsEntry.getData().toString('utf8');

  const relTargets = new Map();
  const relRegex = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g;
  let rm;
  while ((rm = relRegex.exec(relsXml)) !== null) {
    relTargets.set(rm[1], rm[2]);
  }

  const sldIdTagRegex = /<p:sldId\b([^>]*?)\/?>/g;
  let sm;
  while ((sm = sldIdTagRegex.exec(presXml)) !== null) {
    const attrs = sm[1];
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    const ridMatch = attrs.match(/\br:id="([^"]+)"/);
    if (!idMatch || !ridMatch) continue;
    const target = relTargets.get(ridMatch[1]);
    if (!target) continue;
    const fullPath = target.startsWith('/') ? target.slice(1) : `ppt/${target}`;
    idByEntry.set(fullPath, idMatch[1]);
  }

  return idByEntry;
}

// ---------------------------------------------------------------------------
// Geometry + per-shape text/style
// ---------------------------------------------------------------------------

/** Reads ppt/presentation.xml's slide size → EMU→px scales and pt→px factor. */
function getSlideMetrics(zipEntries) {
  const presEntry = zipEntries.find(e => e.entryName === 'ppt/presentation.xml');
  let wEmu = 12192000; // standard 13.333in widescreen
  let hEmu = 6858000;
  if (presEntry) {
    const xml = presEntry.getData().toString('utf8');
    const cx = xml.match(/<p:sldSz\s+[^>]*cx="(\d+)"/);
    const cy = xml.match(/<p:sldSz\s+[^>]*cy="(\d+)"/);
    if (cx) wEmu = parseInt(cx[1], 10);
    if (cy) hEmu = parseInt(cy[1], 10);
  }
  const sx = RENDER_WIDTH / wEmu;
  const sy = RENDER_HEIGHT / hEmu;
  // 914400 EMU per inch, 72 pt per inch → px per point (horizontal)
  const ptToPx = (RENDER_WIDTH / (wEmu / 914400)) / 72;
  return { sx, sy, ptToPx };
}

/** Extracts a shape's raw EMU bounding box from its first <a:xfrm>, or null. */
function shapeGeometryEmu(shapeXml) {
  const off = shapeXml.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
  const ext = shapeXml.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
  if (!off || !ext) return null;
  return {
    x: parseInt(off[1], 10),
    y: parseInt(off[2], 10),
    cx: parseInt(ext[1], 10),
    cy: parseInt(ext[2], 10)
  };
}

/** Rotation (degrees) and flips from a shape's own <a:xfrm> attributes. */
function shapeXfrmAttrs(shapeXml) {
  const m = shapeXml.match(/<a:xfrm\b([^>]*)>/);
  if (!m) return { rot: 0, flipH: false, flipV: false };
  const rotRaw = (m[1].match(/\brot="(-?\d+)"/) || [])[1];
  return {
    rot: rotRaw ? parseInt(rotRaw, 10) / 60000 : 0, // 60000ths of a degree
    flipH: /\bflipH="1"/.test(m[1]),
    flipV: /\bflipV="1"/.test(m[1])
  };
}

/**
 * Extracts a text box's visible text, preserving paragraph structure AND list
 * formatting. Auto-numbered paragraphs (<a:buAutoNum>) get "1. ", "2. " …
 * markers per indent level; bullet paragraphs (<a:buChar>) get their bullet
 * glyph; deeper levels are indented with leading spaces. Empty paragraphs are
 * dropped (authors use them as spacing). Runs within a paragraph concatenate
 * with no separator (PowerPoint splits words across runs for spell-check).
 */
function extractTextBoxText(txBody) {
  const paraRegex = /<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g;
  const out = [];
  const counters = {}; // indent level → running auto-number
  let paraMatch;
  while ((paraMatch = paraRegex.exec(txBody)) !== null) {
    const paraContent = paraMatch[1];

    const partRegex = /<a:t>([\s\S]*?)<\/a:t>|<a:br(?:\s[^>]*)?\/?>/g;
    const lines = [];
    let line = '';
    let hasVisibleText = false;
    let partMatch;
    while ((partMatch = partRegex.exec(paraContent)) !== null) {
      if (partMatch[1] !== undefined) {
        const decoded = decodeXmlEntities(partMatch[1]);
        line += decoded;
        if (decoded.trim()) hasVisibleText = true;
      } else {
        lines.push(line);
        line = '';
      }
    }
    lines.push(line);
    if (!hasVisibleText) continue;

    // Resolve this paragraph's list marker from its <a:pPr>
    const pPr = paraContent.match(/<a:pPr\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:pPr>)/);
    const pAttrs = pPr ? pPr[1] : '';
    const pInner = (pPr && pPr[2]) || '';
    const lvl = parseInt((pAttrs.match(/\blvl="(\d+)"/) || [])[1] || '0', 10);

    let marker = '';
    if (!/<a:buNone\b/.test(pInner)) {
      const auto = pInner.match(/<a:buAutoNum\b[^>]*\btype="([^"]+)"/);
      const buChar = pInner.match(/<a:buChar\b[^>]*\bchar="([^"]*)"/);
      if (auto) {
        counters[lvl] = (counters[lvl] || 0) + 1;
        Object.keys(counters).forEach((k) => { if (+k > lvl) delete counters[k]; });
        marker = `${counters[lvl]}. `;
      } else if (buChar) {
        marker = `${decodeXmlEntities(buChar[1])} `;
      }
    }

    const indent = '    '.repeat(lvl);
    const hang = ' '.repeat(marker.length);
    const rendered = lines
      .map((ln, i) => (i === 0 ? indent + marker + ln : indent + hang + ln))
      .join('\n');
    out.push(rendered);
  }
  return out.join('\n');
}

/**
 * Extracts a representative text style from a single <p:txBody>: font size,
 * weight, color, family, alignment, line spacing, and vertical anchor — taken
 * from the first paragraph that has visible text. `cap` bounds the font size.
 */
function styleFromBody(body, theme, ptToPx, cap) {
  const style = {};
  if (!body) return style;

  const anchorMatch = body.match(/<a:bodyPr[^>]*\banchor="(\w+)"/);
  if (anchorMatch && PPTX_ANCHOR[anchorMatch[1]]) style.vAlign = PPTX_ANCHOR[anchorMatch[1]];

  const paraRegex = /<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g;
  let paraMatch;
  while ((paraMatch = paraRegex.exec(body)) !== null) {
    const paraContent = paraMatch[1];

    const runRegex = /<a:r>([\s\S]*?)<\/a:r>/g;
    let runMatch;
    let foundVisibleRun = false;
    while ((runMatch = runRegex.exec(paraContent)) !== null) {
      const runBlock = runMatch[1];
      const tMatch = runBlock.match(/<a:t>([\s\S]*?)<\/a:t>/);
      if (!tMatch || !decodeXmlEntities(tMatch[1]).trim()) continue;

      foundVisibleRun = true;

      const rPrMatch = runBlock.match(/<a:rPr\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:rPr>)/);
      if (rPrMatch) {
        const attrs = rPrMatch[1];
        const inner = rPrMatch[2] || '';

        const szMatch = attrs.match(/\bsz="(\d+)"/);
        if (szMatch && !style.fontSize) {
          const raw = Math.round((parseInt(szMatch[1], 10) / 100) * ptToPx);
          style.fontSize = Math.min(cap, Math.max(MIN_FONT_SIZE, raw));
        }
        if (/\bb="1"/.test(attrs) && style.bold === undefined) style.bold = true;
        if (/\bi="1"/.test(attrs) && style.italic === undefined) style.italic = true;

        if (!style.color) {
          const fillMatch = inner.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/);
          const color = resolveFillColor(fillMatch ? fillMatch[1] : null, theme);
          if (color) style.color = color;
        }
        if (!style.fontFamily) {
          const latinMatch = inner.match(/<a:latin typeface="([^"]+)"/);
          if (latinMatch) {
            const resolved = resolveFontFamily(latinMatch[1], theme);
            if (resolved) style.fontFamily = resolved;
          }
        }
      }
      break;
    }

    if (foundVisibleRun) {
      const pPrMatch = paraContent.match(/<a:pPr\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:pPr>)/);
      if (pPrMatch) {
        const attrs = pPrMatch[1];
        const inner = pPrMatch[2] || '';
        const algnMatch = attrs.match(/\balgn="(\w+)"/);
        if (algnMatch && PPTX_ALIGN[algnMatch[1]] && !style.hAlign) style.hAlign = PPTX_ALIGN[algnMatch[1]];
        const lnSpcMatch = inner.match(/<a:lnSpc>\s*<a:spcPct val="(\d+)"/);
        if (lnSpcMatch && style.lineSpacing === undefined) style.lineSpacing = parseInt(lnSpcMatch[1], 10) / 100000;
      }
      if (style.fontSize) break;
    }
  }

  return style;
}

/**
 * Picks the <p:txBody> containing the most visible text — used for the legacy
 * whole-slide `style` field (shapes appear in authoring order, not by
 * importance, so the biggest text box is the reliable style source).
 */
function findMainTextBody(xmlData) {
  const txBodyRegex = /<p:txBody>([\s\S]*?)<\/p:txBody>/g;
  let best = null;
  let bestLength = -1;
  let match;
  while ((match = txBodyRegex.exec(xmlData)) !== null) {
    const body = match[1];
    const length = [...body.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .reduce((sum, t) => sum + decodeXmlEntities(t[1]).trim().length, 0);
    if (length > bestLength) {
      bestLength = length;
      best = body;
    }
  }
  return best;
}

/** Legacy whole-slide representative style (for slides with no positioned elements). */
function extractSlideStyle(xmlData, theme, ptToPx) {
  return styleFromBody(findMainTextBody(xmlData), theme, ptToPx, MAX_FONT_SIZE);
}

/**
 * Encodes a media buffer to a data URL, downscaling to `targetW` px wide when
 * nativeImage is available (PNG/webp keep alpha via toPNG so transparent
 * decorations don't get a white box). Without nativeImage, passes the raw
 * buffer through only if it's under the size cap.
 */
function encodeImage(buffer, mime, targetW) {
  if (nativeImage) {
    try {
      let img = nativeImage.createFromBuffer(buffer);
      const size = img.getSize();
      if (size.width > 0 && targetW && size.width > targetW) {
        img = img.resize({ width: Math.round(targetW), quality: 'good' });
      }
      // JPEG only stays JPEG when the source had no alpha to preserve.
      const asJpeg = mime === 'image/jpeg';
      const out = asJpeg ? img.toJPEG(85) : img.toPNG();
      if (out && out.length && out.length < buffer.length) {
        return `data:${asJpeg ? 'image/jpeg' : 'image/png'};base64,${out.toString('base64')}`;
      }
    } catch (_) { /* fall through to raw passthrough */ }
  }
  if (buffer.length > MAX_BG_BYTES) return null;
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/**
 * Resolves a shape's <a:blipFill> image to a data URL, or null. `targetW` is
 * the intended on-screen width in px so oversized source art is downscaled to
 * roughly what actually renders (2× for crispness).
 */
function resolveBlipImage(shapeXml, relMap, mediaByName, targetW) {
  // <p:pic> uses <p:blipFill>; shape/background fills use <a:blipFill>.
  if (!/<(?:a|p):blipFill\b/.test(shapeXml)) return null;
  const embed = shapeXml.match(/<a:blip\b[^>]*\br:embed="([^"]+)"/);
  if (!embed) return null;
  const rel = relMap.get(embed[1]);
  if (!rel) return null;
  const name = rel.target.split('/').pop();
  const mime = RASTER_EXT[path.extname(name).toLowerCase()];
  if (!mime) return null;
  const entry = mediaByName.get(name);
  if (!entry || entry.header.size > MAX_SOURCE_BYTES) return null;
  return encodeImage(entry.getData(), mime, targetW);
}

/**
 * Extracts a picture fill's <a:stretch><a:fillRect> insets, which define the
 * rectangle (relative to the shape box, in 1000ths of a percent) the image is
 * stretched into. Negative insets zoom the image out past the shape edge so the
 * shape shows a cropped window — this is how PowerPoint frames decorations.
 * Returns null for a plain full-fill (all zero / absent), so the payload stays
 * lean and the renderer treats null as "stretch to fill the box".
 */
function extractFillRect(shapeXml) {
  const m = shapeXml.match(/<a:fillRect\b([^>]*)\/?>/);
  if (!m) return null;
  const attrs = m[1];
  const get = (k) => {
    const mm = attrs.match(new RegExp(`\\b${k}="(-?\\d+)"`));
    return mm ? parseInt(mm[1], 10) : 0;
  };
  const l = get('l'), t = get('t'), r = get('r'), b = get('b');
  if (!l && !t && !r && !b) return null;
  return { l, t, r, b };
}

/**
 * Extracts a picture fill's <a:srcRect> insets — the sub-rectangle of the
 * SOURCE image that is shown, in 1000ths of a percent. Canva exports crop
 * nearly every photo this way. Null when absent / a full-image fill.
 */
function extractSrcRect(shapeXml) {
  const m = shapeXml.match(/<a:srcRect\b([^>]*)\/?>/);
  if (!m) return null;
  const attrs = m[1];
  const get = (k) => {
    const mm = attrs.match(new RegExp(`\\b${k}="(-?\\d+)"`));
    return mm ? parseInt(mm[1], 10) : 0;
  };
  const l = get('l'), t = get('t'), r = get('r'), b = get('b');
  if (!l && !t && !r && !b) return null;
  return { l, t, r, b };
}

/**
 * True when a geometry COVERS almost the whole slide. Checked edge-to-edge on
 * all four sides — a wide decoration hanging off the left edge starts before
 * x=0 but never reaches the right edge, so it must stay a positioned image
 * rather than being stretched into the background (a real Canva failure mode).
 */
function isFullBleed(geom) {
  if (!geom) return false;
  return (
    geom.x <= RENDER_WIDTH * 0.05 &&
    geom.y <= RENDER_HEIGHT * 0.05 &&
    geom.x + geom.width >= RENDER_WIDTH * 0.95 &&
    geom.y + geom.height >= RENDER_HEIGHT * 0.95
  );
}

/**
 * Splits `xml` into its top-level <p:sp>/<p:pic>/<p:grpSp> blocks, skipping
 * blocks nested inside a group — the group's own recursion handles those.
 * A depth stack (rather than a lazy regex) keeps nested groups intact.
 */
function topLevelShapeBlocks(xml) {
  const tagRe = /<(\/?)p:(sp|pic|grpSp)\b[^>]*?(\/)?>/g;
  const blocks = [];
  const stack = [];
  let m;
  while ((m = tagRe.exec(xml)) !== null) {
    const closing = m[1] === '/';
    const selfClosed = m[3] === '/';
    if (!closing && !selfClosed) {
      stack.push({ kind: m[2], contentStart: m.index + m[0].length });
    } else if (closing && stack.length) {
      const open = stack.pop();
      if (stack.length === 0) {
        blocks.push({ kind: open.kind, xml: xml.slice(open.contentStart, m.index) });
      }
    }
  }
  return blocks;
}

/**
 * A group's child→parent coordinate mapping from its <a:xfrm>:
 * abs = off + (child − chOff) × (ext / chExt). Returns {ox, oy, kx, ky} such
 * that abs.x = ox + child.x × kx (and similarly for y), or null if the group
 * declares no usable transform. Group flips/rotation are rare in real decks
 * and are intentionally not modeled.
 */
function groupChildTransform(grpXml) {
  const xfrm = grpXml.match(/<a:xfrm\b[^>]*>([\s\S]*?)<\/a:xfrm>/);
  if (!xfrm) return null;
  const inner = xfrm[1];
  const off = inner.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
  const ext = inner.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
  const chOff = inner.match(/<a:chOff x="(-?\d+)" y="(-?\d+)"/);
  const chExt = inner.match(/<a:chExt cx="(\d+)" cy="(\d+)"/);
  if (!off || !ext || !chOff || !chExt) return null;
  const chCx = parseInt(chExt[1], 10) || 1;
  const chCy = parseInt(chExt[2], 10) || 1;
  const kx = parseInt(ext[1], 10) / chCx;
  const ky = parseInt(ext[2], 10) / chCy;
  return {
    kx,
    ky,
    ox: parseInt(off[1], 10) - parseInt(chOff[1], 10) * kx,
    oy: parseInt(off[2], 10) - parseInt(chOff[2], 10) * ky
  };
}

const IDENTITY_TRANSFORM = { ox: 0, oy: 0, kx: 1, ky: 1 };

/** Composes parent∘local so child coordinates map straight to slide EMU. */
function composeTransforms(parent, local) {
  return {
    kx: parent.kx * local.kx,
    ky: parent.ky * local.ky,
    ox: parent.ox + local.ox * parent.kx,
    oy: parent.oy + local.oy * parent.ky
  };
}

/**
 * Walks a slide's shape tree in document order — descending into <p:grpSp>
 * groups and mapping child geometry through the group transform (Canva wraps
 * nearly everything in groups) — classifying each <p:sp>/<p:pic> as a
 * positioned text element or a positioned image. A picture that covers the
 * whole slide is returned as the full-bleed background instead. Shapes may
 * extend beyond the slide edges; their geometry is preserved as-is and the
 * renderers clip at the slide boundary, exactly like PowerPoint does.
 */
function extractShapes(xmlData, theme, metrics, relMap, mediaByName) {
  const { sx, sy, ptToPx } = metrics;
  const elements = [];
  const images = [];
  let background = null;

  // Slide-level picture-fill background (<p:bg><a:blipFill>)
  const bgMatch = xmlData.match(/<p:bg\b[^>]*>([\s\S]*?)<\/p:bg>/);
  if (bgMatch) {
    const bgImg = resolveBlipImage(bgMatch[1], relMap, mediaByName, RENDER_WIDTH);
    if (bgImg) background = bgImg;
  }

  // Only walk the shape tree — <p:bg> above must not be re-matched as a shape.
  const spTree = xmlData.match(/<p:spTree\b[^>]*>([\s\S]*)<\/p:spTree>/);
  const treeXml = spTree ? spTree[1] : xmlData;

  function walk(xml, t) {
    for (const block of topLevelShapeBlocks(xml)) {
      if (block.kind === 'grpSp') {
        const local = groupChildTransform(block.xml);
        walk(block.xml, local ? composeTransforms(t, local) : t);
        continue;
      }

      const shapeXml = block.xml;
      const raw = shapeGeometryEmu(shapeXml);
      // Map through the accumulated group transform, then into design px.
      const geom = raw
        ? {
            x: Math.round((t.ox + raw.x * t.kx) * sx),
            y: Math.round((t.oy + raw.y * t.ky) * sy),
            width: Math.round(raw.cx * t.kx * sx),
            height: Math.round(raw.cy * t.ky * sy)
          }
        : null;
      // Text inside a scaled group renders proportionally smaller/larger.
      const fontScale = Math.sqrt(Math.abs(t.kx * t.ky)) || 1;

      const txBodyMatch = shapeXml.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/);
      const text = txBodyMatch ? extractTextBoxText(txBodyMatch[1]) : '';

      if (text.trim()) {
        const style = styleFromBody(txBodyMatch[1], theme, ptToPx, ELEMENT_FONT_MAX);
        const box = geom || { x: 96, y: 190, width: RENDER_WIDTH - 192, height: RENDER_HEIGHT - 380 };
        elements.push({
          text,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          fontSize: Math.round((style.fontSize || 48) * fontScale),
          fontFamily: style.fontFamily,
          color: style.color || '#000000',
          bold: style.bold || false,
          italic: style.italic || false,
          hAlign: style.hAlign || 'left',
          vAlign: style.vAlign || 'top',
          lineSpacing: style.lineSpacing,
          textScaling: 'none',
          hasShadow: false // PowerPoint body text has no drop shadow; match it
        });
        continue;
      }

      const fullBleed = isFullBleed(geom) || !geom;
      // Downscale decorations to ~2× their on-slide width; backgrounds stay full.
      const targetW = fullBleed ? RENDER_WIDTH : Math.min(RENDER_WIDTH, Math.max(640, geom.width * 2));
      const img = resolveBlipImage(shapeXml, relMap, mediaByName, targetW);
      if (img) {
        if (fullBleed) {
          // Whole-slide (or unpositioned) picture → treat as the background
          if (!background) background = img;
        } else {
          const { rot, flipH, flipV } = shapeXfrmAttrs(shapeXml);
          images.push({
            mediaPath: img,
            x: geom.x, y: geom.y, width: geom.width, height: geom.height,
            fill: extractFillRect(shapeXml) || undefined,
            crop: extractSrcRect(shapeXml) || undefined,
            rot: rot || undefined,
            flipH: flipH || undefined,
            flipV: flipV || undefined
          });
        }
      }
    }
  }

  walk(treeXml, IDENTITY_TRANSFORM);

  return { elements, images, background };
}

/**
 * Extracts positioned text/image layout AND legacy flat fields from a PPTX.
 * Returns { name, slides: [{ text, style, bgColor, bgImage, background,
 * elements, images, section }] }.
 */
async function parsePptx(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();

      const slideEntries = zipEntries.filter(entry =>
        entry.entryName.match(/^ppt\/slides\/slide\d+\.xml$/)
      );

      slideEntries.sort((a, b) => {
        const numA = parseInt(a.entryName.match(/slide(\d+)\.xml/)[1], 10);
        const numB = parseInt(b.entryName.match(/slide(\d+)\.xml/)[1], 10);
        return numA - numB;
      });

      const mediaByName = new Map();
      zipEntries.forEach(entry => {
        if (entry.entryName.startsWith('ppt/media/')) {
          mediaByName.set(entry.entryName.split('/').pop(), entry);
        }
      });

      const theme = extractTheme(zipEntries);
      const metrics = getSlideMetrics(zipEntries);
      const sectionByRid = extractSections(zipEntries);
      const slideIdByEntry = buildSlideIdMap(zipEntries);

      const slides = slideEntries.map(entry => {
        const xmlData = entry.getData().toString('utf8');
        const slideFile = entry.entryName.split('/').pop();
        const relMap = readRelTargets(zipEntries, `ppt/slides/_rels/${slideFile}.rels`);
        const slideId = slideIdByEntry.get(entry.entryName);

        const { elements, images, background } = extractShapes(
          xmlData, theme, metrics, relMap, mediaByName
        );

        // Flat text/style kept for search, stage display, and any surface that
        // renders a slide as a single block (worship lyrics, songs, scripture).
        const text = elements.length
          ? elements.map(e => e.text).join('\n')
          : '';

        return {
          slideName: slideFile,
          text,
          style: extractSlideStyle(xmlData, theme, metrics.ptToPx),
          bgColor: resolveBgColor(xmlData, entry.entryName, zipEntries, theme),
          bgImage: background,
          background,
          elements,
          images,
          section: slideId ? sectionByRid.get(slideId) || null : null
        };
      });

      resolve({
        name: path.basename(filePath, path.extname(filePath)),
        slides
      });

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { parsePptx };
