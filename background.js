// Background service worker for the extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('debunkr Dashboard extension installed');
  setupContextMenus();
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    const tabs = await chrome.tabs.query({url: url});
    
    if (tabs.length > 0) {
      // Focus the existing tab
      const existingTab = tabs[0];
      await chrome.tabs.update(existingTab.id, {active: true});
      await chrome.windows.update(existingTab.windowId, {focused: true});
    } else {
      // Create new tab if none exists
      chrome.tabs.create({url: url});
    }
  } catch (error) {
    console.error('Error handling URL:', error);
    // Fallback to creating new tab
    chrome.tabs.create({url: url});
  }
}

// Function to open chat tab or focus existing one
async function openOrFocusChatTab(urlParams = '') {
  const chatUrl = chrome.runtime.getURL('chat.html') + urlParams;
  const extensionUrl = chrome.runtime.getURL('chat.html');
  
  // Query for existing debunkr Dashboard tabs
  const tabs = await chrome.tabs.query({url: extensionUrl + '*'});
  
  if (tabs.length > 0) {
    // Focus the existing tab and update URL if needed
    const existingTab = tabs[0];
    await chrome.tabs.update(existingTab.id, {
      active: true,
      url: chatUrl
    });
    await chrome.windows.update(existingTab.windowId, {focused: true});
  } else {
    // Create new tab if none exists
    chrome.tabs.create({
      url: chatUrl
    });
  }
}

// Set up context menus
async function setupContextMenus() {
  try {
    // Remove existing menus
    await chrome.contextMenus.removeAll();
    
    // Small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create parent menu
    chrome.contextMenus.create({
      id: 'misinfoManager',
      title: 'debunkr',
      contexts: ['selection']
    });
    
    // Create "New Chat" submenu
    chrome.contextMenus.create({
      id: 'newChat',
      parentId: 'misinfoManager',
      title: 'New Chat',
      contexts: ['selection']
    });
    
    // Add separator
    chrome.contextMenus.create({
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
    const result = await chrome.storage.local.get(['chatTitles']);
    console.log('Context menu update - chatTitles:', result.chatTitles);
    
    if (result.chatTitles && Object.keys(result.chatTitles).length > 0) {
      // Sort chats by last activity
      const sortedChats = Object.entries(result.chatTitles)
        .filter(([id, chat]) => chat.hasMessages) // Only show chats with messages
        .sort(([,a], [,b]) => new Date(b.lastActivity) - new Date(a.lastActivity))
        .slice(0, 5); // Limit to 5 most recent chats
      
      console.log('Sorted chats for context menu:', sortedChats);
      
      if (sortedChats.length > 0) {
        // Add each chat as a menu item
        sortedChats.forEach(([chatId, chat]) => {
          console.log('Creating context menu item for chat:', chatId, chat.title);
          try {
            chrome.contextMenus.create({
              id: `chat-${chatId}`,
              parentId: 'misinfoManager',
              title: chat.title.length > 30 ? chat.title.substring(0, 30) + '...' : chat.title,
              contexts: ['selection']
            });
          } catch (error) {
            console.error(`Error creating context menu item for chat ${chatId}:`, error);
          }
        });
      }
    } else {
      console.log('No chatTitles found for context menu');
    }
  } catch (error) {
    console.error('Error updating context menu:', error);
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
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
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.chatTitles || changes.encryptedChats)) {
    // Clear existing timeout
    if (contextMenuUpdateTimeout) {
      clearTimeout(contextMenuUpdateTimeout);
    }
    
    // Debounce context menu updates to prevent rapid rebuilds
    contextMenuUpdateTimeout = setTimeout(() => {
      setupContextMenus(); // Rebuild entire context menu
    }, 500);
  }
});