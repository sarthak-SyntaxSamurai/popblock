/**
 * PopBlock — Bridge Script (ISOLATED world)
 *
 * Listens for custom events dispatched by blocker.js (MAIN world)
 * and forwards them to the service worker via chrome.runtime.sendMessage.
 *
 * This separation is needed because MAIN world scripts cannot use chrome.* APIs.
 */

window.addEventListener('__popblock_blocked__', (e) => {
  try {
    const detail = JSON.parse(e.detail);
    chrome.runtime.sendMessage({
      type: 'POPBLOCK_BLOCKED',
      detail: detail
    }).catch(() => {
      // Extension context may be invalidated — ignore
    });
  } catch (err) {
    // Malformed event or extension context dead — ignore
  }
});
