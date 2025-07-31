class ChatManager {
  constructor() {
    this.currentChatId = null;
    this.chats = new Map();
    this.nextChatId = 1;
    this.pendingText = null;
    this.pendingSource = null;
    this.saveTimeout = null;
    this.initializeFromURL();
    this.initializeStorage();
    this.initializeEventListeners();
  }

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

  async initializeStorage() {
    try {
      const result = await chrome.storage.local.get(['encryptedChats', 'nextChatId', 'currentChatId']);
      
      if (result.encryptedChats) {
        try {
          // Decrypt and parse chat data
          const decryptedData = await this.decryptData(result.encryptedChats);
          this.chats = new Map(Object.entries(decryptedData).map(([k, v]) => [parseInt(k), v]));
        } catch (decryptError) {
          console.warn('Failed to decrypt chat data, starting fresh');
          this.chats = new Map();
        }
      }
      
      if (result.nextChatId) {
        this.nextChatId = result.nextChatId;
      }
      
      if (result.currentChatId) {
        this.currentChatId = result.currentChatId;
      }
      
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
      
      this.updateChatHistoryDisplay();
      
      // Force save to ensure chatTitles are created for existing chats
      if (this.chats.size > 0) {
        this.saveToStorage();
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
      this.createInitialChat();
    }
  }

  async saveToStorage() {
    try {
      // Convert Map to plain object and encrypt sensitive data
      const chatsObj = Object.fromEntries(this.chats);
      const encryptedChats = await this.encryptData(chatsObj);
      
      // Also save chat titles separately for context menu (unencrypted for easy access)
      const chatTitles = {};
      for (const [chatId, chat] of this.chats) {
        chatTitles[chatId] = {
          title: chat.title,
          lastActivity: chat.lastActivity,
          hasMessages: chat.messages.length > 0
        };
      }
      
      await chrome.storage.local.set({
        encryptedChats: encryptedChats,
        chatTitles: chatTitles,
        nextChatId: this.nextChatId,
        currentChatId: this.currentChatId
      });
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  // Debounced save to prevent excessive storage operations
  debouncedSaveToStorage(delay = 1000) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveToStorage();
      this.saveTimeout = null;
    }, delay);
  }

  // Immediate save for critical operations
  async forceSaveToStorage() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.saveToStorage();
  }

  initializeEventListeners() {
    // New chat button
    document.getElementById('newChatBtn').addEventListener('click', () => {
      this.createNewChat();
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    // Search functionality
    const searchInput = document.getElementById('chatSearch');
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
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    messageInput.addEventListener('input', () => {
      this.adjustTextareaHeight();
      this.updateSendButton();
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
    this.updateChatHistoryDisplay();
    this.debouncedSaveToStorage();
    this.focusInput();
  }

  findEmptyChat() {
    for (const [chatId, chat] of this.chats) {
      if (chat.messages.length === 0) {
        return chatId;
      }
    }
    return null;
  }

  createNewChat() {
    // Check if there's already an empty chat - if so, just switch to it or do nothing
    const emptyChatId = this.findEmptyChat();
    if (emptyChatId) {
      // If we're already on the empty chat, just focus input
      if (this.currentChatId === emptyChatId) {
        this.focusInput();
        return;
      }
      // Otherwise switch to the empty chat
      this.loadChat(emptyChatId);
      this.focusInput();
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
    this.updateChatHistoryDisplay();
    this.debouncedSaveToStorage();
    this.focusInput();
  }

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
      this.debouncedSaveToStorage(); // Save the title change
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
    this.updateChatHistoryDisplay();
    this.debouncedSaveToStorage();
    
    // Pre-fill the input with just the selected text (source is in header now)
    this.preFillInput(false);
  }

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
    const messagesContainer = document.getElementById('messagesContainer');
    const sortedChats = Array.from(this.chats.values()).sort((a, b) => {
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
            <div class="text-preview">${this.sanitizeInput(this.pendingText)}</div>
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

    // Add event listeners for chat selection
    document.querySelectorAll('.chat-selector-item').forEach(item => {
      item.addEventListener('click', () => {
        const chatId = parseInt(item.dataset.chatId);
        this.continueExistingChat(chatId);
      });
    });

    document.getElementById('createNewChatBtn').addEventListener('click', () => {
      this.createNewChatWithText();
    });
  }

  continueExistingChat(chatId) {
    this.loadChat(chatId);
    this.preFillInput(false); // Don't include source for existing chats
  }

  continueChatFromContext() {
    if (this.targetChatId && this.chats.has(this.targetChatId)) {
      this.loadChat(this.targetChatId);
      this.preFillInput(false); // Don't include source for existing chats
    } else {
      // Fallback to creating new chat if target chat doesn't exist
      this.createNewChatWithText();
    }
  }

  preFillInput(includeSource = false) {
    if (this.pendingText) {
      const messageInput = document.getElementById('messageInput');
      let textToInsert = this.pendingText;
      
      // Only include source if specifically requested (for new chats)
      if (includeSource && this.pendingSource) {
        textToInsert += `\n\nSource: ${this.pendingSource}`;
      }
      
      messageInput.value = textToInsert;
      this.adjustTextareaHeight();
      this.updateSendButton();
      this.focusInput();
      
      // Clear the pending text after using it
      this.pendingText = null;
      this.pendingSource = null;
    }
  }

  loadChat(chatId) {
    this.currentChatId = chatId;
    this.updateChatHistoryDisplay();
    this.renderMessages();
    this.updateChatHeader();
    this.clearInput();
    this.debouncedSaveToStorage();
  }

  updateChatHistoryDisplay(filteredChats = null) {
    const chatHistory = document.getElementById('chatHistory');
    
    // Use filtered chats if provided, otherwise use all chats
    const chatsToDisplay = filteredChats || Array.from(this.chats.values());
    
    // Sort chats by last activity (most recent first)
    const sortedChats = chatsToDisplay.sort((a, b) => {
      const aTime = new Date(a.lastActivity || 0);
      const bTime = new Date(b.lastActivity || 0);
      return bTime - aTime;
    });
    
    if (sortedChats.length === 0) {
      chatHistory.innerHTML = '<div class="no-results">No chats found</div>';
      return;
    }
    
    const chatItemsHtml = sortedChats.map(chat => `
      <div class="chat-item ${chat.id === this.currentChatId ? 'active' : ''}" data-chat-id="${chat.id}">
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

  searchChats(query) {
    if (!query.trim()) {
      // Show all chats if query is empty
      this.updateChatHistoryDisplay();
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
    
    this.updateChatHistoryDisplay(filteredChats);
  }

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

  renderMessages() {
    const messagesContainer = document.getElementById('messagesContainer');
    const currentChat = this.chats.get(this.currentChatId);
    
    if (!currentChat || currentChat.messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">💬</div>
          <h2>Start a new conversation</h2>
          <p>Type your message below to begin chatting.</p>
        </div>
      `;
      return;
    }

    const messagesHtml = currentChat.messages.map(message => `
      <div class="message ${message.type} ${message.isLoading ? 'loading' : ''} ${message.isError ? 'error' : ''}">
        <div class="message-avatar">
          ${message.type === 'user' ? 'U' : 'AI'}
        </div>
        <div class="message-content">
          ${message.isLoading ? `<div class="loading-dots">${message.content}</div>` : this.formatMessage(message.content)}
        </div>
      </div>
    `).join('');

    messagesContainer.innerHTML = messagesHtml;
    this.scrollToBottom();
  }

  formatMessage(content) {
    // Sanitize and format message content
    const sanitized = this.sanitizeInput(content);
    return sanitized.replace(/\n/g, '<br>');
  }

  sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
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
      currentChat.title = content.length > 30 ? content.substring(0, 30) + '...' : content;
    }

    // Clear input
    messageInput.value = '';
    this.adjustTextareaHeight();
    this.updateSendButton();

    // Update displays and save
    this.updateChatHistoryDisplay();
    this.renderMessages();
    this.debouncedSaveToStorage();

    // Get AI response from OpenAI
    this.getAIResponse(content);
  }

  async getAIResponse(userMessage) {
    const currentChat = this.chats.get(this.currentChatId);
    if (!currentChat) return;

    // Check if API key is configured
    const apiKey = await this.getOpenAIApiKey();
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
      this.updateChatHistoryDisplay();
      this.renderMessages();
      this.debouncedSaveToStorage();
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
    this.renderMessages();

    try {
      // Get response from OpenAI
      const response = await this.sendMessageToOpenAI(userMessage);
      
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
    
    this.updateChatHistoryDisplay();
    this.renderMessages();
    this.debouncedSaveToStorage();
  }

  // Sanitize input to prevent XSS attacks
  sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }


  adjustTextareaHeight() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  updateSendButton() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = !messageInput.value.trim();
  }

  updateChatHeader() {
    const currentChat = this.chats.get(this.currentChatId);
    const chatHeader = document.getElementById('chatHeader');
    const chatSourceTitle = document.getElementById('chatSourceTitle');
    
    if (currentChat && currentChat.sourceUrl && currentChat.title !== 'New Chat') {
      // Show header with clickable full URL
      chatSourceTitle.innerHTML = `<a href="#" class="source-link" data-url="${currentChat.sourceUrl}">${currentChat.sourceUrl}</a>`;
      chatHeader.style.display = 'block';
      
      // Add click handler to focus existing tab or open new one
      const sourceLink = chatSourceTitle.querySelector('.source-link');
      sourceLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openOrFocusUrl(currentChat.sourceUrl);
      });
    } else {
      // Hide header for regular chats
      chatHeader.style.display = 'none';
    }
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  focusInput() {
    document.getElementById('messageInput').focus();
  }

  clearInput() {
    const messageInput = document.getElementById('messageInput');
    messageInput.value = '';
    this.adjustTextareaHeight();
    this.updateSendButton();
  }

  renameChat(chatId) {
    const chat = this.chats.get(chatId);
    if (!chat) return;
    
    const newTitle = prompt('Enter new chat name:', chat.title);
    if (newTitle && newTitle.trim() && newTitle.trim() !== chat.title) {
      chat.title = newTitle.trim();
      this.updateChatHistoryDisplay();
      this.forceSaveToStorage();
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
      
      this.updateChatHistoryDisplay();
      this.forceSaveToStorage();
    }
  }

  // Simple encryption using Web Crypto API for sensitive chat data
  async encryptData(data) {
    try {
      const key = await this.getOrCreateEncryptionKey();
      const encoder = new TextEncoder();
      const dataString = JSON.stringify(data);
      const dataBuffer = encoder.encode(dataString);
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        dataBuffer
      );
      
      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encryptedBuffer), iv.length);
      
      return Array.from(result);
    } catch (error) {
      console.error('Encryption failed:', error);
      // Fallback to unencrypted storage if encryption fails
      return JSON.stringify(data);
    }
  }

  async decryptData(encryptedArray) {
    try {
      const key = await this.getOrCreateEncryptionKey();
      
      // Handle both encrypted array and fallback string formats
      if (typeof encryptedArray === 'string') {
        return JSON.parse(encryptedArray);
      }
      
      const encryptedData = new Uint8Array(encryptedArray);
      const iv = encryptedData.slice(0, 12);
      const data = encryptedData.slice(12);
      
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );
      
      const decoder = new TextDecoder();
      const decryptedString = decoder.decode(decryptedBuffer);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }

  async getOrCreateEncryptionKey() {
    // Check if key already exists in storage
    const result = await chrome.storage.local.get(['encryptionKey']);
    
    if (result.encryptionKey) {
      return await crypto.subtle.importKey(
        'raw',
        new Uint8Array(result.encryptionKey),
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    }
    
    // Generate new key if none exists
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Export and store the key
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    await chrome.storage.local.set({
      encryptionKey: Array.from(new Uint8Array(exportedKey))
    });
    
    return key;
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
    const modal = document.getElementById('settingsModal');
    const apiKeyInput = document.getElementById('apiKeyInput');
    
    // Load existing API key if available
    try {
      const decryptedKey = await this.getOpenAIApiKey();
      if (decryptedKey) {
        apiKeyInput.value = decryptedKey;
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
    
    modal.style.display = 'flex';
    
    // Settings modal event listeners
    this.setupSettingsEventListeners();
  }

  setupSettingsEventListeners() {
    const modal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('closeSettings');
    const saveBtn = document.getElementById('saveSettings');
    const testBtn = document.getElementById('testConnection');
    const toggleBtn = document.getElementById('toggleApiKey');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const status = document.getElementById('settingsStatus');

    // Close modal handlers
    const closeModal = () => {
      modal.style.display = 'none';
      status.className = 'settings-status';
      status.style.display = 'none';
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
        this.showSettingsStatus('Please enter an API key', 'error');
        return;
      }
      
      if (!apiKey.startsWith('sk-')) {
        this.showSettingsStatus('Invalid API key format. OpenAI keys start with "sk-"', 'error');
        return;
      }

      try {
        saveBtn.disabled = true;
        this.showSettingsStatus('Saving...', 'loading');
        
        await this.saveOpenAIApiKey(apiKey);
        this.showSettingsStatus('Settings saved successfully!', 'success');
        
        setTimeout(() => {
          closeModal();
        }, 1500);
      } catch (error) {
        console.error('Error saving settings:', error);
        this.showSettingsStatus('Error saving settings. Please try again.', 'error');
      } finally {
        saveBtn.disabled = false;
      }
    };

    // Test connection
    testBtn.onclick = async () => {
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        this.showSettingsStatus('Please enter an API key first', 'error');
        return;
      }

      try {
        testBtn.disabled = true;
        this.showSettingsStatus('Testing connection...', 'loading');
        
        const success = await this.testOpenAIConnection(apiKey);
        if (success) {
          this.showSettingsStatus('Connection successful!', 'success');
        } else {
          this.showSettingsStatus('Connection failed. Please check your API key.', 'error');
        }
      } catch (error) {
        console.error('Error testing connection:', error);
        this.showSettingsStatus('Connection test failed. Please check your API key.', 'error');
      } finally {
        testBtn.disabled = false;
      }
    };
  }

  showSettingsStatus(message, type) {
    const status = document.getElementById('settingsStatus');
    status.textContent = message;
    status.className = `settings-status ${type}`;
  }

  // OpenAI API key management
  async saveOpenAIApiKey(apiKey) {
    try {
      const encryptedKey = await this.encryptData(apiKey);
      await chrome.storage.local.set({
        encryptedOpenAIKey: encryptedKey
      });
    } catch (error) {
      console.error('Error saving API key:', error);
      throw error;
    }
  }

  async getOpenAIApiKey() {
    try {
      const result = await chrome.storage.local.get(['encryptedOpenAIKey']);
      if (result.encryptedOpenAIKey) {
        return await this.decryptData(result.encryptedOpenAIKey);
      }
      return null;
    } catch (error) {
      console.error('Error retrieving API key:', error);
      throw error;
    }
  }

  async testOpenAIConnection(apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error testing OpenAI connection:', error);
      return false;
    }
  }

  // OpenAI API integration
  async sendMessageToOpenAI(message) {
    try {
      const apiKey = await this.getOpenAIApiKey();
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please configure it in Settings.');
      }

      // Create a thread
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!threadResponse.ok) {
        const error = await threadResponse.json();
        throw new Error(`Failed to create thread: ${error.error?.message || 'Unknown error'}`);
      }

      const thread = await threadResponse.json();

      // Add message to thread
      const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          role: 'user',
          content: message
        })
      });

      if (!messageResponse.ok) {
        const error = await messageResponse.json();
        throw new Error(`Failed to add message: ${error.error?.message || 'Unknown error'}`);
      }

      // Create run with the specified assistant
      const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          assistant_id: 'asst_1WukdMISy691nNjcLIwjKFfs'
        })
      });

      if (!runResponse.ok) {
        const error = await runResponse.json();
        throw new Error(`Failed to create run: ${error.error?.message || 'Unknown error'}`);
      }

      const run = await runResponse.json();

      // Poll for completion with exponential backoff
      let runStatus = run;
      let pollInterval = 500; // Start with 500ms
      let maxInterval = 8000; // Max 8 seconds
      let attempts = 0;
      const maxAttempts = 60; // Maximum 60 attempts (up to 5 minutes total)
      
      while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
        if (attempts >= maxAttempts) {
          throw new Error('Request timeout: Assistant is taking too long to respond');
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const statusResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        if (!statusResponse.ok) {
          throw new Error('Failed to check run status');
        }
        
        runStatus = await statusResponse.json();
        attempts++;
        
        // Exponential backoff: double interval up to max, but cap it
        pollInterval = Math.min(pollInterval * 1.5, maxInterval);
      }

      if (runStatus.status !== 'completed') {
        throw new Error(`Run failed with status: ${runStatus.status}`);
      }

      // Get messages
      const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!messagesResponse.ok) {
        throw new Error('Failed to get messages');
      }

      const messages = await messagesResponse.json();
      const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
      
      if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
        return assistantMessage.content[0].text.value;
      }
      
      throw new Error('No response from assistant');
    } catch (error) {
      console.error('Error communicating with OpenAI:', error);
      throw error;
    }
  }

}

// Initialize the chat manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('ChatManager initializing with OpenAI integration...');
  const manager = new ChatManager();
  console.log('ChatManager initialized:', manager);
  
  // Debug: Check if settings button exists
  const settingsBtn = document.getElementById('settingsBtn');
  console.log('Settings button found:', settingsBtn);
});