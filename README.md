# 🛡️ MisInfo Manager

A Chrome extension for analyzing and fact-checking information with a ChatGPT-like interface powered by OpenAI's Assistant API. Built with a modern modular architecture featuring client-side encryption, intelligent quote blocks, and seamless web integration for comprehensive misinformation analysis.

## ✨ Features

### 📱 Chat Interface
- **Clean ChatGPT-style interface** with sidebar and main chat area
- **Multiple conversations** - organize different fact-checking sessions
- **Persistent chat history** with AES-GCM encrypted storage
- **Smart tab management** - prevents duplicate tabs, focuses existing ones
- **Copy functionality** - always-visible copy buttons for all messages
- **Inline title editing** - click chat titles to rename directly

### 🖱️ Context Menu Integration
- **Right-click any selected text** to instantly analyze it
- **"New Chat"** - starts fresh conversation with selected text
- **Continue existing chats** - add selected text to previous conversations
- **Smart quote blocks** - selected text appears as styled quotes with source attribution
- **Chat selection interface** - choose existing chats when multiple options available

### 🔗 Source Tracking & Quote Blocks
- **Automatic source detection** - captures webpage URL when using context menu
- **Visual quote blocks** - selected text displayed with quotation marks and source links
- **Source URL isolation** - source information visible to users but not sent to AI
- **Clickable source headers** - easily return to original webpage
- **Smart URL management** - focuses existing tabs instead of creating duplicates
- **Clean chat titles** - uses domain names for easy identification

### 🗂️ Chat Management
- **Rename chats** - hover over chat → click edit icon OR click title in header
- **Delete chats** - hover over chat → click delete icon  
- **Search functionality** - search through chat titles and message content
- **Auto-sorted history** - most recent conversations at top
- **Empty chat prevention** - reuses empty chats instead of creating duplicates
- **Smart chat optimization** - efficient chat switching and loading

### 🔒 Security & Privacy
- **AES-GCM 256-bit encryption** for all chat data using Web Crypto API
- **Encrypted API key storage** - OpenAI API keys encrypted before storage
- **Local storage only** - all data stays on your device
- **XSS protection** - comprehensive input sanitization
- **Content Security Policy** - prevents unauthorized script execution
- **Secure key generation** - crypto-secure random encryption keys
- **Modular security architecture** - isolated storage and encryption layers

## 🚀 Installation

### For Development
1. **Clone or download** this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable "Developer mode"** (toggle in top right)
4. **Click "Load unpacked"** and select the `misinformation-manager` folder
5. **Pin the extension** to your toolbar for easy access

### For Production
*Note: This extension is currently in development and not published to Chrome Web Store*

## ⚙️ Setup

