/**
 * Rich Web Sticky Notes - Content Script
 * Manifest V3, Modern ES2022+, Shadow DOM Isolation, Zero External Dependencies
 * Global Availability: Notes persist globally across all websites, localhost, and canvas.
 */

(() => {
  // Guard against multiple injections
  if (window.__RICH_WEB_STICKY_NOTES_INITIALIZED__) {
    return;
  }
  window.__RICH_WEB_STICKY_NOTES_INITIALIZED__ = true;

  // --- Constants & Color Themes ---
  const GLOBAL_STORAGE_KEY = 'rich_sticky_notes_global';

  const THEMES = {
    yellow: {
      id: 'yellow',
      name: 'Pastel Yellow',
      bg: '#fef08a',
      headerBg: '#fde047',
      border: '#eab308',
      accent: '#ca8a04',
      hoverBtn: 'rgba(202, 138, 4, 0.15)',
      activeBtn: 'rgba(202, 138, 4, 0.25)'
    },
    green: {
      id: 'green',
      name: 'Mint Green',
      bg: '#bbf7d0',
      headerBg: '#86efac',
      border: '#4ade80',
      accent: '#16a34a',
      hoverBtn: 'rgba(22, 163, 74, 0.15)',
      activeBtn: 'rgba(22, 163, 74, 0.25)'
    },
    blue: {
      id: 'blue',
      name: 'Sky Blue',
      bg: '#bae6fd',
      headerBg: '#7dd3fc',
      border: '#38bdf8',
      accent: '#0284c7',
      hoverBtn: 'rgba(2, 132, 199, 0.15)',
      activeBtn: 'rgba(2, 132, 199, 0.25)'
    },
    pink: {
      id: 'pink',
      name: 'Rose Pink',
      bg: '#fbcfe8',
      headerBg: '#f472b6',
      border: '#ec4899',
      accent: '#db2777',
      hoverBtn: 'rgba(219, 39, 119, 0.15)',
      activeBtn: 'rgba(219, 39, 119, 0.25)'
    }
  };

  const THEME_KEYS = Object.keys(THEMES);
  const DEFAULT_THEME_COLOR = THEMES.yellow.bg;

  // UUID v4 generator
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // --- HTML Sanitization (Whitelist safe tags, strip ALL attributes) ---
  const ALLOWED_TAGS = new Set([
    'B', 'STRONG', 'I', 'EM', 'U', 'S',
    'UL', 'OL', 'LI', 'CODE', 'BR', 'DIV', 'P'
  ]);

  function sanitizeHtml(dirtyHtml) {
    if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(dirtyHtml, 'text/html');

      function cleanNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          return document.createTextNode(node.textContent);
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toUpperCase();
          if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'SVG'].includes(tagName)) {
            return null;
          }
          if (ALLOWED_TAGS.has(tagName)) {
            const cleanEl = document.createElement(tagName.toLowerCase());
            for (const child of Array.from(node.childNodes)) {
              const cleanedChild = cleanNode(child);
              if (cleanedChild) cleanEl.appendChild(cleanedChild);
            }
            return cleanEl;
          } else {
            const fragment = document.createDocumentFragment();
            for (const child of Array.from(node.childNodes)) {
              const cleanedChild = cleanNode(child);
              if (cleanedChild) fragment.appendChild(cleanedChild);
            }
            return fragment;
          }
        }
        return null;
      }

      const container = document.createElement('div');
      for (const child of Array.from(doc.body.childNodes)) {
        const cleaned = cleanNode(child);
        if (cleaned) container.appendChild(cleaned);
      }
      return container.innerHTML;
    } catch (e) {
      return '';
    }
  }

  function getThemeByColor(color) {
    if (!color) return THEMES.yellow;
    for (const key of THEME_KEYS) {
      if (THEMES[key].bg.toLowerCase() === color.toLowerCase() || key === color) {
        return THEMES[key];
      }
    }
    return THEMES.yellow;
  }

  // --- SVGs for UI Icons ---
  const ICONS = {
    grip: `<svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor"><circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/><circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/></svg>`,
    palette: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
    collapse: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    expand: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    bold: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>`,
    italic: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>`,
    underline: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>`,
    strike: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.3 4.9c-2.3-1.4-5.5-1.4-7.5.1-2.4 1.8-1.9 4.6.8 5.6"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M8.7 15.6c.9 1.7 3.3 2.9 6 2.4 2.8-.5 3.9-2.5 3.1-4.2"/></svg>`,
    ul: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>`,
    ol: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h2V3L4 4"/><path d="M4 11h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H4h3"/></svg>`,
    code: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    resize: `<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><circle cx="8" cy="8" r="1.2"/><circle cx="8" cy="4" r="1.2"/><circle cx="4" cy="8" r="1.2"/></svg>`
  };

  // --- Isolated Shadow DOM Stylesheet ---
  const SHADOW_STYLES = `
    :host {
      all: initial;
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      z-index: 2147483640;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #18181b;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .sticky-notes-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      overflow: visible;
      transition: opacity 0.2s ease, transform 0.2s ease;
      z-index: 2147483640;
    }

    .sticky-notes-container.is-hidden {
      opacity: 0 !important;
      pointer-events: none !important;
      transform: scale(0.98);
    }

    /* Note Card */
    .sticky-note {
      position: fixed;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      border: 1px solid rgba(24, 24, 27, 0.14);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      user-select: none;
      min-width: 240px;
      min-height: 200px;
      overflow: hidden;
      transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.15s ease, opacity 0.18s ease;
    }

    .sticky-note:focus-within {
      box-shadow: 0 14px 30px -4px rgba(0, 0, 0, 0.2), 0 10px 14px -6px rgba(0, 0, 0, 0.12);
      border-color: rgba(24, 24, 27, 0.3);
    }

    .sticky-note.is-dragging {
      opacity: 0.94;
      cursor: grabbing !important;
      box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.25), 0 12px 16px -6px rgba(0, 0, 0, 0.18);
      transform: scale(1.015);
    }

    .sticky-note.highlight-pulse {
      animation: notePulse 1.2s ease-out;
    }

    @keyframes notePulse {
      0% {
        box-shadow: 0 0 0 0px #3b82f6, 0 14px 30px rgba(0,0,0,0.25);
        transform: scale(1);
      }
      30% {
        box-shadow: 0 0 0 6px #3b82f6, 0 20px 40px rgba(59,130,246,0.4);
        transform: scale(1.03);
      }
      100% {
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
        transform: scale(1);
      }
    }

    /* Collapsed state */
    .sticky-note.is-collapsed {
      min-height: 0 !important;
      height: auto !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .sticky-note.is-collapsed .note-toolbar,
    .sticky-note.is-collapsed .note-body,
    .sticky-note.is-collapsed .note-resizer {
      display: none !important;
    }

    .sticky-note.is-collapsed .note-header {
      border-bottom: none;
    }

    /* Header Bar */
    .note-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 34px;
      padding: 0 8px 0 10px;
      cursor: grab;
      border-bottom: 1px solid rgba(24, 24, 27, 0.1);
      background-color: var(--note-header-bg, #fde047);
      flex-shrink: 0;
      touch-action: none;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 6px;
      color: rgba(24, 24, 27, 0.55);
    }

    .grip-icon {
      display: flex;
      align-items: center;
      cursor: grab;
      opacity: 0.6;
      transition: opacity 0.15s;
    }

    .note-header:hover .grip-icon {
      opacity: 0.95;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    /* Action Buttons in Header */
    .btn-header {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #18181b;
      cursor: pointer;
      opacity: 0.72;
      transition: opacity 0.15s, background-color 0.15s, transform 0.1s;
      padding: 0;
    }

    .btn-header:hover {
      opacity: 1;
      background-color: var(--note-hover-btn, rgba(24, 24, 27, 0.12));
    }

    .btn-header:active {
      transform: scale(0.92);
      background-color: var(--note-active-btn, rgba(24, 24, 27, 0.2));
    }

    .btn-header.btn-delete:hover {
      background-color: rgba(239, 68, 68, 0.2);
      color: #b91c1c;
      opacity: 1;
    }

    .btn-header.btn-close:hover {
      background-color: rgba(24, 24, 27, 0.16);
      opacity: 1;
    }

    /* Color Palette Popover */
    .palette-popover {
      position: absolute;
      top: 36px;
      right: 36px;
      background: #ffffff;
      border-radius: 8px;
      padding: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1);
      display: flex;
      gap: 6px;
      z-index: 100;
      border: 1px solid rgba(0,0,0,0.08);
      animation: fadeIn 0.12s ease-out;
    }

    .palette-swatch {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s, border-color 0.15s;
    }

    .palette-swatch:hover {
      transform: scale(1.15);
    }

    .palette-swatch.selected {
      border-color: #18181b;
      transform: scale(1.08);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Heading Field */
    .note-heading-wrapper {
      padding: 6px 12px 6px 12px;
      background-color: var(--note-bg, #fef08a);
      border-bottom: 1px solid rgba(24, 24, 27, 0.08);
      flex-shrink: 0;
    }

    .note-heading-input {
      width: 100%;
      border: none;
      outline: none;
      background: transparent;
      font-family: inherit;
      font-size: 15px;
      font-weight: 700;
      color: #18181b;
      line-height: 1.35;
      padding: 2px 0;
      user-select: text;
    }

    .note-heading-input::placeholder {
      color: rgba(24, 24, 27, 0.4);
      font-weight: 600;
    }

    /* Formatting Toolbar */
    .note-toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
      background-color: var(--note-bg, #fef08a);
      border-bottom: 1px solid rgba(24, 24, 27, 0.08);
      flex-shrink: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .note-toolbar::-webkit-scrollbar {
      display: none;
    }

    .btn-tool {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      border-radius: 5px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #18181b;
      cursor: pointer;
      opacity: 0.72;
      transition: opacity 0.12s, background-color 0.12s, color 0.12s;
      flex-shrink: 0;
      padding: 0;
    }

    .btn-tool:hover {
      opacity: 1;
      background-color: var(--note-hover-btn, rgba(24, 24, 27, 0.12));
    }

    .btn-tool.active {
      opacity: 1;
      background-color: rgba(24, 24, 27, 0.18);
      color: #000000;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.12);
    }

    .toolbar-divider {
      width: 1px;
      height: 16px;
      background-color: rgba(24, 24, 27, 0.12);
      margin: 0 3px;
      flex-shrink: 0;
    }

    /* Note Body (contenteditable) */
    .note-body {
      flex: 1;
      padding: 10px 12px;
      background-color: var(--note-bg, #fef08a);
      color: #18181b;
      font-family: inherit;
      font-size: 13.5px;
      line-height: 1.55;
      overflow-y: auto;
      overflow-x: hidden;
      outline: none;
      user-select: text;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .note-body:empty::before {
      content: attr(data-placeholder);
      color: rgba(24, 24, 27, 0.42);
      pointer-events: none;
      display: block;
    }

    .note-body b, .note-body strong {
      font-weight: 700;
    }

    .note-body i, .note-body em {
      font-style: italic;
    }

    .note-body u {
      text-decoration: underline;
    }

    .note-body s {
      text-decoration: line-through;
    }

    .note-body ul, .note-body ol {
      padding-left: 20px;
      margin: 4px 0;
    }

    .note-body ul {
      list-style-type: disc;
    }

    .note-body ol {
      list-style-type: decimal;
    }

    .note-body li {
      margin: 2px 0;
    }

    .note-body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      background-color: rgba(24, 24, 27, 0.1);
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid rgba(24, 24, 27, 0.1);
    }

    .note-body::-webkit-scrollbar {
      width: 5px;
    }

    .note-body::-webkit-scrollbar-thumb {
      background: rgba(24, 24, 27, 0.2);
      border-radius: 4px;
    }

    .note-body::-webkit-scrollbar-thumb:hover {
      background: rgba(24, 24, 27, 0.35);
    }

    /* Resizer corner */
    .note-resizer {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 16px;
      height: 16px;
      cursor: nwse-resize;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(24, 24, 27, 0.35);
      touch-action: none;
      transition: color 0.15s;
    }

    .note-resizer:hover {
      color: rgba(24, 24, 27, 0.75);
    }
  `;

  // --- Sticky Note Manager ---
  class StickyNotesApp {
    constructor() {
      this.notesMap = new Map(); // id -> NoteData (all global notes, including closed)
      this.controllers = new Map(); // id -> NoteController (active DOM controllers on this page)
      this.highestZIndex = 2147483641;
      this.storageKey = GLOBAL_STORAGE_KEY;
      this.container = null;
      this.shadowRoot = null;
      this.saveDebounceTimer = null;
      this.isVisible = true;

      this.initHost();
      this.loadNotesWithMigration();
      this.setupListeners();
    }

    initHost() {
      const existing = document.getElementById('rich-web-sticky-notes-root');
      if (existing) existing.remove();

      const host = document.createElement('div');
      host.id = 'rich-web-sticky-notes-root';
      host.style.cssText = 'all: initial !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; z-index: 2147483647 !important; pointer-events: none !important; border: 0 !important; margin: 0 !important; padding: 0 !important; display: block !important;';

      this.shadowRoot = host.attachShadow({ mode: 'open' });

      const styleEl = document.createElement('style');
      styleEl.textContent = SHADOW_STYLES;
      this.shadowRoot.appendChild(styleEl);

      this.container = document.createElement('div');
      this.container.className = 'sticky-notes-container';
      this.shadowRoot.appendChild(this.container);

      const target = document.body || document.documentElement;
      if (target) {
        target.appendChild(host);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          (document.body || document.documentElement).appendChild(host);
        });
      }
    }

    // Loads notes globally, automatically migrating any previous per-URL notes
    async loadNotesWithMigration() {
      try {
        const allData = await chrome.storage.local.get(null);
        let globalList = Array.isArray(allData[this.storageKey]) ? allData[this.storageKey] : [];

        // Check if there are legacy per-URL keys (keys starting with 'notes:')
        const legacyKeys = Object.keys(allData).filter(k => k.startsWith('notes:') && k !== this.storageKey);
        if (legacyKeys.length > 0) {
          const existingIds = new Set(globalList.map(n => n.id));
          let migrated = false;
          for (const key of legacyKeys) {
            const list = allData[key];
            if (Array.isArray(list)) {
              for (const item of list) {
                if (item && item.id && !existingIds.has(item.id)) {
                  globalList.push(item);
                  existingIds.add(item.id);
                  migrated = true;
                }
              }
            }
          }
          if (migrated) {
            await chrome.storage.local.set({ [this.storageKey]: globalList });
            await chrome.storage.local.remove(legacyKeys).catch(() => {});
          }
        }

        // Populate in-memory map and render active notes
        this.container.innerHTML = '';
        this.controllers.clear();
        this.notesMap.clear();

        for (const item of globalList) {
          this.notesMap.set(item.id, item);
          if (!item.closed) {
            const controller = new NoteController(this, item);
            this.controllers.set(item.id, controller);
            this.container.appendChild(controller.element);
            controller.clampToViewport();
          }
        }

        this.notifyBadgeUpdate();
      } catch (err) {
        console.error('Error loading global sticky notes:', err);
      }
    }

    createNote(overrides = {}) {
      const activeCount = this.controllers.size;
      const baseOffset = 40 + (activeCount % 8) * 30;

      const defaultWidth = 260;
      const defaultHeight = 240;
      const w = window.innerWidth || 800;
      const h = window.innerHeight || 600;
      const maxX = Math.max(20, w - defaultWidth - 40);
      const maxY = Math.max(20, h - defaultHeight - 40);

      const targetX = Math.min(Math.max(30, 60 + baseOffset), maxX);
      const targetY = Math.min(Math.max(30, 80 + baseOffset), maxY);

      const newNoteData = {
        id: generateUUID(),
        heading: overrides.heading || '',
        bodyHtml: overrides.bodyHtml || '',
        color: overrides.color || DEFAULT_THEME_COLOR,
        x: overrides.x ?? targetX,
        y: overrides.y ?? targetY,
        width: overrides.width ?? defaultWidth,
        height: overrides.height ?? defaultHeight,
        collapsed: overrides.collapsed ?? false,
        closed: false,
        sourceUrl: window.location.href,
        sourceTitle: document.title || 'Web Note',
        updatedAt: Date.now()
      };

      this.notesMap.set(newNoteData.id, newNoteData);
      const controller = new NoteController(this, newNoteData);
      this.controllers.set(newNoteData.id, controller);
      this.container.appendChild(controller.element);

      this.bringToFront(controller);
      setTimeout(() => controller.focusHeading(), 50);

      this.persistNow();
      this.notifyBadgeUpdate();
      return controller;
    }

    // Close note: stashes it off-screen, but keeps it permanently saved
    closeNote(id) {
      const controller = this.controllers.get(id);
      const data = this.notesMap.get(id);
      if (!data) return;

      data.closed = true;
      data.updatedAt = Date.now();
      if (controller) {
        const latest = controller.getData();
        Object.assign(data, latest, { closed: true });
      }

      if (controller) {
        controller.element.style.transform = 'scale(0.85)';
        controller.element.style.opacity = '0';
        setTimeout(() => {
          controller.destroy();
          if (controller.element.parentNode) {
            controller.element.parentNode.removeChild(controller.element);
          }
          this.controllers.delete(id);
        }, 180);
      }

      this.persistNow();
      this.notifyBadgeUpdate();
    }

    // Reopen closed note back onto the page
    reopenNote(id) {
      let data = this.notesMap.get(id);
      if (!data) return false;

      data.closed = false;
      data.updatedAt = Date.now();

      let controller = this.controllers.get(id);
      if (!controller) {
        controller = new NoteController(this, data);
        this.controllers.set(id, controller);
        this.container.appendChild(controller.element);
      }

      controller.element.style.display = 'flex';
      controller.element.style.opacity = '1';
      controller.element.style.transform = 'scale(1)';

      this.bringToFront(controller);
      controller.clampToViewport();

      controller.element.classList.remove('highlight-pulse');
      void controller.element.offsetWidth;
      controller.element.classList.add('highlight-pulse');

      controller.focusBody();
      this.persistNow();
      this.notifyBadgeUpdate();
      return true;
    }

    // Permanent deletion
    deleteNote(id) {
      const controller = this.controllers.get(id);
      this.notesMap.delete(id);

      if (controller) {
        controller.element.style.transform = 'scale(0.8)';
        controller.element.style.opacity = '0';
        setTimeout(() => {
          controller.destroy();
          if (controller.element.parentNode) {
            controller.element.parentNode.removeChild(controller.element);
          }
          this.controllers.delete(id);
        }, 180);
      }

      this.persistNow();
      this.notifyBadgeUpdate();
    }

    bringToFront(controller) {
      this.highestZIndex += 1;
      controller.element.style.zIndex = this.highestZIndex;
    }

    scheduleSave() {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = setTimeout(() => {
        this.persistNow();
      }, 250);
    }

    persistNow() {
      clearTimeout(this.saveDebounceTimer);
      for (const [id, controller] of this.controllers.entries()) {
        if (this.notesMap.has(id)) {
          this.notesMap.set(id, controller.getData());
        }
      }

      const list = Array.from(this.notesMap.values());
      chrome.storage.local.set({ [this.storageKey]: list }).catch(err => {
        console.error('Failed to persist global sticky notes:', err);
      });
      this.notifyBadgeUpdate();
    }

    notifyBadgeUpdate() {
      try {
        const activeCount = Array.from(this.notesMap.values()).filter(n => !n.closed).length;
        chrome.runtime.sendMessage({
          action: 'UPDATE_BADGE_COUNT',
          count: activeCount
        }).catch(() => {});
      } catch (e) {}
    }

    toggleVisibility() {
      this.isVisible = !this.isVisible;
      if (this.isVisible) {
        this.container.classList.remove('is-hidden');
      } else {
        this.container.classList.add('is-hidden');
      }
      return this.isVisible;
    }

    focusNoteById(id) {
      let data = this.notesMap.get(id);
      if (!data) return false;

      if (data.closed || !this.controllers.has(id)) {
        return this.reopenNote(id);
      }

      const controller = this.controllers.get(id);
      if (!this.isVisible) {
        this.toggleVisibility();
      }

      this.bringToFront(controller);
      controller.clampToViewport();

      controller.element.classList.remove('highlight-pulse');
      void controller.element.offsetWidth;
      controller.element.classList.add('highlight-pulse');

      controller.focusBody();
      return true;
    }

    setupListeners() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'CREATE_NOTE') {
          const note = this.createNote(message.noteData || {});
          sendResponse({ ok: true, noteId: note.data.id });
        } else if (message.action === 'GET_NOTES') {
          for (const [id, controller] of this.controllers.entries()) {
            if (this.notesMap.has(id)) {
              this.notesMap.set(id, controller.getData());
            }
          }
          const list = Array.from(this.notesMap.values());
          sendResponse({ ok: true, notes: list, isVisible: this.isVisible });
        } else if (message.action === 'CLOSE_NOTE') {
          this.closeNote(message.noteId);
          sendResponse({ ok: true });
        } else if (message.action === 'REOPEN_NOTE') {
          const success = this.reopenNote(message.noteId);
          sendResponse({ ok: success });
        } else if (message.action === 'DELETE_NOTE') {
          this.deleteNote(message.noteId);
          sendResponse({ ok: true });
        } else if (message.action === 'DELETE_ALL_NOTES') {
          for (const id of Array.from(this.notesMap.keys())) {
            this.deleteNote(id);
          }
          sendResponse({ ok: true });
        } else if (message.action === 'TOGGLE_VISIBILITY') {
          const visible = this.toggleVisibility();
          sendResponse({ ok: true, isVisible: visible });
        } else if (message.action === 'FOCUS_NOTE') {
          const success = this.focusNoteById(message.noteId);
          sendResponse({ ok: success });
        }
        return true;
      });

      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'CANVAS_CREATE_NOTE') {
          this.createNote();
        }
      });

      // Real-time global sync across all browser tabs
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes[this.storageKey]) {
          const newNotesData = changes[this.storageKey].newValue || [];
          this.reconcileStorageChange(newNotesData);
        }
      });

      window.addEventListener('resize', () => {
        for (const controller of this.controllers.values()) {
          controller.clampToViewport();
        }
      });

      window.addEventListener('beforeunload', () => this.persistNow());
      window.addEventListener('pagehide', () => this.persistNow());
    }

    reconcileStorageChange(newList) {
      const newMap = new Map(newList.map(n => [n.id, n]));
      this.notesMap = newMap;

      // Remove deleted notes or closed notes from this page
      for (const [id, controller] of this.controllers.entries()) {
        const updated = newMap.get(id);
        if (!updated || updated.closed) {
          controller.destroy();
          if (controller.element.parentNode) {
            controller.element.parentNode.removeChild(controller.element);
          }
          this.controllers.delete(id);
        }
      }

      // Add or update open notes
      for (const item of newList) {
        if (item.closed) continue;

        if (this.controllers.has(item.id)) {
          const controller = this.controllers.get(item.id);
          if (!controller.isFocused()) {
            controller.updateFromData(item);
          }
        } else {
          const controller = new NoteController(this, item);
          this.controllers.set(item.id, controller);
          this.container.appendChild(controller.element);
          controller.clampToViewport();
        }
      }

      this.notifyBadgeUpdate();
    }
  }

  // --- Note Controller: Single Sticky Note UI & Behavior ---
  class NoteController {
    constructor(app, data) {
      this.app = app;
      this.data = {
        id: data.id || generateUUID(),
        heading: data.heading || '',
        bodyHtml: sanitizeHtml(data.bodyHtml || ''),
        color: data.color || DEFAULT_THEME_COLOR,
        x: data.x ?? 60,
        y: data.y ?? 60,
        width: Math.max(240, data.width ?? 260),
        height: Math.max(200, data.height ?? 240),
        collapsed: !!data.collapsed,
        closed: !!data.closed,
        sourceUrl: data.sourceUrl || '',
        sourceTitle: data.sourceTitle || '',
        updatedAt: data.updatedAt || Date.now()
      };

      this.element = null;
      this.headerEl = null;
      this.headingInput = null;
      this.toolbarEl = null;
      this.bodyEl = null;
      this.resizerEl = null;
      this.palettePopover = null;

      this.isDragging = false;
      this.isResizing = false;

      this.render();
      this.bindEvents();
    }

    getData() {
      return {
        id: this.data.id,
        heading: this.headingInput ? this.headingInput.value : this.data.heading,
        bodyHtml: sanitizeHtml(this.bodyEl ? this.bodyEl.innerHTML : this.data.bodyHtml),
        color: this.data.color,
        x: Math.round(this.data.x),
        y: Math.round(this.data.y),
        width: Math.round(this.data.width),
        height: Math.round(this.data.height),
        collapsed: this.data.collapsed,
        closed: this.data.closed,
        sourceUrl: this.data.sourceUrl,
        sourceTitle: this.data.sourceTitle,
        updatedAt: this.data.updatedAt
      };
    }

    isFocused() {
      if (!this.element) return false;
      const active = this.app.shadowRoot.activeElement;
      return (
        active === this.headingInput ||
        active === this.bodyEl ||
        this.element.contains(active)
      );
    }

    updateFromData(newData) {
      this.data.color = newData.color || this.data.color;
      this.data.x = newData.x ?? this.data.x;
      this.data.y = newData.y ?? this.data.y;
      this.data.width = Math.max(240, newData.width ?? this.data.width);
      this.data.height = Math.max(200, newData.height ?? this.data.height);
      this.data.collapsed = !!newData.collapsed;
      this.data.closed = !!newData.closed;
      this.data.updatedAt = newData.updatedAt || Date.now();

      this.applyTheme(this.data.color);
      this.applyPosition();
      this.applyDimensions();
      this.applyCollapsedState();

      if (this.headingInput && this.headingInput.value !== newData.heading) {
        this.headingInput.value = newData.heading || '';
      }
      if (this.bodyEl && this.bodyEl.innerHTML !== newData.bodyHtml) {
        this.bodyEl.innerHTML = sanitizeHtml(newData.bodyHtml || '');
      }
    }

    render() {
      this.element = document.createElement('div');
      this.element.className = 'sticky-note';
      this.element.dataset.id = this.data.id;
      this.applyTheme(this.data.color);
      this.applyPosition();
      this.applyDimensions();

      // 1. Draggable Header Bar
      this.headerEl = document.createElement('div');
      this.headerEl.className = 'note-header';
      this.headerEl.innerHTML = `
        <div class="header-left">
          <div class="grip-icon" title="Drag note">${ICONS.grip}</div>
        </div>
        <div class="header-right">
          <button class="btn-header btn-palette" title="Change color theme">${ICONS.palette}</button>
          <button class="btn-header btn-collapse" title="${this.data.collapsed ? 'Expand note' : 'Collapse note'}">
            ${this.data.collapsed ? ICONS.expand : ICONS.collapse}
          </button>
          <button class="btn-header btn-close" title="Close note (saved in popup, does not delete)">${ICONS.close}</button>
          <button class="btn-header btn-delete" title="Delete note permanently">${ICONS.trash}</button>
        </div>
      `;

      // 2. Editable Heading Field
      const headingWrapper = document.createElement('div');
      headingWrapper.className = 'note-heading-wrapper';
      this.headingInput = document.createElement('input');
      this.headingInput.type = 'text';
      this.headingInput.className = 'note-heading-input';
      this.headingInput.placeholder = 'Note heading...';
      this.headingInput.value = this.data.heading || '';
      headingWrapper.appendChild(this.headingInput);

      // 3. Formatting Toolbar
      this.toolbarEl = document.createElement('div');
      this.toolbarEl.className = 'note-toolbar';
      this.toolbarEl.innerHTML = `
        <button class="btn-tool" data-cmd="bold" title="Bold (Ctrl+B)">${ICONS.bold}</button>
        <button class="btn-tool" data-cmd="italic" title="Italic (Ctrl+I)">${ICONS.italic}</button>
        <button class="btn-tool" data-cmd="underline" title="Underline (Ctrl+U)">${ICONS.underline}</button>
        <button class="btn-tool" data-cmd="strikeThrough" title="Strikethrough">${ICONS.strike}</button>
        <div class="toolbar-divider"></div>
        <button class="btn-tool" data-cmd="insertUnorderedList" title="Bulleted List">${ICONS.ul}</button>
        <button class="btn-tool" data-cmd="insertOrderedList" title="Numbered List">${ICONS.ol}</button>
        <button class="btn-tool" data-cmd="code" title="Inline Code">${ICONS.code}</button>
      `;

      // 4. Rich Text Body Area
      this.bodyEl = document.createElement('div');
      this.bodyEl.className = 'note-body';
      this.bodyEl.contentEditable = 'true';
      this.bodyEl.setAttribute('data-placeholder', 'Type your note here...');
      this.bodyEl.innerHTML = sanitizeHtml(this.data.bodyHtml || '');

      // 5. Corner Resizer
      this.resizerEl = document.createElement('div');
      this.resizerEl.className = 'note-resizer';
      this.resizerEl.title = 'Resize note';
      this.resizerEl.innerHTML = ICONS.resize;

      this.element.appendChild(this.headerEl);
      this.element.appendChild(headingWrapper);
      this.element.appendChild(this.toolbarEl);
      this.element.appendChild(this.bodyEl);
      this.element.appendChild(this.resizerEl);

      this.applyCollapsedState();
    }

    applyTheme(color) {
      const theme = getThemeByColor(color);
      this.data.color = theme.bg;
      this.element.style.setProperty('--note-bg', theme.bg);
      this.element.style.setProperty('--note-header-bg', theme.headerBg);
      this.element.style.setProperty('--note-border', theme.border);
      this.element.style.setProperty('--note-accent', theme.accent);
      this.element.style.setProperty('--note-hover-btn', theme.hoverBtn);
      this.element.style.setProperty('--note-active-btn', theme.activeBtn);
      this.element.style.backgroundColor = theme.bg;
    }

    applyPosition() {
      this.element.style.left = `${this.data.x}px`;
      this.element.style.top = `${this.data.y}px`;
    }

    applyDimensions() {
      this.element.style.width = `${this.data.width}px`;
      if (!this.data.collapsed) {
        this.element.style.height = `${this.data.height}px`;
      }
    }

    applyCollapsedState() {
      const collapseBtn = this.headerEl.querySelector('.btn-collapse');
      if (this.data.collapsed) {
        this.element.classList.add('is-collapsed');
        this.element.style.height = 'auto';
        if (collapseBtn) {
          collapseBtn.innerHTML = ICONS.expand;
          collapseBtn.title = 'Expand note';
        }
      } else {
        this.element.classList.remove('is-collapsed');
        this.element.style.height = `${this.data.height}px`;
        if (collapseBtn) {
          collapseBtn.innerHTML = ICONS.collapse;
          collapseBtn.title = 'Collapse note';
        }
      }
    }

    toggleCollapse() {
      this.data.collapsed = !this.data.collapsed;
      this.data.updatedAt = Date.now();
      this.applyCollapsedState();
      this.app.persistNow();
    }

    showPalettePopover() {
      if (this.palettePopover) {
        this.palettePopover.remove();
        this.palettePopover = null;
        return;
      }

      this.palettePopover = document.createElement('div');
      this.palettePopover.className = 'palette-popover';

      THEME_KEYS.forEach((key) => {
        const theme = THEMES[key];
        const swatch = document.createElement('div');
        swatch.className = `palette-swatch ${theme.bg === this.data.color ? 'selected' : ''}`;
        swatch.style.backgroundColor = theme.bg;
        swatch.title = theme.name;

        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          this.applyTheme(theme.bg);
          this.data.updatedAt = Date.now();
          this.app.persistNow();
          this.palettePopover.remove();
          this.palettePopover = null;
        });

        this.palettePopover.appendChild(swatch);
      });

      this.element.appendChild(this.palettePopover);

      const dismissHandler = (e) => {
        if (this.palettePopover && !this.palettePopover.contains(e.target)) {
          this.palettePopover.remove();
          this.palettePopover = null;
          document.removeEventListener('pointerdown', dismissHandler);
        }
      };
      setTimeout(() => {
        document.addEventListener('pointerdown', dismissHandler);
      }, 0);
    }

    focusHeading() {
      if (this.headingInput) {
        this.headingInput.focus();
        this.headingInput.select();
      }
    }

    focusBody() {
      if (this.bodyEl) {
        this.bodyEl.focus();
      }
    }

    clampToViewport() {
      const w = window.innerWidth || 800;
      const h = window.innerHeight || 600;
      const maxX = Math.max(0, w - this.data.width);
      const currentHeight = this.data.collapsed ? 80 : this.data.height;
      const maxY = Math.max(0, h - currentHeight);

      this.data.x = Math.min(Math.max(0, this.data.x), maxX);
      this.data.y = Math.min(Math.max(0, this.data.y), maxY);
      this.applyPosition();
    }

    bindEvents() {
      this.element.addEventListener('pointerdown', () => {
        this.app.bringToFront(this);
      });

      const paletteBtn = this.headerEl.querySelector('.btn-palette');
      paletteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showPalettePopover();
      });

      const collapseBtn = this.headerEl.querySelector('.btn-collapse');
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCollapse();
      });

      const closeBtn = this.headerEl.querySelector('.btn-close');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.closeNote(this.data.id);
      });

      const deleteBtn = this.headerEl.querySelector('.btn-delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.deleteNote(this.data.id);
      });

      this.setupDragging();
      this.setupResizing();

      this.headingInput.addEventListener('input', () => {
        this.data.heading = this.headingInput.value;
        this.data.updatedAt = Date.now();
        this.app.scheduleSave();
      });

      this.headingInput.addEventListener('blur', () => {
        this.app.persistNow();
      });

      this.headingInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.bodyEl.focus();
        }
      });

      this.setupToolbar();
      this.setupEditor();
    }

    setupDragging() {
      let startX = 0;
      let startY = 0;
      let initialLeft = 0;
      let initialTop = 0;

      const onPointerMove = (e) => {
        if (!this.isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newX = initialLeft + deltaX;
        let newY = initialTop + deltaY;

        const w = window.innerWidth || 800;
        const h = window.innerHeight || 600;
        const maxX = Math.max(0, w - this.data.width);
        const currentHeight = this.data.collapsed ? this.element.offsetHeight : this.data.height;
        const maxY = Math.max(0, h - currentHeight);

        newX = Math.min(Math.max(0, newX), maxX);
        newY = Math.min(Math.max(0, newY), maxY);

        this.data.x = newX;
        this.data.y = newY;
        this.applyPosition();
      };

      const onPointerUp = (e) => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.element.classList.remove('is-dragging');

        try {
          this.headerEl.releasePointerCapture(e.pointerId);
        } catch {}

        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        this.data.updatedAt = Date.now();
        this.app.persistNow();
      };

      this.headerEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('.btn-header') || e.target.closest('.palette-popover')) {
          return;
        }

        this.isDragging = true;
        this.element.classList.add('is-dragging');
        this.app.bringToFront(this);

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = this.data.x;
        initialTop = this.data.y;

        try {
          this.headerEl.setPointerCapture(e.pointerId);
        } catch {}

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });
    }

    setupResizing() {
      let startX = 0;
      let startY = 0;
      let initialW = 0;
      let initialH = 0;

      const onPointerMove = (e) => {
        if (!this.isResizing) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const w = window.innerWidth || 800;
        const h = window.innerHeight || 600;
        const maxW = w - this.data.x - 10;
        const maxH = h - this.data.y - 10;

        const newW = Math.min(Math.max(240, initialW + deltaX), Math.max(240, maxW));
        const newH = Math.min(Math.max(200, initialH + deltaY), Math.max(200, maxH));

        this.data.width = newW;
        this.data.height = newH;
        this.applyDimensions();
      };

      const onPointerUp = (e) => {
        if (!this.isResizing) return;
        this.isResizing = false;

        try {
          this.resizerEl.releasePointerCapture(e.pointerId);
        } catch {}

        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        this.data.updatedAt = Date.now();
        this.app.persistNow();
      };

      this.resizerEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || this.data.collapsed) return;
        e.stopPropagation();
        e.preventDefault();

        this.isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        initialW = this.data.width;
        initialH = this.data.height;

        try {
          this.resizerEl.setPointerCapture(e.pointerId);
        } catch {}

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });
    }

    setupToolbar() {
      const toolButtons = this.toolbarEl.querySelectorAll('.btn-tool');

      toolButtons.forEach((btn) => {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
        });

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const cmd = btn.dataset.cmd;
          if (!cmd) return;

          this.bodyEl.focus();

          if (cmd === 'code') {
            this.toggleInlineCode();
          } else {
            document.execCommand(cmd, false, null);
          }

          this.updateToolbarActiveStates();
          this.handleBodyChange();
        });
      });
    }

    toggleInlineCode() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      if (!this.bodyEl.contains(range.commonAncestorContainer)) return;

      let node = range.commonAncestorContainer;
      let codeNode = null;
      while (node && node !== this.bodyEl) {
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'CODE') {
          codeNode = node;
          break;
        }
        node = node.parentNode;
      }

      if (codeNode) {
        const parent = codeNode.parentNode;
        while (codeNode.firstChild) {
          parent.insertBefore(codeNode.firstChild, codeNode);
        }
        parent.removeChild(codeNode);
      } else {
        if (range.collapsed) {
          const codeEl = document.createElement('code');
          codeEl.innerHTML = '&#8203;';
          range.insertNode(codeEl);
          range.selectNodeContents(codeEl);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          const fragment = range.extractContents();
          const codeEl = document.createElement('code');
          codeEl.appendChild(fragment);
          range.insertNode(codeEl);
          sel.selectAllChildren(codeEl);
        }
      }
    }

    updateToolbarActiveStates() {
      if (!this.isFocused()) return;

      const toolButtons = this.toolbarEl.querySelectorAll('.btn-tool');
      toolButtons.forEach((btn) => {
        const cmd = btn.dataset.cmd;
        let isActive = false;

        if (cmd === 'code') {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            let node = sel.getRangeAt(0).commonAncestorContainer;
            while (node && node !== this.bodyEl) {
              if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'CODE') {
                isActive = true;
                break;
              }
              node = node.parentNode;
            }
          }
        } else {
          try {
            isActive = document.queryCommandState(cmd);
          } catch {}
        }

        if (isActive) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    setupEditor() {
      const onSelectionOrCaretMove = () => {
        this.updateToolbarActiveStates();
      };

      this.bodyEl.addEventListener('keyup', onSelectionOrCaretMove);
      this.bodyEl.addEventListener('mouseup', onSelectionOrCaretMove);
      document.addEventListener('selectionchange', onSelectionOrCaretMove);

      this.bodyEl.addEventListener('input', () => {
        this.handleBodyChange();
      });

      this.bodyEl.addEventListener('blur', () => {
        this.app.persistNow();
      });

      this.bodyEl.addEventListener('paste', (e) => {
        e.preventDefault();
        const clipboard = e.clipboardData || window.clipboardData;
        if (!clipboard) return;

        const html = clipboard.getData('text/html');
        const text = clipboard.getData('text/plain');

        if (html) {
          const cleanHtml = sanitizeHtml(html);
          if (cleanHtml) {
            document.execCommand('insertHTML', false, cleanHtml);
          } else if (text) {
            document.execCommand('insertText', false, text);
          }
        } else if (text) {
          document.execCommand('insertText', false, text);
        }

        this.handleBodyChange();
      });

      this.bodyEl.addEventListener('keydown', (e) => {
        const isMod = e.ctrlKey || e.metaKey;
        if (isMod) {
          if (e.key.toLowerCase() === 'b') {
            e.preventDefault();
            document.execCommand('bold', false, null);
            this.updateToolbarActiveStates();
            this.handleBodyChange();
          } else if (e.key.toLowerCase() === 'i') {
            e.preventDefault();
            document.execCommand('italic', false, null);
            this.updateToolbarActiveStates();
            this.handleBodyChange();
          } else if (e.key.toLowerCase() === 'u') {
            e.preventDefault();
            document.execCommand('underline', false, null);
            this.updateToolbarActiveStates();
            this.handleBodyChange();
          }
        }
      });
    }

    handleBodyChange() {
      this.data.bodyHtml = sanitizeHtml(this.bodyEl.innerHTML);
      this.data.updatedAt = Date.now();
      this.app.scheduleSave();
    }

    destroy() {
      if (this.palettePopover) {
        this.palettePopover.remove();
      }
    }
  }

  // Initialize App on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new StickyNotesApp();
    });
  } else {
    new StickyNotesApp();
  }
})();
