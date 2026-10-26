# QA findings: 25-persona test of the real app

Each persona drove the real Electron app (own throwaway profile and port). This file merges their reports,
removes duplicates, and ranks what is left. `Persona` numbers refer to the test personas (see the end).
"Where" is the likely source location, not a confirmed root cause unless it says so.

Status: all 25 reports are merged.

## Fixed so far
| ID | Fix | Checked |
| --- | --- | --- |
| B1 | Corrupt `songs.db` is set aside as `.corrupt-<time>`, a fresh DB is created and refilled from the library, with a notice. Also fixes M14 (mirror runs at startup). | unit tests + real app |
| B2 | Closing the operator window closes every output window and the app quits. | unit tests + real app |
| B3 | Imported slide layout stays inside the Output Preview (`position: relative` on the preview screen). | real-app visual test |
| B4 | Setlist create / rename / duplicate / delete, row up / down / remove, Add Song picker, working "Create Setlist" button. Also fixes M25 (ghost rows), the setlist half of M6 (names, headers, notes written as text), and the unconfirmed "active setlist resets after restart". | real-app visual test |
| M1 | Navigation remembers which song is live (`livePresentationId`). Selecting another song no longer moves the live position; the next arrow starts that song at slide 1. Presenter/PA/Stage report the live song, not the selected one. | real-app visual test |
| M2 | PA and Presenter pages dim and show a red NO SIGNAL banner when the feed drops. | real-app visual test |
| M3 | Escape closes an open dropdown menu first; only a bare Escape clears the output. | real-app visual test |
| M4 | `Shift+Right/Down` or `]` = next song, `Shift+Left/Up` or `[` = previous song in the active setlist (starts at slide 1). | real-app visual test |
| M5 | Digits typed in quick succession form one slide number (`1` then `2` = slide 12). | real-app visual test |
| M13 | A damaged `library.json` is copied to `library.json.corrupt-<time>` before anything overwrites it, and a message says whether it was restored from a backup or started fresh. | real-app visual test |
| M15 | Presenter/PA/Audience open as ordinary windows in separate cascade slots, smaller than the operator window, and focus returns to the operator window. | real-app visual test |
| M22 | The web server tries ports 8080-8090 and reports a clear error (as a message in the app) if none can be used; it retries on the next attempt. | real-app visual test |
| M24 | New "Phones & tablets" section in the Screens menu: Start sharing, then it lists the real LAN addresses (`http://<ip>:<port>/presenter` and `/pa`). Opening a Presenter/PA window also starts the server. | real-app visual test |
| M6 | The slide view title and rehearsal-audio path are set as text/properties, not markup (the setlist half was fixed with B4). | real-app visual test |
| M7 | Import Song detects chords-above-lyrics, converts it (keeping intro/interlude lines), and tells the user. A `Title:` / `{title: ...}` line fills in the title, category and key. | real-app visual test |
| M8 | Any `[Name]` line that isn't a chord is a section header, so `[Bait 1]`, `[Reff]`, `[副歌]` work and map to the right group. `Title:`/`Category:`/`Key:` lines and `{...}` directives no longer become lyrics. | real-app visual test |
| M9 | Chord-only lines (intro, interlude, instrumental) become their own slide with empty text: blank on the audience screen, chords kept for the chart and print. | real-app visual test |
| B6 | Stacked touch layout now touch-only; narrow desktop windows keep three columns and a compact toolbar. | real-app visual test |

| M11 | The band's Stage window now shows chords (sent as ChordPro in the song's current key); spacing no longer splits words where a chord falls mid-word. | real-app visual test |

