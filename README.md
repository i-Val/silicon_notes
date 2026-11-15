# Rich Web Sticky Notes (Chrome Extension)

A lightweight Chrome Extension (Manifest V3) that lets you create, format, drag, resize, collapse, and persist rich text sticky notes directly on any webpage, localhost, or on a dedicated blank canvas workspace.

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
- **Guaranteed Persistence (Zero Data Loss):**
  - Notes automatically persist per page URL (`notes:${origin}${pathname}`) or canvas (`notes:canvas_workspace`).
  - Closing a note (`✕`) stashes it safely off-screen **without deleting your content**. You can reopen any closed note at any time with a single click from the extension popup.
  - Permanent deletion is handled explicitly via the Trash icon (`🗑`) with confirmation.
  - Immediate state persistence on `blur`, `dragend`, `resize`, `beforeunload`, and `pagehide`.
- **Full Localhost & Port Support:**
  - Works seamlessly on `localhost`, `127.0.0.1`, and any local dev server port (`:3000`, `:5173`, `:8080`, etc.).
  - Guaranteed DOM isolation with inline reset styles so Tailwind, Bootstrap, or custom CSS resets never hide or distort sticky notes.
- **Blank Tabs & Dedicated Notes Canvas:**
  - Chrome strictly restricts content scripts on internal pages like `chrome://newtab`. To solve this, the extension includes a built-in **Blank Notes Canvas** (`canvas/canvas.html`) with an infinite dot-grid workspace.
  - Pressing `Alt+Shift+N` on a new tab or clicking "Open Canvas" in the popup launches the canvas instantly.
  - Also supports `about:blank`.
- **4 Pastel Themes (WCAG Compliant):**
  - 💛 Pastel Yellow (`#fef08a`)
  - 💚 Mint Green (`#bbf7d0`)
  - 💙 Sky Blue (`#bae6fd`)
  - 💗 Rose Pink (`#fbcfe8`)
  - Paired with high-contrast charcoal text (`#18181b`) for optimal readability.
- **Collapsible & Resizable:**
  - Fold notes down to just their title bar (`–` / `+`).
  - Drag the bottom-right corner to resize (`min-width: 240px`, `min-height: 200px`). Custom dimensions persist automatically.
- **Extension Action Popup:**
  - Search and filter notes on the current page or canvas.
  - Reopen closed notes or jump to active notes with a highlight pulse animation.
  - Export notes on the page to a Markdown (`.md`) file.
  - Toggle show/hide notes on the page (`Alt+Shift+H`).
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

1. Open Google Chrome.
2. Go to `chrome://extensions/`.
3. In the top-right corner, turn on **Developer mode**.
4. Click **Load unpacked** (or click the reload icon 🔄 if already loaded).
5. Select this project folder (`silicon_notes`).
6. Pin **Rich Web Sticky Notes** to your Chrome toolbar.
7. Test across different environments:
   - **On any website:** Visit any site and press `Alt+Shift+N`.
   - **On localhost:** Open any local dev server (`http://localhost:3000` or Laragon) and create notes.
   - **On blank tabs:** Click the extension icon or press `Alt+Shift+N` on a new tab to launch the full-screen **Blank Notes Canvas**.

---

## 📂 Project Structure

```
silicon_notes/
├── manifest.json              # Manifest V3 config & command shortcuts
├── background/
│   └── service_worker.js      # Background worker handling commands, badges & canvas routing
├── canvas/
│   └── canvas.html            # Full-screen blank notes workspace
├── content/
│   └── content.js             # Core engine with Shadow DOM isolation, persistent storage & note controls
├── popup/
│   ├── popup.html             # Extension action popup
│   ├── popup.css              # Popup styling
│   └── popup.js               # Search, jump-to, reopen, export & management logic
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── icon.svg
│   └── generate_icons.py
├── test/
│   └── demo.html              # Testing playground
└── README.md
```
