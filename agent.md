# EasyPresent - Agent Context

## Project Overview & Mission
EasyPresent is a modern, high-performance desktop application designed for live event presentation, lyric projection, and media playback. It is a clone/alternative to ProPresenter built on a hybrid architecture (Electron + Vite + Vanilla JS + C++ Native Addons) to deliver zero-latency media playback and a premium UI experience.

## Technology Stack
- **Frontend:** Vanilla JS, CSS Custom Properties, HTML5
- **Build Tool:** Vite + `vite-plugin-electron`
- **Desktop Wrapper:** Electron (Node.js, `adm-zip`, `xml2js`)
- **Backend Engine:** C++ Native Addons via `node-addon-api`, DirectX 11, WASAPI

## Key Files & Directories
- `/src`: Frontend code. Contains `engine/StateManager.js` for state management, and `components/` for all UI components.
- `/electron`: Main process scripts, including `pptx-parser.js`.
- `/native`: C++ source for hardware-accelerated rendering and audio processing.
- `/dist-electron`: Build outputs.
- `improvements.md`: Detailed UI/UX and architectural pointers for future scaling.

## Active Context
We have recently integrated built-in church presentation best practices to improve readability and volunteer workflows. Future work involves transitioning to a more scalable state management system (unidirectional data flow) and implementing DOM virtualization for large decks as outlined in `improvements.md`.

## Changelog / Recent Edits
- **[Current Date]**: Implemented configurable `maxLinesPerSlide` setting, auto-splitting in `SongImporter.js`, readability warnings in `SlideEditor.js`, and updated `StateManager.js` with new robust default themes (Worship, Sermon, Announcement). Pushed changes to GitHub.
