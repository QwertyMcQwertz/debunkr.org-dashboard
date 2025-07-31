/**
 * Main ChatManager Class - Orchestrates Misinformation Manager Extension
 * 
 * This is the core class that coordinates all extension functionality including:
 * - Chat conversation management with persistent storage
 * - Integration with OpenAI Assistants API for misinformation analysis
 * - Context menu integration for analyzing web content
 * - Quote block functionality for highlighted text
 * - Modular architecture with StorageManager, OpenAIClient, and UIManager
 * 
 * Architecture:
 * - StorageManager: Handles encryption, persistence, and Chrome storage operations
 * - OpenAIClient: Manages OpenAI API communication with exponential backoff
 * - UIManager: Controls DOM manipulation, rendering, and user interactions
 * 
 * Data Flow:
 * 1. User selects text on web pages -> Context menu -> Background script
 * 2. Background script opens extension with text/source parameters
 * 3. ChatManager processes URL parameters and creates/continues chats
 * 4. Messages are encrypted and stored via StorageManager
 * 5. OpenAI responses are processed and displayed with copy functionality
 * 
 * @class ChatManager
 */
class ChatManager {
  /**
   * Initialize ChatManager with modular architecture
   * Sets up all dependent modules and begins initialization sequence
   * @constructor
   */
  constructor() {
    /** @type {number|null} ID of currently active chat */
    this.currentChatId = null;
    /** @type {Map<number, Object>} Map of all chat objects keyed by ID */
    this.chats = new Map();
    /** @type {number} Next available chat ID for new conversations */
    this.nextChatId = 1;
    /** @type {string|null} Text pending processing from context menu */
    this.pendingText = null;
    /** @type {string|null} Source URL for pending text */
    this.pendingSource = null;
    
    // Initialize modular components
    /** @type {StorageManager} Handles encryption and persistence */
    this.storageManager = new StorageManager();
    /** @type {OpenAIClient} Manages OpenAI API communication */
    this.openaiClient = new OpenAIClient(this.storageManager);
    /** @type {UIManager} Controls DOM and user interface */
    this.uiManager = new UIManager();
    
    // Begin initialization sequence
    this.initializeFromURL();
    this.initializeStorage();
    this.initializeEventListeners();
  }

  /**
   * Parse URL parameters for context menu integration
   * Handles different action types: newChat, selectChat, continueChat
   * Extracts and decodes text content and source URLs from URL parameters
   */
  initializeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const text = urlParams.get('text');
    const source = urlParams.get('source');
    const chatId = urlParams.get('chatId');
    
    if (text) {
      this.pendingText = decodeURIComponent(text);
      this.pendingSource = source ? decodeURIComponent(source) : null;
    }
    
