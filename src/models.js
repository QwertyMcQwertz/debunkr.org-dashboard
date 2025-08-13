/**
 * Domain Models for the Chat Application
 * Rich domain objects with behavior and validation
 * 
 * Features:
 * - Rich domain behavior instead of anemic data structures
 * - Input validation and sanitization
 * - Event emission for state changes
 * - Immutable operations where appropriate
 * 
 * @file models.js
 */

/**
 * Message Model
 * Represents a single message in a chat conversation
 * 
 * @class Message
 */
class Message {
  /**
   * Create a new message
   * @param {Object} data - Message data
   * @param {string} data.content - Message content
   * @param {string} data.type - Message type ('user' or 'assistant')
   * @param {Array} data.images - Optional image attachments
   * @param {Object} options - Additional options
   */
  constructor(data, options = {}) {
    // Validate required fields
    if (!data.content && (!data.images || data.images.length === 0)) {
      throw new Error('Message must have content or images');
    }
    
    if (!data.type || !['user', 'assistant'].includes(data.type)) {
      throw new Error('Message type must be "user" or "assistant"');
    }

    /** @type {string} Unique message identifier */
    this.id = data.id || this.generateId();
    
    /** @type {string} Message content */
    this.content = this.sanitizeContent(data.content || '[Image]');
    
    /** @type {string} Message type */
    this.type = data.type;
    
    /** @type {string} ISO timestamp */
    this.timestamp = data.timestamp || new Date().toISOString();
    
    /** @type {Array<Object>} Image attachments */
    this.images = this.validateImages(data.images || []);
    
    /** @type {boolean} Whether message is loading */
    this.isLoading = Boolean(data.isLoading);
    
    /** @type {boolean} Whether message is an error */
    this.isError = Boolean(data.isError);
    
    /** @type {Object} Additional metadata */
    this.metadata = data.metadata || {};

    // Freeze the object to prevent accidental mutations
    if (options.freeze !== false) {
      Object.freeze(this);
    }
  }

  /**
   * Generate unique message ID
   * @returns {string} Unique identifier
   */
  generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize message content
   * @param {string} content - Raw content
   * @returns {string} Sanitized content
   */
  sanitizeContent(content) {
    if (typeof content !== 'string') {
      return String(content || '');
    }

    // Limit content length
    if (content.length > 50000) {
      console.warn('[Message] Content too long, truncating');
      return content.substring(0, 50000) + '... [truncated]';
    }

    return content.trim();
  }

  /**
   * Validate image attachments
   * @param {Array} images - Image array to validate
   * @returns {Array} Validated images
   */
  validateImages(images) {
    if (!Array.isArray(images)) {
      return [];
    }

    return images.filter(image => {
      if (!image || typeof image !== 'object') {
        return false;
      }
      
      // Validate required image properties
      if (!image.data || !image.fileName) {
        console.warn('[Message] Invalid image missing data or fileName');
        return false;
      }

      // Validate data URL format
      if (typeof image.data !== 'string' || !image.data.startsWith('data:image/')) {
        console.warn('[Message] Invalid image data format');
        return false;
      }

      return true;
    });
  }

  /**
   * Check if message has images
   * @returns {boolean} Whether message has valid images
   */
  hasImages() {
    return this.images && this.images.length > 0;
  }

  /**
   * Check if message is from user
   * @returns {boolean} Whether message is from user
   */
  isFromUser() {
    return this.type === 'user';
  }

  /**
   * Check if message is from assistant
   * @returns {boolean} Whether message is from assistant
   */
  isFromAssistant() {
    return this.type === 'assistant';
  }

  /**
   * Get message preview for UI display
   * @param {number} maxLength - Maximum preview length
   * @returns {string} Preview text
   */
  getPreview(maxLength = 50) {
    if (this.hasImages() && !this.content) {
      return '[Image]';
    }
    
    const preview = this.content.length > maxLength 
      ? this.content.substring(0, maxLength) + '...' 
      : this.content;
    
    return preview;
  }

  /**
   * Create a copy of the message with updates
   * @param {Object} updates - Properties to update
   * @returns {Message} New message instance
   */
  update(updates) {
    return new Message({
      id: this.id,
      content: this.content,
      type: this.type,
      timestamp: this.timestamp,
      images: this.images,
      isLoading: this.isLoading,
      isError: this.isError,
      metadata: this.metadata,
      ...updates
    });
  }

