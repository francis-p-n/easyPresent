const AdmZip = require('adm-zip');
const xml2js = require('xml2js');
const path = require('path');

// Raster images larger than this are skipped as backgrounds to keep the
// library file from ballooning (they'd be stored as base64 data URLs)
const MAX_BG_BYTES = 2.5 * 1024 * 1024;

const RASTER_EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

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

      const parser = new xml2js.Parser();

      const parsePromises = slideEntries.map(entry => {
        return new Promise((resolveSlide, rejectSlide) => {
          const xmlData = entry.getData().toString('utf8');
          parser.parseString(xmlData, (err, result) => {
            if (err) return rejectSlide(err);

            const texts = [];
            function extractText(obj) {
              if (!obj) return;
              if (Array.isArray(obj)) {
                obj.forEach(extractText);
                return;
              }
              if (typeof obj !== 'object') return;
              for (const key in obj) {
                if (key === 'a:t') {
                  if (Array.isArray(obj[key])) {
                    obj[key].forEach(t => {
                      if (typeof t === 'string') texts.push(t);
                      else if (t && t._) texts.push(t._);
                    });
                  } else if (typeof obj[key] === 'string') {
                    texts.push(obj[key]);
                  }
                } else if (typeof obj[key] === 'object') {
                  extractText(obj[key]);
                }
              }
            }

            extractText(result);

            resolveSlide({
              slideName: entry.entryName.split('/').pop(),
              text: texts.join('\n').trim(),
              bgImage: extractBgImage(entry.entryName)
            });
          });
        });
      });

      Promise.all(parsePromises)
        .then(slides => resolve({
          name: path.basename(filePath, path.extname(filePath)),
          slides
        }))
        .catch(reject);

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { parsePptx };
