/**
 * Chat Application Orchestrator
 * Main application controller that coordinates specialized controllers
 * 
 * Features:
 * - Lightweight orchestration layer
 * - Event-driven communication between components
 * - Centralized initialization and cleanup
 * - Simplified component coordination
 * 
 * @class ChatApplication
 */
class ChatApplication {
  /**
   * Initialize the chat application
   * @constructor
   */
  constructor() {
    /** @type {EventBus} Central event bus for component communication */
    this.eventBus = new EventBus();
    
    /** @type {boolean} Application initialization status */
    this.initialized = false;
    
    /** @type {Object} Cross-browser runtime API */
    this.runtime = this._getBrowserRuntime();
    
    /** @type {Object} Component instances */
    this.components = {
      iconManager: null,
      storageManager: null,
      poeClient: null,
      uiManager: null,
      routingController: null,
      chatController: null,
      messageController: null,
      settingsController: null
    };

    /** @type {Object} Tab notification system */
    this.tabNotification = {
      isBlinking: false,
      originalTitle: 'debunkr.org Dashboard',
      originalFavicon: null,
      blinkInterval: null,
      blinkCount: 0,
      maxBlinks: 10
    };

    // Enable debug logging in development
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('dev')) {
      this.eventBus.setDebug(true);
    }

    // Set up global error handling
    this.setupGlobalErrorHandling();

