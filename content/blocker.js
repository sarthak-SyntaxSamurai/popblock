/**
 * PopBlock — Main World Blocker (world: "MAIN")
 *
 * Blocks popups and redirects using methods that ACTUALLY WORK:
 * 1. Override window.open — reliable
 * 2. Override Location.prototype.replace/assign — reliable
 * 3. Navigation API (navigate event) — catches location.href, .assign, .replace, etc.
 * 4. Block clickjack overlays
 * 5. Strip meta-refresh tags
 */
'use strict';

var POPBLOCK_EVENT = '__popblock_blocked__';

function _pbNotify(type, url) {
  try {
    window.dispatchEvent(new CustomEvent(POPBLOCK_EVENT, {
      detail: JSON.stringify({ type: type, url: url || '' })
    }));
  } catch (e) {}
}

function _pbIsCrossOrigin(url) {
  try {
    var resolved = new URL(url, location.href);
    return resolved.origin !== location.origin;
  } catch (e) {
    return true; // Treat invalid URLs as cross-origin
  }
}

// =============================================
// 1. Override window.open — ALWAYS block cross-origin
// =============================================
var _pbOrigOpen = window.open;

window.open = function (url, target, features) {
  // Allow: no URL (about:blank), same-origin without popup features
  if (!url || url === 'about:blank') {
    return _pbOrigOpen.call(window, url, target, features);
  }

  if (!_pbIsCrossOrigin(url) && !features) {
    return _pbOrigOpen.call(window, url, target, features);
  }

  // Block everything else
  _pbNotify('popup', url);
  console.log('%c[PopBlock]%c Blocked popup → ' + url, 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');

  return {
    closed: true,
    close: function () {},
    focus: function () {},
    blur: function () {},
    postMessage: function () {},
    document: { write: function () {}, close: function () {} },
    location: { href: '', replace: function () {} }
  };
};

// =============================================
// 2. Override Location.prototype.replace & assign
// =============================================
var _pbOrigReplace = Location.prototype.replace;
var _pbOrigAssign = Location.prototype.assign;

Location.prototype.replace = function (url) {
  if (!_pbIsCrossOrigin(url)) {
    return _pbOrigReplace.call(this, url);
  }
  _pbNotify('redirect', url);
  console.log('%c[PopBlock]%c Blocked redirect (replace) → ' + url, 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');
};

Location.prototype.assign = function (url) {
  if (!_pbIsCrossOrigin(url)) {
    return _pbOrigAssign.call(this, url);
  }
  _pbNotify('redirect', url);
  console.log('%c[PopBlock]%c Blocked redirect (assign) → ' + url, 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');
};

// =============================================
// 3. Navigation API — catches location.href = "..." and more
//    This is the ONLY way to intercept location.href changes
//    since Object.defineProperty on window.location fails.
// =============================================
if (typeof navigation !== 'undefined' && navigation.addEventListener) {
  navigation.addEventListener('navigate', function (event) {
    // Don't block user-initiated navigations (link clicks, form submits)
    if (event.userInitiated) return;
    // Don't block same-document navigations (hash changes, pushState)
    if (event.hashChange || !event.destination) return;

    var destUrl = event.destination.url;

    // Allow same-origin
    if (!_pbIsCrossOrigin(destUrl)) return;

    // Block cross-origin script-initiated navigations
    if (event.canIntercept) {
      event.preventDefault();
      _pbNotify('redirect', destUrl);
      console.log('%c[PopBlock]%c Blocked redirect (navigation API) → ' + destUrl, 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');
    }
  });
  console.log('%c[PopBlock]%c Navigation API interception active', 'color:#6C5CE7;font-weight:bold', 'color:#00D68F');
}

// =============================================
// 4. Block clickjack overlays
// =============================================
document.addEventListener('click', function (e) {
  var el = e.target;
  if (!el || el === document.body || el === document.documentElement) return;
  try {
    var style = getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    var coversViewport = rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8;
    var isInvisible = parseFloat(style.opacity) < 0.05 ||
      (style.backgroundColor === 'transparent' && !el.textContent.trim());
    if (coversViewport && isInvisible) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      el.remove();
      _pbNotify('overlay', '');
      console.log('%c[PopBlock]%c Removed clickjack overlay', 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');
    }
  } catch (err) {}
}, true);

// =============================================
// 5. Block meta-refresh redirects
// =============================================
var _pbMetaObs = new MutationObserver(function (mutations) {
  for (var i = 0; i < mutations.length; i++) {
    var added = mutations[i].addedNodes;
    for (var j = 0; j < added.length; j++) {
      var node = added[j];
      if (node.nodeType !== 1) continue;
      if (node.tagName === 'META' && node.httpEquiv && node.httpEquiv.toLowerCase() === 'refresh') {
        node.remove();
        _pbNotify('meta-refresh', node.getAttribute('content') || '');
        console.log('%c[PopBlock]%c Removed meta-refresh', 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');
      }
      if (node.querySelectorAll) {
        var metas = node.querySelectorAll('meta[http-equiv="refresh" i]');
        for (var k = 0; k < metas.length; k++) {
          metas[k].remove();
          _pbNotify('meta-refresh', metas[k].getAttribute('content') || '');
        }
      }
    }
  }
});

if (document.documentElement) {
  _pbMetaObs.observe(document.documentElement, { childList: true, subtree: true });
} else {
  new MutationObserver(function (_, obs) {
    if (document.documentElement) {
      obs.disconnect();
      _pbMetaObs.observe(document.documentElement, { childList: true, subtree: true });
    }
  }).observe(document, { childList: true });
}

console.log('%c[PopBlock]%c Main world blocker active ✓ — ' + location.href, 'color:#6C5CE7;font-weight:bold', 'color:#00D68F');
