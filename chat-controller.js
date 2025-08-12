/**
 * Chat Controller
 * Manages chat lifecycle operations and business logic
 * 
 * Features:
 * - Chat creation, loading, and deletion
 * - Chat search and filtering
 * - Chat title management
 * - Integration with storage and UI through events
 * 
 * @class ChatController
 */
class ChatController {
  /**
   * Initialize chat controller
   * @param {EventBus} eventBus - Event bus for communication
   * @param {StorageManager} storageManager - Storage manager instance
   * @constructor
   */
  constructor(eventBus, storageManager) {
    /** @type {EventBus} Event bus instance */
    this.eventBus = eventBus;
    
    /** @type {StorageManager} Storage manager instance */
    this.storageManager = storageManager;
    
    /** @type {Map<number, Chat>} Map of all chats */
    this.chats = new Map();
    
    /** @type {number} Next available chat ID */
    this.nextChatId = 1;
    
    /** @type {number|null} Currently active chat ID */
    this.currentChatId = null;

    this.setupEventListeners();
  }

  /**
   * Set up event listeners for chat-related events
   */
  setupEventListeners() {
    this.eventBus.on(EventTypes.CHAT_CREATED, this.handleChatCreated.bind(this));
    this.eventBus.on(EventTypes.CHAT_DELETED, this.handleChatDeleted.bind(this));
    this.eventBus.on(EventTypes.CHAT_RENAMED, this.handleChatRenamed.bind(this));
    this.eventBus.on(EventTypes.CHAT_SEARCH, this.handleChatSearch.bind(this));
    this.eventBus.on(EventTypes.STORAGE_LOADED, this.handleStorageLoaded.bind(this));
  }

  /**
   * Initialize chats from storage data
   * @param {Object} data - Storage data
   */
  async initializeFromStorage(data) {
    try {
      console.log('[ChatController] Initializing from storage:', data);
      
      // Always create new Map and properly instantiate Chat objects
      this.chats = new Map();
      
      if (data.chats) {
        // Handle both Map and plain object storage formats
        const chatsData = data.chats instanceof Map ? Object.fromEntries(data.chats) : data.chats;
        
        for (const [chatId, chatData] of Object.entries(chatsData)) {
          
          let chatInstance;
          if (chatData instanceof Chat) {
            // Already a Chat instance
            chatInstance = chatData;
          } else {
            // Create new Chat instance from plain object
            chatInstance = Chat.fromJSON(chatData, this.eventBus);
          }
          
          // Validate the instance was created correctly
          if (!(chatInstance instanceof Chat)) {
            console.error(`[ChatController] Failed to create Chat instance for ID ${chatId}`);
            continue;
          }
          
          console.log(`[ChatController] Created Chat instance:`, chatInstance);
          console.log(`[ChatController] Chat instance constructor:`, chatInstance.constructor.name);
          console.log(`[ChatController] Chat has addMessage:`, typeof chatInstance.addMessage);
          
          this.chats.set(parseInt(chatId), chatInstance);
        }
      }
      
      this.nextChatId = data.nextChatId || this.calculateNextChatId();
      this.currentChatId = data.currentChatId || null;

      // Emit initialization complete event
      this.eventBus.emit(EventTypes.CHAT_LOADED, {
        type: 'initialized',
        chatCount: this.chats.size,
        currentChatId: this.currentChatId
      });

      console.log(`[ChatController] Initialized with ${this.chats.size} chats`);
    } catch (error) {
      console.error('[ChatController] Error initializing from storage:', error);
      this.eventBus.emit(EventTypes.APP_ERROR, {
        type: 'chatInitialization',
        error: error.message
      });
    }
  }

  /**
   * Calculate next available chat ID
   * @returns {number} Next chat ID
   */
  calculateNextChatId() {
    if (this.chats.size === 0) {
      return 1;
    }
    return Math.max(...this.chats.keys()) + 1;
  }

