// Firefox-compatible background script (classic)
// Loads polyfill and compatibility layer, then runs main logic

// Use cross-browser API (available globally after browser-compat.js loads)
const { runtime, tabs, windows, storage, contextMenus } = browserAPI;

runtime.onInstalled.addListener(() => {
  console.log('debunkr.org Dashboard extension installed');
  setupContextMenus();
});

// Handle messages from content scripts or popup
runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openChat') {
    openOrFocusChatTab();
  } else if (request.action === 'openOrFocusUrl') {
    openOrFocusUrl(request.url);
  }
});

// Function to open URL or focus existing tab
async function openOrFocusUrl(url) {
  try {
    // Query for tabs with the exact URL
    const tabsResult = await tabs.query({url: url});
    
    if (tabsResult.length > 0) {
      // Focus the existing tab
      const existingTab = tabsResult[0];
      await tabs.update(existingTab.id, {active: true});
      await windows.update(existingTab.windowId, {focused: true});
    } else {
      // Create new tab if none exists
      tabs.create({url: url});
    }
  } catch (error) {
    console.error('Error handling URL:', error);
    // Fallback to creating new tab
    tabs.create({url: url});
  }
}

// Function to open chat tab or focus existing one
async function openOrFocusChatTab(urlParams = '') {
  const chatUrl = runtime.getURL('chat.html') + urlParams;
  const extensionUrl = runtime.getURL('chat.html');
  
  // Query for existing debunkr.org Dashboard tabs
  const tabsResult = await tabs.query({url: extensionUrl + '*'});
  
  if (tabsResult.length > 0) {
    // Focus the existing tab and update URL if needed
    const existingTab = tabsResult[0];
    await tabs.update(existingTab.id, {
      active: true,
      url: chatUrl
    });
    await windows.update(existingTab.windowId, {focused: true});
  } else {
    // Create new tab if none exists
    tabs.create({
      url: chatUrl
    });
  }
}

// Set up context menus
async function setupContextMenus() {
  try {
    // Remove existing menus
    await contextMenus.removeAll();
    
    // Small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create parent menu
    contextMenus.create({
      id: 'misinfoManager',
      title: 'debunkr.org Dashboard',
      contexts: ['selection']
    });
    
    // Create "New Chat" submenu
    contextMenus.create({
      id: 'newChat',
      parentId: 'misinfoManager',
      title: 'New Chat',
      contexts: ['selection']
    });
    
    // Add separator
    contextMenus.create({
      id: 'separator',
      parentId: 'misinfoManager',
      type: 'separator',
      contexts: ['selection']
    });
    
    // Load existing chats and add them to context menu
    await updateContextMenuWithChats();
  } catch (error) {
    console.error('Error setting up context menus:', error);
  }
}

// Update context menu with existing chats
async function updateContextMenuWithChats() {
  try {
    const result = await storage.local.get(['chatTitles']);
    console.log('Context menu update - chatTitles:', result.chatTitles);
    
    if (result.chatTitles && Object.keys(result.chatTitles).length > 0) {
      
      // Sort chats by last activity with robust filtering
      const sortedChats = Object.entries(result.chatTitles)
        .filter(([id, chat]) => {
          // Validate chat ID is a valid positive integer
          const chatId = parseInt(id);
          if (!Number.isInteger(chatId) || chatId <= 0) {
            console.warn(`[Background] Filtering out invalid chat ID: ${id}`);
            return false;
          }
          
          // Validate chat object exists and has required properties
          if (!chat || typeof chat !== 'object') {
            console.warn(`[Background] Filtering out invalid chat object for ID: ${id}`);
            return false;
          }
          
          // Only show chats with messages
          if (!chat.hasMessages) {
            return false;
          }
          
          return true;
        })
        .sort(([,a], [,b]) => new Date(b.lastActivity) - new Date(a.lastActivity))
        .slice(0, 5); // Limit to 5 most recent chats
      
      console.log('Sorted chats for context menu:', sortedChats);
      
      if (sortedChats.length > 0) {
        // Add each chat as a menu item
        sortedChats.forEach(([chatId, chat]) => {
          console.log('Creating context menu item for chat:', chatId, chat.title);
          try {
            contextMenus.create({
              id: `chat-${chatId}`,
              parentId: 'misinfoManager',
              title: chat.title.length > 30 ? chat.title.substring(0, 30) + '...' : chat.title,
              contexts: ['selection']
            });
          } catch (error) {
            console.warn(`[Background] Failed to create context menu for chat ${chatId}:`, error);
          }
        });
      }
    } else {
      console.log('No chatTitles found in storage for context menu');
    }
  } catch (error) {
    console.error('Error updating context menu:', error);
  }
}

// Handle context menu clicks
contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText;
  
  if (info.menuItemId === 'newChat') {
    // Open new chat with selected text
    const urlParams = '?action=newChat&text=' + encodeURIComponent(selectedText) +
      '&source=' + encodeURIComponent(tab.url);
    
    await openOrFocusChatTab(urlParams);
  } else if (info.menuItemId.startsWith('chat-')) {
    // Continue existing chat
    const chatId = info.menuItemId.replace('chat-', '');
    const urlParams = '?action=continueChat&chatId=' + chatId +
      '&text=' + encodeURIComponent(selectedText) +
      '&source=' + encodeURIComponent(tab.url);
    
    await openOrFocusChatTab(urlParams);
  }
});

// Debounce context menu updates
let contextMenuUpdateTimeout;

// Listen for storage changes to update context menu
storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.chatTitles || changes.encryptedChats)) {
    console.log('[Background] Storage changed, updating context menu:', changes);
    
    // Clear existing timeout
    if (contextMenuUpdateTimeout) {
      clearTimeout(contextMenuUpdateTimeout);
    }
    
    // Debounce context menu updates to prevent rapid rebuilds
    contextMenuUpdateTimeout = setTimeout(() => {
      console.log('[Background] Rebuilding context menu due to storage changes');
      setupContextMenus(); // Rebuild entire context menu
    }, 500);
  }
});
