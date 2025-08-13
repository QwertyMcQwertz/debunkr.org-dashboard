/**
 * UI Management and DOM Manipulation Module
 * Handles all user interface updates, message rendering, and DOM interactions
 * 
 * Features:
 * - Cached DOM element access for performance
 * - Message formatting with quote block support
 * - Copy-to-clipboard functionality with fallback support
 * - Chat history display and management
 * - Quote block input handling
 * - Settings modal management
 * - Responsive textarea height adjustment
 * 
 * @class UIManager
 */
class UIManager {
  /**
   * Initialize the UI manager
   * @constructor
   */
  constructor() {
    /** @type {Object<string, HTMLElement>} Cache of frequently accessed DOM elements */
    this.cachedElements = {};
    /** @type {Object|null} Currently active quote block data */
    this.currentQuote = null;
    /** @type {Array<Object>} Currently attached images */
    this.attachedImages = [];
    /** @type {Set<Function>} Track event listeners for cleanup */
    this.eventListeners = new Set();
    /** @type {WeakMap<Element, Function>} Track listeners per element */
    this.elementListeners = new WeakMap();
  }

  /**
   * Get cached DOM element by ID for improved performance
   * Elements are cached on first access to avoid repeated querySelector calls
   * @param {string} id - Element ID to retrieve
   * @returns {HTMLElement|null} The DOM element or null if not found
   */
  getElement(id) {
    if (!this.cachedElements[id]) {
      this.cachedElements[id] = document.getElementById(id);
    }
    return this.cachedElements[id];
  }

  /**
   * Sanitize user input to prevent XSS attacks
   * Uses textContent assignment to escape HTML entities
   * @param {string} input - Raw user input to sanitize
   * @returns {string} HTML-escaped safe string
   */
  sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  /**
   * Format message content with quote block support
   * Detects quoted text patterns and wraps them in styled quote blocks
   * Handles multiline content and additional context after quotes
   * @param {string} content - Raw message content to format
   * @returns {string} HTML-formatted message content
   */
  formatMessage(content) {
    // Input validation and length limit
    if (typeof content !== 'string') {
      console.warn('Invalid content type for formatMessage:', typeof content);
      return '';
    }
    
    // Limit content length to prevent DoS
    if (content.length > 50000) {
      console.warn('Content too long, truncating');
      content = content.substring(0, 50000) + '... [truncated]';
    }
    
    // Sanitize and format message content with quote block support
    const sanitized = this.sanitizeInput(content);
    
    // Check if content contains quoted text pattern (no source URL in LLM messages now)
    const quotePattern = /^"(.+?)"(\n\n(.+))?$/s;
    const match = content.match(quotePattern);
    
    if (match) {
      const [, quotedText, , additionalContext] = match;
      
      // Double sanitize quoted content for extra security
      const quotedTextSanitized = this.sanitizeInput(quotedText);
      let quoteBlock = `<div class="quote-block">${quotedTextSanitized.replace(/\n/g, '<br>')}</div>`;
      
      if (additionalContext) {
        const contextSanitized = this.sanitizeInput(additionalContext);
        quoteBlock += '<br>' + contextSanitized.replace(/\n/g, '<br>');
      }
      
      return quoteBlock;
    }
    
    return sanitized.replace(/\n/g, '<br>');
  }

