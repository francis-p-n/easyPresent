const AdmZip = require('adm-zip');
const path = require('path');

// Raster images larger than this are skipped as backgrounds to keep the
// library file from ballooning (they'd be stored as base64 data URLs)
const MAX_BG_BYTES = 2.5 * 1024 * 1024;

const RASTER_EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

// Matches NativeRender's canvas width (src/engine/NativeRender.js) so imported
// point sizes convert to the same pixel space the renderer draws in.
const RENDER_WIDTH = 1920;

const SCHEME_COLOR_ALIAS = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };

const PPTX_ALIGN = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };
const PPTX_ANCHOR = { t: 'top', ctr: 'center', b: 'bottom' };

// Clamp imported font sizes to what's sane on the app's fixed 1920x1080 canvas.
// Design-tool exports (e.g. Canva) often scale a shape's text via its own
// vector transform rather than the authored `sz`, so the raw XML value can be
// wildly larger than what actually rendered on the original slide. The
// ceiling matches the largest size the app's own templates use
// (worship_title in src/features/presentation/SlideEditor.js), so imports
// can't render more dominant than any native slide type.
const MIN_FONT_SIZE = 24;
const MAX_FONT_SIZE = 110;

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

/**
 * Extracts a slide's text, preserving its paragraph/line structure.
 * Runs (a:r) within a paragraph are concatenated with no separator (PowerPoint
 * routinely splits a single word across multiple runs, e.g. for spell-check),
 * while explicit <a:br/> elements and paragraph (a:p) boundaries become
 * newlines. Naively joining every <a:t> run with '\n' (the previous approach)
 * shattered words like "searing" into "sear-\ning" whenever they spanned runs.
 *
 * A paragraph that produces no visible text is treated as spacing decoration
 * and dropped — PowerPoint authors routinely use empty <a:p> elements as
 * inter-line breathing room, and preserving them here made imported lyrics
 * render with big awkward gaps ("word / blank / word / blank / …"). We
 * still preserve intra-paragraph <a:br/> line breaks and any consecutive
 * blank lines the author put inside a single paragraph.
 */
function extractSlideText(xmlData) {
  const paraRegex = /<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g;
  const paragraphs = [];
  let paraMatch;
  while ((paraMatch = paraRegex.exec(xmlData)) !== null) {
    const paraContent = paraMatch[1];
    const partRegex = /<a:t>([\s\S]*?)<\/a:t>|<a:br(?:\s[^>]*)?\/>|<a:br(?:\s[^>]*)?>[\s\S]*?<\/a:br>/g;
    const paraLines = [];
    let line = '';
    let partMatch;
    let hasVisibleText = false;
    while ((partMatch = partRegex.exec(paraContent)) !== null) {
      if (partMatch[1] !== undefined) {
        const decoded = decodeXmlEntities(partMatch[1]);
        line += decoded;
        if (decoded.trim()) hasVisibleText = true;
      } else {
        paraLines.push(line);
        line = '';
      }
    }
    paraLines.push(line);
    // Drop fully-empty paragraphs — otherwise decorative <a:p/> elements
    // (spacing between real paragraphs) render as visible blank lines.
    if (hasVisibleText) paragraphs.push(paraLines.join('\n'));
  }
  return paragraphs.join('\n').trim();
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

/**
 * Extracts the slide's background color from <p:bg>. PPTX slides declare
 * their background as either a solid fill or a scheme reference. Returns
 * a hex color like '#1a1a1a' or null if no color background (image or none).
 */
function extractSlideBgColor(xmlData, theme) {
  const bgMatch = xmlData.match(/<p:bg\b[^>]*>([\s\S]*?)<\/p:bg>/);
  if (!bgMatch) return null;
  const bg = bgMatch[1];
  // Ignore backgrounds that are picture-fills — those are handled as bgImage
  if (/<a:blipFill\b/.test(bg)) return null;
  const solid = bg.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/);
  if (solid) return resolveFillColor(solid[1], theme);
  // Fall back to <p:bgRef> which references a theme fill by index
  const bgRef = bg.match(/<p:bgRef\b[^>]*>([\s\S]*?)<\/p:bgRef>/);
  if (bgRef) {
    const scheme = bgRef[1].match(/<a:schemeClr val="(\w+)"/);
    if (scheme) return resolveSchemeColor(scheme[1], theme);
  }
  return null;
}

/**
 * Extracts sections from ppt/presentation.xml (PowerPoint 2010+ feature under
 * the p14 extension namespace). Returns a Map<slideRelId, sectionName> that
 * lets the caller label each slide with the section it belongs to. If the
 * presentation has no sections, returns an empty Map.
 */
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

/**
 * Builds a map from ppt/slides/slideN.xml → slide id (the string used by
 * p14:sldId to reference each slide). Sections identify their member slides
 * by these ids, so we need this to correlate a section back to a slide file.
 */
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

  // XML attribute order is arbitrary — parse each <p:sldId> tag then pull
  // `id` and `r:id` independently, otherwise presentations authored by tools
  // that write `r:id` first would have all their section labels drop out.
  const sldIdTagRegex = /<p:sldId\b([^>]*?)\/?>/g;
  let sm;
  while ((sm = sldIdTagRegex.exec(presXml)) !== null) {
    const attrs = sm[1];
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    const ridMatch = attrs.match(/\br:id="([^"]+)"/);
    if (!idMatch || !ridMatch) continue;
    const target = relTargets.get(ridMatch[1]);
    if (!target) continue;
    // Targets look like "slides/slide1.xml"; normalize to full zip path
    const fullPath = target.startsWith('/') ? target.slice(1) : `ppt/${target}`;
    idByEntry.set(fullPath, idMatch[1]);
  }

  return idByEntry;
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

