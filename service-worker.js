/**
 * PopBlock — Service Worker
 *
 * Responsibilities:
 * 1. Generate runtime icon (OffscreenCanvas)
 * 2. Track blocked counts per tab
 * 3. ACTIVELY BLOCK REDIRECTS via webNavigation — detect redirect navigations
 *    and revert them using tabs.goBack()
 * 4. Handle messages from content scripts
 */

// --- All event listeners registered synchronously at top level ---

// =============================================
// Icon Generation (OffscreenCanvas)
// =============================================
function generateShieldIcon(size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / 100;

  ctx.beginPath();
  ctx.moveTo(50 * s, 5 * s);
  ctx.lineTo(90 * s, 20 * s);
  ctx.lineTo(90 * s, 55 * s);
  ctx.quadraticCurveTo(90 * s, 80 * s, 50 * s, 95 * s);
  ctx.quadraticCurveTo(10 * s, 80 * s, 10 * s, 55 * s);
  ctx.lineTo(10 * s, 20 * s);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6C5CE7');
  gradient.addColorStop(1, '#FF3B5C');
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(2, 8 * s);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(35 * s, 35 * s); ctx.lineTo(65 * s, 65 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(65 * s, 35 * s); ctx.lineTo(35 * s, 65 * s); ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

async function setExtensionIcon() {
  try {
    await chrome.action.setIcon({
      imageData: {
        16: generateShieldIcon(16),
        32: generateShieldIcon(32),
        48: generateShieldIcon(48),
        128: generateShieldIcon(128)
      }
    });
  } catch (err) {
    console.warn('[PopBlock SW] Icon generation failed:', err);
  }
}

// =============================================
// Install & Startup
// =============================================
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      popblockEnabled: true,
      whitelist: [],
      totalBlocked: 0
    });
    await chrome.storage.session.set({ tabCounts: {}, tabUrls: {} });
  }

  await chrome.action.setBadgeBackgroundColor({ color: '#FF3B5C' });
  try { await chrome.action.setBadgeTextColor({ color: '#FFFFFF' }); } catch (e) {}
  await setExtensionIcon();
});

setExtensionIcon();

// =============================================
// Active Redirect Blocking via webNavigation
// =============================================

// Track the last "good" URL per tab so we can revert to it
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // Main frame only

  const { popblockEnabled = true } = await chrome.storage.local.get('popblockEnabled');
  if (!popblockEnabled) return;

  // Save current URL before navigation happens
  try {
    const tab = await chrome.tabs.get(details.tabId);
    if (tab && tab.url) {
      const { tabUrls = {} } = await chrome.storage.session.get('tabUrls');
      // Only save if it's a real page (not a redirect target we're about to block)
      if (!tabUrls[details.tabId] || tabUrls[details.tabId].url !== tab.url) {
        tabUrls[details.tabId] = {
          url: tab.url,
          time: Date.now()
        };
        await chrome.storage.session.set({ tabUrls });
      }
    }
  } catch (e) {
    // Tab may have been closed
  }
});

