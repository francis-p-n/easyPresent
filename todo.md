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

## Active Development
- `[ ]` Store imported media as files on disk instead of inline data URLs (library size)
- `[ ]` Rasterize SVG-based PPTX slides (shape-heavy templates import text-only)
- `[ ]` PPTX-imported custom/decorative fonts (e.g. Canva typefaces) aren't embedded — imported `fontFamily` only renders correctly if that font happens to be installed locally
- `[ ]` PPTX import doesn't yet read gradient fills, underline, or per-run color/size variation within a single text box (only a representative style per slide is extracted)
- `[ ]` App icon + code signing for distribution builds

## Future Ideas
- `[ ]` Remote-control web page served by the stage server (operate from phone/iPad on venue Wi-Fi)
- `[ ]` Wire the C++ DirectX addon path into the render pipeline (video backgrounds)
- `[ ]` Undo/redo for slide editing
- `[ ]` Multi-text-box rendering on stage display and audience output (currently plain text)
