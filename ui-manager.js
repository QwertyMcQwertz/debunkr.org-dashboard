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
    // Sanitize and format message content with quote block support
    const sanitized = this.sanitizeInput(content);
    
    // Check if content contains quoted text pattern (no source URL in LLM messages now)
    const quotePattern = /^"(.+?)"(\n\n(.+))?$/s;
    const match = content.match(quotePattern);
    
    if (match) {
      const [, quotedText, , additionalContext] = match;
      
      // Replace the quoted portion with styled quote block
      const quotedTextSanitized = this.sanitizeInput(quotedText);
      let quoteBlock = `<div class="quote-block">${quotedTextSanitized.replace(/\n/g, '<br>')}</div>`;
      
      if (additionalContext) {
        quoteBlock += '<br>' + this.sanitizeInput(additionalContext).replace(/\n/g, '<br>');
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
        return;
      }
      // If no welcome message exists, create it (this shouldn't happen in normal flow)
      messagesContainer.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">🛡️</div>
          <h2>Fight Misinformation with AI</h2>
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
              <div class="step">1. Configure your OpenAI API key in <span class="settings-hint">⚙️ Settings</span></div>
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
          ${message.type === 'user' ? 'U' : 'AI'}
        </div>
        <div class="message-container">
          <div class="message-content">
            ${message.isLoading ? `<div class="loading-dots">${message.content}</div>` : this.formatMessage(message.content)}
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
    
    this.scrollToBottom();
  }

  /**
   * Set up event listeners for message copy buttons
   * Attaches click handlers to all copy buttons in the current message list
   * @param {Object} currentChat - Chat object for accessing message data
   */
  setupCopyButtons(currentChat) {
    const copyButtons = document.querySelectorAll('.copy-message-btn');
    copyButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const messageId = button.dataset.messageId;
        this.copyMessageToClipboard(messageId, currentChat, button);
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
    
    container.innerHTML = `
      <div class="input-quote-block" style="position: relative;">
        ${this.sanitizeInput(text)}
        <button class="input-quote-remove" id="removeQuote">×</button>
        ${sourceUrl ? `<div class="quote-source" style="margin-top: 6px;">From: ${sourceUrl}</div>` : ''}
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
   * Button is enabled when there's text input OR an active quote block
   * Prevents sending empty messages while allowing quote-only messages
   */
  updateSendButton() {
    const messageInput = this.getElement('messageInput');
    const sendButton = this.getElement('sendButton');
    // Enable if there's text input OR a quote block
    sendButton.disabled = !messageInput.value.trim() && !this.currentQuote;
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
   * Resets textarea height and updates send button state
   */
  clearInput() {
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
    status.textContent = message;
    status.className = `settings-status ${type}`;
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

}