// Detect redirects and revert them
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return; // Main frame only

  const { popblockEnabled = true } = await chrome.storage.local.get('popblockEnabled');
  if (!popblockEnabled) return;

  // Check whitelist
  const { whitelist = [] } = await chrome.storage.local.get('whitelist');
  try {
    const destUrl = new URL(details.url);
    if (whitelist.some(d => destUrl.hostname === d || destUrl.hostname.endsWith('.' + d))) {
      return; // Whitelisted
    }
  } catch (e) {}

  const qualifiers = details.transitionQualifiers || [];
  const isClientRedirect = qualifiers.includes('client_redirect');
  const isServerRedirect = qualifiers.includes('server_redirect');
  const transitionType = details.transitionType;

  // Detect suspicious redirects:
  // - client_redirect: JS-initiated redirect (location.href = ...)
  // - server_redirect: HTTP 3xx redirect
  // We block client redirects that aren't user-typed or bookmarked
  if (isClientRedirect && transitionType !== 'typed' && transitionType !== 'auto_bookmark') {
    const { tabUrls = {} } = await chrome.storage.session.get('tabUrls');
    const savedTab = tabUrls[details.tabId];

    if (savedTab && savedTab.url) {
      try {
        const prevOrigin = new URL(savedTab.url).origin;
        const newOrigin = new URL(details.url).origin;

        // Only block cross-origin redirects
        if (prevOrigin !== newOrigin && !savedTab.url.startsWith('chrome') && !savedTab.url.startsWith('brave')) {
          console.log('[PopBlock SW] Blocking cross-origin redirect:', savedTab.url, '→', details.url);

          // Revert: go back to previous page
          try {
            await chrome.tabs.goBack(details.tabId);
          } catch (e) {
            // goBack failed, navigate directly
            await chrome.tabs.update(details.tabId, { url: savedTab.url });
          }

          await incrementBlockCount(details.tabId);
          return;
        }
      } catch (e) {
        // URL parsing failed
      }
    }
  }

  // Reset tab count for user-initiated navigations
  if (transitionType === 'typed' || transitionType === 'auto_bookmark') {
    try {
      const { tabCounts = {} } = await chrome.storage.session.get('tabCounts');
      tabCounts[details.tabId] = 0;
      await chrome.storage.session.set({ tabCounts });
      await chrome.action.setBadgeText({ text: '', tabId: details.tabId });
    } catch (e) {}
  }
});

// =============================================
// Message Handling
// =============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'POPBLOCK_BLOCKED' && sender.tab) {
    (async () => {
      try {
        await incrementBlockCount(sender.tab.id);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  if (message.type === 'GET_STATUS') {
    (async () => {
      try {
        const { popblockEnabled = true, totalBlocked = 0, whitelist = [] } =
          await chrome.storage.local.get(['popblockEnabled', 'totalBlocked', 'whitelist']);
        const { tabCounts = {} } = await chrome.storage.session.get('tabCounts');
        sendResponse({
          enabled: popblockEnabled,
          totalBlocked,
          whitelist,
          tabCounts
        });
      } catch (err) {
        sendResponse({ enabled: true, totalBlocked: 0, whitelist: [], tabCounts: {} });
      }
    })();
    return true;
  }

  if (message.type === 'TOGGLE_ENABLED') {
    (async () => {
      try {
        const { popblockEnabled = true } = await chrome.storage.local.get('popblockEnabled');
        const newState = !popblockEnabled;
        await chrome.storage.local.set({ popblockEnabled: newState });

        if (!newState) {
          await chrome.action.setBadgeText({ text: 'OFF' });
          await chrome.action.setBadgeBackgroundColor({ color: '#666666' });
        } else {
          await chrome.action.setBadgeText({ text: '' });
          await chrome.action.setBadgeBackgroundColor({ color: '#FF3B5C' });
        }

        sendResponse({ enabled: newState });
      } catch (err) {
        sendResponse({ enabled: true });
      }
    })();
    return true;
  }

  if (message.type === 'UPDATE_WHITELIST') {
    (async () => {
      try {
        await chrome.storage.local.set({ whitelist: message.whitelist || [] });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }
});

// =============================================
// Tab Cleanup
// =============================================
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const { tabCounts = {} } = await chrome.storage.session.get('tabCounts');
    delete tabCounts[tabId];
    await chrome.storage.session.set({ tabCounts });

    const { tabUrls = {} } = await chrome.storage.session.get('tabUrls');
    delete tabUrls[tabId];
    await chrome.storage.session.set({ tabUrls });
  } catch (err) {}
});

// =============================================
// Helpers
// =============================================
async function incrementBlockCount(tabId) {
  const { tabCounts = {} } = await chrome.storage.session.get('tabCounts');
  tabCounts[tabId] = (tabCounts[tabId] || 0) + 1;
  await chrome.storage.session.set({ tabCounts });

  const { totalBlocked = 0 } = await chrome.storage.local.get('totalBlocked');
  await chrome.storage.local.set({ totalBlocked: totalBlocked + 1 });

  const count = tabCounts[tabId];
  await chrome.action.setBadgeText({
    text: count > 0 ? String(count) : '',
    tabId
  });
}
