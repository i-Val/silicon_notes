/**
 * Rich Web Sticky Notes - Background Service Worker (Manifest V3)
 */

function getNormalizedUrlKey(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) {
      return null;
    }
    return `notes:${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}

async function updateTabBadge(tabId, url) {
  if (!tabId || tabId < 0) return;
  const key = getNormalizedUrlKey(url);
  if (!key) {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    return;
  }

  try {
    const data = await chrome.storage.local.get(key);
    const notes = Array.isArray(data[key]) ? data[key] : [];
    const count = notes.length;
    
    await chrome.action.setBadgeText({
      tabId,
      text: count > 0 ? String(count) : ''
    });
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: '#eab308' // Amber yellow accent matching default note
    });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({
        tabId,
        color: '#18181b' // Dark charcoal text
      });
    }
  } catch (err) {
    console.debug('Badge update error:', err);
  }
}

// Send a message to content script, auto-injecting if not present
async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    // Content script might not be injected yet
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content.js']
      });
      // Small pause to allow script initialization
      await new Promise(r => setTimeout(r, 100));
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

  const key = getNormalizedUrlKey(activeTab.url);
  if (!key) return; // Ignore internal chrome:// pages

  if (command === 'new-sticky-note') {
    sendMessageToTab(activeTab.id, { action: 'CREATE_NOTE' }).catch(() => {});
  } else if (command === 'toggle-notes-visibility') {
    sendMessageToTab(activeTab.id, { action: 'TOGGLE_VISIBILITY' }).catch(() => {});
  }
});

// Update badge on tab navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateTabBadge(tabId, tab.url);
  }
});

// Update badge on tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      updateTabBadge(activeInfo.tabId, tab.url);
    }
  } catch (err) {
    // Tab might be closing
  }
});

// Listen to storage changes to update badge in real time
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.id || !activeTab.url) return;

  const currentKey = getNormalizedUrlKey(activeTab.url);
  if (currentKey && changes[currentKey]) {
    const newNotes = changes[currentKey].newValue || [];
    const count = Array.isArray(newNotes) ? newNotes.length : 0;
    chrome.action.setBadgeText({
      tabId: activeTab.id,
      text: count > 0 ? String(count) : ''
    }).catch(() => {});
  }
});

// Messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPDATE_BADGE_COUNT') {
    const tabId = sender?.tab?.id || message.tabId;
    if (tabId) {
      const count = message.count || 0;
      chrome.action.setBadgeText({
        tabId,
        text: count > 0 ? String(count) : ''
      }).catch(() => {});
    }
    sendResponse({ ok: true });
  }
  return true;
});
