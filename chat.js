class ChatManager {
  constructor() {
    this.currentChatId = null;
    this.chats = new Map();
    this.nextChatId = 1;
    this.pendingText = null;
    this.pendingSource = null;
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

  initializeEventListeners() {
    // New chat button
    document.getElementById('newChatBtn').addEventListener('click', () => {
      this.createNewChat();
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
    this.saveToStorage();
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
    this.saveToStorage();
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
      this.saveToStorage(); // Save the title change
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
    this.saveToStorage();
    
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
    this.saveToStorage();
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
      <div class="message ${message.type}">
        <div class="message-avatar">
          ${message.type === 'user' ? 'U' : 'AI'}
        </div>
        <div class="message-content">
          ${this.formatMessage(message.content)}
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
    this.saveToStorage();

    // Simulate AI response (in a real app, this would call an API)
    setTimeout(() => {
      this.simulateAIResponse(content);
    }, 800);
  }

  simulateAIResponse(userMessage) {
    const currentChat = this.chats.get(this.currentChatId);
    if (!currentChat) return;

    // Sanitize user input to prevent any potential XSS
    const sanitizedMessage = this.sanitizeInput(userMessage);
    
    // Simple response simulation - in a real app, this would be an API call
    let response = "I understand you'd like me to help with analyzing information. ";
    
    const lowerMessage = sanitizedMessage.toLowerCase();
    
    if (lowerMessage.includes('fact-check') || lowerMessage.includes('verify')) {
      response += "To properly fact-check this claim, I would need to:\n\n1. Examine the original sources\n2. Cross-reference with reliable databases\n3. Check for any contradicting evidence\n4. Assess the credibility of the information source\n\nCould you please share the specific claim or content you'd like me to analyze?";
    } else if (lowerMessage.includes('source') || lowerMessage.includes('credibility')) {
      response += "When evaluating source credibility, I look at several factors:\n\n• Author expertise and credentials\n• Publication reputation and editorial standards\n• Transparency in methodology\n• Presence of citations and references\n• Potential conflicts of interest\n\nPlease share the source you'd like me to evaluate.";
    } else if (lowerMessage.includes('news') || lowerMessage.includes('article')) {
      response += "For news article verification, I can help you:\n\n• Check if the story is reported by multiple reliable sources\n• Verify quotes and statistics\n• Identify potential bias or misleading framing\n• Assess the timeliness and relevance of the information\n\nPlease share the article link or content for analysis.";
    } else {
      response += "I can help you with various aspects of information verification:\n\n• Fact-checking specific claims\n• Analyzing source credibility\n• Identifying potential misinformation patterns\n• Providing research guidance\n\nWhat specific information would you like me to help analyze?";
    }

    const aiMessage = {
      id: Date.now(),
      type: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    };

    currentChat.messages.push(aiMessage);
    currentChat.lastActivity = new Date().toISOString();
    
    this.updateChatHistoryDisplay();
    this.renderMessages();
    this.saveToStorage();
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
      this.saveToStorage();
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
      this.saveToStorage();
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

  // Sanitize input to prevent XSS attacks
  sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }
}

// Initialize the chat manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new ChatManager();
});