  /**
   * Convert message to plain object for storage
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      content: this.content,
      type: this.type,
      timestamp: this.timestamp,
      images: this.images,
      isLoading: this.isLoading,
      isError: this.isError,
      metadata: this.metadata
    };
  }

  /**
   * Create message from plain object
   * @param {Object} data - Plain object data
   * @returns {Message} Message instance
   */
  static fromJSON(data) {
    return new Message(data);
  }
}

/**
 * Chat Model
 * Represents a chat conversation with messages and metadata
 * 
 * @class Chat
 */
class Chat {
  /**
   * Create a new chat
   * @param {Object} data - Chat data
   * @param {EventBus} eventBus - Event bus for state changes
   */
  constructor(data, eventBus = null) {
    // Validate required fields
    if (!data.id && data.id !== 0) {
      throw new Error('Chat must have an ID');
    }

    /** @type {EventBus} Event bus for emitting changes */
    this.eventBus = eventBus;
    
    /** @type {number} Unique chat identifier */
    this.id = data.id;
    
    /** @type {string} Chat title */
    this._title = this.sanitizeTitle(data.title || 'New Chat');
    
    /** @type {Array<Message>} Chat messages */
    this._messages = this.initializeMessages(data.messages || []);
    
    /** @type {string} ISO timestamp of last activity */
    this._lastActivity = data.lastActivity || new Date().toISOString();
    
    /** @type {string} Source URL if chat originated from web content */
    this.sourceUrl = data.sourceUrl || null;
    
    /** @type {string} Most recent source URL */
    this.lastSourceUrl = data.lastSourceUrl || null;
    
    /** @type {Object} Additional metadata */
    this.metadata = data.metadata || {};
  }

  /**
   * Initialize messages array from raw data
   * @param {Array} messagesData - Raw message data
   * @returns {Array<Message>} Array of Message instances
   */
  initializeMessages(messagesData) {
    if (!Array.isArray(messagesData)) {
      return [];
    }

    return messagesData.map(msgData => {
      // If already a Message instance, return as-is
      if (msgData instanceof Message) {
        return msgData;
      }
      // Otherwise create new Message instance
      return new Message(msgData);
    });
  }

  /**
   * Sanitize chat title
   * @param {string} title - Raw title
   * @returns {string} Sanitized title
   */
  sanitizeTitle(title) {
    if (typeof title !== 'string') {
      return 'New Chat';
    }

    // Limit title length and sanitize
    const sanitized = title.trim().substring(0, 100);
    return sanitized || 'New Chat';
  }

  /**
   * Get all messages
   * @returns {Array<Message>} Array of messages
   */
  getMessages() {
    return [...this._messages]; // Return copy to prevent external modifications
  }

  /**
   * Get chat title
   * @returns {string} Chat title
   */
  get title() {
    return this._title;
  }

  /**
   * Set chat title with validation
   * @param {string} newTitle - New title
   */
  set title(newTitle) {
    const sanitizedTitle = this.sanitizeTitle(newTitle);
    if (sanitizedTitle !== this._title) {
      this._title = sanitizedTitle;
      this.updateActivity();
      this.emitChange('titleUpdated', { title: this._title });
    }
  }

  /**
   * Get chat messages
   * @returns {Array<Message>} Array of messages
   */
  get messages() {
    return [...this._messages]; // Return copy to prevent direct mutation
  }

  /**
   * Get last activity timestamp
   * @returns {string} ISO timestamp
   */
  get lastActivity() {
    return this._lastActivity;
  }

  /**
   * Add message to chat
   * @param {string|Object|Message} content - Message content or message object
   * @param {string} type - Message type ('user' or 'assistant')
   * @param {Array} images - Optional image attachments
   * @param {Object} options - Additional message options (isLoading, isError, etc.)
   * @returns {Message} Created message
   */
  addMessage(content, type = 'user', images = [], options = {}) {
    let message;

    if (content instanceof Message) {
      message = content;
    } else if (typeof content === 'object') {
      message = new Message(content, { freeze: false });
    } else {
      message = new Message({
        content: String(content),
        type,
        images,
        ...options  // Include additional options like isLoading, isError
      }, { freeze: false }); // Don't freeze messages that need state updates
    }

    this._messages.push(message);
    this.updateActivity();
    
    // Update title for first message if it's still default
    if (this._messages.length === 1 && this._title === 'New Chat') {
      this.generateTitleFromMessage(message);
    }

    this.emitChange('messageAdded', { message, totalMessages: this._messages.length });
    
    return message;
  }

