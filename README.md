# EasyPresent

**An Open-Source, Cross-Platform ProPresenter Alternative**

EasyPresent is a modern, high-performance desktop application designed for live event presentation, lyric projection, and media playback. Built with a hybrid architecture, it combines the flexibility of web technologies (Electron + HTML/CSS/JS) with the raw performance of native C++ APIs for zero-latency media playback and GPU-accelerated compositing.

---

## 🏗️ Architecture

The application is built in three distinct layers:

1. **Frontend UI (Electron + JS)**
   - **Framework:** Vanilla JS, CSS Custom Properties, and HTML5.
   - **Build Tool:** Vite + `vite-plugin-electron`.
   - **Role:** Handles layout, state management, media library organization, playlist management, and user interactions.

2. **Backend Engine (C++ Native Addons)**
   - **Frameworks:** Node-API (`node-addon-api`), C++20.
   - **Graphics:** DirectX 11 (GPU accelerated texture compositing).
   - **Video:** Media Foundation with DXVA2 Hardware Acceleration.
   - **Audio:** WASAPI for low-latency, multi-channel audio mixing.
   - **Role:** Handles heavy lifting. Composites text, video, and image layers at 60fps, and shares texture handles directly with Electron output windows for zero-copy rendering.
   - *Note: If the C++ native addon cannot be compiled or loaded, the application elegantly falls back to HTML5 Canvas for rendering!*

3. **Presentation Import (Electron Main Process)**
   - **Frameworks:** Node.js, `adm-zip`, `xml2js`.
   - **Role:** Parses PPTX files directly within the Electron Main process for easy integration into the frontend UI.

---

## 📁 Directory Structure

- `/src`: Frontend code (HTML/JS/CSS assets)
- `/electron`: Main, Preload, and PPTX Parsing scripts (`pptx-parser.js`) for Electron
- `/native`: C++ source files for native bindings and integrations
- `/dist-electron`: Built output folder for the Electron main/preload bundles

---

## 🚀 Features

- **Slide Engine:** Rich text formatting, slide groups (Verse, Chorus), and dynamic text scaling.
- **Media Bin:** Organize and preview video and image assets.
- **Audio Bin:** Manage background audio playlists with crossfade support.
- **Multi-Screen Support:** Independent Audience and Stage Display outputs.
- **Non-Destructive Editing:** Edit presentations without interrupting the live output.
- **Live Output Preview:** Real-time preview of the audience screen directly in the control panel.
- **Church Presentation Best Practices:** 
  - Automated song import splitting with configurable max lines per slide.
  - Real-time visual readability warnings in the slide editor.
  - Pre-configured high-contrast default themes (Worship, Sermon, Announcements).

---

## 🛠️ Development Setup

### Prerequisites

To build both the frontend and the native C++ engine, you will need:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- **Windows Only (for Native Engine):**
  - Visual Studio 2022 Build Tools (with the "Desktop development with C++" workload and Windows 10/11 SDK).
  - [CMake](https://cmake.org/download/) (v3.20 or higher)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/easypresent.git
   cd easypresent
   ```

2. **Install Node dependencies:**
   ```bash
   npm install
   ```

3. **Compile the Native C++ Engine:**
   ```bash
   npm run build:native
   ```
   *If you skip this step or the build fails, the app will automatically fall back to the software-rendered HTML5 Canvas engine.*

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```

---

## 📦 Packaging for Production

To build a standalone `.exe` installer for distribution:

```bash
npm run build
```

This uses `electron-builder` to bundle the native `.node` addons, the frontend assets, and the Electron runtime into a single executable.

---

## 🤝 Contributing

Contributions are welcome! Whether it's reporting bugs, submitting pull requests, or suggesting new features, we'd love your help making EasyPresent the best open-source presentation software available.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
