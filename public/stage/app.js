const socket = io();
let currentText = '';
let currentTransposition = 0;
let currentChart = [];   // every section of the live song, chords inline
let currentIndex = -1;   // which of them is on the audience screen

// All standard chromatic notes
const sharpKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const flatKeys  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

socket.on('slide-update', (slideData) => {
  if (slideData && slideData.text) {
    currentText = slideData.text;
  } else {
    currentText = '';
  }
  currentChart = slideData && Array.isArray(slideData.chart) ? slideData.chart : [];
  currentIndex = slideData && typeof slideData.index === 'number' ? slideData.index : -1;
  renderSlide();
});

// Text size for the band, kept on this device only
let textScale = 1;
try { textScale = Number(localStorage.getItem('stageTextScale')) || 1; } catch (e) { /* private window */ }

function changeTextSize(delta) {
  textScale = Math.min(2, Math.max(0.6, Math.round((textScale + delta) * 10) / 10));
  try { localStorage.setItem('stageTextScale', String(textScale)); } catch (e) { /* private window */ }
  renderSlide();
}

function changeTransposition(delta) {
  currentTransposition += delta;
  
  // Normalize between -11 and +11 (just to keep number reasonable)
  if (currentTransposition > 11) currentTransposition -= 12;
  if (currentTransposition < -11) currentTransposition += 12;
  
  const displayVal = currentTransposition > 0 ? `+${currentTransposition}` : currentTransposition;
  document.getElementById('transpo-val').textContent = displayVal;
  
  renderSlide();
}

// Transposes a single chord string (e.g. "C#m7" -> "Dm7" for +1)
function transposeChord(chord, steps) {
  if (steps === 0 || !chord) return chord;

  // Regex to match the root note (A-G) plus optional sharp/flat
  const rootRegex = /^([A-G][#b]?)(.*)$/;
  const match = chord.match(rootRegex);
  
  if (!match) return chord; // Not a standard chord format
  
  const rootNote = match[1];
  const suffix = match[2];

  // Find index in sharp or flat array
  let index = sharpKeys.indexOf(rootNote);
  let useSharps = true;
  
  if (index === -1) {
    index = flatKeys.indexOf(rootNote);
    useSharps = false;
  }
  
  if (index === -1) return chord; // fallback

  let newIndex = (index + steps) % 12;
  if (newIndex < 0) newIndex += 12;

  const newRoot = useSharps ? sharpKeys[newIndex] : flatKeys[newIndex];
  
  return newRoot + suffix;
}

// Parses ChordPro format and renders to DOM
function renderSlide() {
  const container = document.getElementById('slide-content');
  container.innerHTML = '';
  container.style.fontSize = textScale + 'em';

  // The whole song, with the live section lit and kept in view
  if (currentChart.length && currentIndex >= 0) {
    let liveEl = null;
    currentChart.forEach((section, i) => {
      const block = document.createElement('section');
      block.className = 'section' + (i === currentIndex ? ' live' : i === currentIndex + 1 ? ' next' : i < currentIndex ? ' done' : '');
      if (section.label) {
        const head = document.createElement('div');
        head.className = 'section-label';
        head.textContent = section.label + (i === currentIndex ? '  ▶ LIVE' : i === currentIndex + 1 ? '  NEXT' : '');
        block.appendChild(head);
      }
      renderLines(block, section.text);
      container.appendChild(block);
      if (i === currentIndex) liveEl = block;
    });
    // Keep the live section near the top so the band can read what is coming
    if (liveEl && liveEl.scrollIntoView) liveEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }

  if (!currentText) return;
  renderLines(container, currentText);
}

function renderLines(container, text) {
  const lines = String(text || '').split('\n');

  lines.forEach(lineText => {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'line';

    // Regex to match [Chord]LyricWord
    // It splits by `[` and `]` to separate chords from lyrics.
    // E.g. "[C]Amazing " -> "", "C", "Amazing "
    const tokens = lineText.split(/\[(.*?)\]/);
    
    // First token is always lyric (could be empty if starts with chord)
    if (tokens[0]) {
      const span = createChordWordPair('', tokens[0]);
      lineDiv.appendChild(span);
    }

    for (let i = 1; i < tokens.length; i += 2) {
      const chordRaw = tokens[i];
      const lyricPart = tokens[i+1] || '';
      
      const transposedChord = transposeChord(chordRaw, currentTransposition);
      const span = createChordWordPair(transposedChord, lyricPart);
      lineDiv.appendChild(span);
    }

    container.appendChild(lineDiv);
  });
}

function createChordWordPair(chord, lyric) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chord-word';
  
  const chordSpan = document.createElement('div');
  chordSpan.className = 'chord';
  chordSpan.textContent = chord;
  
  const lyricSpan = document.createElement('div');
  lyricSpan.className = 'lyric';
  // Replace space with non-breaking space if it's just a space so rendering holds width
  lyricSpan.textContent = lyric === ' ' ? '\u00A0' : lyric;
  if (lyric === '') lyricSpan.textContent = '\u00A0';

  wrapper.appendChild(chordSpan);
  wrapper.appendChild(lyricSpan);
  return wrapper;
}
