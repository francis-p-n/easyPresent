# Roadmap & Backlog

## Completed
- `[x]` Church presentation best practices (max lines, readability warnings, default themes)
- `[x]` Camp feature set: template sets, game tab (scores/trivia/countdown), team scheduler tab
- `[x]` Announcement slides with double-click quick-edit overlay
- `[x]` Multi-text-box slide editor (drag/resize, snap guides, per-box autosize, inline editing)
- `[x]` Mobile/iPad responsive layout + touch swipe navigation
- `[x]` PPTX import preserves design background images (Canva-style templates)
- `[x]` Performance: thumbnail LRU cache, debounced saves, search worker index, preview/broadcast dedup
- `[x]` Architecture: single `goLive()` navigation action, lazy PIXI init, file-based persistence (userData/library.json), copy-on-write presentation/playlist updates
- `[x]` UI/UX pass from `improvements.md` (palette, contrast, focus rings, hover lift, live pulse, resizer hit areas, context menu motion)
- `[x]` Destructive-action confirmation (delete presentation)
- `[x]` Virtualized playlist rendering (VirtualScroller)

## Active Development
- `[ ]` Store imported media as files on disk instead of inline data URLs (library size)
- `[ ]` Rasterize SVG-based PPTX slides (shape-heavy templates import text-only)
- `[ ]` App icon + code signing for distribution builds

## Future Ideas
- `[ ]` Remote-control web page served by the stage server (operate from phone/iPad on venue Wi-Fi)
- `[ ]` Wire the C++ DirectX addon path into the render pipeline (video backgrounds)
- `[ ]` Undo/redo for slide editing
- `[ ]` Multi-text-box rendering on stage display and audience output (currently plain text)
