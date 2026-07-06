# Roadmap & Backlog

## Completed
- `[x]` Church presentation best practices (max lines, readability warnings, default themes)
- `[x]` Camp feature set: template sets, game tab (scores/trivia/countdown), team scheduler tab
- `[x]` Announcement slides with double-click quick-edit overlay
- `[x]` Multi-text-box slide editor (drag/resize, snap guides, per-box autosize, inline editing)
- `[x]` Mobile/iPad responsive layout + touch swipe navigation
- `[x]` PPTX import preserves design background images (Canva-style templates)
- `[x]` PPTX import extracts each slide's own formatting (font size, bold/italic, color, family, alignment) instead of only plain text, so imports keep the source deck's look
- `[x]` Fixed PPTX text corruption: words split across multiple XML runs (e.g. spell-check breaks) rendered as broken fragments on separate lines ("sear-\ning\nloss" instead of "searing loss")
- `[x]` Performance: thumbnail LRU cache, debounced saves, search worker index, preview/broadcast dedup
- `[x]` Architecture: single `goLive()` navigation action, lazy PIXI init, file-based persistence (userData/library.json), copy-on-write presentation/playlist updates
- `[x]` UI/UX pass from `improvements.md` (palette, contrast, focus rings, hover lift, live pulse, resizer hit areas, context menu motion)
- `[x]` Destructive-action confirmation (delete presentation)
- `[x]` Virtualized playlist rendering (VirtualScroller)
- `[x]` Bug hunt (Jul 2026): slim stage broadcast payload (was shipping multi-MB base64 backgrounds per slide advance), messages now render in Output Preview (was a dead canvas-context path), per-slide style included in preview repaint signature, imported lineSpacing honored, invalid canvas textAlign no longer leaks between thumbnails
- `[x]` Test suite: 119 tests across 16 files — SongImporter parsing, pptx-parser (fixture-built decks + real session-slides integration), navigation/state, TimerEngine, StorageManager (file + localStorage + migration), SearchWorker (real module), NativeRender thumbnails (mock canvas), PreviewPanel (dedup/message regressions), LibraryPanel import flow, ChordSheet, VirtualScroller, ToastManager, Icons, models, stage-display chord transposition (VM sandbox)
- `[x]` Fixed TextElement.hasShadow — `options.hasShadow || true` made shadows impossible to disable
- `[x]` Live E2E run (Playwright driving the real Electron app, scratchpad/e2e.mjs pattern): launch, import of real session decks, go-live/keyboard nav, message overlay, stage server + socket broadcast, persistence across restart — 14/14
- `[x]` Fixed stage display window: loaded non-existent dist/src/output/stage.html (chrome-error in every environment); now loads the stage server at localhost:8080. Vendored socket.io client into public/stage because the bundled main process can't serve /socket.io/socket.io.js from disk
- `[x]` Audience output window: the core ProPresenter gap — a real fullscreen projection window (auto-targets the external display when one is connected, `Screens` toolbar button toggles it), synced from operator state (`src/engine/outputSync.js`) over IPC (`toggle-audience-output`/`update-audience-output`), rendered by a dependency-free script (`public/output/audience-render.js`) so it never needs a bundler. Shows live slide text/style/background, the message overlay independent of slide state, and honors imported per-slide style + theme fallback. 21 new tests (outputSync, audience-render via VM sandbox, main.js IPC handlers — the latter needed patching Node's `Module._load` directly since vitest's mock/doMock don't intercept `require('electron')` from CJS)
- `[x]` Arrangements (ProPresenter parity gap): named, ordered slide sequences that can repeat a slide (Verse 1, Chorus, Verse 1, Chorus, Bridge) without duplicating slide data (`src/engine/arrangement.js`; the model shape — `arrangements`/`activeArrangementId`/`sequence` of ids — already existed on the unused `Presentation` class and is now wired to the real plain-object presentations everywhere: `goLive`/`goLiveNext`/`goLivePrev`, `SlideView`'s grid + slide count, the stage broadcast, and the audience output sync). New `ArrangementEditor` modal (toolbar: layers icon in the slide view header) to build/rename/delete arrangements and reorder/add/remove sequence entries. Fixed two latent identity bugs this surfaced: `AnnouncementEditor` and `SlideEditor` compared `liveSlideIndex === editorIndex` to decide whether to push a live update, which breaks once a slide's arrangement position can differ from its master index — both now compare slide id instead. 67 new tests; verified live in the real Electron app (Playwright) building a repeating V-C-V-C-B arrangement and confirming keyboard navigation lands on the correct repeated occurrence.
- `[x]` Fixed "can't change fonts": the Slide Editor's Text Box panel had a Font Size control but no Font (family) control at all — there was no UI path to change a text box's font. Added one (`#prop-font-family`, with a `<datalist>` of common fonts including ones the PPTX importer produces, e.g. Calibri). Also fixed `SlideEditor.loadSlide()` silently discarding an imported PPTX slide's captured style (fontFamily/color/bold/italic/hAlign/lineSpacing) the moment it was opened for editing — it only ever applied generic template defaults. Root-caused a second, deeper bug behind the same symptom: neither `SlideView` (thumbnail grid) nor `PreviewPanel` (live output) had any reactive listener for theme changes at all — they only repainted incidentally when something else also changed, and even then `PreviewPanel`'s repaint-dedup signature keyed on the theme's *id*, not its style content, so editing the currently-active theme in place (the common case — one theme, tweak it) silently did nothing. Both panels now listen for `activeThemeId`/`themes` directly. 25 new tests; verified in a fully repackaged Windows build (not just dev) that font changes now show up on thumbnails and live output.
- `[x]` Investigated "screen config doesn't work" — the Screens/audience-output toggle (see above) works correctly in both dev and a freshly packaged build; the earlier packaged-build test that seemed to show it and the theme editor failing was traced to stale `dist/` output from packaging without re-running `vite build` after a source change, not a product bug. Worth remembering for future packaged-build testing: `npm run build` (not `electron-builder` alone) to avoid this exact false alarm.

## Active Development
- `[ ]` Audience output currently renders plain text only (no multi-text-box layout, no video backgrounds, no transitions) — see Future Ideas
- `[ ]` Arrangement editor has no drag-and-drop reordering (up/down buttons only) and Master's own slide order can't be edited from within it
- `[ ]` Store imported media as files on disk instead of inline data URLs (library size)
- `[ ]` Rasterize SVG-based PPTX slides (shape-heavy templates import text-only)
- `[ ]` PPTX-imported custom/decorative fonts (e.g. Canva typefaces) aren't embedded — imported `fontFamily` only renders correctly if that font happens to be installed locally
- `[ ]` PPTX import doesn't yet read gradient fills, underline, or per-run color/size variation within a single text box (only a representative style per slide is extracted)
- `[ ]` Stage display layout: long chord-free lyric lines render one word per row with large chord-space gaps (public/stage CSS) — needs a no-chords compact mode
- `[ ]` App icon + code signing for distribution builds

## Future Ideas
- `[ ]` Remote-control web page served by the stage server (operate from phone/iPad on venue Wi-Fi)
- `[ ]` Wire the C++ DirectX addon path into the render pipeline (video backgrounds)
- `[ ]` Undo/redo for slide editing
- `[ ]` Multi-text-box rendering on stage display and audience output (currently plain text)
- `[ ]` Transitions (dissolve/cut/wipe) between live slides on the audience output, with per-slide override
- `[ ]` Looks: per-output layer visibility (e.g. hide lyrics on audience during sermon, keep visible on stage/confidence monitor)
