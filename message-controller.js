/**
 * Message Controller
 * Handles message operations, AI interactions, and message processing
 * 
 * Features:
 * - Message sending and receiving
 * - AI response handling with error recovery
 * - Image attachment processing
 * - Message state management (loading, error states)
 * - Integration with Poe API
 * 
 * @class MessageController
 */
class MessageController {
  /**
   * Initialize message controller
   * @param {EventBus} eventBus - Event bus for communication
   * @param {PoeClient} poeClient - Poe API client
   * @param {StorageManager} storageManager - Storage manager instance
   * @constructor
   */
  constructor(eventBus, poeClient, storageManager) {
    /** @type {EventBus} Event bus instance */
    this.eventBus = eventBus;
    
    /** @type {PoeClient} Poe API client */
    this.poeClient = poeClient;
    
    /** @type {StorageManager} Storage manager instance */
    this.storageManager = storageManager;
    
    /** @type {boolean} Flag to prevent concurrent API requests */
    this.isApiRequestPending = false;
    
    /** @type {Array<Object>} Pending images for current message */
    this.pendingImages = null;

    this.setupEventListeners();
  }

  /**
   * Set up event listeners for message-related events
   */
  setupEventListeners() {
    this.eventBus.on(EventTypes.MESSAGE_SENT, this.handleMessageSent.bind(this));
    this.eventBus.on(EventTypes.MESSAGE_LOADING, this.handleMessageLoading.bind(this));
    this.eventBus.on(EventTypes.IMAGE_ADDED, this.handleImageAdded.bind(this));
    this.eventBus.on(EventTypes.UI_UPDATE, this.handleUIUpdate.bind(this));
  }

  /**
   * Send a user message and trigger AI response
   * @param {Chat} chat - Chat to send message to
   * @param {string} content - Message content
   * @param {Array} images - Image attachments
   * @returns {Promise<Message>} Promise resolving to sent message
   */
  async sendMessage(chat, content, images = []) {
    // Prevent concurrent API requests
    if (this.isApiRequestPending) {
      console.log('[MessageController] API request already pending, skipping');
      return null;
    }

    if (!content && images.length === 0) {
      console.warn('[MessageController] Cannot send empty message');
      return null;
    }

    if (!chat) {
      console.error('[MessageController] No chat provided for message');
      return null;
    }

    try {
      // Create and add user message
      const userMessage = chat.addMessage(content || '[Image]', 'user', images);
      
      // Store images for API call before clearing UI
      this.pendingImages = images;

      // Update chat title if it's still default
      if (chat.title === 'New Chat' && (content || images.length > 0)) {
        this.updateChatTitle(chat, content, images);
      }

      // Emit message sent event
      this.eventBus.emit(EventTypes.MESSAGE_SENT, {
        message: userMessage,
        chat: chat,
        hasImages: images.length > 0
      });

      // Clear UI input
      this.eventBus.emit(EventTypes.UI_CLEAR, {
        type: 'input'
      });

      // Trigger AI response
      await this.getAIResponse(chat);

      return userMessage;
    } catch (error) {
      console.error('[MessageController] Error sending message:', error);
      this.eventBus.emit(EventTypes.MESSAGE_ERROR, {
        error: error.message,
        chat: chat
      });
      return null;
    }
  }