  /**
   * Render all messages for the current chat
   * Displays welcome message for empty chats or renders message list
   * Automatically sets up copy button event listeners
   * @param {Object|null} currentChat - Chat object containing messages array
   */
  renderMessages(currentChat) {
    const messagesContainer = this.getElement('messagesContainer');
    
    if (!currentChat || currentChat.messages.length === 0) {
      // Don't modify the container if it already has the welcome message
      if (messagesContainer.querySelector('.welcome-message')) {
        // But still set up listeners if they haven't been set up yet
        this.setupWelcomeMessageListeners();
        return;
      }
      // If no welcome message exists, create it (this shouldn't happen in normal flow)
      messagesContainer.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon"><img src="assets/debunkr_logo_half.svg" alt="debunkr" class="welcome-logo"></div>
          <h2>Scroll with Scrutiny.</h2>
          <p>Highlight suspicious text on any website, right-click, and let our egalitarian AI analyze it for bias, manipulation, and power structures.</p>
          
          <div class="welcome-features">
            <div class="feature-item">
              <span class="feature-icon">🎯</span>
              <div class="feature-text">
                <strong>Smart Analysis</strong>
                <small>Questions power structures and identifies bias</small>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔍</span>
              <div class="feature-text">
                <strong>Source Critical</strong>
                <small>Examines who benefits from particular narratives</small>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">💡</span>
              <div class="feature-text">
                <strong>Media Literacy</strong>
                <small>Promotes critical thinking about information</small>
              </div>
            </div>
          </div>
          
          <div class="get-started-cta">
            <h3>Get Started:</h3>
            <div class="step-list">
              <div class="step">1. Configure your Poe API key in <span class="settings-hint clickable-settings">⚙️ Settings</span></div>
              <div class="step">2. Highlight text on any webpage</div>
              <div class="step">3. Right-click → "debunkr" → "New Chat"</div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const messagesHtml = currentChat.messages.map(message => `
      <div class="message ${message.type} ${message.isLoading ? 'loading' : ''} ${message.isError ? 'error' : ''}" data-message-id="${message.id}">
        <div class="message-avatar">
          ${message.type === 'user' ? 'U' : 'dA'}
        </div>
        <div class="message-container">
          <div class="message-content">
            ${message.images && message.images.length > 0 ? `
              <div class="message-images">
                ${message.images.map(image => `
                  <div class="message-image-item">
                    <img src="${image.data}" alt="${image.fileName}" class="message-image-preview">
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${message.isLoading ? `<div class="loading-dots">${message.content}</div>` : 
              (message.content === '[Image]' && message.images && message.images.length > 0) ? '' : this.formatMessage(message.content)}
          </div>
          ${!message.isLoading ? `
            <div class="message-actions">
              <button class="copy-message-btn" data-message-id="${message.id}" title="Copy message">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                </svg>
                Copy
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

    messagesContainer.innerHTML = messagesHtml;
    
    // Add copy button event listeners
    this.setupCopyButtons(currentChat);
    
    // Add image click listeners
    this.setupImageViewers();
    
    this.scrollToBottom();
  }

  /**
   * Set up event listeners for message copy buttons
   * Attaches click handlers to all copy buttons in the current message list
   * @param {Object} currentChat - Chat object for accessing message data
   */
  setupCopyButtons(currentChat) {
    const copyButtons = document.querySelectorAll('.copy-message-btn:not([data-listener-attached])');
    copyButtons.forEach(button => {
      const handler = (e) => {
        e.stopPropagation();
        const messageId = button.dataset.messageId;
        this.copyMessageToClipboard(messageId, currentChat, button);
      };
      
      button.addEventListener('click', handler);
      button.setAttribute('data-listener-attached', 'true');
      
      // Track listener for cleanup
      this.elementListeners.set(button, handler);
      this.eventListeners.add(() => {
        button.removeEventListener('click', handler);
        button.removeAttribute('data-listener-attached');
      });
    });
  }

  /**
   * Copy message content to clipboard with visual feedback
   * Uses modern Clipboard API with fallback for older browsers
   * Strips HTML formatting to copy plain text only
   * @param {string|number} messageId - ID of message to copy
   * @param {Object} currentChat - Chat object containing messages
   * @param {HTMLElement} buttonElement - Button element for visual feedback
   */
  async copyMessageToClipboard(messageId, currentChat, buttonElement) {
    const message = currentChat.messages.find(msg => msg.id == messageId);
    if (!message) return;

    try {
      // Get the raw text content without HTML formatting
      const textContent = this.getPlainTextFromMessage(message.content);
      
      await navigator.clipboard.writeText(textContent);
      
      // Show feedback
      this.showCopyFeedback(buttonElement);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      this.fallbackCopyToClipboard(message.content, buttonElement);
    }
  }

  /**
   * Extract plain text from HTML-formatted message content
   * Creates temporary DOM element to strip HTML tags safely
   * @param {string} content - HTML content to convert to plain text
   * @returns {string} Plain text without HTML formatting
   */
  getPlainTextFromMessage(content) {
    // Create a temporary element to strip HTML tags
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  /**
   * Fallback clipboard copy method for older browsers
   * Uses deprecated execCommand as fallback when Clipboard API unavailable
   * @param {string} text - Text content to copy
   * @param {HTMLElement} buttonElement - Button element for visual feedback
   */
  fallbackCopyToClipboard(text, buttonElement) {
    const textArea = document.createElement('textarea');
    textArea.value = this.getPlainTextFromMessage(text);
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      this.showCopyFeedback(buttonElement);
    } catch (error) {
      console.error('Fallback copy failed:', error);
    }
    
    document.body.removeChild(textArea);
  }

  /**
   * Show visual feedback when copy operation succeeds
   * Temporarily changes button appearance and text to indicate success
   * @param {HTMLElement} buttonElement - Button to show feedback on
   */
  showCopyFeedback(buttonElement) {
    const originalText = buttonElement.innerHTML;
    buttonElement.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"></polyline>
      </svg>
      Copied!
    `;
    buttonElement.classList.add('copied');
    
    setTimeout(() => {
      buttonElement.innerHTML = originalText;
      buttonElement.classList.remove('copied');
    }, 2000);
  }

  /**
   * Update the sidebar chat history display
   * Shows sorted list of chats with preview text and action buttons
   * Supports filtered chat lists for search functionality
   * @param {Map} chats - Map of all chat objects
   * @param {number|null} currentChatId - ID of currently active chat
   * @param {Array|null} filteredChats - Optional filtered subset of chats
   */
  updateChatHistoryDisplay(chats, currentChatId, filteredChats = null) {
    const chatHistory = this.getElement('chatHistory');
    
    // Use filtered chats if provided, otherwise use all chats
    const chatsToDisplay = filteredChats || Array.from(chats.values());
    
    // Sort chats by last activity (most recent first)
    const sortedChats = chatsToDisplay.sort((a, b) => {
      const aTime = new Date(a.lastActivity || 0);
      const bTime = new Date(b.lastActivity || 0);
      return bTime - aTime;
    });
    
    if (sortedChats.length === 0) {
      chatHistory.innerHTML = `
        <div class="empty-history">
          <div class="empty-history-text">No conversations yet</div>
          <div class="empty-history-hint">Start by selecting text on any webpage!</div>
        </div>
      `;
      return;
    }
    
    const chatItemsHtml = sortedChats.map(chat => `
      <div class="chat-item ${chat.id === currentChatId ? 'active' : ''}" data-chat-id="${chat.id}">
        <div class="chat-content">
          <div class="chat-title" data-chat-id="${chat.id}">${chat.title}</div>
          <div class="chat-preview">${this.getLastMessagePreview(chat)}</div>
        </div>
        <div class="chat-actions">
          <button class="chat-action-btn rename-btn" data-chat-id="${chat.id}" title="Rename chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="chat-action-btn delete-btn" data-chat-id="${chat.id}" title="Delete chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
    
    chatHistory.innerHTML = chatItemsHtml;
  }

  /**
   * Generate preview text for chat history sidebar
   * Shows truncated version of last message or placeholder for empty chats
   * @param {Object} chat - Chat object with messages array
   * @returns {string} Preview text for display in sidebar
   */
  getLastMessagePreview(chat) {
    if (chat.messages.length === 0) {
      return 'No messages yet';
    }
    
    const lastMessage = chat.messages[chat.messages.length - 1];
    const preview = lastMessage.content.length > 50 
      ? lastMessage.content.substring(0, 50) + '...' 
      : lastMessage.content;
    
    return preview;
  }

  /**
   * Update chat header with source URL and editable title
   * Shows header only for chats that originated from web content
   * Returns elements for event binding in main chat manager
   * @param {Object|null} currentChat - Current chat object
   * @returns {Object|null} Object with sourceLink and titleInput elements, or null
   */
  updateChatHeader(currentChat) {
    const chatHeader = this.getElement('chatHeader');
    const chatSourceTitle = this.getElement('chatSourceTitle');
    const chatTitleEditable = this.getElement('chatTitleEditable');
    
    if (currentChat && (currentChat.sourceUrl || currentChat.lastSourceUrl) && currentChat.title !== 'New Chat') {
      const displayUrl = currentChat.lastSourceUrl || currentChat.sourceUrl;
      
      // Show header with clickable full URL and editable title
      chatSourceTitle.innerHTML = `<a href="#" class="source-link" data-url="${displayUrl}">${displayUrl}</a>`;
      chatTitleEditable.value = currentChat.title;
      chatHeader.style.display = 'block';
      
      // Return the source link element for event binding
      return {
        sourceLink: chatSourceTitle.querySelector('.source-link'),
        titleInput: chatTitleEditable
      };
    } else {
      // Hide header for regular chats
      chatHeader.style.display = 'none';
      return null;
    }
  }

  /**
   * Display quote block in input area
   * Shows quoted text with source URL and remove button
   * Updates input placeholder to guide user interaction
   * @param {string} text - Text content to quote
   * @param {string|null} sourceUrl - Source URL for attribution
   */
  showInputQuote(text, sourceUrl) {
    this.currentQuote = { text, sourceUrl };
    const container = this.getElement('inputQuoteContainer');
    
    // Sanitize both text and sourceUrl
    const sanitizedText = this.sanitizeInput(text);
    const sanitizedSourceUrl = sourceUrl ? this.sanitizeInput(sourceUrl) : '';
    
    container.innerHTML = `
      <div class="input-quote-block" style="position: relative;">
        ${sanitizedText}
        <button class="input-quote-remove" id="removeQuote">×</button>
        ${sanitizedSourceUrl ? `<div class="quote-source" style="margin-top: 6px;">From: ${sanitizedSourceUrl}</div>` : ''}
      </div>
    `;
    
    container.style.display = 'block';
    
    // Add remove functionality
    this.getElement('removeQuote').addEventListener('click', () => {
      this.hideInputQuote();
    });
    
    // Update placeholder
    const messageInput = this.getElement('messageInput');
    messageInput.placeholder = 'Add your thoughts or questions about the quoted text...';
  }

  /**
   * Hide and clear the input quote block
   * Resets currentQuote state and restores default input placeholder
   */
  hideInputQuote() {
    this.currentQuote = null;
    const container = this.getElement('inputQuoteContainer');
    container.style.display = 'none';
    container.innerHTML = '';
    
    // Reset placeholder
    const messageInput = this.getElement('messageInput');
    messageInput.placeholder = 'Ask me to analyze any information, fact-check claims, or verify sources...';
  }

  /**
   * Format user message with quoted text for LLM processing
   * Combines quoted text and user input into properly formatted message
   * Source URLs are excluded from LLM messages (UI display only)
   * @returns {string} Formatted message ready for LLM processing
   */
  getFormattedMessageWithQuote() {
    const messageInput = this.getElement('messageInput');
    const userText = messageInput.value.trim();
    
    if (!this.currentQuote) {
      return userText;
    }
    
    // Format the message with quoted text for LLM (source URL is only shown in UI, not sent to LLM)
    let formattedMessage = `"${this.currentQuote.text}"`;
    
    if (userText) {
      formattedMessage += `\n\n${userText}`;
    }
    
    return formattedMessage;
  }

  /**
   * Display chat selection interface for context menu text
   * Shows existing chats sorted by activity with preview text
   * Used when user selects text from web pages
   * @param {Map} chats - Map of all available chats
   * @param {string} pendingText - Selected text to be added to chosen chat
   * @returns {Object} Object with selector elements for event binding
   */
  displayChatSelector(chats, pendingText) {
    const messagesContainer = this.getElement('messagesContainer');
    const sortedChats = Array.from(chats.values()).sort((a, b) => {
      const aTime = new Date(a.lastActivity || 0);
      const bTime = new Date(b.lastActivity || 0);
      return bTime - aTime;
    });

    const chatListHtml = sortedChats.map(chat => `
      <div class="chat-selector-item" data-chat-id="${chat.id}">
        <div class="chat-selector-title">${chat.title}</div>
        <div class="chat-selector-preview">${this.getLastMessagePreview(chat)}</div>
      </div>
    `).join('');

    messagesContainer.innerHTML = `
      <div class="chat-selector">
        <div class="chat-selector-header">
          <h2>Continue in existing chat</h2>
          <p>Selected text will be added to the chosen chat</p>
          <div class="selected-text-preview">
            <strong>Selected text:</strong>
            <div class="text-preview">${this.sanitizeInput(pendingText)}</div>
          </div>
        </div>
        <div class="chat-selector-list">
          ${chatListHtml}
        </div>
        <div class="chat-selector-actions">
          <button class="btn-secondary" id="createNewChatBtn">Create New Chat Instead</button>
        </div>
      </div>
    `;

    return {
      selectorItems: document.querySelectorAll('.chat-selector-item'),
      createNewBtn: this.getElement('createNewChatBtn')
    };
  }

  /**
   * Dynamically adjust textarea height based on content
   * Grows textarea as user types, with maximum height limit
   * Provides better user experience for longer messages
   */
  adjustTextareaHeight() {
    const textarea = this.getElement('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  /**
   * Update send button enabled/disabled state
   * Button is enabled when there's text input OR an active quote block OR attached images
   * Prevents sending empty messages while allowing quote-only and image-only messages
   */
  updateSendButton() {
    const messageInput = this.getElement('messageInput');
    const sendButton = this.getElement('sendButton');
    // Enable if there's text input OR a quote block OR attached images
    sendButton.disabled = !messageInput.value.trim() && !this.currentQuote && this.attachedImages.length === 0;
  }

  /**
   * Scroll messages container to bottom
   * Used after adding new messages to keep conversation in view
   */
  scrollToBottom() {
    const messagesContainer = this.getElement('messagesContainer');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Focus the message input textarea
   * Used to restore focus after various UI operations
   */
  focusInput() {
    this.getElement('messageInput').focus();
  }

  /**
   * Clear message input and reset UI state
   * Resets textarea height, clears images, and updates send button state
   */
  clearInput() {
    const messageInput = this.getElement('messageInput');
    messageInput.value = '';
    this.clearAttachedImages();
    this.hideInputQuote(); // Clear any quote block
    this.adjustTextareaHeight();
    this.updateSendButton();
  }

  /**
   * Clear input text only, preserving quote block
   * Used when switching chats to preserve pending quotes
   */
  clearInputText() {
    const messageInput = this.getElement('messageInput');
    messageInput.value = '';
    this.adjustTextareaHeight();
    this.updateSendButton();
  }

  /**
   * Display status message in settings modal
   * Shows success, error, or loading states for settings operations
   * @param {string} message - Status message to display
   * @param {string} type - Status type: 'success', 'error', or 'loading'
   */
  showSettingsStatus(message, type) {
    const status = this.getElement('settingsStatus');
    console.log('Showing settings status:', message, type);
    status.textContent = message;
    status.className = `settings-status ${type}`;
    // Force display in case CSS isn't working
    status.style.display = 'block';
    console.log('Status element after update:', status.className, status.textContent);
  }

  /**
   * Open the settings modal dialog
   * @returns {HTMLElement} The modal element for further manipulation
   */
  openSettingsModal() {
    const modal = this.getElement('settingsModal');
    modal.style.display = 'flex';
    return modal;
  }

  /**
   * Close settings modal and reset status display
   * Clears any status messages and hides the modal
   */
  closeSettingsModal() {
    const modal = this.getElement('settingsModal');
    const status = this.getElement('settingsStatus');
    modal.style.display = 'none';
    status.className = 'settings-status';
    status.style.display = 'none';
  }

  /**
   * Set up event listeners for welcome message elements
   * Handles clickable elements in the welcome screen using event delegation
   */
  setupWelcomeMessageListeners() {
    // Use event delegation to handle clicks on dynamically created elements
    const messagesContainer = this.getElement('messagesContainer');
    if (messagesContainer && !messagesContainer.hasAttribute('data-welcome-listeners')) {
      const welcomeClickHandler = (e) => {
        if (e.target.classList.contains('clickable-settings')) {
          e.preventDefault();
          e.stopPropagation();
          console.log('[UIManager] Welcome settings link clicked');
          // Trigger the same action as the settings button
          const settingsBtn = this.getElement('settingsBtn');
          if (settingsBtn) {
            settingsBtn.click();
          }
        }
      };
      
      messagesContainer.addEventListener('click', welcomeClickHandler);
      
      // Track listener for cleanup
      this.elementListeners.set(messagesContainer, welcomeClickHandler);
      this.eventListeners.add(() => {
        messagesContainer.removeEventListener('click', welcomeClickHandler);
        messagesContainer.removeAttribute('data-welcome-listeners');
      });
      
      // Mark as having listener attached
      messagesContainer.setAttribute('data-welcome-listeners', 'true');
      console.log('[UIManager] Welcome message listeners set up');
    }
  }

  /**
   * Set up event listeners for image previews
   * Allows clicking on message images to view them full-size
   */
  setupImageViewers() {
    const imageElements = document.querySelectorAll('.message-image-preview:not([data-listener-attached])');
    imageElements.forEach(img => {
      const handler = (e) => {
        e.stopPropagation();
        this.showImageModal(img.src, img.alt);
      };
      
      img.addEventListener('click', handler);
      img.setAttribute('data-listener-attached', 'true');
      
      // Track listener for cleanup
      this.elementListeners.set(img, handler);
      this.eventListeners.add(() => {
        img.removeEventListener('click', handler);
        img.removeAttribute('data-listener-attached');
      });
    });
  }

  /**
   * Show image in a full-size modal
   * @param {string} imageSrc - Source URL of the image
   * @param {string} imageAlt - Alt text for the image
   */
  showImageModal(imageSrc, imageAlt) {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'image-modal-overlay';
    modalOverlay.innerHTML = `
      <div class="image-modal-content">
        <button class="image-modal-close">×</button>
        <img src="${imageSrc}" alt="${imageAlt}" class="image-modal-image">
        <div class="image-modal-caption">${imageAlt}</div>
      </div>
    `;

    // Add to document
    document.body.appendChild(modalOverlay);

    // Add event listeners
    const closeBtn = modalOverlay.querySelector('.image-modal-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modalOverlay);
    });

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        document.body.removeChild(modalOverlay);
      }
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(modalOverlay);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Add image to the attached images list and show preview
   * @param {File|string} imageData - Image file or base64 data
   * @param {string} fileName - Name of the image file
   */
  async addAttachedImage(imageData, fileName) {
    const imageId = Date.now() + Math.random().toString(36).substr(2, 9);
    
    try {
      if (imageData instanceof File) {
        console.log(`[UIManager] Processing file upload: ${fileName} (${imageData.size} bytes)`);
        
        // Validate file size (max 10MB)
        if (imageData.size > 10 * 1024 * 1024) {
          this.showImageError(`Image "${fileName}" is too large. Maximum size is 10MB.`);
          return false;
        }

        // Validate file type more strictly
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(imageData.type)) {
          this.showImageError(`"${fileName}" format not supported. Use JPEG, PNG, GIF, or WebP.`);
          return false;
        }

        // Compress image if it's large
        const compressedData = await this.compressImageIfNeeded(imageData);
        
        // Verify compression didn't fail
        if (!compressedData || !compressedData.startsWith('data:image/')) {
          this.showImageError(`Failed to process "${fileName}". Please try a different image.`);
          return false;
        }
        
        this.attachedImages.push({
          id: imageId,
          data: compressedData,
          fileName: fileName,
          type: imageData.type,
          originalSize: imageData.size
        });
        
        console.log(`[UIManager] Successfully added image: ${fileName}`);
        this.updateImagePreview();
        this.updateSendButton();
        return true;
        
      } else {
        // Handle base64 data (from paste)
        if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
          this.showImageError('Invalid image data provided.');
          return false;
        }

        // Estimate size from base64 string
        const estimatedSize = imageData.length * 0.75; // Base64 is ~33% larger than binary
        if (estimatedSize > 10 * 1024 * 1024) {
          this.showImageError(`Pasted image is too large. Maximum size is 10MB.`);
          return false;
        }

        this.attachedImages.push({
          id: imageId,
          data: imageData,
          fileName: fileName,
          type: 'image/png' // Default for pasted images
        });
        
        console.log(`[UIManager] Successfully added pasted image: ${fileName}`);
        this.updateImagePreview();
        this.updateSendButton();
        return true;
      }
    } catch (error) {
      console.error('[UIManager] Error processing image:', error);
      this.showImageError(`Failed to process "${fileName}": ${error.message}`);
      return false;
    }
  }

  /**
   * Compress image if it's larger than 2MB or dimensions are too large
   * @param {File} file - Image file to potentially compress
   * @returns {Promise<string>} Compressed image data as base64
   */
  async compressImageIfNeeded(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            // Check if compression is needed
            const needsCompression = file.size > 2 * 1024 * 1024 || // > 2MB
                                   img.width > 1920 || img.height > 1920; // Large dimensions

            if (!needsCompression) {
              resolve(e.target.result);
              return;
            }

            // Calculate new dimensions maintaining aspect ratio
            const maxDimension = 1920;
            let { width, height } = img;
            
            if (width > height && width > maxDimension) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            } else if (height > maxDimension) {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }

            // Create canvas and compress
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress with quality based on original size
            const quality = file.size > 5 * 1024 * 1024 ? 0.7 : 0.8;
            const compressedData = canvas.toDataURL(file.type, quality);
            
            console.log(`Image compressed: ${(file.size / 1024).toFixed(1)}KB → ${(compressedData.length * 0.75 / 1024).toFixed(1)}KB`);
            resolve(compressedData);
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Show image error message to user
   * @param {string} message - Error message to display
   */
  showImageError(message) {
    console.error('Image error:', message);
    
    // Create temporary error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'image-error-notification';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(errorDiv);

    // Remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }

  /**
   * Remove image from attached images list
   * @param {string} imageId - ID of image to remove
   */
  removeAttachedImage(imageId) {
    this.attachedImages = this.attachedImages.filter(img => img.id !== imageId);
    this.updateImagePreview();
    this.updateSendButton();
  }

  /**
   * Update the image preview display
   */
  updateImagePreview() {
    const container = this.getElement('imagePreviewContainer');
    
    if (this.attachedImages.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    const previewHtml = this.attachedImages.map(image => `
      <div class="image-preview-item">
        <img src="${image.data}" alt="${image.fileName}" class="image-preview">
        <button class="image-remove-btn" data-image-id="${image.id}">×</button>
      </div>
    `).join('');

    container.innerHTML = previewHtml;
    container.style.display = 'block';

    // Add remove button event listeners
    container.querySelectorAll('.image-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const imageId = btn.dataset.imageId;
        this.removeAttachedImage(imageId);
      });
    });
  }

  /**
   * Clear all attached images
   */
  clearAttachedImages() {
    this.attachedImages = [];
    this.updateImagePreview();
    this.updateSendButton();
  }

  /**
   * Get formatted message with images for sending
   * @returns {Object} Object containing text and images
   */
  getMessageWithImages() {
    const messageInput = this.getElement('messageInput');
    const text = this.getFormattedMessageWithQuote();
    
    return {
      text: text,
      images: this.attachedImages.map(img => ({
        data: img.data,
        type: img.type,
        fileName: img.fileName
      }))
    };
  }

  /**
   * Handle paste events for image uploads
   * @param {ClipboardEvent} event - The paste event
   */
  async handlePasteImage(event) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const fileName = `pasted-image-${Date.now()}.${item.type.split('/')[1]}`;
          await this.addAttachedImage(file, fileName);
        }
        break;
      }
    }
  }

  /**
   * Clean up all event listeners and resources
   * Call this method when the UI manager is no longer needed
   */
  cleanup() {
    // Remove all tracked event listeners
    for (const cleanup of this.eventListeners) {
      try {
        cleanup();
      } catch (error) {
        console.warn('Error during listener cleanup:', error);
      }
    }
    
    this.eventListeners.clear();
    this.elementListeners = new WeakMap();
    
    // Clear cached elements
    this.cachedElements = {};
    
    // Clear attached images to free memory
    this.attachedImages = [];
    
    console.log('UIManager cleanup completed');
  }

}