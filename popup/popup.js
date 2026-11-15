/**
 * Rich Web Sticky Notes - Popup Controller
 * Global Availability: Manages sticky notes available across all websites.
 */

const GLOBAL_STORAGE_KEY = 'rich_sticky_notes_global';

document.addEventListener('DOMContentLoaded', async () => {
  const pageUrlEl = document.getElementById('pageUrl');
  const badgeCountEl = document.getElementById('notesCountBadge');
  const notesListEl = document.getElementById('notesList');
  const btnNewNote = document.getElementById('btnNewNote');
  const btnOpenCanvasTop = document.getElementById('btnOpenCanvasTop');
  const btnToggleVisibility = document.getElementById('btnToggleVisibility');
  const btnExport = document.getElementById('btnExport');
  const btnClearAll = document.getElementById('btnClearAll');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const newKeyHint = document.getElementById('newKeyHint');
  const toggleKeyHint = document.getElementById('toggleKeyHint');

  // Custom Styled Modal elements
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalBtnCancel = document.getElementById('modalBtnCancel');
  const modalBtnConfirm = document.getElementById('modalBtnConfirm');
  const toastEl = document.getElementById('toast');

  let modalResolver = null;

  function showConfirmDialog({ title, message, confirmText = 'Delete', danger = true }) {
    return new Promise((resolve) => {
      modalTitle.textContent = title;
      modalMessage.textContent = message;
      modalBtnConfirm.textContent = confirmText;
      if (danger) {
        modalBtnConfirm.className = 'btn btn-danger';
      } else {
        modalBtnConfirm.className = 'btn btn-primary';
      }
      modalResolver = resolve;
      modalBackdrop.style.display = 'flex';
    });
  }

  modalBtnCancel.addEventListener('click', () => {
    modalBackdrop.style.display = 'none';
    if (modalResolver) {
      modalResolver(false);
      modalResolver = null;
    }
  });

  modalBtnConfirm.addEventListener('click', () => {
    modalBackdrop.style.display = 'none';
    if (modalResolver) {
      modalResolver(true);
      modalResolver = null;
    }
  });

  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) {
      modalBackdrop.style.display = 'none';
      if (modalResolver) {
        modalResolver(false);
        modalResolver = null;
      }
    }
  });

  let toastTimer = null;
  function showToast(msg) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    toastTimer = setTimeout(() => {
      toastEl.style.display = 'none';
    }, 2400);
  }

  const isMac = navigator.userAgent.toLowerCase().includes('mac');
  if (isMac) {
    if (newKeyHint) newKeyHint.textContent = 'Cmd+Shift+N';
    if (toggleKeyHint) toggleKeyHint.textContent = 'Cmd+Shift+H';
  }

  let activeTab = null;
  let allNotes = [];
  let isWebPage = false;
  let isNotesVisible = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;
    if (activeTab && activeTab.url) {
      const u = activeTab.url;
      isWebPage = (
        !u.startsWith('chrome://') &&
        !u.startsWith('edge://') &&
        !u.startsWith('chrome-extension://')
      ) || u.includes('canvas');
    }
  } catch (err) {
    console.debug('Active tab query:', err);
  }

  async function sendMessageToContent(message) {
    if (!isWebPage || !activeTab || !activeTab.id) return null;
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
        return null;
      }
    }
  }

  async function loadGlobalNotes() {
    try {
      const allData = await chrome.storage.local.get(null);
      let globalList = Array.isArray(allData[GLOBAL_STORAGE_KEY]) ? allData[GLOBAL_STORAGE_KEY] : [];

      const legacyKeys = Object.keys(allData).filter(k => k.startsWith('notes:') && k !== GLOBAL_STORAGE_KEY);
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
          await chrome.storage.local.set({ [GLOBAL_STORAGE_KEY]: globalList });
          await chrome.storage.local.remove(legacyKeys).catch(() => {});
        }
      }

      allNotes = globalList;
      renderNotes(getFilteredNotes());
    } catch (e) {
      allNotes = [];
      renderNotes([]);
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
          <div class="empty-desc">Click "New Note" or press Alt+Shift+N to create a sticky note. Your notes follow you everywhere across all sites!</div>
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

      // Click card to jump or reopen
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-card-delete')) return;

        if (!isWebPage) {
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
          console.debug('Focus note failed:', err);
        }
      });

      // Delete button with custom styled confirm dialog
      const delBtn = card.querySelector('.btn-card-delete');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        const confirmed = await showConfirmDialog({
          title: 'Delete Sticky Note?',
          message: `Permanently delete "${title}"? This cannot be undone.`,
          confirmText: 'Delete Note',
          danger: true
        });

        if (!confirmed) return;

        allNotes = allNotes.filter(n => n.id !== note.id);
        await chrome.storage.local.set({ [GLOBAL_STORAGE_KEY]: allNotes });

        if (isWebPage) {
          sendMessageToContent({ action: 'DELETE_NOTE', noteId: note.id }).catch(() => {});
        }

        renderNotes(getFilteredNotes());
        showToast('Sticky note deleted');
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

  // --- Actions ---

  // New Note
  btnNewNote.addEventListener('click', async () => {
    if (!isWebPage) {
      openCanvasTab();
      return;
    }

    try {
      btnNewNote.disabled = true;
      const resp = await sendMessageToContent({ action: 'CREATE_NOTE' });
      if (resp && resp.ok) {
        window.close();
      } else {
        openCanvasTab();
      }
    } catch (err) {
      openCanvasTab();
    }
  });

  // Open Canvas
  btnOpenCanvasTop.addEventListener('click', () => {
    openCanvasTab();
  });

  // Toggle Visibility
  btnToggleVisibility.addEventListener('click', async () => {
    if (!isWebPage) return;
    try {
      const resp = await sendMessageToContent({ action: 'TOGGLE_VISIBILITY' });
      if (resp && typeof resp.isVisible === 'boolean') {
        isNotesVisible = resp.isVisible;
        if (isNotesVisible) {
          btnToggleVisibility.classList.remove('is-active');
        } else {
          btnToggleVisibility.classList.add('is-active');
        }
      }
    } catch (err) {}
  });

  // Export Notes to Markdown
  btnExport.addEventListener('click', () => {
    if (allNotes.length === 0) {
      showToast('No sticky notes to export');
      return;
    }

    let md = `# Global Sticky Notes Export\n`;
    md += `Exported: ${new Date().toLocaleString()}\n`;
    md += `Total Notes: ${allNotes.length}\n\n---\n\n`;

    allNotes.forEach((n, idx) => {
      const title = n.heading ? n.heading.trim() : `Note #${idx + 1}`;
      const text = htmlToPlainText(n.bodyHtml).trim();
      const updated = new Date(n.updatedAt || Date.now()).toLocaleString();
      const status = n.closed ? ' [Closed]' : ' [Active]';
      const source = n.sourceUrl ? ` | Origin: ${n.sourceUrl}` : '';

      md += `### ${title}${status}\n`;
      md += `*Theme: ${n.color || 'Yellow'} | Last Updated: ${updated}${source}*\n\n`;
      md += `${text || '_No content_'}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `global-sticky-notes-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported to Markdown');
  });

  // Clear All Notes with Custom Styled Confirm
  btnClearAll.addEventListener('click', async () => {
    if (allNotes.length === 0) return;

    const confirmed = await showConfirmDialog({
      title: 'Delete All Sticky Notes?',
      message: `Permanently delete all ${allNotes.length} sticky notes everywhere? This action cannot be undone.`,
      confirmText: 'Delete All Notes',
      danger: true
    });

    if (!confirmed) return;

    allNotes = [];
    await chrome.storage.local.set({ [GLOBAL_STORAGE_KEY]: [] });

    if (isWebPage) {
      sendMessageToContent({ action: 'DELETE_ALL_NOTES' }).catch(() => {});
    }

    renderNotes([]);
    showToast('All sticky notes deleted');
  });

  // Search
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

  // Real-time updates while popup is open
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes[GLOBAL_STORAGE_KEY]) {
      allNotes = changes[GLOBAL_STORAGE_KEY].newValue || [];
      renderNotes(getFilteredNotes());
    }
  });

  loadGlobalNotes();
});
