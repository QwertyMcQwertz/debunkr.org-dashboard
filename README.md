# 🛡️ MisInfo Manager

A Chrome extension for analyzing and fact-checking information with a ChatGPT-like interface. Easily capture text from any webpage and analyze it for misinformation, verify sources, and maintain organized conversations about different topics.

## ✨ Features

### 📱 Chat Interface
- **Clean ChatGPT-style interface** with sidebar and main chat area
- **Multiple conversations** - organize different fact-checking sessions
- **Persistent chat history** with secure encrypted storage
- **Smart tab management** - prevents duplicate tabs, focuses existing ones

### 🖱️ Context Menu Integration
- **Right-click any selected text** to instantly analyze it
- **"New Chat"** - starts fresh conversation with selected text
- **Continue existing chats** - add selected text to previous conversations
- **Smart source handling** - automatically includes source URL for new chats

### 🔗 Source Tracking
- **Automatic source detection** - captures webpage URL when using context menu
- **Clickable source headers** - easily return to original webpage
- **Smart URL management** - focuses existing tabs instead of creating duplicates
- **Clean chat titles** - uses domain names for easy identification

### 🗂️ Chat Management
- **Rename chats** - hover over chat → click edit icon
- **Delete chats** - hover over chat → click delete icon  
- **Auto-sorted history** - most recent conversations at top
- **Empty chat prevention** - won't create unnecessary duplicate chats

### 🔒 Security & Privacy
- **AES-GCM encryption** for all chat data using Web Crypto API
- **Local storage only** - all data stays on your device
- **XSS protection** - input sanitization prevents malicious code
- **Content Security Policy** - prevents unauthorized script execution

## 🚀 Installation

### For Development
1. **Clone or download** this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable "Developer mode"** (toggle in top right)
4. **Click "Load unpacked"** and select the `misinformation-manager` folder
5. **Pin the extension** to your toolbar for easy access

### For Production
*Note: This extension is currently in development and not published to Chrome Web Store*

## 💡 Usage

### Starting a New Analysis

**Method 1: Extension Popup**
1. Click the MisInfo Manager icon in your toolbar
2. Click "Open Chat Interface"

**Method 2: Context Menu (Recommended)**
1. **Select text** on any webpage you want to analyze
2. **Right-click** → hover over "MisInfo Manager"
3. Choose **"New Chat"** to start fresh analysis
4. The selected text and source URL will be automatically included

### Continuing Existing Conversations
1. **Select text** on any webpage
2. **Right-click** → hover over "MisInfo Manager"  
3. Choose from your **existing chat names** to continue that conversation
4. Only the selected text is added (no source URL for existing chats)

### Managing Chats
- **Rename**: Hover over chat → click ✏️ edit icon → enter new name
- **Delete**: Hover over chat → click 🗑️ delete icon → confirm
- **Navigate**: Click any chat name to switch conversations

### Using Source Links
- **New chats from context menu** show clickable source URL in header
- **Click the header URL** to return to original webpage
- **Smart tab behavior** - focuses existing tab if URL already open

## 🏗️ Architecture

### File Structure
```
misinformation-manager/
├── manifest.json          # Extension configuration
├── popup.html/js          # Extension popup interface
├── background.js          # Service worker for context menus & tab management
├── chat.html/css/js       # Main chat interface
└── README.md              # This file
```

### Key Components

**Background Script (`background.js`)**
- Manages context menus and updates them based on existing chats
- Handles smart tab management (prevents duplicates)
- Routes context menu actions to appropriate chat functions

**Chat Manager (`chat.js`)**
- Core application logic for chat interface
- Handles encryption/decryption of chat data
- Manages chat CRUD operations and UI updates
- Processes URL parameters from context menu actions

**Security Features**
- **Encryption**: All chat data encrypted with AES-GCM before storage
- **Input Sanitization**: Prevents XSS attacks from user input
- **CSP**: Content Security Policy prevents unauthorized scripts
- **Local Storage**: No data sent to external servers

## 🔧 Technical Details

### Permissions Required
- `tabs` - Smart tab management and URL detection
- `storage` - Encrypted local data persistence  
- `contextMenus` - Right-click menu integration
- `activeTab` - Access current tab URL for source tracking

### Storage Format
```javascript
{
  encryptedChats: [...],      // AES-GCM encrypted chat data
  chatTitles: {...},          // Unencrypted titles for context menu
  encryptionKey: [...],       // Stored encryption key
  nextChatId: 1,              // Auto-increment counter
  currentChatId: 1            // Currently active chat
}
```

### Context Menu Structure
```
MisInfo Manager
├── New Chat
├── [Chat Title 1]
├── [Chat Title 2]
└── ... (up to 5 recent chats)
```

## 🤝 Contributing

### Development Setup
1. Make changes to source files
2. **Reload extension** in `chrome://extensions/` (click refresh icon)
3. Test functionality across all entry points
4. Ensure security measures remain intact

### Code Style
- **ES6+ JavaScript** with async/await patterns
- **Semantic HTML** with accessibility considerations  
- **Modern CSS** with flexbox layouts and transitions
- **No external dependencies** - vanilla JavaScript only

### Security Guidelines
- **Never commit secrets** or API keys
- **Sanitize all user input** before processing
- **Use CSP headers** to prevent code injection
- **Encrypt sensitive data** before storage

## 🐛 Troubleshooting

### Extension Not Loading
- Check that all files are in the correct directory structure
- Verify `manifest.json` is valid JSON
- Look for errors in Chrome DevTools → Extensions page

### Context Menu Not Appearing  
- Ensure you've **selected text** before right-clicking
- Check that extension permissions are granted
- Try reloading the extension

### Chats Not Persisting
- Check browser storage permissions
- Look for encryption/decryption errors in console
- Verify Chrome storage quotas aren't exceeded

### Multiple Tabs Opening
- This should be fixed in current version
- If still occurring, check background script message handling

## 📝 License

This project is for educational and research purposes. Please ensure compliance with your local laws and the terms of service of websites you analyze.

## 🚧 Future Enhancements

- **Export conversations** to various formats
- **Search within chat history** 
- **Custom AI model integration**
- **Batch analysis** of multiple sources
- **Collaboration features** for team fact-checking
- **Browser sync** across devices

---

**Version**: 1.0  
**Manifest Version**: 3  
**Minimum Chrome Version**: 88+