# AI Coding Agent Specification: "Silicon Notes" Chrome Extension

## 1. Role & Objective
Act as a Senior Chrome Extension Engineer specializing in Manifest V3, modern JavaScript (ES2022+), DOM isolation, and UI/UX engineering. Build a complete, production-ready Chrome Extension named **"Silicon Notes"** that lets users create, edit, format, drag, resize, collapse, and persist sticky notes directly on any webpage.

---

## 2. Core Functional Requirements

### 2.1 Note Structure & Rich Text Editor
Each injected sticky note must contain four distinct sections:
1. **Draggable Header Bar:**
   - Subtle drag grip indicator.
   - Color cycle/picker trigger to switch note themes on the fly.
   - Collapse/expand toggle button (`–` / `+`) that folds the note down to just its header and heading.
   - Delete button (`✕`) to remove the note permanently.
2. **Editable Heading Field:**
   - A dedicated single-line title input (`placeholder="Note heading..."`) styled with bold typography (`font-weight: 700`), visually separated from the body by a subtle divider.
3. **Formatting Toolbar:**
   - Compact toolbar between the heading and body with icon buttons for:
     - **Bold** (`Ctrl/Cmd + B`)
     - **Italic** (`Ctrl/Cmd + I`)
     - **Underline** (`Ctrl/Cmd + U`)
     - **Strikethrough**
     - **Bulleted List** (`<ul>`)
     - **Numbered List** (`<ol>`)
     - **Inline Code** (`<code>`)
   - **Active State Reflection:** Listen to `selectionchange` / `keyup` / `mouseup` inside the editor so toolbar buttons highlight (`active` state) whenever the caret is inside formatted text.
   - **Focus Preservation:** Use `mousedown` with `e.preventDefault()` on toolbar buttons so clicking a formatting icon never steals focus or collapses the user's text selection inside the body.
4. **Rich Text Body Area:**
   - A `contenteditable="true"` container supporting multi-line text, nested lists, and keyboard shortcuts (`Ctrl/Cmd + B`, `I`, `U`).
   - **Paste Sanitization:** Intercept the `paste` event to strip external website styles/classes and insert clean plain text or sanitized formatting.
   - **HTML Sanitization:** Sanitize `innerHTML` before saving to storage and before rendering from storage. Whitelist only safe tags: `<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<s>`, `<ul>`, `<ol>`, `<li>`, `<code>`, `<br>`, `<div>`, `<p>` (strip all attributes like `onclick`, `style`, `class`).

### 2.2 Note Interaction, Positioning & Themes
- **Creation Triggers:**
  - Clicking **`+ New Sticky Note`** inside the browser toolbar popup.
  - Pressing a global keyboard shortcut (`Alt+Shift+N` on Windows/Linux, `Command+Shift+N` on macOS) registered in `manifest.json` under `"commands"`.
- **Drag & Viewport Bounds:**
  - Dragging the header moves the note smoothly across the viewport.
  - Clamp `x` and `y` coordinates within `window.innerWidth` and `window.innerHeight` so notes cannot be lost off-screen.
- **Resizing & Stacking:**
  - Support native or custom corner resizing (`min-width: 240px`, `min-height: 200px`) tracked via `ResizeObserver` so custom dimensions persist.
  - Clicking or dragging any note brings it to the highest `z-index` among all sticky notes on the page.
- **Color Themes:**
  - Support 4 high-contrast pastel themes:
    - **Yellow:** `#fef08a`
    - **Mint Green:** `#bbf7d0`
    - **Sky Blue:** `#bae6fd`
    - **Rose Pink:** `#fbcfe8`
  - Use dark charcoal text (`#18181b`) across all themes for WCAG-compliant readability.

### 2.3 Persistence & Multi-Tab Sync
- **Storage API:** Use `chrome.storage.local` keyed by normalized URL (`notes:${window.location.origin}${window.location.pathname}`) so notes persist per page while ignoring volatile query strings (`?utm_source=...`).
- **Data Schema:**
  ```json
  {
    "id": "uuid-v4",
    "heading": "string",
    "bodyHtml": "sanitized-html-string",
    "color": "#fef08a",
    "x": 80,
    "y": 80,
    "width": 260,
    "height": 240,
    "collapsed": false,
    "updatedAt": 1700000000000
  }