  /**
   * Get AI response from the Poe bot
   * @param {Chat} chat - Chat to get response for
   */
  async getAIResponse(chat) {
    if (!chat || this.isApiRequestPending) {
      return;
    }

    this.isApiRequestPending = true;

    try {
      // Check API key first
      const apiKey = await this.storageManager.getOpenAIApiKey();
      if (!apiKey) {
        await this.addErrorMessage(chat, 
          'Poe API key not configured. Please click the settings icon (⚙️) to configure your API key.'
        );
        return;
      }

      // Add loading message
      const loadingMessage = chat.addMessage(
        'debunkr.org Assistant is thinking...', 
        'assistant',
        [],
        { isLoading: true }
      );

      // Emit loading state
      this.eventBus.emit(EventTypes.MESSAGE_LOADING, {
        message: loadingMessage,
        chat: chat
      });

      // Update UI
      this.eventBus.emit(EventTypes.UI_UPDATE, {
        type: 'renderMessages',
        chat: chat
      });

      // Get AI response  
      const messages = chat.getMessages().map(msg => msg.toJSON ? msg.toJSON() : msg);
      const response = await this.poeClient.sendMessage(messages, this.pendingImages || []);

      // Clear pending images after successful API call
      this.pendingImages = null;

      // Replace loading message with actual response
      const updateSuccess = chat.updateMessage(loadingMessage.id, {
        content: response,
        isLoading: false
      });

      if (!updateSuccess) {
        console.warn('[MessageController] Failed to update loading message, adding new message');
        // Fallback: remove loading message and add new response
        chat.removeMessage(loadingMessage.id);
        const newMessage = chat.addMessage(response, 'assistant');
        
        this.eventBus.emit(EventTypes.MESSAGE_RECEIVED, {
          message: newMessage,
          chat: chat,
          loadingMessageId: loadingMessage.id,
          fallbackUsed: true
        });
      } else {
        const updatedMessage = chat.getMessage(loadingMessage.id);
        this.eventBus.emit(EventTypes.MESSAGE_RECEIVED, {
          message: updatedMessage,
          chat: chat,
          loadingMessageId: loadingMessage.id
        });
      }

    } catch (error) {
      console.error('[MessageController] Error getting AI response:', error);
      
      // Clear pending images on error
      this.pendingImages = null;
      
      // Create user-friendly error message
      const errorContent = this.getUserFriendlyErrorMessage(error);
      
      await this.addErrorMessage(chat, errorContent);

      // Emit error event
      this.eventBus.emit(EventTypes.MESSAGE_ERROR, {
        error: error.message,
        chat: chat,
        userFriendlyMessage: errorContent
      });

    } finally {
      this.isApiRequestPending = false;
      
      // Update UI with final state
      this.eventBus.emit(EventTypes.UI_UPDATE, {
        type: 'renderMessages',
        chat: chat
      });

      // Save chat state
      this.eventBus.emit(EventTypes.STORAGE_SAVED, {
        type: 'chatUpdate',
        chatId: chat.id
      });
    }
  }

  /**
   * Add error message to chat
   * @param {Chat} chat - Chat to add error to
   * @param {string} errorContent - Error message content
   */
  async addErrorMessage(chat, errorContent) {
    const errorMessage = chat.addMessage(errorContent, 'assistant', [], { isError: true });
    
    chat.updateMessage(errorMessage.id, {
      isError: true
    });
  }

  /**
   * Update chat title based on message content
   * @param {Chat} chat - Chat to update
   * @param {string} content - Message content
   * @param {Array} images - Image attachments
   */
  updateChatTitle(chat, content, images) {
    let titleText = content || 'Image message';
    
    // Handle quoted text pattern
    const quoteMatch = content?.match(/^"(.+?)"\n\n(.+)?$/s);
    if (quoteMatch) {
      titleText = quoteMatch[2] || quoteMatch[1];
    }
    
    // Generate appropriate title
    if (!content && images.length > 0) {
      titleText = 'Image message';
    }
    
    chat.title = titleText.length > 30 ? titleText.substring(0, 30) + '...' : titleText;
  }