    this.urlAction = action;
    this.targetChatId = chatId ? parseInt(chatId) : null;
  }

  /**
   * Initialize application state from Chrome storage
   * Loads encrypted chat data and handles URL-based actions
   * Creates initial chat if none exist, otherwise loads most recent
   * Handles various URL action types for context menu integration
   */
  async initializeStorage() {
    try {
      const data = await this.storageManager.loadData();
      this.chats = data.chats;
      this.nextChatId = data.nextChatId;
      this.currentChatId = data.currentChatId;
      
      // Handle URL actions
      if (this.urlAction === 'newChat' && this.pendingText) {
        this.createNewChatWithText();
      } else if (this.urlAction === 'selectChat' && this.pendingText) {
        this.showChatSelector();
      } else if (this.urlAction === 'continueChat' && this.pendingText) {
        this.continueChatFromContext();
      } else {
        // If no chats exist, create one empty chat
        if (this.chats.size === 0) {
          this.createInitialChat();
        } else {
          // Load the most recent chat or the stored current chat
          const chatToLoad = this.currentChatId && this.chats.has(this.currentChatId) 
            ? this.currentChatId 
            : Array.from(this.chats.keys())[0];
          this.loadChat(chatToLoad);
        }
      }
      
      this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
      
      // Force save to ensure chatTitles are created for existing chats
      if (this.chats.size > 0) {
        this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
      this.createInitialChat();
    }
  }

  /**
   * Set up all DOM event listeners for user interactions
   * Handles chat management, search, settings, and message operations
   * Uses event delegation for dynamically created elements
   */
  initializeEventListeners() {
    // Initialize sidebar state
    this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (this.sidebarCollapsed) {
      this.uiManager.getElement('sidebar').classList.add('collapsed');
    }

    // New chat button
    this.uiManager.getElement('newChatBtn').addEventListener('click', () => {
      this.createNewChat();
    });

    // Settings button
    this.uiManager.getElement('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    // Sidebar collapse button
    this.uiManager.getElement('collapseBtn').addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Search functionality
    const searchInput = this.uiManager.getElement('chatSearch');
    searchInput.addEventListener('input', (e) => {
      this.searchChats(e.target.value);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.target.value = '';
        this.searchChats('');
      }
    });

    // Chat history items and actions
    document.addEventListener('click', (e) => {
      // Handle rename button
      if (e.target.closest('.rename-btn')) {
        e.stopPropagation();
        const chatId = parseInt(e.target.closest('.rename-btn').dataset.chatId);
        this.renameChat(chatId);
        return;
      }
      
      // Handle delete button
      if (e.target.closest('.delete-btn')) {
        e.stopPropagation();
        const chatId = parseInt(e.target.closest('.delete-btn').dataset.chatId);
        this.deleteChat(chatId);
        return;
      }
      
      // Handle chat selection
      const chatItem = e.target.closest('.chat-item');
      if (chatItem && !e.target.closest('.chat-actions')) {
        const chatId = parseInt(chatItem.dataset.chatId);
        this.loadChat(chatId);
      }
    });

    // Message input
    const messageInput = this.uiManager.getElement('messageInput');
    const sendButton = this.uiManager.getElement('sendButton');

    messageInput.addEventListener('input', () => {
      this.uiManager.adjustTextareaHeight();
      this.uiManager.updateSendButton();
    });

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    sendButton.addEventListener('click', () => {
      this.sendMessage();
    });
  }

  /**
   * Create the first chat when no chats exist
   * Sets up a new empty chat and makes it active
   * Used during initial app load when storage is empty
   */
  createInitialChat() {
    // Only create initial chat if none exist
    const newChatId = this.nextChatId++;
    const newChat = {
      id: newChatId,
      title: 'New Chat',
      messages: [],
      lastActivity: new Date().toISOString()
    };
    
    this.chats.set(newChatId, newChat);
    this.loadChat(newChatId);
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
    this.uiManager.focusInput();
  }

  /**
   * Find an existing chat with no messages
   * Prevents creating duplicate empty chats
   * @returns {number|null} Chat ID of empty chat, or null if none found
   */
  findEmptyChat() {
    for (const [chatId, chat] of this.chats) {
      if (chat.messages.length === 0) {
        return chatId;
      }
    }
    return null;
  }

  /**
   * Create new chat or switch to existing empty chat
   * Optimizes chat creation by reusing empty chats when possible
   * Triggered by "New Chat" button in sidebar
   */
  createNewChat() {
    // Check if there's already an empty chat - if so, just switch to it or do nothing
    const emptyChatId = this.findEmptyChat();
    if (emptyChatId) {
      // If we're already on the empty chat, just focus input
      if (this.currentChatId === emptyChatId) {
        this.uiManager.focusInput();
        return;
      }
      // Otherwise switch to the empty chat
      this.loadChat(emptyChatId);
      this.uiManager.focusInput();
      return;
    }
    
    // Only create new chat if no empty chats exist
    const newChatId = this.nextChatId++;
    const newChat = {
      id: newChatId,
      title: 'New Chat',
      messages: [],
      lastActivity: new Date().toISOString()
    };
    
    this.chats.set(newChatId, newChat);
    this.loadChat(newChatId);
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
    this.uiManager.focusInput();
  }

  /**
   * Create new chat with pre-filled text from context menu
   * Optimizes by reusing empty chats and sets appropriate title from source URL
   * Used when user selects "New Chat" from context menu with selected text
   */
  createNewChatWithText() {
    // Check if there's an empty chat first
    const emptyChatId = this.findEmptyChat();
    if (emptyChatId) {
      // Use existing empty chat and update its title and source
      const emptyChat = this.chats.get(emptyChatId);
      if (this.pendingSource) {
        emptyChat.title = this.extractDomainFromUrl(this.pendingSource);
        emptyChat.sourceUrl = this.pendingSource;
      }
      this.loadChat(emptyChatId);
      this.preFillInput(false); // Just text, source is in header now
      this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId); // Save the title change
      return;
    }
    
    // Create new chat only if no empty ones exist
    const newChatId = this.nextChatId++;
    
    // Use source domain as title if available
    let chatTitle = 'New Chat';
    if (this.pendingSource) {
      chatTitle = this.extractDomainFromUrl(this.pendingSource);
    }
    
    const newChat = {
      id: newChatId,
      title: chatTitle,
      messages: [],
      lastActivity: new Date().toISOString(),
      sourceUrl: this.pendingSource // Store source for header display
    };
    
    this.chats.set(newChatId, newChat);
    this.loadChat(newChatId);
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
    
    // Pre-fill the input with just the selected text (source is in header now)
    this.preFillInput(false);
  }

  /**
   * Display chat selection interface for context menu text
   * Allows users to choose existing chat or create new one
   * Used when multiple chats exist and user selects text from web page
   */
  showChatSelector() {
    // If no existing chats, create new one
    if (this.chats.size === 0) {
      this.createNewChatWithText();
      return;
    }

    // Show chat selection modal
    this.displayChatSelector();
  }

  displayChatSelector() {
    const elements = this.uiManager.displayChatSelector(this.chats, this.pendingText);

    // Add event listeners for chat selection
    elements.selectorItems.forEach(item => {
      item.addEventListener('click', () => {
        const chatId = parseInt(item.dataset.chatId);
        this.continueExistingChat(chatId);
      });
    });

    elements.createNewBtn.addEventListener('click', () => {
      this.createNewChatWithText();
    });
  }

  continueExistingChat(chatId) {
    // Update the last known source URL if we have one
    if (this.pendingSource) {
      const chat = this.chats.get(chatId);
      if (chat) {
        chat.lastSourceUrl = this.pendingSource;
        chat.lastActivity = new Date().toISOString();
      }
    }
    
    this.loadChat(chatId);
    this.preFillInput(false); // Don't include source for existing chats
  }

  continueChatFromContext() {
    if (this.targetChatId && this.chats.has(this.targetChatId)) {
      // Update the last known source URL if we have one
      if (this.pendingSource) {
        const chat = this.chats.get(this.targetChatId);
        if (chat) {
          chat.lastSourceUrl = this.pendingSource;
          chat.lastActivity = new Date().toISOString();
        }
      }
      
      this.loadChat(this.targetChatId);
      this.preFillInput(false); // Don't include source for existing chats
    } else {
      // Fallback to creating new chat if target chat doesn't exist
      this.createNewChatWithText();
    }
  }

  /**
   * Pre-fill input with pending text from context menu
   * Shows text as quote block instead of direct input for better UX
   * Clears pending state after processing
   * @param {boolean} includeSource - Whether to include source URL (deprecated)
   */
  preFillInput(includeSource = false) {
    if (this.pendingText) {
      // Show quote block in input instead of pre-filling text
      this.uiManager.showInputQuote(this.pendingText, this.pendingSource);
      this.uiManager.focusInput();
      this.uiManager.updateSendButton();
      
      // Clear the pending text after using it
      this.pendingText = null;
      this.pendingSource = null;
    }
  }

  /**
   * Load and display specific chat by ID
   * Updates all UI components and saves current state
   * @param {number} chatId - ID of chat to load and display
   */
  loadChat(chatId) {
    this.currentChatId = chatId;
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.uiManager.renderMessages(this.chats.get(this.currentChatId));
    this.updateChatHeader();
    this.uiManager.clearInput();
    this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
  }

  /**
   * Update chat header with source link and editable title
   * Sets up event listeners for source link clicks and title editing
   * Only shows header for chats with source URLs
   */
  updateChatHeader() {
    const currentChat = this.chats.get(this.currentChatId);
    const headerElements = this.uiManager.updateChatHeader(currentChat);
    
    // Add click handler if header elements exist
    if (headerElements) {
      if (headerElements.sourceLink) {
        headerElements.sourceLink.addEventListener('click', (e) => {
          e.preventDefault();
          const url = headerElements.sourceLink.dataset.url;
          this.openOrFocusUrl(url);
        });
      }
      
      if (headerElements.titleInput) {
        // Add title editing functionality
        headerElements.titleInput.addEventListener('blur', () => {
          this.updateChatTitle(headerElements.titleInput.value);
        });
        
        headerElements.titleInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            headerElements.titleInput.blur();
          }
          if (e.key === 'Escape') {
            headerElements.titleInput.value = currentChat.title;
            headerElements.titleInput.blur();
          }
        });
      }
    }
  }

  /**
   * Update chat title and persist changes
   * Validates title is different and non-empty before saving
   * @param {string} newTitle - New title for the current chat
   */
  updateChatTitle(newTitle) {
    const currentChat = this.chats.get(this.currentChatId);
    if (currentChat && newTitle.trim() && newTitle.trim() !== currentChat.title) {
      currentChat.title = newTitle.trim();
      currentChat.lastActivity = new Date().toISOString();
      this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
      this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
    }
  }

  /**
   * Search through chat titles and message content
   * Filters chat history display based on search query
   * Searches both chat titles and all message content for matches
   * @param {string} query - Search term to filter chats by
   */
  searchChats(query) {
    if (!query.trim()) {
      // Show all chats if query is empty
      this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
      return;
    }
    
    const searchTerm = query.toLowerCase();
    const filteredChats = Array.from(this.chats.values()).filter(chat => {
      // Search in chat title
      if (chat.title.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // Search in message content
      return chat.messages.some(message => 
        message.content.toLowerCase().includes(searchTerm)
      );
    });
    
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId, filteredChats);
  }

  /**
   * Send user message and trigger AI response
   * Handles quote formatting, auto-title generation, and message persistence
   * Clears input after sending and initiates AI response flow
   */
  sendMessage() {
    // Get formatted content (includes quote if present)
    const content = this.uiManager.getFormattedMessageWithQuote();
    
    if (!content) return;

    const currentChat = this.chats.get(this.currentChatId);
    if (!currentChat) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: content,
      timestamp: new Date().toISOString()
    };
    
    currentChat.messages.push(userMessage);
    currentChat.lastActivity = new Date().toISOString();

    // Update chat title if it's a new chat (but not if it already has a meaningful title from context menu)
    if (currentChat.title === 'New Chat' && content.length > 0) {
      // Extract first non-quoted text for title (no source URL in content now)
      let titleText = content;
      const quoteMatch = content.match(/^"(.+?)"\n\n(.+)?$/s);
      if (quoteMatch && quoteMatch[2]) {
        titleText = quoteMatch[2];
      } else if (quoteMatch) {
        titleText = quoteMatch[1];
      }
      
      currentChat.title = titleText.length > 30 ? titleText.substring(0, 30) + '...' : titleText;
    }

    // Clear input and quote
    this.uiManager.clearInput();
    this.uiManager.hideInputQuote();

    // Update displays and save
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.uiManager.renderMessages(currentChat);
    this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);

    // Get AI response from OpenAI
    this.getAIResponse(content);
  }

  /**
   * Get AI response from OpenAI Assistant
   * Handles API key validation, loading states, and error handling
   * Updates chat with loading message, then replaces with actual response
   * @param {string} userMessage - User's message to send to AI
   */
  async getAIResponse(userMessage) {
    const currentChat = this.chats.get(this.currentChatId);
    if (!currentChat) return;

    // Check if API key is configured
    const apiKey = await this.storageManager.getOpenAIApiKey();
    if (!apiKey) {
      const errorMessage = {
        id: Date.now(),
        type: 'assistant',
        content: 'OpenAI API key not configured. Please click the settings icon (⚙️) in the top-right corner to configure your API key.',
        isError: true,
        timestamp: new Date().toISOString()
      };

      currentChat.messages.push(errorMessage);
      currentChat.lastActivity = new Date().toISOString();
      this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
      this.uiManager.renderMessages(currentChat);
      this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
      return;
    }

    // Add loading message
    const loadingMessage = {
      id: `loading-${Date.now()}`,
      type: 'assistant',
      content: 'Analyzing your message...',
      isLoading: true,
      timestamp: new Date().toISOString()
    };

    currentChat.messages.push(loadingMessage);
    this.uiManager.renderMessages(currentChat);

    try {
      // Get response from OpenAI
      const response = await this.openaiClient.sendMessage(userMessage);
      
      // Remove loading message
      const loadingIndex = currentChat.messages.findIndex(msg => msg.id === loadingMessage.id);
      if (loadingIndex !== -1) {
        currentChat.messages.splice(loadingIndex, 1);
      }

      // Add AI response
      const aiMessage = {
        id: Date.now(),
        type: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };

      currentChat.messages.push(aiMessage);
      currentChat.lastActivity = new Date().toISOString();
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Remove loading message
      const loadingIndex = currentChat.messages.findIndex(msg => msg.id === loadingMessage.id);
      if (loadingIndex !== -1) {
        currentChat.messages.splice(loadingIndex, 1);
      }

      // Add error message
      const errorMessage = {
        id: Date.now(),
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}\n\nPlease make sure your OpenAI API key is configured in Settings and try again.`,
        isError: true,
        timestamp: new Date().toISOString()
      };

      currentChat.messages.push(errorMessage);
      currentChat.lastActivity = new Date().toISOString();
    }
    
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.uiManager.renderMessages(currentChat);
    this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
  }

  renameChat(chatId) {
    const chat = this.chats.get(chatId);
    if (!chat) return;
    
    const newTitle = prompt('Enter new chat name:', chat.title);
    if (newTitle && newTitle.trim() && newTitle.trim() !== chat.title) {
      chat.title = newTitle.trim();
      this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
      this.storageManager.forceSave(this.chats, this.nextChatId, this.currentChatId);
    }
  }

  deleteChat(chatId) {
    const chat = this.chats.get(chatId);
    if (!chat) return;
    
    if (confirm(`Delete chat "${chat.title}"?`)) {
      this.chats.delete(chatId);
      
      // If we deleted the current chat, switch to another one or create new
      if (this.currentChatId === chatId) {
        const remainingChats = Array.from(this.chats.keys());
        if (remainingChats.length > 0) {
          this.loadChat(remainingChats[0]);
        } else {
          this.createNewChat();
        }
      }
      
      this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
      this.storageManager.forceSave(this.chats, this.nextChatId, this.currentChatId);
    }
  }

  /**
   * Toggle sidebar collapsed/expanded state
   * Saves state to localStorage for persistence
   */
  toggleSidebar() {
    const sidebar = this.uiManager.getElement('sidebar');
    this.sidebarCollapsed = !this.sidebarCollapsed;
    
    if (this.sidebarCollapsed) {
      sidebar.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
    }
    
    // Save state to localStorage
    localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed.toString());
  }

  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (error) {
      return 'Unknown Source';
    }
  }

  async openOrFocusUrl(url) {
    try {
      // Send message to background script to handle tab focusing
      await chrome.runtime.sendMessage({
        action: 'openOrFocusUrl',
        url: url
      });
    } catch (error) {
      console.error('Error opening URL:', error);
      // Fallback to normal link opening
      window.open(url, '_blank');
    }
  }

  // Settings functionality
  async openSettings() {
    this.uiManager.openSettingsModal();
    const apiKeyInput = this.uiManager.getElement('apiKeyInput');
    
    // Load existing API key if available
    try {
      const decryptedKey = await this.storageManager.getOpenAIApiKey();
      if (decryptedKey) {
        apiKeyInput.value = decryptedKey;
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
    
    // Settings modal event listeners
    this.setupSettingsEventListeners();
  }

  setupSettingsEventListeners() {
    const closeBtn = this.uiManager.getElement('closeSettings');
    const saveBtn = this.uiManager.getElement('saveSettings');
    const testBtn = this.uiManager.getElement('testConnection');
    const toggleBtn = this.uiManager.getElement('toggleApiKey');
    const apiKeyInput = this.uiManager.getElement('apiKeyInput');
    const modal = this.uiManager.getElement('settingsModal');

    // Close modal handlers
    const closeModal = () => {
      this.uiManager.closeSettingsModal();
    };

    closeBtn.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    // Toggle API key visibility
    toggleBtn.onclick = () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? '🙈' : '👁️';
    };

    // Save settings
    saveBtn.onclick = async () => {
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        this.uiManager.showSettingsStatus('Please enter an API key', 'error');
        return;
      }
      
      if (!apiKey.startsWith('sk-')) {
        this.uiManager.showSettingsStatus('Invalid API key format. OpenAI keys start with "sk-"', 'error');
        return;
      }

      try {
        saveBtn.disabled = true;
        this.uiManager.showSettingsStatus('Saving...', 'loading');
        
        await this.storageManager.saveOpenAIApiKey(apiKey);
        this.uiManager.showSettingsStatus('Settings saved successfully!', 'success');
        
        setTimeout(() => {
          closeModal();
        }, 1500);
      } catch (error) {
        console.error('Error saving settings:', error);
        this.uiManager.showSettingsStatus('Error saving settings. Please try again.', 'error');
      } finally {
        saveBtn.disabled = false;
      }
    };

    // Test connection
    testBtn.onclick = async () => {
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        this.uiManager.showSettingsStatus('Please enter an API key first', 'error');
        return;
      }

      try {
        testBtn.disabled = true;
        this.uiManager.showSettingsStatus('Testing connection...', 'loading');
        
        const success = await this.openaiClient.testConnection(apiKey);
        if (success) {
          this.uiManager.showSettingsStatus('Connection successful!', 'success');
        } else {
          this.uiManager.showSettingsStatus('Connection failed. Please check your API key.', 'error');
        }
      } catch (error) {
        console.error('Error testing connection:', error);
        this.uiManager.showSettingsStatus('Connection test failed. Please check your API key.', 'error');
      } finally {
        testBtn.disabled = false;
      }
    };
  }
}

// Initialize the chat manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('ChatManager initializing with modular architecture...');
  const manager = new ChatManager();
  console.log('ChatManager initialized:', manager);
  
  // Debug: Check if settings button exists
  const settingsBtn = document.getElementById('settingsBtn');
  console.log('Settings button found:', settingsBtn);
});