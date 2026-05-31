/**
 * PopBlock — Popup Script
 *
 * Handles UI state, toggle, whitelist, and stats display.
 * Uses async/await throughout (no .then() chains).
 * Stores NO state in variables — reads from chrome.storage on every interaction.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const toggleCard = document.getElementById('toggleCard');
  const statusLabel = document.getElementById('statusLabel');
  const statusHint = document.getElementById('statusHint');
  const shieldIcon = document.getElementById('shieldIcon');
  const tabBlockCount = document.getElementById('tabBlockCount');
  const totalBlockCount = document.getElementById('totalBlockCount');
  const currentDomain = document.getElementById('currentDomain');
  const siteStatus = document.getElementById('siteStatus');
  const whitelistBtn = document.getElementById('whitelistBtn');
  const whitelistText = document.getElementById('whitelistText');

  // --- Load current state ---
  async function refreshState() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

      // Update toggle
      enableToggle.checked = response.enabled;
      updateToggleUI(response.enabled);

      // Update stats
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabCount = tab ? (response.tabCounts[tab.id] || 0) : 0;
      animateNumber(tabBlockCount, tabCount);
      animateNumber(totalBlockCount, response.totalBlocked);

      // Update site info
      if (tab && tab.url) {
        try {
          const url = new URL(tab.url);
          const domain = url.hostname;
          currentDomain.textContent = domain || '—';

          const isWhitelisted = response.whitelist.includes(domain);
          updateWhitelistUI(isWhitelisted);
        } catch (e) {
          currentDomain.textContent = 'Internal Page';
          siteStatus.textContent = 'N/A';
          whitelistBtn.style.display = 'none';
        }
      }
    } catch (err) {
      // Extension context may be invalid
      console.error('Failed to load state:', err);
    }
  }

  function updateToggleUI(enabled) {
    if (enabled) {
      toggleCard.classList.add('active');
      toggleCard.classList.remove('disabled');
      shieldIcon.classList.add('active');
      statusLabel.textContent = 'Protection Active';
      statusHint.textContent = 'Blocking popups & redirects';
      document.body.classList.remove('disabled');
    } else {
      toggleCard.classList.remove('active');
      toggleCard.classList.add('disabled');
      shieldIcon.classList.remove('active');
      statusLabel.textContent = 'Protection Paused';
      statusHint.textContent = 'Popups & redirects allowed';
      document.body.classList.add('disabled');
    }
  }

  function updateWhitelistUI(isWhitelisted) {
    if (isWhitelisted) {
      whitelistBtn.classList.add('active');
      whitelistText.textContent = 'Whitelisted';
      siteStatus.textContent = 'Allowed';
      siteStatus.classList.add('whitelisted');
    } else {
      whitelistBtn.classList.remove('active');
      whitelistText.textContent = 'Whitelist';
      siteStatus.textContent = 'Protected';
      siteStatus.classList.remove('whitelisted');
    }
  }

  function animateNumber(element, target) {
    const current = parseInt(element.textContent) || 0;
    if (current === target) return;

    element.textContent = target.toLocaleString();
    element.classList.add('bump');
    setTimeout(() => element.classList.remove('bump'), 300);
  }

  // --- Toggle handler ---
  enableToggle.addEventListener('change', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED' });
      updateToggleUI(response.enabled);
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  });

  // --- Whitelist handler ---
  whitelistBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      const url = new URL(tab.url);
      const domain = url.hostname;
      if (!domain) return;

      const { whitelist = [] } = await chrome.storage.local.get('whitelist');
      const isWhitelisted = whitelist.includes(domain);

      let newWhitelist;
      if (isWhitelisted) {
        newWhitelist = whitelist.filter(d => d !== domain);
      } else {
        newWhitelist = [...whitelist, domain];
      }

      await chrome.runtime.sendMessage({ type: 'UPDATE_WHITELIST', whitelist: newWhitelist });
      updateWhitelistUI(!isWhitelisted);
    } catch (err) {
      console.error('Whitelist toggle failed:', err);
    }
  });

  // --- Listen for live block updates ---
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.totalBlocked) {
      animateNumber(totalBlockCount, changes.totalBlocked.newValue);
    }
    if (areaName === 'session' && changes.tabCounts) {
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            const count = changes.tabCounts.newValue[tab.id] || 0;
            animateNumber(tabBlockCount, count);
          }
        } catch (err) { /* ignore */ }
      })();
    }
  });

  // --- Initialize ---
  await refreshState();
});
