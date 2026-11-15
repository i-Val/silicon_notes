# Rich Web Sticky Notes (Chrome Extension)

A lightweight Chrome Extension (Manifest V3) that lets you create, format, drag, resize, collapse, and persist rich text sticky notes directly on any webpage.

Built with modern ES2022+, Web Components / Shadow DOM CSS isolation, and zero third-party dependencies.

---

## ✨ Features

- **Draggable & Boundary-Clamped:** Drag any note across the page smoothly via the header bar. Notes are automatically clamped to the visible viewport so they never get lost off-screen.
- **Rich Text Editor:**
  - **Bold** (`Ctrl+B` / `Cmd+B`)
  - **Italic** (`Ctrl+I` / `Cmd+I`)
  - **Underline** (`Ctrl+U` / `Cmd+U`)
  - **Strikethrough**
  - **Bulleted Lists** (`<ul>`)
  - **Numbered Lists** (`<ol>`)
  - **Inline Code** (`<code>`)
  - **Active State Reflection:** Toolbar buttons automatically highlight based on the active cursor selection.
  - **Focus Preservation:** Clicking formatting buttons never loses your cursor position or text selection.
- **Paste & HTML Sanitization:** Automatically strips invasive inline CSS, classes, scripts, and trackers from pasted content. Whitelists only safe formatting tags (`<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<s>`, `<ul>`, `<ol>`, `<li>`, `<code>`, `<br>`, `<div>`, `<p>`).
- **4 Pastel Themes (WCAG Compliant):**
  - 💛 Pastel Yellow (`#fef08a`)
  - 💚 Mint Green (`#bbf7d0`)
  - 💙 Sky Blue (`#bae6fd`)
  - 💗 Rose Pink (`#fbcfe8`)
  - Paired with high-contrast charcoal text (`#18181b`) for optimal readability.
- **Collapsible & Resizable:**
  - Fold notes down to just their title bar (`–` / `+`).
  - Drag the bottom-right corner to resize (`min-width: 240px`, `min-height: 200px`). Dimensions persist automatically.
- **DOM & CSS Isolation:** Injected inside an open Shadow DOM root (`#rich-web-sticky-notes-root`), ensuring host webpage styles and frameworks (Tailwind, Bootstrap, resets) never break the note UI.
- **Persistence & Multi-Tab Sync:**
  - Keyed by normalized page URL (`notes:${origin}${pathname}`). Ignores volatile query parameters like `?utm_source=...`.
  - Automatically synchronizes note changes across multiple open tabs of the same webpage in real time via `chrome.storage.onChanged`.
- **Extension Action Popup:**
  - List and search all notes on the current tab.
  - Jump-to-note feature with a smooth highlight pulse animation.
  - Export all notes on the page to a Markdown (`.md`) file.
  - Toggle show/hide notes on the page.
  - Dynamic note count badge on the extension icon.

---

## ⌨️ Keyboard Shortcuts

| Action | Windows / Linux | macOS |
| :--- | :--- | :--- |
| **New Sticky Note** | `Alt + Shift + N` | `Cmd + Shift + N` |
| **Toggle Show / Hide Notes** | `Alt + Shift + H` | `Cmd + Shift + H` |
| **Bold** | `Ctrl + B` | `Cmd + B` |
| **Italic** | `Ctrl + I` | `Cmd + I` |
| **Underline** | `Ctrl + U` | `Cmd + U` |

---

## 🚀 Installation & Testing

1. Open Google Chrome (or any Chromium browser like Brave, Edge, Arc).
2. Go to `chrome://extensions/`.
3. In the top-right corner, turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder (`silicon_notes`).
6. Open [`test/demo.html`](test/demo.html) in Chrome or visit any website.
7. Click the extension puzzle icon and pin **Rich Web Sticky Notes** to your toolbar.
8. Click **New Note** or press `Alt + Shift + N` to create your first sticky note!

---

## 📂 Project Structure

```
silicon_notes/
├── manifest.json              # Manifest V3 configuration & command shortcuts
├── background/
│   └── service_worker.js      # Background worker handling commands & badges
├── content/
│   └── content.js             # Core engine with Shadow DOM isolation & note controls
├── popup/
│   ├── popup.html             # Extension action popup
│   ├── popup.css              # Popup styling
│   └── popup.js               # Search, jump-to, export & management logic
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── icon.svg
│   └── generate_icons.py
├── test/
│   └── demo.html              # Testing & verification playground
└── README.md
```
