const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

/**
 * Extracts text from a PPTX file.
 * Returns an array of objects representing slides, each containing an array of text snippets.
 */
async function parsePptx(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      
      // Filter for slide XML files
      const slideEntries = zipEntries.filter(entry => 
        entry.entryName.match(/^ppt\/slides\/slide\d+\.xml$/)
      );
      
      // Sort slides by number in the filename
      slideEntries.sort((a, b) => {
        const numA = parseInt(a.entryName.match(/slide(\d+)\.xml/)[1], 10);
        const numB = parseInt(b.entryName.match(/slide(\d+)\.xml/)[1], 10);
        return numA - numB;
      });

      const slidesData = [];
      const parser = new xml2js.Parser();

      // Parse each slide
      const parsePromises = slideEntries.map(entry => {
        return new Promise((resolveSlide, rejectSlide) => {
          const xmlData = entry.getData().toString('utf8');
          parser.parseString(xmlData, (err, result) => {
            if (err) return rejectSlide(err);
            
            const texts = [];
            // Helper function to recursively find all a:t elements
            function extractText(obj) {
              if (!obj) return;
              if (typeof obj === 'string') {
                // Should not happen directly at this level, but just in case
                return;
              }
              if (Array.isArray(obj)) {
                obj.forEach(extractText);
                return;
              }
              for (const key in obj) {
                if (key === 'a:t') {
                  if (Array.isArray(obj[key])) {
                    obj[key].forEach(t => {
                      if (typeof t === 'string') texts.push(t);
                      else if (t._) texts.push(t._);
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
            
            // Join all text snippets with space or newline
            // For now, we'll just keep them as an array of text blocks or join them
            resolveSlide({
              slideName: entry.entryName.split('/').pop(),
              text: texts.join('\n').trim()
            });
          });
        });
      });

      Promise.all(parsePromises)
        .then(slides => resolve(slides))
        .catch(reject);
        
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { parsePptx };
