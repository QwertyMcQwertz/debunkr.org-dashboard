// Cross-browser compatibility
const browserAPI = (() => {
  if (typeof browser !== 'undefined') {
    return browser;
  } else if (typeof chrome !== 'undefined') {
    return {
      runtime: {
        sendMessage: (message) => new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        })
      }
    };
  }
})();

document.addEventListener('DOMContentLoaded', function() {
  const openChatBtn = document.getElementById('openChat');
  
  openChatBtn.addEventListener('click', function() {
    // Send message to background script to handle tab opening/focusing
    browserAPI.runtime.sendMessage({
      action: 'openChat'
    });
    
    // Close the popup after opening the chat
    window.close();
  });
});