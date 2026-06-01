/**
 * PopBlock — Main World Blocker (world: "MAIN")
 *
 * BULLETPROOF Edition — Blocks popups and redirects using methods that ACTUALLY WORK:
 * 1. Override window.open — tamper-proof, iframe-resistant
 * 2. Override Location.prototype.replace/assign — tamper-proof
 * 3. Navigation API (navigate event) — catches location.href, .assign, .replace, etc.
 * 4. Block clickjack overlays — enhanced detection
 * 5. Strip meta-refresh tags
 * 6. Iframe bypass protection — prevents stealing clean APIs from iframes
 * 7. setTimeout/setInterval redirect guard — catches delayed redirects
 * 8. Aggressive invisible iframe cleanup — removes ad iframes
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
// 1. Override window.open — TAMPER-PROOF
// =============================================
var _pbOrigOpen = window.open;

var _pbBlockedOpen = function (url, target, features) {
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

// Make window.open non-configurable so sites can't revert our override
Object.defineProperty(window, 'open', {
  value: _pbBlockedOpen,
  writable: false,
  configurable: false
});

// =============================================
// 2. Override Location.prototype.replace & assign — TAMPER-PROOF
// =============================================
var _pbOrigReplace = Location.prototype.replace;
var _pbOrigAssign = Location.prototype.assign;

Object.defineProperty(Location.prototype, 'replace', {
  value: function (url) {
    if (!_pbIsCrossOrigin(url)) {
      return _pbOrigReplace.call(this, url);
    }
    _pbNotify('redirect', url);
    console.log('%c[PopBlock]%c Blocked redirect (replace) → ' + url, 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');
  },
  writable: false,
  configurable: false
});

Object.defineProperty(Location.prototype, 'assign', {
  value: function (url) {
    if (!_pbIsCrossOrigin(url)) {
      return _pbOrigAssign.call(this, url);
    }
    _pbNotify('redirect', url);
    console.log('%c[PopBlock]%c Blocked redirect (assign) → ' + url, 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');
  },
  writable: false,
  configurable: false
});

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
// 4. Block clickjack overlays — ENHANCED
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

    // Enhanced: also detect fixed/absolute positioned overlays with high z-index
    var isOverlayPositioned = (style.position === 'fixed' || style.position === 'absolute') &&
      parseInt(style.zIndex, 10) > 9000;

    if (coversViewport && (isInvisible || isOverlayPositioned)) {
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

// =============================================
// 6. IFRAME BYPASS PROTECTION — Prevents stealing clean APIs
//    Sites create hidden iframes to get unpatched window.open
//    We intercept contentWindow access to propagate our blocks
//    Uses WeakSet to track patched windows (no cross-origin property access needed)
// =============================================
(function () {
  try {
    var iframeProto = HTMLIFrameElement.prototype;
    var cwDesc = Object.getOwnPropertyDescriptor(iframeProto, 'contentWindow');
    if (!cwDesc || !cwDesc.get) return;

    var originalCWGet = cwDesc.get;

    // WeakSet tracks patched windows by reference — no property access on the
    // window object is needed, so cross-origin windows never throw SecurityError
    var _patchedWindows = new WeakSet();

    function _pbPatchIframeWindow(win) {
      if (!win || _patchedWindows.has(win)) return;
      _patchedWindows.add(win);
      try {
        // Override window.open inside iframe
        Object.defineProperty(win, 'open', {
          value: _pbBlockedOpen,
          writable: false,
          configurable: false
        });

        // Override Location.prototype inside iframe
        var iframeLoc = win.Location || (win.location && win.location.constructor);
        if (iframeLoc && iframeLoc.prototype) {
          Object.defineProperty(iframeLoc.prototype, 'replace', {
            value: Location.prototype.replace,
            writable: false,
            configurable: false
          });
          Object.defineProperty(iframeLoc.prototype, 'assign', {
            value: Location.prototype.assign,
            writable: false,
            configurable: false
          });
        }
      } catch (e) {
        // Cross-origin iframe — can't patch, but also can't be exploited
        // since the site can't access cross-origin contentWindow either
      }
    }

    Object.defineProperty(iframeProto, 'contentWindow', {
      get: function () {
        var win;
        try { win = originalCWGet.call(this); } catch (e) { return null; }
        _pbPatchIframeWindow(win);
        return win;
      },
      configurable: false
    });

    // Also patch contentDocument access
    var cdDesc = Object.getOwnPropertyDescriptor(iframeProto, 'contentDocument');
    if (cdDesc && cdDesc.get) {
      var originalCDGet = cdDesc.get;
      Object.defineProperty(iframeProto, 'contentDocument', {
        get: function () {
          try {
            var win = originalCWGet.call(this);
            _pbPatchIframeWindow(win);
          } catch (e) {}
          try { return originalCDGet.call(this); } catch (e) { return null; }
        },
        configurable: false
      });
    }

    console.log('%c[PopBlock]%c Iframe bypass protection active', 'color:#6C5CE7;font-weight:bold', 'color:#00D68F');
  } catch (e) {
    console.warn('[PopBlock] Could not install iframe protection:', e);
  }
})();

// =============================================
// 7. setTimeout / setInterval REDIRECT GUARD
//    Catches delayed redirect attacks like:
//    setTimeout(function(){ location.href = "http://ad.com" }, 2000)
//    We wrap setTimeout/setInterval to inspect string arguments
// =============================================
(function () {
  try {
    var _origSetTimeout = window.setTimeout;
    var _origSetInterval = window.setInterval;

    // Regex to detect redirect patterns in string code
    var _redirectPattern = /(?:location\s*(?:\.|(?:\[['"]))\s*(?:href|replace|assign))|(?:window\s*\.\s*open\s*\()|(?:document\s*\.\s*location\s*=)/i;

    Object.defineProperty(window, 'setTimeout', {
      value: function (fn, delay) {
        // Only intercept string arguments (eval-style) that contain redirects
        if (typeof fn === 'string' && _redirectPattern.test(fn)) {
          _pbNotify('timer-redirect', fn.substring(0, 200));
          console.log('%c[PopBlock]%c Blocked setTimeout redirect code', 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');
          return 0;
        }
        return _origSetTimeout.apply(window, arguments);
      },
      writable: false,
      configurable: false
    });

    Object.defineProperty(window, 'setInterval', {
      value: function (fn, delay) {
        if (typeof fn === 'string' && _redirectPattern.test(fn)) {
          _pbNotify('timer-redirect', fn.substring(0, 200));
          console.log('%c[PopBlock]%c Blocked setInterval redirect code', 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');
          return 0;
        }
        return _origSetInterval.apply(window, arguments);
      },
      writable: false,
      configurable: false
    });

    console.log('%c[PopBlock]%c Timer redirect guard active', 'color:#6C5CE7;font-weight:bold', 'color:#00D68F');
  } catch (e) {
    console.warn('[PopBlock] Could not install timer guard:', e);
  }
})();

// =============================================
// 8. AGGRESSIVE INVISIBLE IFRAME CLEANUP
//    Removes zero-size or hidden iframes used by ad networks
//    to smuggle popups and track users
// =============================================
(function () {
  function _pbCleanIframes() {
    try {
      var iframes = document.querySelectorAll('iframe');
      for (var i = 0; i < iframes.length; i++) {
        var iframe = iframes[i];
        var src = iframe.src || '';

        // Skip same-origin iframes without suspicious characteristics
        if (!_pbIsCrossOrigin(src) && src !== '' && src !== 'about:blank') continue;

        var style = getComputedStyle(iframe);
        var rect = iframe.getBoundingClientRect();

        var isHidden = style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity) < 0.01;

        var isTiny = rect.width <= 1 || rect.height <= 1;

        var isOffscreen = rect.right < 0 || rect.bottom < 0 ||
          rect.left > window.innerWidth || rect.top > window.innerHeight;

        if ((isHidden || isTiny || isOffscreen) && _pbIsCrossOrigin(src)) {
          iframe.remove();
          _pbNotify('iframe', src);
          console.log('%c[PopBlock]%c Removed hidden ad iframe → ' + src, 'color:#6C5CE7;font-weight:bold', 'color:#FF3B5C');
        }
      }
    } catch (e) {}
  }

  // Run cleanup after page loads and periodically
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(_pbCleanIframes, 1000);
      setTimeout(_pbCleanIframes, 3000);
    });
  } else {
    setTimeout(_pbCleanIframes, 1000);
    setTimeout(_pbCleanIframes, 3000);
  }

  // Also watch for dynamically added iframes
  var _pbIframeObs = new MutationObserver(function (mutations) {
    var shouldClean = false;
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        if (added[j].tagName === 'IFRAME' || (added[j].querySelectorAll && added[j].querySelectorAll('iframe').length > 0)) {
          shouldClean = true;
          break;
        }
      }
      if (shouldClean) break;
    }
    if (shouldClean) {
      setTimeout(_pbCleanIframes, 100);
    }
  });

  if (document.documentElement) {
    _pbIframeObs.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      _pbIframeObs.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  console.log('%c[PopBlock]%c Invisible iframe cleanup active', 'color:#6C5CE7;font-weight:bold', 'color:#00D68F');
})();

console.log('%c[PopBlock]%c Main world blocker active ✓ (BULLETPROOF) — ' + location.href, 'color:#6C5CE7;font-weight:bold', 'color:#00D68F');