  /**
   * Remove message from chat
   * @param {string} messageId - ID of message to remove
   * @returns {boolean} Whether message was found and removed
   */
  removeMessage(messageId) {
    const index = this._messages.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      const removedMessage = this._messages.splice(index, 1)[0];
      this.updateActivity();
      this.emitChange('messageRemoved', { 
        message: removedMessage, 
        totalMessages: this._messages.length 
      });
      return true;
    }
    return false;
  }

  /**
   * Update existing message
   * @param {string} messageId - ID of message to update
   * @param {Object} updates - Properties to update
   * @returns {boolean} Whether message was found and updated
   */
  updateMessage(messageId, updates) {
    const index = this._messages.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      const oldMessage = this._messages[index];
      this._messages[index] = oldMessage.update(updates);
      this.updateActivity();
      this.emitChange('messageUpdated', { 
        oldMessage, 
        newMessage: this._messages[index] 
      });
      return true;
    }
    return false;
  }

  /**
   * Get message by ID
   * @param {string} messageId - Message ID to find
   * @returns {Message|null} Found message or null
   */
  getMessage(messageId) {
    return this._messages.find(msg => msg.id === messageId) || null;
  }

  /**
   * Get last message in chat
   * @returns {Message|null} Last message or null if empty
   */
  getLastMessage() {
    return this._messages.length > 0 ? this._messages[this._messages.length - 1] : null;
  }

  /**
   * Check if chat is empty
   * @returns {boolean} Whether chat has no messages
   */
  isEmpty() {
    return this._messages.length === 0;
  }

  /**
   * Get message count
   * @returns {number} Number of messages
   */
  getMessageCount() {
    return this._messages.length;
  }

  /**
   * Generate title from first message content
   * @param {Message} message - Message to generate title from
   */
  generateTitleFromMessage(message) {
    if (!message.content || message.content === '[Image]') {
      if (message.hasImages()) {
        this._title = 'Image message';
      }
      return;
    }

    // Extract meaningful content for title
    let titleText = message.content;
    
    // Handle quoted text pattern
    const quoteMatch = message.content.match(/^"(.+?)"\n\n(.+)?$/s);
    if (quoteMatch) {
      titleText = quoteMatch[2] || quoteMatch[1];
    }

    // Limit title length
    this._title = titleText.length > 30 ? titleText.substring(0, 30) + '...' : titleText;
    
    this.emitChange('titleGenerated', { title: this._title });
  }

  /**
   * Search messages for content
   * @param {string} query - Search query
   * @returns {Array<Message>} Matching messages
   */
  searchMessages(query) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    const searchTerm = query.toLowerCase();
    return this._messages.filter(message => 
      message.content.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Update last activity timestamp
   */
  updateActivity() {
    this._lastActivity = new Date().toISOString();
  }

  /**
   * Emit change event if event bus is available
   * @param {string} changeType - Type of change
   * @param {Object} data - Change data
   */
  emitChange(changeType, data) {
    if (this.eventBus) {
      this.eventBus.emit(EventTypes.CHAT_UPDATED, {
        chatId: this.id,
        changeType,
        data
      });
    }
  }

  /**
   * Convert chat to plain object for storage
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      title: this._title,
      messages: this._messages.map(msg => msg.toJSON()),
      lastActivity: this._lastActivity,
      sourceUrl: this.sourceUrl,
      lastSourceUrl: this.lastSourceUrl,
      metadata: this.metadata
    };
  }

  /**
   * Create chat from plain object
   * @param {Object} data - Plain object data
   * @param {EventBus} eventBus - Event bus instance
   * @returns {Chat} Chat instance
   */
  static fromJSON(data, eventBus = null) {
    return new Chat(data, eventBus);
  }
}