    // Initialize application
    this.initialize();
  }

  /**
   * Get cross-browser compatible runtime API
   * @private
   * @returns {Object} Runtime API object
   */
  _getBrowserRuntime() {
    if (typeof browser !== 'undefined' && browser.runtime) {
      return browser.runtime;
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
      return {
        sendMessage: (message) => new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        })
      };
    } else {
      throw new Error('No runtime API available');
    }
  }

  /**
   * Set up global error handling
   */
  setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
      console.error('[ChatApplication] Global error:', event.error);
      this.eventBus.emit(EventTypes.APP_ERROR, {
        type: 'global',
        error: event.error.message,
        filename: event.filename,
        lineno: event.lineno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[ChatApplication] Unhandled promise rejection:', event.reason);
      this.eventBus.emit(EventTypes.APP_ERROR, {
        type: 'unhandledPromise',
        error: event.reason
      });
    });

    // Set up cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  /**
   * Initialize all application components
   */
  async initialize() {
    try {
      console.log('[ChatApplication] Starting initialization...');

      // Initialize core components first
      await this.initializeCoreComponents();

      // Initialize controllers
      await this.initializeControllers();

      // Set up application-level event listeners
      this.setupApplicationEventListeners();

      // Initialize routing and load initial state
      await this.initializeApplicationState();

      this.initialized = true;

      // Emit application ready event
      this.eventBus.emit(EventTypes.APP_READY, {
        timestamp: new Date().toISOString(),
        components: Object.keys(this.components)
      });

      console.log('[ChatApplication] Initialization completed successfully');

    } catch (error) {
      console.error('[ChatApplication] Initialization failed:', error);
      this.eventBus.emit(EventTypes.APP_ERROR, {
        type: 'initialization',
        error: error.message
      });
      
      // Show user-friendly error message
      this.showInitializationError(error);
    }
  }

  /**
   * Initialize core components (storage, API, UI)
   */
  async initializeCoreComponents() {
    // Initialize icon manager
    this.components.iconManager = new IconManager();
    await this.components.iconManager.preloadIcons();
    
    // Initialize storage manager
    this.components.storageManager = new StorageManager();
    
    // Initialize Poe API client
    this.components.poeClient = new PoeClient(this.components.storageManager);
    
    // Initialize UI manager with event bus and icon manager
    this.components.uiManager = new UIManager();
    this.components.uiManager.eventBus = this.eventBus;
    this.components.uiManager.iconManager = this.components.iconManager;

    console.log('[ChatApplication] Core components initialized');
  }

  /**
   * Initialize specialized controllers
   */
  async initializeControllers() {
    // Initialize routing controller
    this.components.routingController = new RoutingController(this.eventBus);
    
    // Initialize chat controller
    this.components.chatController = new ChatController(
      this.eventBus, 
      this.components.storageManager
    );
    
    // Initialize message controller
    this.components.messageController = new MessageController(
      this.eventBus,
      this.components.poeClient,
      this.components.storageManager
    );
    
    // Initialize settings controller
    this.components.settingsController = new SettingsController(
      this.eventBus,
      this.components.storageManager,
      this.components.poeClient,
      this.components.uiManager
    );

    console.log('[ChatApplication] Controllers initialized');
  }

  /**
   * Set up application-level event listeners
   */
  setupApplicationEventListeners() {
    // Handle UI events
    this.eventBus.on(EventTypes.UI_UPDATE, this.handleUIUpdate.bind(this));
    this.eventBus.on(EventTypes.UI_FOCUS, this.handleUIFocus.bind(this));
    this.eventBus.on(EventTypes.UI_CLEAR, this.handleUIClear.bind(this));

    // Handle storage events
    this.eventBus.on(EventTypes.STORAGE_LOADED, this.handleStorageLoaded.bind(this));
    this.eventBus.on(EventTypes.STORAGE_ERROR, this.handleStorageError.bind(this));

    // Handle application errors
    this.eventBus.on(EventTypes.APP_ERROR, this.handleApplicationError.bind(this));

    // Handle message events for notifications
    this.eventBus.on(EventTypes.MESSAGE_RECEIVED, this.handleMessageReceived.bind(this));

    // Set up DOM event listeners
    this.setupDOMEventListeners();
    
    // Set up tab notification system
    this.setupTabNotifications();
    
    // Set up welcome message listeners for settings button
    this.components.uiManager.setupWelcomeMessageListeners();

    console.log('[ChatApplication] Application event listeners set up');
  }

  /**
   * Set up DOM event listeners
   */
  setupDOMEventListeners() {
    // Sidebar toggle
    const collapseBtn = this.components.uiManager.getElement('collapseBtn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => this.toggleSidebar());
    }

    // New chat button
    const newChatBtn = this.components.uiManager.getElement('newChatBtn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => this.createNewChat());
    }

    // Settings button
    const settingsBtn = this.components.uiManager.getElement('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings());
    }

    // Message input and send
    const messageInput = this.components.uiManager.getElement('messageInput');
    const sendButton = this.components.uiManager.getElement('sendButton');
    
    console.log('[ChatApplication] Setting up message input/send listeners:', { messageInput, sendButton });
    
    if (messageInput && sendButton) {
      messageInput.addEventListener('input', () => {
        this.components.uiManager.adjustTextareaHeight();
        this.components.uiManager.updateSendButton();
      });

      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          console.log('[ChatApplication] Enter key pressed, sending message');
          this.sendMessage();
        }
      });

      messageInput.addEventListener('paste', (e) => {
        this.components.uiManager.handlePasteImage(e);
      });

      sendButton.addEventListener('click', (e) => {
        console.log('[ChatApplication] Send button clicked');
        this.sendMessage();
      });
      
      console.log('[ChatApplication] Message input/send listeners attached successfully');
    } else {
      console.error('[ChatApplication] Could not find messageInput or sendButton elements');
    }

    // Image upload
    const imageUploadBtn = this.components.uiManager.getElement('imageUploadBtn');
    const imageFileInput = this.components.uiManager.getElement('imageFileInput');
    
    if (imageUploadBtn && imageFileInput) {
      imageUploadBtn.addEventListener('click', () => {
        imageFileInput.click();
      });
      
      imageFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
          await this.components.uiManager.addAttachedImage(file, file.name);
        }
        e.target.value = '';
      });
    }

    // Chat search
    const searchInput = this.components.uiManager.getElement('chatSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.searchChats(e.target.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.target.value = '';
          this.searchChats('');
        }
      });
    }

    // Chat item clicks (using event delegation)
    document.addEventListener('click', (e) => {
      this.handleDocumentClick(e);
    });

    console.log('[ChatApplication] DOM event listeners set up');
  }

  /**
   * Initialize application state (routing, storage, initial chat)
   */
  async initializeApplicationState() {
    try {
      // Parse URL parameters for routing
      const routingData = this.components.routingController.initializeFromURL();
      
      // Load data from storage
      const storageData = await this.components.storageManager.loadData();
      
      // Initialize chat controller with storage data
      await this.components.chatController.initializeFromStorage(storageData);
      
      // Process routing decision
      await this.processRoutingDecision(routingData, storageData);
      
      // Set up sidebar state
      this.initializeSidebarState();

      console.log('[ChatApplication] Application state initialized');

    } catch (error) {
      console.error('[ChatApplication] Error initializing application state:', error);
      
      // Fallback: create initial chat
      this.components.chatController.createNewChat();
    }
  }

  /**
   * Process routing decision based on URL parameters
   * @param {Object} routingData - Routing data from URL
   * @param {Object} storageData - Data from storage
   */
  async processRoutingDecision(routingData, storageData) {
    const chats = this.components.chatController.getAllChats();
    const decision = this.components.routingController.processRoutingAction(chats);

    switch (decision.action) {
      case 'createNewChatWithText':
        this.components.chatController.createNewChatWithText(
          decision.data.text,
          decision.data.source
        );
        break;

      case 'showChatSelector':
        this.showChatSelector(decision.data);
        break;

      case 'continueChatFromContext':
        this.continueChatFromContext(decision.data);
        break;

      case 'createInitialChat':
        this.components.chatController.createNewChat();
        // Ensure welcome message is displayed and set up
        setTimeout(() => {
          this.components.uiManager.setupWelcomeMessageListeners();
        }, 100);
        break;

      case 'loadDefaultChat':
        this.loadDefaultChat(storageData);
        break;

      default:
        console.warn('[ChatApplication] Unknown routing decision:', decision.action);
    }
  }

  /**
   * Initialize sidebar collapsed state
   */
  initializeSidebarState() {
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed) {
      this.setSidebarCollapsed(true);
    }
  }

  /**
   * Application action methods
   */
  
  createNewChat() {
    this.components.chatController.createNewChat();
    this.components.uiManager.focusInput();
    // Ensure welcome message listeners are set up for new empty chats
    setTimeout(() => {
      this.components.uiManager.setupWelcomeMessageListeners();
    }, 100);
  }

  sendMessage() {
    console.log('[ChatApplication] sendMessage called');
    
    if (this.components.messageController.isRequestPending()) {
      console.log('[ChatApplication] Message controller request pending');
      return;
    }

    const messageWithImages = this.components.uiManager.getMessageWithImages();
    
    const currentChat = this.components.chatController.getCurrentChat();
    if (!currentChat) {
      console.error('[ChatApplication] No current chat for sending message');
      // Try to create a new chat if none exists
      this.createNewChat();
      const newChat = this.components.chatController.getCurrentChat();
      if (!newChat) {
        console.error('[ChatApplication] Failed to create new chat');
        return;
      }
    }

    const chatToUse = currentChat || this.components.chatController.getCurrentChat();
    
    this.components.messageController.sendMessage(
      chatToUse,
      messageWithImages.text,
      messageWithImages.images
    );
  }

  searchChats(query) {
    const results = this.components.chatController.searchChats(query);
    // Results are automatically handled by the chat controller event emission
  }

  openSettings() {
    this.components.settingsController.openSettings();
  }

  toggleSidebar() {
    const sidebar = this.components.uiManager.getElement('sidebar');
    const isCollapsed = sidebar.classList.contains('collapsed');
    this.setSidebarCollapsed(!isCollapsed);
  }

  setSidebarCollapsed(collapsed) {
    const sidebar = this.components.uiManager.getElement('sidebar');
    const logoImg = sidebar.querySelector('.sidebar-main-logo');
    
    if (collapsed) {
      sidebar.classList.add('collapsed');
      logoImg.src = 'assets/debunkr_logo_half.svg';
    } else {
      sidebar.classList.remove('collapsed');
      logoImg.src = 'assets/debunkr_logo.svg';
    }
    
    localStorage.setItem('sidebarCollapsed', collapsed.toString());
    
    this.eventBus.emit(EventTypes.UI_SIDEBAR_TOGGLE, {
      collapsed: collapsed
    });
  }

  /**
   * Handle document clicks for chat items
   * @param {Event} e - Click event
   */
  handleDocumentClick(e) {
    // Handle chat rename
    if (e.target.closest('.rename-btn')) {
      e.stopPropagation();
      const chatId = parseInt(e.target.closest('.rename-btn').dataset.chatId);
      this.components.chatController.renameChat(chatId);
      return;
    }

    // Handle chat delete
    if (e.target.closest('.delete-btn')) {
      e.stopPropagation();
      const chatId = parseInt(e.target.closest('.delete-btn').dataset.chatId);
      this.components.chatController.deleteChat(chatId);
      return;
    }

    // Handle chat selection
    const chatItem = e.target.closest('.chat-item');
    if (chatItem && !e.target.closest('.chat-actions')) {
      const chatId = parseInt(chatItem.dataset.chatId);
      this.components.chatController.loadChat(chatId);
    }
  }

  /**
   * Helper methods for routing decisions
   */
  
  showChatSelector(data) {
    const chats = this.components.chatController.getAllChats();
    const elements = this.components.uiManager.displayChatSelector(chats, data.text);
    
    elements.selectorItems.forEach(item => {
      item.addEventListener('click', () => {
        const chatId = parseInt(item.dataset.chatId);
        this.continueChatFromContext({ chatId, text: data.text, source: data.source });
      });
    });
    
    elements.createNewBtn.addEventListener('click', () => {
      this.components.chatController.createNewChatWithText(data.text, data.source);
    });
  }

  continueChatFromContext(data) {
    const chat = this.components.chatController.getChat(data.chatId);
    if (chat && data.source) {
      chat.lastSourceUrl = data.source;
    }
    
    this.components.chatController.loadChat(data.chatId);
    
    // Pre-fill input
    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'preFillInput',
      data: { text: data.text, source: data.source }
    });
  }

  loadDefaultChat(storageData) {
    const chats = this.components.chatController.getAllChats();
    const chatToLoad = storageData.currentChatId && chats.has(storageData.currentChatId)
      ? storageData.currentChatId
      : Array.from(chats.keys())[0];
    
    if (chatToLoad) {
      this.components.chatController.loadChat(chatToLoad);
    } else {
      this.components.chatController.createNewChat();
    }
  }

  /**
   * Event handlers
   */
  
  handleUIUpdate(data) {
    switch (data.type) {
      case 'renderMessages':
        this.components.uiManager.renderMessages(data.chat);
        // Re-setup welcome message listeners after rendering
        this.components.uiManager.setupWelcomeMessageListeners();
        break;
      case 'updateChatHistory':
        this.updateChatHistoryDisplay(data.filteredChats);
        break;
      case 'updateChatHeader':
        this.updateChatHeader(data.chat);
        break;
      case 'preFillInput':
        this.preFillInput(data.data);
        break;
    }
  }

  handleUIFocus(data) {
    if (data.type === 'input') {
      this.components.uiManager.focusInput();
    }
  }

  handleUIClear(data) {
    switch (data.type) {
      case 'input':
        if (data.preserveQuote) {
          // Only clear input text, preserve quote block when switching chats
          this.components.uiManager.clearInputText();
          this.components.uiManager.clearAttachedImages();
        } else {
          // Normal clear - clears everything including quote
          this.components.uiManager.clearInput();
        }
        break;
      case 'images':
        this.components.uiManager.clearAttachedImages();
        break;
    }
  }

  handleStorageLoaded(data) {
    console.log('[ChatApplication] Storage loaded:', data.type);
  }

  handleStorageError(data) {
    console.error('[ChatApplication] Storage error:', data.error);
  }

  handleApplicationError(data) {
    console.error('[ChatApplication] Application error:', data);
    
    // Could implement user notification here
    if (data.type === 'initialization') {
      this.showInitializationError(new Error(data.error));
    }
  }

  /**
   * UI helper methods
   */
  
  updateChatHistoryDisplay(filteredChats = null) {
    const chats = this.components.chatController.getAllChats();
    const currentChatId = this.components.chatController.getCurrentChat()?.id || null;
    
    this.components.uiManager.updateChatHistoryDisplay(chats, currentChatId, filteredChats);
  }

  updateChatHeader(chat) {
    const headerElements = this.components.uiManager.updateChatHeader(chat);
    if (headerElements) {
      // Set up header event listeners
      if (headerElements.sourceLink) {
        headerElements.sourceLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.openOrFocusUrl(headerElements.sourceLink.dataset.url);
        });
      }
      if (headerElements.titleInput) {
        headerElements.titleInput.addEventListener('blur', () => {
          this.components.chatController.renameChat(chat.id, headerElements.titleInput.value);
        });
        headerElements.titleInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') e.target.blur();
          if (e.key === 'Escape') {
            e.target.value = chat.title;
            e.target.blur();
          }
        });
      }
    }
  }

  preFillInput(data) {
    this.components.uiManager.showInputQuote(data.text, data.source);
    this.components.uiManager.focusInput();
    this.components.uiManager.updateSendButton();
    this.components.routingController.clearPendingData();
  }

  async openOrFocusUrl(url) {
    try {
      await this.runtime.sendMessage({ action: 'openOrFocusUrl', url: url });
    } catch (error) {
      console.error('[ChatApplication] Error opening URL:', error);
      window.open(url, '_blank');
    }
  }

  showInitializationError(error) {
    const messagesContainer = this.components.uiManager.getElement('messagesContainer');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="error-message">
          <h3>Application Error</h3>
          <p>Failed to initialize the application: ${error.message}</p>
          <p>Please refresh the page to try again.</p>
        </div>
      `;
    }
  }

  /**
   * Get application diagnostics
   * @returns {Promise<Object>} Diagnostic information
   */
  async getDiagnostics() {
    const diagnostics = {
      initialized: this.initialized,
      timestamp: new Date().toISOString(),
      eventBus: this.eventBus.getDiagnostics(),
      components: {}
    };

    // Get diagnostics from each component
    for (const [name, component] of Object.entries(this.components)) {
      if (component && typeof component.getDiagnostics === 'function') {
        try {
          diagnostics.components[name] = await component.getDiagnostics();
        } catch (error) {
          diagnostics.components[name] = { error: error.message };
        }
      }
    }

    return diagnostics;
  }

  /**
   * Clean up application and all components
   */
  async cleanup() {
    console.log('[ChatApplication] Starting cleanup...');

    try {
      // Clean up components in reverse order
      const componentNames = Object.keys(this.components).reverse();
      
      for (const name of componentNames) {
        const component = this.components[name];
        if (component && typeof component.cleanup === 'function') {
          try {
            await component.cleanup();
            console.log(`[ChatApplication] Cleaned up ${name}`);
          } catch (error) {
            console.error(`[ChatApplication] Error cleaning up ${name}:`, error);
          }
        }
      }

      // Stop any running tab notifications
      this.stopTabNotification();

      // Clear event bus
      this.eventBus.clearAll();

      // Clear component references
      this.components = {};

      this.initialized = false;

      console.log('[ChatApplication] Cleanup completed');

    } catch (error) {
      console.error('[ChatApplication] Error during cleanup:', error);
    }
  }

  /**
   * Set up tab notification system
   */
  setupTabNotifications() {
    // Store original favicon
    const faviconLink = document.querySelector('link[rel*="icon"]');
    this.tabNotification.originalFavicon = faviconLink ? faviconLink.href : null;

    // Listen for tab visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.stopTabNotification();
      }
    });

    console.log('[ChatApplication] Tab notification system set up');
  }

  /**
   * Handle message received event for notifications
   * @param {Object} data - Message received event data
   */
  handleMessageReceived(data) {
    // Only show notification for assistant messages when tab is hidden
    if (data.message && data.message.type === 'assistant' && document.visibilityState === 'hidden') {
      this.startTabNotification();
    }
  }

  /**
   * Start tab notification (blinking favicon and title)
   */
  startTabNotification() {
    if (this.tabNotification.isBlinking) {
      return; // Already blinking
    }

    console.log('[ChatApplication] Starting tab notification');
    this.tabNotification.isBlinking = true;
    this.tabNotification.blinkCount = 0;

    // Blink title and favicon
    this.tabNotification.blinkInterval = setInterval(() => {
      this.tabNotification.blinkCount++;

      if (this.tabNotification.blinkCount % 2 === 1) {
        // Show notification state
        document.title = '💬 New Message - debunkr.org';
        this.setFavicon('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23ff4444"/><text x="16" y="22" font-family="Arial" font-size="18" text-anchor="middle" fill="white">!</text></svg>');
      } else {
        // Show normal state
        document.title = this.tabNotification.originalTitle;
        this.setFavicon(this.tabNotification.originalFavicon);
      }

      // Stop after max blinks or if tab becomes visible
      if (this.tabNotification.blinkCount >= this.tabNotification.maxBlinks || document.visibilityState === 'visible') {
        this.stopTabNotification();
      }
    }, 1000); // Blink every second
  }

  /**
   * Stop tab notification
   */
  stopTabNotification() {
    if (!this.tabNotification.isBlinking) {
      return;
    }

    console.log('[ChatApplication] Stopping tab notification');
    this.tabNotification.isBlinking = false;

    // Clear interval
    if (this.tabNotification.blinkInterval) {
      clearInterval(this.tabNotification.blinkInterval);
      this.tabNotification.blinkInterval = null;
    }

    // Restore original title and favicon
    document.title = this.tabNotification.originalTitle;
    this.setFavicon(this.tabNotification.originalFavicon);
  }

  /**
   * Set favicon
   * @param {string} faviconUrl - URL or data URI for favicon
   */
  setFavicon(faviconUrl) {
    if (!faviconUrl) return;

    let faviconLink = document.querySelector('link[rel*="icon"]');
    
    if (!faviconLink) {
      // Create favicon link if it doesn't exist
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }
    
    faviconLink.href = faviconUrl;
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('ChatApplication initializing with modular architecture...');
  window.chatApplication = new ChatApplication();
});