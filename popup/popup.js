/**
 * Rich Web Sticky Notes - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const pageUrlEl = document.getElementById('pageUrl');
  const badgeCountEl = document.getElementById('notesCountBadge');
  const notesListEl = document.getElementById('notesList');
  const btnNewNote = document.getElementById('btnNewNote');
  const btnNewNoteText = document.getElementById('btnNewNoteText');
  const btnOpenCanvasTop = document.getElementById('btnOpenCanvasTop');
  const btnToggleVisibility = document.getElementById('btnToggleVisibility');
  const btnExport = document.getElementById('btnExport');
  const btnClearAll = document.getElementById('btnClearAll');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const newKeyHint = document.getElementById('newKeyHint');
  const toggleKeyHint = document.getElementById('toggleKeyHint');
  const restrictedBanner = document.getElementById('restrictedBanner');
  const btnLaunchCanvas = document.getElementById('btnLaunchCanvas');

  // Platform specific shortcuts display
  const isMac = navigator.userAgent.toLowerCase().includes('mac');
  if (isMac) {
    if (newKeyHint) newKeyHint.textContent = 'Cmd+Shift+N';
    if (toggleKeyHint) toggleKeyHint.textContent = 'Cmd+Shift+H';
  }

  let activeTab = null;
  let allNotes = [];
  let isNotesVisible = true;
  let isRestrictedPage = false;
  let currentStorageKey = null;

  // Normalized Storage Key helper
  function computeStorageKey(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'chrome-extension:' && parsed.pathname.includes('canvas')) {
        return 'notes:canvas_workspace';
      }
      if (parsed.protocol === 'about:' || url === 'about:blank') {
        return 'notes:about_blank';
      }
      if (parsed.protocol === 'file:') {
        return `notes:file_${parsed.pathname}`;
      }
      if (['http:', 'https:'].includes(parsed.protocol)) {
        return `notes:${parsed.origin}${parsed.pathname}`;
      }
      return null;
    } catch {
      return null;
    }
  }

  // 1. Detect Active Tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;
  } catch (err) {
    console.error('Cannot query active tab:', err);
  }

  if (!activeTab || !activeTab.id || !activeTab.url) {
    setupRestrictedMode('No active tab detected');
    return;
  }

  currentStorageKey = computeStorageKey(activeTab.url);

  // If on browser internal page (like chrome://newtab), switch to Canvas Companion Mode
  if (!currentStorageKey) {
    setupRestrictedMode('Chrome New Tab / Internal Page');
  } else {
    // Normal Web, Localhost, File, or Canvas Page
    try {
      const parsed = new URL(activeTab.url);
      if (parsed.protocol === 'chrome-extension:' && parsed.pathname.includes('canvas')) {
        pageUrlEl.textContent = 'Notes Canvas';
      } else if (parsed.protocol === 'about:') {
        pageUrlEl.textContent = 'about:blank';
      } else {
        pageUrlEl.textContent = `${parsed.hostname || ''}${parsed.pathname}`;
      }
      pageUrlEl.title = activeTab.url;
    } catch {
      pageUrlEl.textContent = activeTab.url;
    }
    loadNotes();
  }

  function setupRestrictedMode(title) {
    isRestrictedPage = true;
    currentStorageKey = 'notes:canvas_workspace';
    pageUrlEl.textContent = title;
    restrictedBanner.style.display = 'flex';
    if (btnNewNoteText) btnNewNoteText.textContent = 'New Note (Canvas)';
    btnToggleVisibility.disabled = true;
    loadNotesFromStorageDirectly();
  }

  // Tab messenger with auto-injection
  async function sendMessageToContent(message) {
    if (isRestrictedPage) return null;
    try {
      return await chrome.tabs.sendMessage(activeTab.id, message);
    } catch (err) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content/content.js']
        });
        await new Promise(r => setTimeout(r, 120));
        return await chrome.tabs.sendMessage(activeTab.id, message);
      } catch (injErr) {
        throw injErr;
      }
    }
  }

  function htmlToPlainText(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Just now';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 30) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  async function loadNotes() {
    try {
      const response = await sendMessageToContent({ action: 'GET_NOTES' });
      if (response && response.ok) {
        allNotes = response.notes || [];
        isNotesVisible = response.isVisible !== false;
        updateVisibilityIcon();
        renderNotes(getFilteredNotes());
      } else {
        await loadNotesFromStorageDirectly();
      }
    } catch (err) {
      await loadNotesFromStorageDirectly();
    }
  }

  async function loadNotesFromStorageDirectly() {
    try {
      if (!currentStorageKey) return;
      const data = await chrome.storage.local.get(currentStorageKey);
      allNotes = Array.isArray(data[currentStorageKey]) ? data[currentStorageKey] : [];
      renderNotes(getFilteredNotes());
    } catch (e) {
      renderNotes([]);
    }
  }

  function getFilteredNotes() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return allNotes;
    return allNotes.filter(note => {
      const headingMatch = (note.heading || '').toLowerCase().includes(query);
      const text = htmlToPlainText(note.bodyHtml).toLowerCase();
      const bodyMatch = text.includes(query);
      return headingMatch || bodyMatch;
    });
  }

  function updateVisibilityIcon() {
    if (!btnToggleVisibility) return;
    if (isNotesVisible) {
      btnToggleVisibility.classList.remove('is-active');
      btnToggleVisibility.title = 'Hide sticky notes on this page';
      btnToggleVisibility.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    } else {
      btnToggleVisibility.classList.add('is-active');
      btnToggleVisibility.title = 'Show sticky notes on this page';
      btnToggleVisibility.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    }
  }

  function renderNotes(notes) {
    const activeCount = allNotes.filter(n => !n.closed).length;
    badgeCountEl.textContent = `${activeCount} active (${allNotes.length} total)`;

    if (allNotes.length === 0) {
      notesListEl.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <div class="empty-title">No Sticky Notes Found</div>
          <div class="empty-desc">${isRestrictedPage ? 'Click "New Note (Canvas)" to create a note on the Blank Notes Canvas.' : 'Click "New Note" above or press Alt+Shift+N to create a sticky note.'}</div>
        </div>
      `;
      return;
    }

    if (notes.length === 0) {
      notesListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No Matching Notes</div>
          <div class="empty-desc">No notes match "${escapeHtml(searchInput.value)}".</div>
        </div>
      `;
      return;
    }

    notesListEl.innerHTML = '';

    notes.forEach((note) => {
      const card = document.createElement('div');
      card.className = `note-card ${note.closed ? 'is-closed' : ''}`;
      card.dataset.id = note.id;

      const title = note.heading ? note.heading.trim() : 'Untitled Note';
      const snippet = htmlToPlainText(note.bodyHtml).trim();
      const timeStr = formatRelativeTime(note.updatedAt);
      const isClosed = !!note.closed;

      card.innerHTML = `
        <div class="note-card-top">
          <div class="note-card-title-group">
            <span class="theme-pill" style="background-color: ${note.color || '#fef08a'}"></span>
            <span class="note-card-title">${escapeHtml(title)}</span>
            ${isClosed ? '<span class="status-badge-closed">Closed</span>' : ''}
          </div>
          <div class="note-card-actions">
            <button class="btn-card-action btn-card-delete" title="Delete note permanently">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
        <div class="note-card-snippet">${escapeHtml(snippet)}</div>
        <div class="note-card-meta">
          <span>${timeStr}</span>
          <span>${isClosed ? 'Click to reopen' : 'Click to focus'}</span>
        </div>
      `;

      // Click card to jump/reopen
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-card-delete')) return;

        if (isRestrictedPage) {
          // Open canvas tab with note
          const canvasUrl = chrome.runtime.getURL('canvas/canvas.html');
          await chrome.tabs.create({ url: canvasUrl });
          window.close();
          return;
        }

        try {
          if (note.closed) {
            await sendMessageToContent({ action: 'REOPEN_NOTE', noteId: note.id });
          } else {
            await sendMessageToContent({ action: 'FOCUS_NOTE', noteId: note.id });
          }
          window.close();
        } catch (err) {
          console.error('Focus note failed:', err);
        }
      });

      // Delete button
      const delBtn = card.querySelector('.btn-card-delete');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmDelete = window.confirm('Permanently delete this sticky note?');
        if (!confirmDelete) return;

        try {
          if (!isRestrictedPage) {
            await sendMessageToContent({ action: 'DELETE_NOTE', noteId: note.id });
          } else {
            allNotes = allNotes.filter(n => n.id !== note.id);
            await chrome.storage.local.set({ [currentStorageKey]: allNotes });
          }
          allNotes = allNotes.filter(n => n.id !== note.id);
          renderNotes(getFilteredNotes());
        } catch (err) {
          console.error('Delete note failed:', err);
        }
      });

      notesListEl.appendChild(card);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function openCanvasTab() {
    const canvasUrl = chrome.runtime.getURL('canvas/canvas.html');
    chrome.tabs.create({ url: canvasUrl });
    window.close();
  }

  // --- Button Handlers ---

  // New Note
  btnNewNote.addEventListener('click', async () => {
    if (isRestrictedPage) {
      openCanvasTab();
      return;
    }

    try {
      btnNewNote.disabled = true;
      await sendMessageToContent({ action: 'CREATE_NOTE' });
      window.close();
    } catch (err) {
      // If content injection failed, open canvas
      openCanvasTab();
    }
  });

  // Top Bar Open Canvas Button
  btnOpenCanvasTop.addEventListener('click', () => {
    openCanvasTab();
  });

  // Banner Launch Canvas Button
  if (btnLaunchCanvas) {
    btnLaunchCanvas.addEventListener('click', () => {
      openCanvasTab();
    });
  }

  // Toggle Visibility
  btnToggleVisibility.addEventListener('click', async () => {
    try {
      const resp = await sendMessageToContent({ action: 'TOGGLE_VISIBILITY' });
      if (resp && typeof resp.isVisible === 'boolean') {
        isNotesVisible = resp.isVisible;
        updateVisibilityIcon();
      }
    } catch (err) {}
  });

  // Export Notes (Markdown file download)
  btnExport.addEventListener('click', () => {
    if (allNotes.length === 0) {
      alert('No notes to export.');
      return;
    }

    let md = `# Sticky Notes Export\n`;
    md += `URL: ${activeTab?.url || 'Notes Canvas'}\n`;
    md += `Exported: ${new Date().toLocaleString()}\n\n---\n\n`;

    allNotes.forEach((n, idx) => {
      const title = n.heading ? n.heading.trim() : `Note #${idx + 1}`;
      const text = htmlToPlainText(n.bodyHtml).trim();
      const updated = new Date(n.updatedAt || Date.now()).toLocaleString();
      const status = n.closed ? ' [Closed]' : '';
      md += `### ${title}${status}\n`;
      md += `*Theme: ${n.color || 'Yellow'} | Last Updated: ${updated}*\n\n`;
      md += `${text || '_No content_'}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sticky-notes-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Clear All Notes
  btnClearAll.addEventListener('click', async () => {
    if (allNotes.length === 0) return;
    const confirmClear = window.confirm(`Permanently delete all ${allNotes.length} notes?`);
    if (!confirmClear) return;

    try {
      if (!isRestrictedPage) {
        await sendMessageToContent({ action: 'DELETE_ALL_NOTES' });
      } else {
        await chrome.storage.local.set({ [currentStorageKey]: [] });
      }
      allNotes = [];
      renderNotes([]);
    } catch (err) {
      console.error('Clear all notes failed:', err);
    }
  });

  // Search input events
  searchInput.addEventListener('input', () => {
    if (searchInput.value.trim().length > 0) {
      searchClear.classList.add('visible');
    } else {
      searchClear.classList.remove('visible');
    }
    renderNotes(getFilteredNotes());
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.remove('visible');
    renderNotes(allNotes);
    searchInput.focus();
  });
});
