# UI/UX Improvement Pointers

As a senior UI/UX designer reviewing the current state of the ProPresenter clone, here are key areas where we can elevate the design from a functional layout to a premium, professional application.

## 1. Visual Hierarchy & Contrast
*   **Palette Refinement:** The current dark mode palette (`#1e1e1e`, `#252526`) is very reminiscent of code editors (like VS Code). For professional presentation software, we want to ensure maximum focus on the *content* (the slides). Consider slightly deepening the background to a richer dark shade (e.g., `#18181A`) and using a slightly lighter panel background (`#222225`) with subtle inner borders to create depth.
*   **Text Contrast:** Your `--text-secondary` (`#999999`) on `--bg-panel` (`#252526`) might cause eye strain in low-light environments (common in AV booths). Lighten secondary text slightly to `#A1A1AA` to comfortably meet WCAG AA contrast ratios.

## 2. Typography & Readability
*   **Base Font Size:** The base font sizes (`11px` for xs, `13px` for sm) are quite small. While dense UIs need smaller text, consider bumping the base UI text to `14px` and using `12px` for secondary labels. 
*   **Font Weights:** Use `Inter`'s medium (`500`) or semibold (`600`) weights for panel headers and section titles to create clearer scannability without relying solely on size or uppercase transformations.

## 3. Interaction & Micro-animations
*   **Slide Thumbnails:** The `scale(1.02)` hover effect is a great start. Enhance this by adding a subtle, soft drop-shadow on hover to make the slide "lift" off the page. Additionally, the live slide indicator (currently a red border) could use a pulsing dot or a more prominent "LIVE" badge to ensure the operator instantly knows what's on the screen.
*   **Panel Resizers:** The resizers are currently `4px` wide. This creates a very narrow hit area for the mouse, frustrating users. Keep the *visible* line at `1px` or `2px`, but make the interactive hit area `8px` to `10px` wide using a transparent pseudo-element (`::after`).
*   **Context Menus:** The context menu animation (`contextMenuIn`) is a simple scale. A smoother, more modern approach is a slight vertical slide combined with a fade (e.g., `transform: translateY(-4px)` to `translateY(0)`).

## 4. Empty States & Onboarding
*   **Actionable Empty States:** The current `.empty-state` is passive. When a playlist or slide view is empty, include a clear Call to Action (CTA). For example, "Drag and drop media here" or a prominent "Create Playlist" button directly inside the empty state area.
*   **Illustrations:** Consider adding subtle, monochromatic vector illustrations to empty states to make the application feel more polished and friendly.

## 5. Tooling & Control Layout
*   **Clear Buttons:** The `.clear-btn` styling is functional but having multiple buttons packed together can lead to misclicks in high-pressure live environments. Ensure there is adequate padding between critical destructive actions (like "Clear All") and standard actions.
*   **Input Fields:** For the search inputs, the `10px` padding is good, but consider a subtle focus ring transition with a soft box-shadow (e.g., `box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.2)`) to make the active state feel more tactile.

## 6. Feedback & States
*   **Success/Error States:** Ensure that any actions (like saving a presentation or failing to load media) have clear, non-intrusive toast notifications at the bottom or top of the screen.
*   **Loading States:** For media-heavy applications, skeleton loaders for image thumbnails are crucial to prevent the UI from feeling broken while assets load.

## 7. Direct Visual Feedback (Based on UI Screenshots)

Based on a review of the current UI screenshots, here are immediate, actionable fixes and improvements:

*   **Stray Artifacts & HTML Bugs:** 
    *   There are stray bullet points (`•`) appearing on their own lines under the "Audio Playlist" and "Media" headers. This suggests an issue with empty `<li>` elements or list styling. Ensure list items have their content properly nested and consider removing default list styles (`list-style-type: none;`).
    *   In the empty state view, there is a stray `+` character floating below the "Create Presentation" button. This needs to be removed from the DOM.
