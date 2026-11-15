/**
 * Rich Web Sticky Notes - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const pageUrlEl = document.getElementById('pageUrl');
  const badgeCountEl = document.getElementById('notesCountBadge');
  const notesListEl = document.getElementById('notesList');
  const btnNewNote = document.getElementById('btnNewNote');
  const btnToggleVisibility = document.getElementById('btnToggleVisibility');
  const btnExport = document.getElementById('btnExport');
  const btnClearAll = document.getElementById('btnClearAll');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const newKeyHint = document.getElementById('newKeyHint');
  const toggleKeyHint = document.getElementById('toggleKeyHint');

  // Platform specific shortcuts display
  const isMac = navigator.userAgent.toLowerCase().includes('mac');
  if (isMac) {
    if (newKeyHint) newKeyHint.textContent = 'Cmd+Shift+N';
    if (toggleKeyHint) toggleKeyHint.textContent = 'Cmd+Shift+H';
  }

  let activeTab = null;
  let allNotes = [];
  let isNotesVisible = true;

  // 1. Get Active Tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;
  } catch (err) {
    console.error('Cannot query active tab:', err);
  }

  if (!activeTab || !activeTab.id || !activeTab.url) {
    renderUnavailable('No active webpage detected.');
    return;
  }

  // Display URL nicely
  try {
    const urlObj = new URL(activeTab.url);
    if (!['http:', 'https:', 'file:'].includes(urlObj.protocol)) {
      renderUnavailable('Sticky notes cannot be added to browser internal or settings pages.');
      return;
    }
    pageUrlEl.textContent = `${urlObj.hostname}${urlObj.pathname}`;
    pageUrlEl.title = activeTab.url;
  } catch {
    pageUrlEl.textContent = activeTab.url;
  }

  // Safe tab messenger with auto-injection
  async function sendMessageToContent(message) {
    try {
      return await chrome.tabs.sendMessage(activeTab.id, message);
    } catch (err) {
      // Try injecting script if missing
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

  // Strip HTML for snippet display
  function htmlToPlainText(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  // Format relative time
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

  // Load notes from content script
  async function loadNotes() {
    try {
      const response = await sendMessageToContent({ action: 'GET_NOTES' });
      if (response && response.ok) {
        allNotes = response.notes || [];
        isNotesVisible = response.isVisible !== false;
        updateVisibilityIcon();
        renderNotes(getFilteredNotes());
      }
    } catch (err) {
      console.warn('Could not connect to content script:', err);
      // Fallback: read directly from storage
      try {
        const urlObj = new URL(activeTab.url);
        const key = `notes:${urlObj.origin}${urlObj.pathname}`;
        const data = await chrome.storage.local.get(key);
        allNotes = Array.isArray(data[key]) ? data[key] : [];
        renderNotes(getFilteredNotes());
      } catch (storageErr) {
        renderUnavailable('Unable to load notes for this page.');
      }
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

  function renderUnavailable(message) {
    badgeCountEl.textContent = 'Unavailable';
    btnNewNote.disabled = true;
    btnToggleVisibility.disabled = true;
    btnExport.disabled = true;
    btnClearAll.disabled = true;
    searchInput.disabled = true;

    notesListEl.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div class="empty-title">Cannot Add Notes Here</div>
        <div class="empty-desc">${message}</div>
      </div>
    `;
  }

  function renderNotes(notes) {
    badgeCountEl.textContent = `${allNotes.length} note${allNotes.length === 1 ? '' : 's'}`;

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
          <div class="empty-title">No Sticky Notes on this Page</div>
          <div class="empty-desc">Click "New Note" above or press <kbd>${isMac ? 'Cmd+Shift+N' : 'Alt+Shift+N'}</kbd> to add your first sticky note.</div>
        </div>
      `;
      return;
    }

    if (notes.length === 0) {
      notesListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No Matching Notes</div>
          <div class="empty-desc">No notes match "${searchInput.value}".</div>
        </div>
      `;
      return;
    }

    notesListEl.innerHTML = '';

    notes.forEach((note) => {
      const card = document.createElement('div');
      card.className = 'note-card';
      card.dataset.id = note.id;

      const title = note.heading ? note.heading.trim() : 'Untitled Note';
      const snippet = htmlToPlainText(note.bodyHtml).trim();
      const timeStr = formatRelativeTime(note.updatedAt);

      card.innerHTML = `
        <div class="note-card-top">
          <div class="note-card-title-group">
            <span class="theme-pill" style="background-color: ${note.color || '#fef08a'}"></span>
            <span class="note-card-title">${escapeHtml(title)}</span>
          </div>
          <div class="note-card-actions">
            <button class="btn-card-action btn-card-delete" title="Delete note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="note-card-snippet">${escapeHtml(snippet)}</div>
        <div class="note-card-meta">
          <span>${timeStr}</span>
          <span>Click to focus</span>
        </div>
      `;

      // Click card to jump/focus
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-card-delete')) return;
        try {
          await sendMessageToContent({ action: 'FOCUS_NOTE', noteId: note.id });
          window.close(); // Close popup so user sees note highlighted
        } catch (err) {
          console.error('Focus note failed:', err);
        }
      });

      // Delete button
      const delBtn = card.querySelector('.btn-card-delete');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await sendMessageToContent({ action: 'DELETE_NOTE', noteId: note.id });
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

  // --- Button Handlers ---

  // New Note
  btnNewNote.addEventListener('click', async () => {
    try {
      btnNewNote.disabled = true;
      await sendMessageToContent({ action: 'CREATE_NOTE' });
      window.close(); // Close popup so user can immediately type into note
    } catch (err) {
      console.error('Create note failed:', err);
      btnNewNote.disabled = false;
    }
  });

  // Toggle Visibility
  btnToggleVisibility.addEventListener('click', async () => {
    try {
      const resp = await sendMessageToContent({ action: 'TOGGLE_VISIBILITY' });
      if (resp && typeof resp.isVisible === 'boolean') {
        isNotesVisible = resp.isVisible;
        updateVisibilityIcon();
      }
    } catch (err) {
      console.error('Toggle visibility failed:', err);
    }
  });

  // Export Notes (Markdown file download)
  btnExport.addEventListener('click', () => {
    if (allNotes.length === 0) {
      alert('No notes on this page to export.');
      return;
    }

    let md = `# Sticky Notes for ${activeTab.title || 'Page'}\n`;
    md += `URL: ${activeTab.url}\n`;
    md += `Exported: ${new Date().toLocaleString()}\n\n---\n\n`;

    allNotes.forEach((n, idx) => {
      const title = n.heading ? n.heading.trim() : `Note #${idx + 1}`;
      const text = htmlToPlainText(n.bodyHtml).trim();
      const updated = new Date(n.updatedAt || Date.now()).toLocaleString();
      md += `### ${title}\n`;
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
    const confirm = window.confirm(`Delete all ${allNotes.length} sticky notes on this page?`);
    if (!confirm) return;

    try {
      await sendMessageToContent({ action: 'DELETE_ALL_NOTES' });
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

  // Initialize
  loadNotes();
});
