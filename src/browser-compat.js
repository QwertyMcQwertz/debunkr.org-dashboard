/**
 * Cross-browser compatibility utility for WebExtensions
 * Provides a consistent API that works in both Chrome and Firefox
 */

// Detect browser type
const isFirefox = typeof browser !== 'undefined' && browser.runtime;
const isChrome = typeof chrome !== 'undefined' && chrome.runtime;

// Create a unified browser API object
const browserAPI = (() => {
  if (isFirefox) {
    // Firefox has native browser API
    return browser;
  } else if (isChrome) {
    // Chrome/Chromium browsers - use chrome API or polyfill if available
    if (typeof browser !== 'undefined') {
      // Polyfill is loaded
      return browser;
    } else {
      // Fallback to chrome API with promise wrapping for consistency
      const promisify = (fn) => (...args) => {
        return new Promise((resolve, reject) => {
          fn(...args, (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        });
      };

      return {
        runtime: {
          ...chrome.runtime,
          sendMessage: promisify(chrome.runtime.sendMessage.bind(chrome.runtime)),
          getURL: chrome.runtime.getURL.bind(chrome.runtime),
          onInstalled: chrome.runtime.onInstalled,
          onMessage: chrome.runtime.onMessage
        },
        tabs: {
          ...chrome.tabs,
          query: promisify(chrome.tabs.query.bind(chrome.tabs)),
          update: promisify(chrome.tabs.update.bind(chrome.tabs)),
          create: promisify(chrome.tabs.create.bind(chrome.tabs))
        },
        windows: {
          ...chrome.windows,
          update: promisify(chrome.windows.update.bind(chrome.windows))
        },
        storage: {
          local: {
            get: promisify(chrome.storage.local.get.bind(chrome.storage.local)),
            set: promisify(chrome.storage.local.set.bind(chrome.storage.local)),
            remove: promisify(chrome.storage.local.remove.bind(chrome.storage.local))
          },
          onChanged: chrome.storage.onChanged
        },
        contextMenus: {
          ...chrome.contextMenus,
          create: chrome.contextMenus.create.bind(chrome.contextMenus),
          removeAll: promisify(chrome.contextMenus.removeAll.bind(chrome.contextMenus)),
          onClicked: chrome.contextMenus.onClicked
        }
      };
    }
  } else {
    throw new Error('Unsupported browser environment');
  }
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { browserAPI, isFirefox, isChrome };
}

// Global assignment for direct script usage
if (typeof window !== 'undefined') {
  window.browserAPI = browserAPI;
  window.isFirefox = isFirefox;
  window.isChrome = isChrome;
} else {
  // For background scripts without window object
  if (typeof globalThis !== 'undefined') {
    globalThis.browserAPI = browserAPI;
    globalThis.isFirefox = isFirefox;
    globalThis.isChrome = isChrome;
  } else {
    // Fallback: assign to global scope
    self.browserAPI = browserAPI;
    self.isFirefox = isFirefox;
    self.isChrome = isChrome;
  }
}
