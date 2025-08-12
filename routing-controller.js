/**
 * Routing Controller
 * Handles URL parameter parsing and routing logic for context menu integration
 * 
 * Features:
 * - URL parameter validation and sanitization
 * - Context menu action routing
 * - Text and source URL processing
 * - Chat ID validation
 * 
 * @class RoutingController
 */
class RoutingController {
  /**
   * Initialize routing controller
   * @param {EventBus} eventBus - Event bus for communication
   * @constructor
   */
  constructor(eventBus) {
    /** @type {EventBus} Event bus instance */
    this.eventBus = eventBus;
    /** @type {string|null} Parsed action from URL */
    this.urlAction = null;
    /** @type {string|null} Pending text from context menu */
    this.pendingText = null;
    /** @type {string|null} Source URL from context menu */
    this.pendingSource = null;
    /** @type {number|null} Target chat ID for continuation */
    this.targetChatId = null;
  }

  /**
   * Parse and validate URL parameters for context menu integration
   * @returns {Object} Parsed routing data
   */
  initializeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const text = urlParams.get('text');
    const source = urlParams.get('source');
    const chatId = urlParams.get('chatId');

    // Validate and sanitize action parameter
    const validActions = ['newChat', 'selectChat', 'continueChat'];
    this.urlAction = validActions.includes(action) ? action : null;

    // Validate and sanitize text parameter
    if (text) {
      try {
        const decodedText = decodeURIComponent(text);
        // Limit text length to prevent DoS
        if (decodedText.length > 10000) {
          console.warn('[RoutingController] Text parameter too long, truncating');
          this.pendingText = decodedText.substring(0, 10000);
        } else {
          this.pendingText = decodedText;
        }
      } catch (error) {
        console.warn('[RoutingController] Invalid text parameter encoding:', error);
        this.pendingText = null;
      }
    }

    // Validate and sanitize source URL parameter
    if (source) {
      try {
        const decodedSource = decodeURIComponent(source);
        // Validate URL format and protocol
        const url = new URL(decodedSource);
        if (['http:', 'https:'].includes(url.protocol)) {
          this.pendingSource = decodedSource;
        } else {
          console.warn('[RoutingController] Invalid source URL protocol:', url.protocol);
          this.pendingSource = null;
        }
      } catch (error) {
        console.warn('[RoutingController] Invalid source URL parameter:', error);
        this.pendingSource = null;
      }
    } else {
      this.pendingSource = null;
    }

    // Validate and sanitize chatId parameter
    if (chatId) {
      const parsedChatId = parseInt(chatId, 10);
      if (!isNaN(parsedChatId) && parsedChatId > 0 && parsedChatId < Number.MAX_SAFE_INTEGER) {
        this.targetChatId = parsedChatId;
      } else {
        console.warn('[RoutingController] Invalid chatId parameter:', chatId);
        this.targetChatId = null;
      }
    } else {
      this.targetChatId = null;
    }

    const routingData = {
      action: this.urlAction,
      text: this.pendingText,
      source: this.pendingSource,
      chatId: this.targetChatId
    };

    // Emit routing event
    this.eventBus.emit(EventTypes.APP_READY, {
      type: 'routing',
      data: routingData
    });

    return routingData;
  }

  /**
   * Process routing action based on parsed URL parameters
   * @param {Map} chats - Available chats map
   * @returns {Object} Routing decision
   */
  processRoutingAction(chats) {
    const routingDecision = {
      action: 'default',
      data: null
    };

    if (this.urlAction === 'newChat' && this.pendingText) {
      routingDecision.action = 'createNewChatWithText';
      routingDecision.data = {
        text: this.pendingText,
        source: this.pendingSource
      };
    } else if (this.urlAction === 'selectChat' && this.pendingText) {
      if (chats.size === 0) {
        routingDecision.action = 'createNewChatWithText';
        routingDecision.data = {
          text: this.pendingText,
          source: this.pendingSource
        };
      } else {
        routingDecision.action = 'showChatSelector';
        routingDecision.data = {
          text: this.pendingText,
          source: this.pendingSource
        };
      }
    } else if (this.urlAction === 'continueChat' && this.pendingText) {
      if (this.targetChatId && chats.has(this.targetChatId)) {
        routingDecision.action = 'continueChatFromContext';
        routingDecision.data = {
          chatId: this.targetChatId,
          text: this.pendingText,
          source: this.pendingSource
        };
      } else {
        routingDecision.action = 'createNewChatWithText';
        routingDecision.data = {
          text: this.pendingText,
          source: this.pendingSource
        };
      }
    } else {
      // Default behavior: load existing chat or create initial chat
      if (chats.size === 0) {
        routingDecision.action = 'createInitialChat';
      } else {
        routingDecision.action = 'loadDefaultChat';
      }
    }

    // Emit routing decision
    this.eventBus.emit(EventTypes.CHAT_LOADED, {
      type: 'routingDecision',
      decision: routingDecision
    });

    return routingDecision;
  }

  /**
   * Extract domain from URL for chat titling
   * @param {string} url - Full URL to extract domain from
   * @returns {string} Domain or fallback text
   */
  extractDomainFromUrl(url) {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain || 'Unknown Source';
    } catch (error) {
      console.warn('[RoutingController] Error extracting domain from URL:', error);
      return 'Unknown Source';
    }
  }

  /**
   * Get pending context menu data
   * @returns {Object} Context data
   */
  getPendingData() {
    return {
      action: this.urlAction,
      text: this.pendingText,
      source: this.pendingSource,
      chatId: this.targetChatId
    };
  }

  /**
   * Clear pending context menu data
   */
  clearPendingData() {
    this.urlAction = null;
    this.pendingText = null;
    this.pendingSource = null;
    this.targetChatId = null;

    // Emit clear event
    this.eventBus.emit(EventTypes.UI_CLEAR, {
      type: 'pendingData'
    });
  }

  /**
   * Check if there is pending context menu data
   * @returns {boolean} Whether there is pending data
   */
  hasPendingData() {
    return this.pendingText !== null || this.urlAction !== null;
  }

  /**
   * Validate URL format and safety
   * @param {string} url - URL to validate
   * @returns {boolean} Whether URL is valid and safe
   */
  isValidUrl(url) {
    try {
      const parsedUrl = new URL(url);
      // Only allow http and https protocols
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate chat title from context data
   * @returns {string} Suggested chat title
   */
  generateChatTitle() {
    if (this.pendingSource) {
      return this.extractDomainFromUrl(this.pendingSource);
    } else if (this.pendingText) {
      // Extract first few words from text
      const words = this.pendingText.trim().split(/\s+/).slice(0, 5);
      return words.join(' ') + (words.length === 5 ? '...' : '');
    }
    return 'New Chat';
  }

  /**
   * Clean up routing controller
   */
  cleanup() {
    this.clearPendingData();
    console.log('[RoutingController] Cleanup completed');
  }
}