*   **Media & Audio List Styling:** The items under "Audio Playlist" and "Media" currently render as plain text. They should be styled as interactive list items. Add padding, hover background colors, and consider adding an icon to the left of each item to denote the media type. Aligning metadata (like duration "3:00") to the far right will also clean up the layout.
*   **Icon Cohesion:** The icons in the bottom dock/toolbar are very disparate in style, color, and weight (mixing flat shapes, 3D elements, and different aesthetics). To achieve a professional, premium look, replace these with a unified, monochromatic icon library (such as Lucide, Phosphor, or Heroicons) and use color selectively for active states.
*   **Empty State Button Polish:** The "Create Presentation" button is functional but feels slightly generic. Consider adding an icon (like a plus sign) *inside* the button alongside the text, refining the border radius, and adding a subtle hover effect (like a slight background lighten or shadow) to make it feel more tactile.
*   **Badge Padding:** The blue numeric badges next to playlist items (like the '2' and '5') are vibrant, but the numbers feel slightly cramped. A slight increase in horizontal padding and ensuring a perfect circle or pill shape will make them look much cleaner.

## 8. MANGO-Level System Design & Architecture (Senior Staff Engineer Feedback)

As a Principal/Staff Engineer from a FAANG/MANGO background, looking at the current stack (Electron + Vite + Vanilla JS + C++ Addons), here is how we need to architect this for scale, high-performance, and resilience:

### A. Predictable State Management
*   **Decouple State from DOM:** Currently relying on Vanilla JS and direct DOM manipulation is a recipe for race conditions and spaghetti code as the app scales. We need to implement a unidirectional data flow (like Flux/Redux or a robust pub/sub event bus). The view should simply be a reflection of the state, not the source of truth.
*   **Virtualization / Windowing:** If a church loads a 500-slide deck, rendering 500 DOM nodes in the `.playlist-panel` will cause massive GC (Garbage Collection) pauses and jank. We must implement DOM virtualization (e.g., virtual scrolling) so only the visible items are kept in the DOM tree.

### B. IPC (Inter-Process Communication) Optimization
*   **Avoid the IPC Bridge for Heavy Payloads:** The `pptx-parser.js` runs in the Main process. Sending massive parsed JSON payloads of slide data over the Electron IPC bridge to the Renderer will serialize/deserialize strings and block the main thread.
*   **Zero-Copy Memory:** For heavy assets (like video frames or large blobs), utilize `SharedArrayBuffer` or stream the data via custom protocols (`protocol.registerStreamProtocol`) instead of standard IPC messaging. 

### C. Rendering Engine Evolution
*   **Move Beyond DOM for Slides:** Relying on HTML/CSS for the actual slide presentation (`.slide-view`) will not scale to 4K 60fps with alpha-channel video backgrounds and complex crossfade transitions. 
*   **Hardware Acceleration:** We must transition the actual slide rendering pipeline to a WebGL/Canvas-based engine (like PixiJS) or render directly via native C++ OpenGL/DirectX bindings (using the native addons) to guarantee V-Sync and GPU acceleration without Chromium's layout engine overhead.

### D. Native Addon Threading Model
*   **Unblock the Event Loop:** The C++ native logic (`node-addon-api`) must absolutely ensure that heavy operations (like parsing proprietary formats or transcoding media) are done using `Napi::AsyncWorker`. A single blocking call in the C++ layer will freeze the entire Node.js event loop and cause the UI to hang.
*   **Multi-threading:** Utilize Web Workers for heavy client-side computations (like searching massive song libraries) to keep the main Renderer thread dedicated exclusively to UI responsiveness.

### E. Micro-Kernel & Plugin Architecture
*   **Extensibility:** A monolithic `main.js` is unmaintainable. Architect the app with a core-plugin model. The "Media Bin", "Audio Player", and "Stage Display" should be lazy-loaded modules. This reduces the initial bundle size, improves startup time (TTI - Time to Interactive), and enforces strict separation of concerns.
