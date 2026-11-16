/**
 * Silicon Notes - Background Service Worker (Manifest V3)
 * Global Availability: Tracks notes globally across the browser.
 */

const GLOBAL_STORAGE_KEY = 'silicon_notes_global';
const LEGACY_STORAGE_KEY = 'rich_sticky_notes_global';

async function updateBadgeGlobal() {
  try {
    const data = await chrome.storage.local.get([GLOBAL_STORAGE_KEY, LEGACY_STORAGE_KEY]);
    const notes = Array.isArray(data[GLOBAL_STORAGE_KEY])
      ? data[GLOBAL_STORAGE_KEY]
      : (Array.isArray(data[LEGACY_STORAGE_KEY]) ? data[LEGACY_STORAGE_KEY] : []);
    const activeCount = notes.filter(n => !n.closed).length;

    await chrome.action.setBadgeText({
      text: activeCount > 0 ? String(activeCount) : ''
    });
    await chrome.action.setBadgeBackgroundColor({
      color: '#eab308'
    });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({
        color: '#18181b'
      });
    }
  } catch (err) {
    console.debug('Badge update error:', err);
  }
}

// Send message to content script, auto-injecting if needed
async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/fonts.js', 'content/content.js']
      });
      await new Promise(r => setTimeout(r, 120));
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (injectionErr) {
      console.warn('Cannot inject content script on this tab:', injectionErr);
      throw injectionErr;
    }
  }
}

// Handle global keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.id || !activeTab.url) return;

  const isRestricted = (
    activeTab.url.startsWith('chrome://') ||
    activeTab.url.startsWith('edge://') ||
    activeTab.url.startsWith('chrome-extension://')
  );

  if (command === 'new-sticky-note') {
    if (isRestricted && !activeTab.url.includes('canvas')) {
      const canvasUrl = chrome.runtime.getURL('canvas/canvas.html');
      chrome.tabs.create({ url: canvasUrl });
    } else {
      sendMessageToTab(activeTab.id, { action: 'CREATE_NOTE' }).catch(() => {});
    }
  } else if (command === 'toggle-notes-visibility') {
    if (!isRestricted) {
      sendMessageToTab(activeTab.id, { action: 'TOGGLE_VISIBILITY' }).catch(() => {});
    }
  }
});

// Update badge on tab navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateBadgeGlobal();
  }
});

// Update badge on tab activation
chrome.tabs.onActivated.addListener(() => {
  updateBadgeGlobal();
});

// Real-time badge update on storage change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const targetChange = changes[GLOBAL_STORAGE_KEY] || changes[LEGACY_STORAGE_KEY];
  if (targetChange) {
    const newNotes = targetChange.newValue || [];
    const activeCount = Array.isArray(newNotes) ? newNotes.filter(n => !n.closed).length : 0;
    chrome.action.setBadgeText({
      text: activeCount > 0 ? String(activeCount) : ''
    }).catch(() => {});
  }
});

// Messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPDATE_BADGE_COUNT') {
    updateBadgeGlobal();
    sendResponse({ ok: true });
  }
  return true;
});

// Initial badge update on service worker start
updateBadgeGlobal();