  /**
   * Get user-friendly error message based on error type
   * @param {Error} error - The error object
   * @returns {string} User-friendly error message
   */
  getUserFriendlyErrorMessage(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('401') || message.includes('invalid or expired api key')) {
      return "Your API key appears to be invalid or expired. Please check your API key in Settings.";
    } else if (message.includes('429') || message.includes('rate limit')) {
      return "You've exceeded your API rate limit. Please wait a moment before trying again.";
    } else if (message.includes('503') || message.includes('service temporarily unavailable')) {
      return "The service is temporarily unavailable. Please try again in a few minutes.";
    } else if (message.includes('timeout') || message.includes('timed out')) {
      return "The request timed out. Please check your internet connection and try again.";
    } else if (message.includes('network') || message.includes('fetch')) {
      return "Unable to connect to the service. Please check your internet connection.";
    } else {
      return `Something went wrong while processing your request.\n\nPlease make sure your Poe API key is configured in Settings and try again.`;
    }
  }

  /**
   * Copy message content to clipboard
   * @param {string} messageId - ID of message to copy
   * @param {Chat} chat - Chat containing the message
   * @returns {Promise<boolean>} Success status
   */
  async copyMessageToClipboard(messageId, chat) {
    const message = chat.getMessage(messageId);
    if (!message) {
      return false;
    }

    try {
      // Get plain text content without HTML formatting
      const textContent = this.getPlainTextFromMessage(message.content);
      await navigator.clipboard.writeText(textContent);
      
      // Emit success event
      this.eventBus.emit(EventTypes.UI_UPDATE, {
        type: 'showCopyFeedback',
        messageId: messageId
      });
      
      return true;
    } catch (error) {
      console.error('[MessageController] Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Extract plain text from HTML-formatted message content
   * @param {string} content - HTML content to convert
   * @returns {string} Plain text without HTML formatting
   */
  getPlainTextFromMessage(content) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  /**
   * Validate message content before sending
   * @param {string} content - Message content to validate
   * @param {Array} images - Image attachments to validate
   * @returns {Object} Validation result
   */
  validateMessage(content, images = []) {
    const result = {
      valid: true,
      errors: []
    };

    // Check if message has content or images
    if (!content && (!images || images.length === 0)) {
      result.valid = false;
      result.errors.push('Message must have content or images');
    }

    // Validate content length
    if (content && content.length > 50000) {
      result.valid = false;
      result.errors.push('Message content is too long (max 50,000 characters)');
    }

    // Validate images
    if (images && images.length > 0) {
      for (const image of images) {
        if (!image.data || !image.data.startsWith('data:image/')) {
          result.valid = false;
          result.errors.push(`Invalid image data: ${image.fileName}`);
        }
      }
    }

    return result;
  }

  /**
   * Event handlers
   */
  handleMessageSent(data) {
    console.log(`[MessageController] Message sent in chat ${data.chat.id}`);
    
    // Update UI to show new message
    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'renderMessages',
      chat: data.chat
    });

    // Update chat history
    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'updateChatHistory'
    });
  }

  handleMessageLoading(data) {
    console.log(`[MessageController] Message loading in chat ${data.chat.id}`);
  }

  handleImageAdded(data) {
    console.log(`[MessageController] Image added: ${data.fileName}`);
  }

  handleUIUpdate(data) {
    if (data.type === 'sendMessage') {
      this.sendMessage(data.chat, data.content, data.images);
    }
  }

  /**
   * Get current API request status
   * @returns {boolean} Whether API request is pending
   */
  isRequestPending() {
    return this.isApiRequestPending;
  }

  /**
   * Get pending images
   * @returns {Array|null} Pending images or null
   */
  getPendingImages() {
    return this.pendingImages;
  }

  /**
   * Clear pending images
   */
  clearPendingImages() {
    this.pendingImages = null;
    
    this.eventBus.emit(EventTypes.UI_CLEAR, {
      type: 'images'
    });
  }

  /**
   * Get diagnostic information
   * @returns {Object} Diagnostic data
   */
  getDiagnostics() {
    return {
      isApiRequestPending: this.isApiRequestPending,
      hasPendingImages: this.pendingImages !== null,
      pendingImageCount: this.pendingImages ? this.pendingImages.length : 0
    };
  }

  /**
   * Clean up message controller
   */
  cleanup() {
    // Clear pending state
    this.isApiRequestPending = false;
    this.pendingImages = null;
    
    console.log('[MessageController] Cleanup completed');
  }
}