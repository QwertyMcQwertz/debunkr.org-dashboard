/**
 * Event Bus for Decoupled Communication
 * Provides publish-subscribe pattern for loosely coupled component communication
 * 
 * Features:
 * - Type-safe event registration and emission
 * - Event listener cleanup and memory management
 * - Debug logging for development
 * - Wildcard event matching
 * 
 * @class EventBus
 */
class EventBus {
  /**
   * Initialize the event bus
   * @constructor
   */
  constructor() {
    /** @type {Map<string, Set<Function>>} Event listeners organized by event type */
    this.listeners = new Map();
    /** @type {boolean} Enable debug logging */
    this.debug = false;
    /** @type {Set<string>} Track all registered event types for cleanup */
    this.eventTypes = new Set();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name to listen for
   * @param {Function} callback - Function to call when event is emitted
   * @param {Object} options - Subscription options
   * @param {boolean} options.once - Remove listener after first execution
   * @returns {Function} Unsubscribe function
   */
  on(event, callback, options = {}) {
    if (typeof event !== 'string' || typeof callback !== 'function') {
      throw new Error('EventBus.on requires event string and callback function');
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    // Wrap callback for 'once' functionality
    const wrappedCallback = options.once 
      ? (...args) => {
          callback(...args);
          this.off(event, wrappedCallback);
        }
      : callback;

    this.listeners.get(event).add(wrappedCallback);
    this.eventTypes.add(event);

    if (this.debug) {
      console.log(`[EventBus] Subscribed to '${event}' (${this.listeners.get(event).size} listeners)`);
    }

    // Return unsubscribe function
    return () => this.off(event, wrappedCallback);
  }

  /**
   * Subscribe to an event that fires only once
   * @param {string} event - Event name to listen for
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    return this.on(event, callback, { once: true });
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name to stop listening to
   * @param {Function} callback - Specific callback to remove
   */
  off(event, callback) {
    if (!this.listeners.has(event)) {
      return;
    }

    const eventListeners = this.listeners.get(event);
    eventListeners.delete(callback);

    // Clean up empty event sets
    if (eventListeners.size === 0) {
      this.listeners.delete(event);
      this.eventTypes.delete(event);
    }

    if (this.debug) {
      console.log(`[EventBus] Unsubscribed from '${event}' (${eventListeners.size} listeners remaining)`);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name to emit
   * @param {*} data - Data to pass to event listeners
   * @returns {number} Number of listeners that received the event
   */
  emit(event, data) {
    if (!this.listeners.has(event)) {
      if (this.debug) {
        console.log(`[EventBus] No listeners for '${event}'`);
      }
      return 0;
    }

    const eventListeners = this.listeners.get(event);
    let successCount = 0;

    for (const callback of eventListeners) {
      try {
        callback(data, event);
        successCount++;
      } catch (error) {
        console.error(`[EventBus] Error in event listener for '${event}':`, error);
        // Continue executing other listeners despite errors
      }
    }

    if (this.debug) {
      console.log(`[EventBus] Emitted '${event}' to ${successCount} listeners`, data);
    }

    return successCount;
  }

  /**
   * Emit an event asynchronously to all subscribers
   * @param {string} event - Event name to emit
   * @param {*} data - Data to pass to event listeners
   * @returns {Promise<number>} Promise resolving to number of successful listeners
   */
  async emitAsync(event, data) {
    if (!this.listeners.has(event)) {
      if (this.debug) {
        console.log(`[EventBus] No listeners for '${event}'`);
      }
      return 0;
    }

    const eventListeners = this.listeners.get(event);
    const promises = Array.from(eventListeners).map(async (callback) => {
      try {
        await callback(data, event);
        return true;
      } catch (error) {
        console.error(`[EventBus] Error in async event listener for '${event}':`, error);
        return false;
      }
    });

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length;

    if (this.debug) {
      console.log(`[EventBus] Emitted async '${event}' to ${successCount} listeners`, data);
    }

    return successCount;
  }

  /**
   * Remove all listeners for a specific event
   * @param {string} event - Event name to clear
   */
  clearEvent(event) {
    if (this.listeners.has(event)) {
      this.listeners.delete(event);
      this.eventTypes.delete(event);
      
      if (this.debug) {
        console.log(`[EventBus] Cleared all listeners for '${event}'`);
      }
    }
  }

  /**
   * Remove all event listeners and clean up
   */
  clearAll() {
    const eventCount = this.listeners.size;
    this.listeners.clear();
    this.eventTypes.clear();
    
    if (this.debug) {
      console.log(`[EventBus] Cleared all ${eventCount} event types`);
    }
  }

  /**
   * Get count of listeners for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  getListenerCount(event) {
    return this.listeners.has(event) ? this.listeners.get(event).size : 0;
  }

  /**
   * Get all registered event types
   * @returns {string[]} Array of event names
   */
  getEventTypes() {
    return Array.from(this.eventTypes);
  }

  /**
   * Enable or disable debug logging
   * @param {boolean} enabled - Whether to enable debug logging
   */
  setDebug(enabled) {
    this.debug = Boolean(enabled);
    console.log(`[EventBus] Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get diagnostic information about the event bus
   * @returns {Object} Diagnostic data
   */
  getDiagnostics() {
    const diagnostics = {
      totalEvents: this.eventTypes.size,
      totalListeners: 0,
      events: {}
    };

    for (const event of this.eventTypes) {
      const listenerCount = this.getListenerCount(event);
      diagnostics.events[event] = listenerCount;
      diagnostics.totalListeners += listenerCount;
    }

    return diagnostics;
  }
}

// Predefined event constants to prevent typos and improve maintainability
const EventTypes = {
  // Chat Events
  CHAT_CREATED: 'chat:created',
  CHAT_LOADED: 'chat:loaded',
  CHAT_DELETED: 'chat:deleted',
  CHAT_RENAMED: 'chat:renamed',
  CHAT_SEARCH: 'chat:search',
  CHAT_UPDATED: 'chat:updated',

  // Message Events  
  MESSAGE_SENT: 'message:sent',
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_ERROR: 'message:error',
  MESSAGE_LOADING: 'message:loading',

  // UI Events
  UI_UPDATE: 'ui:update',
  UI_FOCUS: 'ui:focus',
  UI_CLEAR: 'ui:clear',
  UI_SCROLL: 'ui:scroll',
  UI_SIDEBAR_TOGGLE: 'ui:sidebar:toggle',

  // Settings Events
  SETTINGS_OPENED: 'settings:opened',
  SETTINGS_SAVED: 'settings:saved',
  SETTINGS_ERROR: 'settings:error',
  SETTINGS_TEST: 'settings:test',

  // Image Events
  IMAGE_ADDED: 'image:added',
  IMAGE_REMOVED: 'image:removed',
  IMAGE_ERROR: 'image:error',
  IMAGE_COMPRESSED: 'image:compressed',

  // Storage Events
  STORAGE_SAVED: 'storage:saved',
  STORAGE_LOADED: 'storage:loaded',
  STORAGE_ERROR: 'storage:error',

  // API Events
  API_REQUEST_START: 'api:request:start',
  API_REQUEST_SUCCESS: 'api:request:success', 
  API_REQUEST_ERROR: 'api:request:error',
  API_REQUEST_TIMEOUT: 'api:request:timeout',

  // Cache Events
  CACHE_CLEAR: 'cache:clear',

  // Application Events
  APP_READY: 'app:ready',
  APP_CLEANUP: 'app:cleanup',
  APP_ERROR: 'app:error'
};

// Export both the class and event constants
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EventBus, EventTypes };
} else if (typeof window !== 'undefined') {
  window.EventBus = EventBus;
  window.EventTypes = EventTypes;
}