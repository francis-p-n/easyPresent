const socket = io();
let currentText = '';
let liveState = null;    // what Presenter/PA also get: song title, next song, message, timer
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

// What this screen shows: the chord chart, lyrics only (singers), or big section cues (drums / leader).
// `?view=` in the address wins, so two screens on one computer can differ; the choice is remembered otherwise.
const VIEWS = ['chords', 'lyrics', 'cues'];
function chooseView(search, saved) {
  const found = /[?&]view=([a-z]+)/.exec(String(search || ''));
  const asked = found ? found[1] : '';
  if (VIEWS.indexOf(asked) !== -1) return asked;
  return VIEWS.indexOf(saved) !== -1 ? saved : 'chords';
}
let savedView = '';
try { savedView = localStorage.getItem('stageView') || ''; } catch (e) { /* private window */ }
let currentView = chooseView(typeof location !== 'undefined' ? location.search : '', savedView);

function setView(view) {
  if (VIEWS.indexOf(view) === -1) return;
  currentView = view;
  try { localStorage.setItem('stageView', view); } catch (e) { /* private window */ }
  try { history.replaceState(null, '', '?view=' + view); } catch (e) { /* not in a page */ }
  applyView();
  renderSlide();
}

function applyView() {
  const body = typeof document !== 'undefined' && document.body;
  if (!body || !body.classList) return;
  VIEWS.forEach(function (v) { body.classList.toggle('view-' + v, v === currentView); });
  document.querySelectorAll('.view-btn').forEach(function (b) {
    b.setAttribute('aria-pressed', b.dataset.view === currentView ? 'true' : 'false');
  });
}

// Chords out: a singer reads words, not letters. A line that was only chords (an instrumental) disappears.
function stripChords(text) {
  return String(text || '').replace(/\[[^\]]*\]/g, '');
}

// The bar across the top: song, what is next, the countdown and the time of day
function formatClock(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function renderBar() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const set = function (id, text) { const el = document.getElementById(id); if (el) el.textContent = text; };
  const live = liveState || {};
  set('bar-title', live.title || '');
  set('bar-next', live.nextSong ? 'Next: ' + live.nextSong : '');
  const timer = live.timer && live.timer !== '00:00' ? '⏱ ' + live.timer : '';
  set('bar-timer', timer);
  set('bar-clock', formatClock(new Date()));
  const banner = document.getElementById('stage-message');
  if (banner) {
    banner.textContent = live.message || '';
    banner.hidden = !live.message;
    if (document.body && document.body.classList) document.body.classList.toggle('has-message', !!live.message);
  }
}

socket.on('live-state', (state) => {
  liveState = state || null;
  renderBar();
  if (currentView === 'cues') renderSlide();
});

if (typeof setInterval === 'function') setInterval(renderBar, 1000);

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

  // Cues: the section now and the one after, big enough to read from the drum kit
  if (currentView === 'cues') {
    const now = currentChart[currentIndex];
    const after = currentChart[currentIndex + 1];
    if (now) {
      const big = document.createElement('div');
      big.className = 'cue-now';
      big.textContent = now.label || 'NOW';
      container.appendChild(big);
      const small = document.createElement('div');
      small.className = 'cue-next';
      small.textContent = after ? 'NEXT: ' + (after.label || 'section') : 'LAST SECTION';
      container.appendChild(small);
      const count = document.createElement('div');
      count.className = 'cue-count';
      count.textContent = (currentIndex + 1) + ' of ' + currentChart.length;
      container.appendChild(count);
    } else if (currentText) {
      renderLines(container, currentText);
    }
    return;
  }

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
    // Lyrics only: no chords, and no empty row where a chords-only line was
    if (currentView === 'lyrics') {
      const words = stripChords(lineText);
      if (lineText.indexOf('[') !== -1 && words.trim() === '') return;
      const plain = document.createElement('div');
      plain.className = 'line plain';
      plain.textContent = words === '' ? ' ' : words;
      container.appendChild(plain);
      return;
    }
    const lineDiv = document.createElement('div');
    lineDiv.className = 'line';

    // No chords on this line: one wrapping text run, not a column per word with a reserved chord row
    if (lineText.indexOf('[') === -1) {
      lineDiv.className = 'line plain';
      lineDiv.textContent = lineText === '' ? ' ' : lineText;
      container.appendChild(lineDiv);
      return;
    }

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

applyView();
renderBar();