/** Reads ppt/presentation.xml's slide width to convert PPTX points to the render canvas's pixel space. */
function getPtToPxScale(zipEntries) {
  const presEntry = zipEntries.find(e => e.entryName === 'ppt/presentation.xml');
  const fallback = 2; // matches a standard 13.333in widescreen slide at RENDER_WIDTH
  if (!presEntry) return fallback;

  const xml = presEntry.getData().toString('utf8');
  const sizeMatch = xml.match(/<p:sldSz\s+cx="(\d+)"/);
  if (!sizeMatch) return fallback;

  const cxInches = parseInt(sizeMatch[1], 10) / 914400;
  return cxInches > 0 ? (RENDER_WIDTH / cxInches) / 72 : fallback;
}

/**
 * Picks the <p:txBody> (a shape's text box) containing the most visible text.
 * A slide's shapes appear in the XML in authoring order, not by visual
 * importance — a slide number, footer, or small caption can easily come
 * before the main lyrics/body box. Since that box is reliably the one with
 * the most text, using it as the style source avoids the representative
 * style being hijacked by an incidental shape.
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

/**
 * Extracts a representative text style for a slide: the font size, weight,
 * color, family, and alignment of the first paragraph that has visible text,
 * scoped to the shape with the most text (see findMainTextBody). PPTX runs
 * frequently fragment a single line's formatting (e.g. spell-check splits),
 * so later paragraphs' formatting is ignored once a usable style is found —
 * this favors the dominant look of the text box over incidental per-run
 * variation.
 */
function extractSlideStyle(xmlData, theme, ptToPx) {
  const style = {};

  const mainBody = findMainTextBody(xmlData);
  if (!mainBody) return style;

  const anchorMatch = mainBody.match(/<a:bodyPr[^>]*\banchor="(\w+)"/);
  if (anchorMatch && PPTX_ANCHOR[anchorMatch[1]]) style.vAlign = PPTX_ANCHOR[anchorMatch[1]];

  const paraRegex = /<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g;
  let paraMatch;
  while ((paraMatch = paraRegex.exec(mainBody)) !== null) {
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
          style.fontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, raw));
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
      break; // only the paragraph's first visible run sets its representative style
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

      if (style.fontSize) break; // have a representative font size — stop scanning
    }
  }

  return style;
}

/**
 * Extracts text AND background images from a PPTX file.
 * Returns { name, slides: [{ text, bgImage }] } where bgImage is a data URL
 * of the slide's primary raster image (typically the design background in
 * Canva-style exports), or null.
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

      // Index media entries by their zip path for background lookup
      const mediaByName = new Map();
      zipEntries.forEach(entry => {
        if (entry.entryName.startsWith('ppt/media/')) {
          mediaByName.set(entry.entryName.split('/').pop(), entry);
        }
      });

      /** Resolve a slide's background: largest raster image it references */
      function extractBgImage(slideEntryName) {
        const slideFile = slideEntryName.split('/').pop();
        const relsEntry = zipEntries.find(
          e => e.entryName === `ppt/slides/_rels/${slideFile}.rels`
        );
        if (!relsEntry) return null;

        const relsXml = relsEntry.getData().toString('utf8');
        // Collect referenced media file names (r:embed targets like ../media/image3.png)
        const targets = [...relsXml.matchAll(/Target="\.\.\/media\/([^"]+)"/g)].map(m => m[1]);

        let best = null;
        for (const name of targets) {
          const ext = path.extname(name).toLowerCase();
          const mime = RASTER_EXT[ext];
          if (!mime) continue; // skip svg/video/etc.
          const entry = mediaByName.get(name);
          if (!entry) continue;
          const size = entry.header.size;
          if (size > MAX_BG_BYTES) continue;
          if (!best || size > best.size) best = { entry, size, mime };
        }

        if (!best) return null;
        return `data:${best.mime};base64,${best.entry.getData().toString('base64')}`;
      }

      const theme = extractTheme(zipEntries);
      const ptToPx = getPtToPxScale(zipEntries);
      const sectionByRid = extractSections(zipEntries);
      const slideIdByEntry = buildSlideIdMap(zipEntries);

      const slides = slideEntries.map(entry => {
        const xmlData = entry.getData().toString('utf8');
        const slideId = slideIdByEntry.get(entry.entryName);
        return {
          slideName: entry.entryName.split('/').pop(),
          text: extractSlideText(xmlData),
          bgImage: extractBgImage(entry.entryName),
          bgColor: extractSlideBgColor(xmlData, theme),
          section: slideId ? sectionByRid.get(slideId) || null : null,
          style: extractSlideStyle(xmlData, theme, ptToPx)
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