### Configure OpenAI API Key
1. **Get API Key**: Visit [OpenAI API](https://platform.openai.com/api-keys) to create an API key
2. **Open Extension**: Click the MisInfo Manager icon or use context menu
3. **Access Settings**: Click the ⚙️ settings icon in the top-right corner
4. **Enter API Key**: Paste your OpenAI API key and click "Save"
5. **Test Connection**: Click "Test API Key" to verify it works

*Note: API keys are encrypted with AES-GCM before storage for maximum security*

## 💡 Usage

### Starting a New Analysis

**Method 1: Extension Popup**
1. Click the MisInfo Manager icon in your toolbar
2. Click "Open Chat Interface"

**Method 2: Context Menu (Recommended)**
1. **Select text** on any webpage you want to analyze
2. **Right-click** → hover over "MisInfo Manager"
3. Choose **"New Chat"** to start fresh analysis
4. Selected text appears as a **styled quote block** with source URL
5. Add your own questions or analysis in the input field

### Continuing Existing Conversations
1. **Select text** on any webpage
2. **Right-click** → hover over "MisInfo Manager"  
3. Choose from your **existing chat names** or select "Continue in existing chat"
4. Selected text appears as **quote block** in chosen conversation
5. Source URL is shown in UI but not sent to AI (maintains conversation context)

### Managing Chats
- **Rename**: Hover over chat → click ✏️ edit icon OR click title in chat header
- **Delete**: Hover over chat → click 🗑️ delete icon → confirm
- **Navigate**: Click any chat name to switch conversations
- **Search**: Use search box in sidebar to find chats by title or content
- **Copy Messages**: Click copy button on any message to copy plain text

### Using Source Links
- **New chats from context menu** show clickable source URL in header
- **Click the header URL** to return to original webpage
- **Smart tab behavior** - focuses existing tab if URL already open

## 🏗️ Architecture

Built with **modern modular architecture** for maintainability, security, and performance.

### File Structure
```
misinformation-manager/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html/js          # Extension popup interface
├── background.js          # Service worker for context menus & tab management
├── chat.html/css/js       # Main chat interface
├── storage-manager.js     # Data persistence & encryption module
├── openai-client.js       # OpenAI API communication module
├── ui-manager.js          # DOM manipulation & UI module
├── ARCHITECTURE.md        # Detailed architecture documentation
├── API-REFERENCE.md       # Complete API documentation
├── CSS-DOCUMENTATION.md   # Comprehensive CSS guide
└── README.md              # This file
```

### Modular Architecture

**🎯 ChatManager (`chat.js`)** - *Main Orchestrator*
- Application lifecycle management and URL parameter handling
- Chat conversation management and context menu integration
- Event coordination between all modules
- OpenAI Assistant API integration with intelligent polling

**💾 StorageManager (`storage-manager.js`)** - *Data Layer*
- AES-GCM 256-bit encryption for all sensitive data
- Debounced saves to prevent excessive storage operations
- Secure API key management with encryption
- Fallback mechanisms for corrupted data

**🤖 OpenAIClient (`openai-client.js`)** - *API Layer*
- OpenAI Assistants API v2 implementation
- Exponential backoff polling (500ms to 8s intervals)
- Thread and run management for conversation context
- Comprehensive error handling and timeout protection

**🎨 UIManager (`ui-manager.js`)** - *Presentation Layer*
- DOM manipulation with cached element access
- Quote block rendering and copy functionality
- Settings modal and chat history management
- Responsive UI components and state management

**⚡ Background Script (`background.js`)** - *Service Worker*
- Context menu management with debounced updates
- Smart tab management (prevents duplicates)
- Routes context menu actions to chat interface

## 🔧 Technical Details

### Permissions Required
- `tabs` - Smart tab management and URL detection
- `storage` - Encrypted local data persistence  
- `contextMenus` - Right-click menu integration
- `activeTab` - Access current tab URL for source tracking
- `webRequest` (optional) - Enhanced source URL detection

### Storage Format
```javascript
{
  encryptedChats: [...],        // AES-GCM encrypted chat data
  chatTitles: {...},            // Unencrypted titles for context menu
  encryptionKey: [...],         // AES-GCM 256-bit encryption key
  encryptedOpenAIKey: [...],    // Encrypted OpenAI API key
  nextChatId: 1,                // Auto-increment counter
  currentChatId: 1              // Currently active chat
}
```

### Security Architecture
- **Client-side encryption**: All sensitive data encrypted before storage
- **Secure key management**: Automatic AES-GCM key generation
- **API key protection**: OpenAI keys encrypted with same system
- **XSS prevention**: Comprehensive input sanitization
- **Privacy-first**: No user data sent to third parties (except OpenAI API)

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

### API Key Issues
- **"API key not configured"**: Click settings ⚙️ and add your OpenAI API key
- **"Failed to connect"**: Verify API key is valid at [OpenAI API Keys](https://platform.openai.com/api-keys)
- **"Rate limit exceeded"**: Wait a few minutes or check your OpenAI usage

### Extension Not Loading
- Check that all files are in the correct directory structure
- Verify `manifest.json` is valid JSON
- Look for errors in Chrome DevTools → Extensions page
- Ensure all modular files (storage-manager.js, openai-client.js, ui-manager.js) are present

### Context Menu Not Appearing  
- Ensure you've **selected text** before right-clicking
- Check that extension permissions are granted
- Try reloading the extension
- Verify background script is running (check service worker in Extensions page)

### Chats Not Persisting
- Check browser storage permissions
- Look for encryption/decryption errors in console
- Verify Chrome storage quotas aren't exceeded
- Check if encryption key was corrupted (extension will show warning)

### Quote Blocks Not Displaying
- Ensure selected text is properly formatted
- Check if source URL is valid
- Verify UI components are loading correctly

### Copy Functionality Not Working
- Modern browsers: Check clipboard permissions
- Older browsers: Extension includes fallback copy method
- Verify copy buttons are visible and clickable

## 📝 License

This project is for educational and research purposes. Please ensure compliance with your local laws and the terms of service of websites you analyze.

## 🚧 Future Enhancements

- **Export conversations** to various formats (JSON, PDF, HTML)
- **Advanced search** with filters and highlighting
- **Custom AI model integration** (Claude, Gemini, local models)
- **Batch analysis** of multiple sources simultaneously
- **Collaboration features** for team fact-checking
- **Browser sync** across devices with end-to-end encryption
- **Plugin system** for custom analyzers and data sources
- **Advanced quote management** with annotation capabilities
- **Performance analytics** and usage insights
- **Mobile companion app** for cross-platform access

---

## 📚 Documentation

- **[Architecture Guide](ARCHITECTURE.md)** - Detailed system architecture and component interactions
- **[API Reference](API-REFERENCE.md)** - Complete API documentation for all classes and methods
- **[CSS Documentation](CSS-DOCUMENTATION.md)** - Comprehensive styling guide and design system

---

**Version**: 2.0  
**Architecture**: Modular (4 core modules)  
**Manifest Version**: 3  
**OpenAI API**: Assistants API v2  
**Encryption**: AES-GCM 256-bit  
**Minimum Chrome Version**: 88+