| M10 | Imported PowerPoint title/body placeholders take their position from the slide layout, then the master (they used to share one default box and print on top of each other). | unit tests + real app |
| M12 | Printed sheets place chords by display column (wide CJK/emoji count as 2, accents as 0) and wrap very long words; the audience screen and the operator preview wrap them too. | unit tests + real app |
| M16 | The Messages tab explains `{timer}` and has a "+ Timer" button; the operator preview ticks with the countdown; a half-typed message survives switching tabs. | real app |
| M17 | Category chips and the setlist dropdown are at least 28px tall; touch screens get 44px targets and a wider gap around CLEAR ALL; a swipe only changes slides when it starts on the slide area. | real app |
| M15 (follow-up) | Focus returns to the operator window again once a new output window finishes loading (it was briefly nobody's). | real app |

B5 (Bible text) is waiting on a decision.

### Visual test pass (real app, 33 checks + screenshots)
All fixed items above were exercised in the running app: narrow 853px window, busy-port fallback, window cascade and
focus, share-to-phones addresses, song change while live, next-song keys, `1`,`2` = slide 12, Escape with a menu open,
PA no-signal banner, setlist create / add / reorder / remove / duplicate / delete, Import Song with a chords-above-lyrics
chart (Title line, other-language headers, intro line), a hostile song title, an imported PowerPoint in the preview,
and a damaged `library.json`. 33 of 33 behaviour checks pass. Looking at the screenshots found four more problems,
fixed in the same pass:
- chord-only lines rendered as `DAG` instead of `D A G` (my M9 change);
- the library list kept highlighting the old song when a song was picked from the playlist (existing bug);
- at ~850px the "Playlist" title was squeezed to "P..." and the Messages/Macros tabs were clipped;
- the song picker's "Added ..." toasts piled up over the timer controls.

Not covered by the visual pass: real second/third monitors, a real printer, touch input, a screen reader.

---

## BLOCKERS (fix first)

| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| B1 | A corrupt `songs.db` stops the app from opening any window, with no message. Regression from the SQLite work. Fix: catch the open error, move the bad file to `songs.db.corrupt-<time>`, start a fresh DB, rebuild charts from the library. | 15 | `electron/ipc/songs.js` (`openSongDb`) |
| B2 | Closing the operator window while any output window is open does not quit the app. Output windows stay up and the process keeps running. | 17 | `electron/main.js` (`window-all-closed` only) |
| B3 | After importing a .pptx, taking a slide live makes it spill out of the Output Preview and cover the library, playlist and slide grid. The preview box stays blank. | 18 | `src/features/stage/PreviewPanel.js` |
| B4 | Setlists can't be created, renamed, deleted or duplicated. Playlist items can't be reordered or removed. Adding a song is only possible from a hidden library right-click menu. The empty-state "Create Playlist" button has no handler. | 21 (also 20) | `src/features/library/PlaylistPanel.js` |
| B5 | The Bible panel is unusable: both data files are stubs (Genesis 1:1, John 3:16 only). Ranges ("John 3:16-18") silently show one verse; abbreviations ("jn 3:16") and numbered books fail. **Needs your decision:** ESV/NIV are copyrighted, so real text must be a public-domain translation (KJV/WEB) or a licensed file you supply. | 19 | `src/data/bible-*.json`, `src/features/bible/BiblePanel.js` |
| B6 | At roughly 850 px wide (1280 px at 150% zoom) the toolbar's right end is cut off with no scroll, and the slide grid renders underneath the side panels. | 07 | `src/styles/layout.css`, `toolbar.css` |

## MAJOR

### Live state and sync
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M1 | Selecting another song while a slide is live carries the old slide number into the new song, so the next arrow press skips its first slides. The Presenter/PA header and "next" then describe a song that is not on screen. | 04, 11 | `src/core/navigation.js`, `src/core/liveState.js` |
| M2 | The PA view keeps showing the last slide with a green LIVE badge after it loses its connection. Only small header text changes. It should dim and say the feed is stale. | 11 | `public/pa/index.html` |
| M3 | Escape closes the Screens menu and also blanks the live output. The menu is not treated as a modal for shortcuts. | 04 | `src/main.js` (`MODAL_SELECTOR`) |

### Keyboard operation
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M4 | No keyboard way to go to the next song. Arrows stop at the last slide, playlist rows aren't focusable, and nothing is documented. | 04 | `src/main.js`, `PlaylistPanel.js` |
| M5 | Number keys only reach slides 1-9; songs often have 12-15 slides. | 04 | `src/main.js` |

### Security
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M6 | Script runs in the operator window from text in playlist headers/notes, playlist names (and the switcher dropdown), and song titles shown above the slide grid. An imported file could trigger it. The output windows, PA/Presenter pages and print sheet are safe. | 22 | `PlaylistPanel.js` (`_updateItemDom`, name bar), `SlideView.js` (header) |

### Importing charts
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M7 | Import Song does not convert chords-over-lyrics (the chord-website format), yet says "imported successfully". Chord letters then appear as lyrics on the audience screen. The converter already exists; wire it into the importer with auto-detection. | 13, 06 | `SongImporter.js`, `src/songs/chordSheetParse.js` |
| M8 | Non-English section headers are swallowed ("[副歌]", "Bait", "Reff" become lyric text or "Verse 1"). The importer's own "Download Template" starts with `Title:`/`Category:` lines that end up on slide 1. | 23, 06, 13 | `src/songs/chordpro.js` |
| M9 | Chord-only sections (Intro, Interlude, Instrumental) in pasted ChordPro keep their chords but become blank slides, and `[Interlude]` isn't recognised as a section. | 03 | `src/songs/chordpro.js` |
| M10 | Imported .pptx decks: text boxes overlap on some slides, formatting is only partly kept, decks are named after the file ("a", "b") with no rename, and import shows no progress for ~4 s. | 18 | `electron/pptx/parser.js`, `src/features/library/LibraryPanel.js` |

### Band and print
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M11 | The Stage window shows no chords and the transpose control does nothing: the feed carries only the chord-stripped text. | 03 | `src/main.js` (`broadcast`), `public/stage/app.js` |
| M12 | Print: chord alignment breaks for CJK/Korean/emoji (padding counts characters, not display width). A very long unbroken word runs off the page. | 23 | `src/songs/printSheet.js` |

### Data safety
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M13 | A corrupt `library.json` is recovered from a backup or replaced with defaults with no message, and the next save overwrites the corrupt file. Keep a `.corrupt` copy and tell the user. | 15 | `electron/services/libraryStore.js`, `src/services/StorageManager.js` |
| M14 | After `songs.db` is deleted, the rebuilt database is incomplete (only the starter songs came back, not songs added earlier) because mirroring only runs on a library change, not at startup. A later export would silently omit them. Call `sync.mirror()` after the first pull. | 15 | `src/songs/songLibrary.js` |

### Windows and screens
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M15 | With one display, Presenter and PA open at exactly the same position and size (PA hides Presenter), and all three outputs cover most of the operator window. Cascade them and keep the operator on top. | 17 | `electron/windows/displays.js` |

### Network
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M22 | If the stage port (8080) is already in use, opening Presenter/PA fails silently: no window, no message. The server has no error handler, and the hub marks itself started before listening succeeds, so it never retries. Needs an error toast and ideally a port fallback. | 05 | `electron/server/stageServer.js`, `electron/services/stageHub.js` |
| M23 | The web server listens on every network interface with open CORS and no password. Anyone on the same Wi-Fi (or a web page open on a LAN browser) can read the live slide text and title. Nothing else is exposed and the show can't be changed from the network. Decide if that is acceptable; options are a LAN on/off switch or a join code. | 05, 22 | `electron/server/stageServer.js` |

| M24 | A phone or laptop can't open `/presenter` or `/pa` until the operator has opened an output window, because the web server starts lazily. The guest gets "connection refused" with no hint. Start the server when the Screens menu opens (or on a "Share to devices" switch) and show the real LAN address. | 09, 05 | `electron/services/stageHub.js`, `Toolbar.js` |

### Library integrity
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M25 | Deleting a song leaves a blank "ghost" row (empty, still 44 px tall, still counted) in every setlist that held it. No warning, and the delete dialog doesn't say the song is in a setlist. Remove the row (or show "missing song") and mention setlists in the dialog. | 14 | `PlaylistPanel.js` (`if (!pres) { el.innerHTML = '' }`), `LibraryPanel.js` |

### Messages, timers and preview
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M16 | `{timer}` in a message is not discoverable (no hint on the Messages tab) and the operator Output Preview shows "00:00" frozen while the real screens count down. | 10 | `MessagesTab.js`, `PreviewPanel.js` |

### Size and touch
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M17 | Most controls are 22-32 px tall and 10-11 px text; CLEAR ALL sits right next to LOGO. At 1024x768 the slide grid shows one row. Playlist reorder needs drag-and-drop, which doesn't work on touch. A swipe anywhere changes the live slide, even when scrolling a list. | 07, 20 | `src/styles/*.css`, `src/main.js` (swipe) |

### Accessibility
| ID | Problem | Seen by | Where |
| --- | --- | --- | --- |
| M18 | PA and Presenter pages have no live regions, so screen readers hear nothing when the state changes. | 16 | `public/pa/`, `public/presenter/` |
| M19 | Slide thumbnails can't be reached with Tab and have no role or name. Library and playlist rows are focusable divs with no button/list roles. | 16 | `SlideView.js`, `LibraryPanel.js`, `PlaylistPanel.js` |
| M20 | Dialogs have no dialog role, no focus trap, and ignore Escape. | 16 | `SongImporter.js` and the other modals |
| M21 | The Search box, the three Screens display dropdowns and the four top-left icon buttons have no accessible name. | 16, 25 | `Toolbar.js` |

## MINOR

- **Unconfirmed (check first):** the active setlist after a restart may reset to "Sunday Morning Service", and switching to "This Week" once showed an empty list (personas 21, 25). Verify whether this is a render bug or lost data.
- **Logo with no logo image** looks identical to a cleared screen; operator preview still says LIVE (01, 07, 11, 12). Say so when no logo is set, and show the logo state in the preview.
- **Presenter polish:** NOW/NEXT labels and the two unlabelled clocks are too small; message banner shifts the layout; section name in NEXT looks like a lyric line; cleared state looks like live apart from dim text (02).
- **Contrast:** PA status text on green is 1.99:1; operator chips and Clear All are 3.5-4.1:1 (07, 16).
- **No reduced-motion support** for the LIVE badge pulse (16).
- **Screens menu:** "Auto (next free display)" is unexplained on one display; help text shows the literal `<this-pc>`; tooltip clipped at the right edge ("SHOW LOGO (") (01, 17, 20).
- **Unlabelled toolbar icons:** the four view buttons at the far left have no tooltip; Edit/Themes/Screens rely on tooltips (01, 25).
- **Shortcut hints:** F1-F6 appear only in hover tooltips (04, 20).
- **Focus:** closing an output window leaves nothing focused, so shortcuts stop working until the operator window is clicked (17). Focused setlist dropdown swallows arrow keys (04).
- **Timers:** Reset after the 3-min preset goes to 05:00; nothing happens at zero; CLEAR ALL leaves the timer running; presets load but don't start (10).
- **Slide labels:** continuation slides of a long section are all "VERSE 1" (13, 23). Slide counts read "1 slides".
- **Print pagination:** 15 pages for 8 songs (each song starts a new page; repeated sections print in full; no "(cont.)" marker); songs without a key print no key line (03, 08).
- **Chord display:** where chords sit one character apart (e.g. "Am" then "D") they fuse in the slide view; print pads a space (03).
- **Audience window:** text scales by width only, so 4:3 and portrait look sparse (12). Single-display audience window is framed with a title bar (17).
- **Text edge cases:** Arabic mixed with Latin renders left-to-right (23). 7 imports stack 7 identical toasts (23, 13).
- **Search:** focus shows a tiled-magnifier glitch; lyric matches rank above title matches (06). Category field in the import dialog is clipped (06).
- **Library backups** are rate-limited to one per 10 min, so a restore may be stale (15).
- **GPU memory** reached ~1.2 GB with all three outputs open (24); "Stage display connected" console noise (24).
- **LAN views:** the web server starts only when a screen is first opened, so a phone gets "connection refused" until then, and the app never shows the address to type (it shows the literal `<this-pc>`). No indicator of connected devices (05).
- **Presenter page on a phone:** no "connected / waiting" cue (the offline note is ~7px grey text over the NEXT box); after CLEAR ALL the old song title stays; labels are 8-9px in landscape; no text-size control or keep-awake, so the phone dims mid-sermon (09).
- **Delete:** no undo toast and Ctrl+Z does nothing ("This cannot be undone"); library list stays scrolled oddly with the top row half-clipped after a context-menu action (14).
- **Welcome modal** wording could name the pencil icon and mention how to open the screens (25).
- **Bible panel:** no Enter-to-send, no confirmation, "dummy data" in the error text (19).

## Not bugs / left alone
- "Sbab" and the blank line before the last chorus line in Betapa Hatiku are in the chart as supplied.
- LAN clients cannot push events to other viewers or change the show (22, 05); the exposure is read-only (see M23).

## What worked well (keep)
- Three screens stay in sync: 200 rapid key presses, 100x Clear/Logo spam, 30x open/close with no desync or leaks (11, 24).
- Update latency is about 3-50 ms; payloads to the web views are small; no image data goes over the network (11, 18, 24).
- Hard kill right after a save loses nothing; library and songs-database export/import round-trip (15).
- Library chips, search, empty state, duplicate and rename all work and reach the database; deleted starter songs stay deleted after a restart (14).
- Unicode (CJK, Arabic, emoji, accents) displays correctly and survives SQLite (06, 23).
- The Presenter page auto-fits at phone, tablet and landscape sizes with no horizontal scroll, and a reload restores the current slide at once (09).
- Output windows, PA/Presenter pages and print sheet escape text safely (22).
- 300-song library stays smooth (24).

## Personas
01 first-time PA volunteer, 02 senior pastor, 03 worship leader, 04 keyboard-only operator, 05 church IT admin,
06 Indonesian-language operator, 07 low-vision volunteer at 150% zoom, 08 drummer reading prints, 09 guest speaker on a phone,
10 youth leader (messages/timers), 11 sound engineer, 12 livestream operator, 13 songwriter importing charts, 14 librarian,
15 data-loss-paranoid admin, 16 accessibility auditor, 17 single-display small church, 18 PowerPoint user, 19 Bible reader,
20 kids-ministry touch user, 21 worship planner, 22 security-minded admin, 23 multilingual text tester, 24 stress tester, 25 first-run secretary.
