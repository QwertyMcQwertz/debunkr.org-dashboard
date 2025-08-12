class ChatManager {
  constructor() {
    this.pendingSource = null;
    /** @type {boolean} Flag to track if settings event listeners are set up */
    this.settingsListenersSetup = false;

    // Initialize modular components
    /** @type {StorageManager} Handles encryption and persistence */
    this.storageManager = new StorageManager();
    /** @type {PoeClient} Manages Poe API communication */
    this.poeClient = new PoeClient(this.storageManager);
    /** @type {UIManager} Controls DOM and user interface */
    this.uiManager = new UIManager();

    // Begin initialization sequence
    this.initializeFromURL();
    this.initializeStorage();
    this.initializeEventListeners();
  }

  /**
   * Parse URL parameters for context menu integration
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
        if (this.chats.size === 0) {
          this.createInitialChat();
        } else {
          const chatToLoad = this.currentChatId && this.chats.has(this.currentChatId)
            ? this.currentChatId
            : Array.from(this.chats.keys())[0];
          this.loadChat(chatToLoad);
        }
      }

      this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);

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
   */
  initializeEventListeners() {
    this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (this.sidebarCollapsed) {
      const sidebar = this.uiManager.getElement('sidebar');
      const logoImg = sidebar.querySelector('.sidebar-main-logo');
      sidebar.classList.add('collapsed');
      // Set the appropriate logo for collapsed state
      logoImg.src = 'debunkr_logo_half.svg';
    }

    this.uiManager.getElement('newChatBtn').addEventListener('click', () => this.createNewChat());
    this.uiManager.getElement('settingsBtn').addEventListener('click', () => this.openSettings());
    this.uiManager.getElement('collapseBtn').addEventListener('click', () => this.toggleSidebar());
    
    // Set up welcome message listeners for clickable elements
    this.uiManager.setupWelcomeMessageListeners();

    const searchInput = this.uiManager.getElement('chatSearch');
    searchInput.addEventListener('input', (e) => this.searchChats(e.target.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.target.value = '';
        this.searchChats('');
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.rename-btn')) {
        e.stopPropagation();
        const chatId = parseInt(e.target.closest('.rename-btn').dataset.chatId);
        this.renameChat(chatId);
        return;
      }
      if (e.target.closest('.delete-btn')) {
        e.stopPropagation();
        const chatId = parseInt(e.target.closest('.delete-btn').dataset.chatId);
        this.deleteChat(chatId);
        return;
      }
      const chatItem = e.target.closest('.chat-item');
      if (chatItem && !e.target.closest('.chat-actions')) {
        const chatId = parseInt(chatItem.dataset.chatId);
        this.loadChat(chatId);
      }
    });

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
    sendButton.addEventListener('click', () => this.sendMessage());
  }

  /**
   * Create the first chat when no chats exist
   */
  createInitialChat() {
    const newChatId = this.nextChatId++;
    const newChat = {
      id: newChatId,
      title: 'New Chat',
      messages: [],
      lastActivity: new Date().toISOString(),
    };
    this.chats.set(newChatId, newChat);
    this.loadChat(newChatId);
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
    this.uiManager.focusInput();
  }

  /**
   * Find an existing chat with no messages
   */
  findEmptyChat() {
    for (const [chatId, chat] of this.chats) {
      if (chat.messages.length === 0) return chatId;
    }
    return null;
  }

  /**
   * Create new chat or switch to existing empty chat
   */
  createNewChat() {
    const emptyChatId = this.findEmptyChat();
    if (emptyChatId) {
      if (this.currentChatId === emptyChatId) {
        this.uiManager.focusInput();
        return;
      }
      this.loadChat(emptyChatId);
      this.uiManager.focusInput();
      return;
    }
    const newChatId = this.nextChatId++;
    const newChat = {
      id: newChatId,
      title: 'New Chat',
      messages: [],
      lastActivity: new Date().toISOString(),
    };
    this.chats.set(newChatId, newChat);
    this.loadChat(newChatId);
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
    this.uiManager.focusInput();
  }

  /**
   * Create new chat with pre-filled text from context menu
   */
  createNewChatWithText() {
    const emptyChatId = this.findEmptyChat();
    if (emptyChatId) {
      const emptyChat = this.chats.get(emptyChatId);
      if (this.pendingSource) {
        emptyChat.title = this.extractDomainFromUrl(this.pendingSource);
        emptyChat.sourceUrl = this.pendingSource;
      }
      this.loadChat(emptyChatId);
      this.preFillInput(false);
      this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
      return;
    }

    const newChatId = this.nextChatId++;
    let chatTitle = this.pendingSource ? this.extractDomainFromUrl(this.pendingSource) : 'New Chat';
    const newChat = {
      id: newChatId,
      title: chatTitle,
      messages: [],
      lastActivity: new Date().toISOString(),
      sourceUrl: this.pendingSource,
    };
    this.chats.set(newChatId, newChat);
    this.loadChat(newChatId);
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
    this.preFillInput(false);
  }

  /**
   * Display chat selection interface for context menu text
   */
  showChatSelector() {
    if (this.chats.size === 0) {
      this.createNewChatWithText();
      return;
    }
    this.displayChatSelector();
  }

  displayChatSelector() {
    const elements = this.uiManager.displayChatSelector(this.chats, this.pendingText);
    elements.selectorItems.forEach(item => {
      item.addEventListener('click', () => {
        const chatId = parseInt(item.dataset.chatId);
        this.continueExistingChat(chatId);
      });
    });
    elements.createNewBtn.addEventListener('click', () => this.createNewChatWithText());
  }

  continueExistingChat(chatId) {
    if (this.pendingSource) {
      const chat = this.chats.get(chatId);
      if (chat) {
        chat.lastSourceUrl = this.pendingSource;
        chat.lastActivity = new Date().toISOString();
      }
    }
    this.loadChat(chatId);
    this.preFillInput(false);
  }

  continueChatFromContext() {
    if (this.targetChatId && this.chats.has(this.targetChatId)) {
      if (this.pendingSource) {
        const chat = this.chats.get(this.targetChatId);
        if (chat) {
          chat.lastSourceUrl = this.pendingSource;
          chat.lastActivity = new Date().toISOString();
        }
      }
      this.loadChat(this.targetChatId);
      this.preFillInput(false);
    } else {
      this.createNewChatWithText();
    }
  }

  /**
   * Pre-fill input with pending text from context menu
   */
  preFillInput() {
    if (this.pendingText) {
      this.uiManager.showInputQuote(this.pendingText, this.pendingSource);
      this.uiManager.focusInput();
      this.uiManager.updateSendButton();
      this.pendingText = null;
      this.pendingSource = null;
    }
  }

  /**
   * Load and display specific chat by ID
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
   */
  updateChatHeader() {
    const currentChat = this.chats.get(this.currentChatId);
    const headerElements = this.uiManager.updateChatHeader(currentChat);
    if (headerElements) {
      if (headerElements.sourceLink) {
        headerElements.sourceLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.openOrFocusUrl(headerElements.sourceLink.dataset.url);
        });
      }
      if (headerElements.titleInput) {
        headerElements.titleInput.addEventListener('blur', () => this.updateChatTitle(headerElements.titleInput.value));
        headerElements.titleInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') e.target.blur();
          if (e.key === 'Escape') {
            e.target.value = currentChat.title;
            e.target.blur();
          }
        });
      }
    }
  }

  /**
   * Update chat title and persist changes
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
   */
  searchChats(query) {
    if (!query.trim()) {
      this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
      return;
    }
    const searchTerm = query.toLowerCase();
    const filteredChats = Array.from(this.chats.values()).filter(chat =>
      chat.title.toLowerCase().includes(searchTerm) ||
      chat.messages.some(message => message.content.toLowerCase().includes(searchTerm))
    );
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId, filteredChats);
  }

  /**
   * Send user message and trigger AI response
   */
  sendMessage() {
    const content = this.uiManager.getFormattedMessageWithQuote();
    if (!content) return;

    const currentChat = this.chats.get(this.currentChatId);
    if (!currentChat) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: content,
      timestamp: new Date().toISOString()
    };
    currentChat.messages.push(userMessage);
    currentChat.lastActivity = new Date().toISOString();

    if (currentChat.title === 'New Chat' && content.length > 0) {
      let titleText = content;
      const quoteMatch = content.match(/^"(.+?)"\n\n(.+)?$/s);
      if (quoteMatch) titleText = quoteMatch[2] || quoteMatch[1];
      currentChat.title = titleText.length > 30 ? titleText.substring(0, 30) + '...' : titleText;
    }

    this.uiManager.clearInput();
    this.uiManager.hideInputQuote();
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.uiManager.renderMessages(currentChat);
    this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
    this.getAIResponse();
  }

  /**
   * Get AI response from the Poe bot.
   */
  async getAIResponse() {
    const currentChat = this.chats.get(this.currentChatId);
    if (!currentChat) return;

    const apiKey = await this.storageManager.getOpenAIApiKey();
    if (!apiKey) {
      const errorMessage = {
        id: Date.now(),
        type: 'assistant',
        content: 'Poe API key not configured. Please click the settings icon (⚙️) to configure your API key.',
        isError: true,
        timestamp: new Date().toISOString()
      };
      currentChat.messages.push(errorMessage);
      this.uiManager.renderMessages(currentChat);
      this.storageManager.debouncedSave(this.chats, this.nextChatId, this.currentChatId);
      return;
    }

    const loadingMessage = {
      id: `loading-${Date.now()}`,
      type: 'assistant',
      content: 'debunkr is thinking...',
      isLoading: true,
      timestamp: new Date().toISOString()
    };
    currentChat.messages.push(loadingMessage);
    this.uiManager.renderMessages(currentChat);

    try {
      const response = await this.poeClient.sendMessage(currentChat.messages);
      const aiMessage = {
        id: Date.now(),
        type: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };
      const loadingIndex = currentChat.messages.findIndex(msg => msg.id === loadingMessage.id);
      if (loadingIndex !== -1) currentChat.messages.splice(loadingIndex, 1, aiMessage);
      else currentChat.messages.push(aiMessage);
      currentChat.lastActivity = new Date().toISOString();
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage = {
        id: Date.now(),
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}\n\nPlease make sure your Poe API key is configured in Settings and try again.`,
        isError: true,
        timestamp: new Date().toISOString()
      };
      const loadingIndex = currentChat.messages.findIndex(msg => msg.id === loadingMessage.id);
      if (loadingIndex !== -1) currentChat.messages.splice(loadingIndex, 1, errorMessage);
      else currentChat.messages.push(errorMessage);
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
    if (!chat || !confirm(`Delete chat "${chat.title}"?`)) return;

    this.chats.delete(chatId);
    if (this.currentChatId === chatId) {
      const remainingChats = Array.from(this.chats.keys());
      if (remainingChats.length > 0) this.loadChat(remainingChats[0]);
      else this.createNewChat();
    }
    this.uiManager.updateChatHistoryDisplay(this.chats, this.currentChatId);
    this.storageManager.forceSave(this.chats, this.nextChatId, this.currentChatId);
  }

  toggleSidebar() {
    const sidebar = this.uiManager.getElement('sidebar');
    const logoImg = sidebar.querySelector('.sidebar-main-logo');
    this.sidebarCollapsed = !this.sidebarCollapsed;
    sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
    
    // Switch logo based on collapsed state
    if (this.sidebarCollapsed) {
      logoImg.src = 'debunkr_logo_half.svg';
      logoImg.alt = 'debunkr';
    } else {
      logoImg.src = 'debunkr_logo.svg';
      logoImg.alt = 'debunkr';
    }
    
    localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed.toString());
  }

  extractDomainFromUrl(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch (error) {
      return 'Unknown Source';
    }
  }

  async openOrFocusUrl(url) {
    try {
      await chrome.runtime.sendMessage({ action: 'openOrFocusUrl', url: url });
    } catch (error) {
      console.error('Error opening URL:', error);
      window.open(url, '_blank');
    }
  }

  async openSettings() {
    const modal = this.uiManager.getElement('settingsModal');
    
    // Toggle functionality - close if already open
    if (modal && modal.style.display !== 'none') {
      this.uiManager.closeSettingsModal();
      return;
    }
    
    this.uiManager.openSettingsModal();
    const apiKeyInput = this.uiManager.getElement('apiKeyInput');
    try {
      const decryptedKey = await this.storageManager.getOpenAIApiKey();
      if (decryptedKey) apiKeyInput.value = decryptedKey;
    } catch (error) {
      console.error('Error loading API key:', error);
    }
    
    // Settings modal event listeners - only set up once
    if (!this.settingsListenersSetup) {
      this.setupSettingsEventListeners();
      this.settingsListenersSetup = true;
    }
  }

  setupSettingsEventListeners() {
    const closeBtn = this.uiManager.getElement('closeSettings');
    const saveBtn = this.uiManager.getElement('saveSettings');
    const testBtn = this.uiManager.getElement('testConnection');
    const toggleBtn = this.uiManager.getElement('toggleApiKey');
    const apiKeyInput = this.uiManager.getElement('apiKeyInput');
    const modal = this.uiManager.getElement('settingsModal');
    
    // Debug: Check if elements exist
    console.log('Settings elements:', {
      closeBtn, saveBtn, testBtn, toggleBtn, apiKeyInput, modal
    });

    const closeModal = () => this.uiManager.closeSettingsModal();
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    toggleBtn.onclick = () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? '👁️' : '👁️‍🗨️';
    };

    saveBtn.onclick = async () => {
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        this.uiManager.showSettingsStatus('Please enter a Poe API key', 'error');
        return;
      }
      try {
        saveBtn.disabled = true;
        this.uiManager.showSettingsStatus('Saving...', 'loading');
        await this.storageManager.saveOpenAIApiKey(apiKey);
        this.uiManager.showSettingsStatus('Settings saved successfully!', 'success');
        setTimeout(closeModal, 1500);
      } catch (error) {
        console.error('Error saving settings:', error);
        this.uiManager.showSettingsStatus('Error saving settings. Please try again.', 'error');
      } finally {
        saveBtn.disabled = false;
      }
    };

    // Test connection
    if (testBtn) {
      testBtn.onclick = async () => {
        console.log('Test connection button clicked');
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
          this.uiManager.showSettingsStatus('Please enter an API key first', 'error');
          return;
        }

        try {
          testBtn.disabled = true;
          this.uiManager.showSettingsStatus('Testing connection...', 'loading');
          console.log('About to test connection with API key');
          
          const success = await this.poeClient.testConnection(apiKey);
          console.log('Test connection result:', success);
          
          if (success) {
            this.uiManager.showSettingsStatus('Connection successful!', 'success');
          } else {
            this.uiManager.showSettingsStatus('Connection failed. Please check your API key.', 'error');
          }
        } catch (error) {
          console.error('Error testing connection:', error);
          this.uiManager.showSettingsStatus('Connection test failed: ' + error.message, 'error');
        } finally {
          testBtn.disabled = false;
          console.log('Test button re-enabled');
        }
      };
    } else {
      console.error('Test button not found!');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('ChatManager initializing with Poe API integration...');
  new ChatManager();
});