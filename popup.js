document.addEventListener('DOMContentLoaded', function() {
  const openChatBtn = document.getElementById('openChat');
  
  openChatBtn.addEventListener('click', function() {
    // Send message to background script to handle tab opening/focusing
    chrome.runtime.sendMessage({
      action: 'openChat'
    });
    
    // Close the popup after opening the chat
    window.close();
  });
});