  /**
   * Create a new empty chat
   * @param {Object} options - Chat creation options
   * @returns {Chat} Created chat
   */
  createNewChat(options = {}) {
    const emptyChatId = this.findEmptyChat();
    if (emptyChatId && !options.forceNew) {
      // Switch to existing empty chat
      return this.loadChat(emptyChatId);
    }

    const chatData = {
      id: this.nextChatId++,
      title: options.title || 'New Chat',
      messages: [],
      lastActivity: new Date().toISOString(),
      sourceUrl: options.sourceUrl || null
    };

    const newChat = new Chat(chatData, this.eventBus);
    this.chats.set(newChat.id, newChat);
    
    // Emit chat created event
    this.eventBus.emit(EventTypes.CHAT_CREATED, {
      chat: newChat,
      totalChats: this.chats.size
    });

    // Auto-load the new chat
    this.loadChat(newChat.id);
    this.saveToStorage();

    console.log(`[ChatController] Created new chat with ID ${newChat.id}`);
    return newChat;
  }

  /**
   * Create new chat with pre-filled text from context menu
   * @param {string} text - Text to pre-fill
   * @param {string} source - Source URL
   * @returns {Chat} Created chat
   */
  createNewChatWithText(text, source = null) {
    const emptyChatId = this.findEmptyChat();
    let chat;

    if (emptyChatId) {
      // Use existing empty chat
      chat = this.chats.get(emptyChatId);
      if (source) {
        chat.title = this.extractDomainFromUrl(source);
        chat.sourceUrl = source;
      }
    } else {
      // Create new chat
      const title = source ? this.extractDomainFromUrl(source) : 'New Chat';
      chat = this.createNewChat({
        title,
        sourceUrl: source,
        forceNew: true
      });
    }

    // Emit text pre-fill event
    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'preFillInput',
      data: { text, source }
    });

    this.loadChat(chat.id);
    this.saveToStorage();

    return chat;
  }

  /**
   * Load specific chat by ID
   * @param {number} chatId - Chat ID to load
   * @returns {Chat|null} Loaded chat or null if not found
   */
  loadChat(chatId) {
    const chat = this.chats.get(chatId);
    if (!chat) {
      console.warn(`[ChatController] Chat ${chatId} not found`);
      return null;
    }

    this.currentChatId = chatId;
    
    // Emit chat loaded event
    this.eventBus.emit(EventTypes.CHAT_LOADED, {
      type: 'chatSelected',
      chat: chat,
      chatId: chatId
    });

    // Emit UI update events
    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'renderMessages',
      chat: chat
    });
    
    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'updateChatHistory',
      filteredChats: null
    });

    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'updateChatHeader',
      chat: chat
    });

    this.eventBus.emit(EventTypes.UI_CLEAR, {
      type: 'input'
    });

    this.saveToStorage();
    return chat;
  }

  /**
   * Delete chat by ID
   * @param {number} chatId - Chat ID to delete
   * @returns {boolean} Whether chat was deleted
   */
  deleteChat(chatId) {
    const chat = this.chats.get(chatId);
    if (!chat) {
      return false;
    }

    // Confirm deletion
    const confirmed = confirm(`Delete chat "${chat.title}"?`);
    if (!confirmed) {
      return false;
    }

    this.chats.delete(chatId);

    // If deleted chat was current, load another chat
    if (this.currentChatId === chatId) {
      const remainingChats = Array.from(this.chats.keys());
      if (remainingChats.length > 0) {
        this.loadChat(remainingChats[0]);
      } else {
        this.currentChatId = null;
        this.createNewChat();
      }
    }

    // Emit deletion events
    this.eventBus.emit(EventTypes.CHAT_DELETED, {
      chatId,
      chat,
      remainingChats: this.chats.size
    });

    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'updateChatHistory'
    });

    this.saveToStorage();
    console.log(`[ChatController] Deleted chat ${chatId}`);
    return true;
  }

  /**
   * Rename chat
   * @param {number} chatId - Chat ID to rename
   * @param {string} newTitle - New title (if not provided, prompts user)
   * @returns {boolean} Whether chat was renamed
   */
  renameChat(chatId, newTitle = null) {
    const chat = this.chats.get(chatId);
    if (!chat) {
      return false;
    }

    const title = newTitle || prompt('Enter new chat name:', chat.title);
    if (!title || !title.trim() || title.trim() === chat.title) {
      return false;
    }

    const oldTitle = chat.title;
    chat.title = title.trim();

    // Emit rename event
    this.eventBus.emit(EventTypes.CHAT_RENAMED, {
      chatId,
      oldTitle,
      newTitle: chat.title,
      chat
    });

    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'updateChatHistory'
    });

    this.saveToStorage();
    console.log(`[ChatController] Renamed chat ${chatId} from "${oldTitle}" to "${chat.title}"`);
    return true;
  }

  /**
   * Search chats by title and content
   * @param {string} query - Search query
   * @returns {Array<Chat>} Matching chats
   */
  searchChats(query) {
    if (!query || !query.trim()) {
      return Array.from(this.chats.values());
    }

    const searchTerm = query.toLowerCase();
    const results = Array.from(this.chats.values()).filter(chat =>
      chat.title.toLowerCase().includes(searchTerm) ||
      chat.searchMessages(searchTerm).length > 0
    );

    // Emit search event
    this.eventBus.emit(EventTypes.CHAT_SEARCH, {
      query: searchTerm,
      results,
      totalResults: results.length
    });

    return results;
  }

  /**
   * Get chat by ID
   * @param {number} chatId - Chat ID
   * @returns {Chat|null} Chat or null if not found
   */
  getChat(chatId) {
    return this.chats.get(chatId) || null;
  }

  /**
   * Get current active chat
   * @returns {Chat|null} Current chat or null
   */
  getCurrentChat() {
    return this.currentChatId ? this.chats.get(this.currentChatId) : null;
  }

  /**
   * Get all chats
   * @returns {Map<number, Chat>} All chats
   */
  getAllChats() {
    return new Map(this.chats);
  }

  /**
   * Find empty chat (no messages)
   * @returns {number|null} Chat ID or null if none found
   */
  findEmptyChat() {
    for (const [chatId, chat] of this.chats) {
      if (chat.isEmpty()) {
        return chatId;
      }
    }
    return null;
  }

  /**
   * Get sorted chats by last activity
   * @returns {Array<Chat>} Sorted chats
   */
  getSortedChats() {
    return Array.from(this.chats.values()).sort((a, b) => {
      const aTime = new Date(a.lastActivity);
      const bTime = new Date(b.lastActivity);
      return bTime - aTime; // Most recent first
    });
  }

  /**
   * Extract domain from URL for chat naming
   * @param {string} url - URL to extract domain from
   * @returns {string} Domain name
   */
  extractDomainFromUrl(url) {
    try {
      return new URL(url).hostname.replace('www.', '') || 'Unknown Source';
    } catch (error) {
      console.warn('[ChatController] Error extracting domain:', error);
      return 'Unknown Source';
    }
  }

  /**
   * Save current state to storage
   */
  async saveToStorage() {
    try {
      await this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
    } catch (error) {
      console.error('[ChatController] Error saving to storage:', error);
      this.eventBus.emit(EventTypes.STORAGE_ERROR, {
        operation: 'save',
        error: error.message
      });
    }
  }

  /**
   * Force immediate save to storage
   */
  async forceSave() {
    try {
      await this.storageManager.forceSave(this.chats, this.nextChatId, this.currentChatId);
    } catch (error) {
      console.error('[ChatController] Error force saving:', error);
      this.eventBus.emit(EventTypes.STORAGE_ERROR, {
        operation: 'forceSave',
        error: error.message
      });
    }
  }

  /**
   * Event handlers
   */
  handleChatCreated(data) {
    console.log(`[ChatController] Chat created: ${data.chat.id}`);
  }

  handleChatDeleted(data) {
    console.log(`[ChatController] Chat deleted: ${data.chatId}`);
  }

  handleChatRenamed(data) {
    console.log(`[ChatController] Chat renamed: ${data.chatId}`);
  }

  handleChatSearch(data) {
    // Emit UI update for search results
    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'updateChatHistory',
      filteredChats: data.results
    });
  }

  handleStorageLoaded(data) {
    if (data.type === 'initialized') {
      this.initializeFromStorage(data.data);
    }
  }

  /**
   * Get diagnostic information
   * @returns {Object} Diagnostic data
   */
  getDiagnostics() {
    return {
      totalChats: this.chats.size,
      currentChatId: this.currentChatId,
      nextChatId: this.nextChatId,
      emptyChats: Array.from(this.chats.values()).filter(chat => chat.isEmpty()).length,
      totalMessages: Array.from(this.chats.values()).reduce((total, chat) => total + chat.getMessageCount(), 0)
    };
  }

  /**
   * Clean up chat controller
   */
  cleanup() {
    // Force save before cleanup
    this.forceSave();
    
    // Clear data
    this.chats.clear();
    this.currentChatId = null;
    
    console.log('[ChatController] Cleanup completed');
  }
}