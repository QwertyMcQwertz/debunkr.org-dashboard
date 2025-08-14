# 🌐 debunkr.org Dashboard

**Scroll with Scrutiny.**

The debunkr.org Dashboard is a browser extension that helps you analyze suspicious content on the web using AI-powered analysis. Simply highlight text on any website, right-click, and let our egalitarian AI analyze it for bias, manipulation, and power structures.

**Compatible with:** Chrome, Edge, Brave, Opera, Firefox, and other Chromium-based browsers

> **Note:** This extension uses Manifest V3 and is compatible with both Chromium-based browsers and modern Firefox (109+).

## ✨ What You Can Do

### 🔍 **Smart Analysis**
- **Questions power structures** and identifies bias in web content
- **Examines who benefits** from particular narratives and viewpoints  
- **Promotes critical thinking** about information you encounter online
- **Provides detailed analysis** with sources and context

### 🖱️ **Easy to Use**
- **Right-click any text** on any website to analyze it instantly
- **Chat-style interface** that feels familiar and intuitive
- **Multiple conversations** - organize different analysis sessions
- **Image support** - analyze screenshots and images with text
- **Tab notifications** - know when your analysis is ready even if you switch tabs

### 💬 **Conversation Management**  
- **Save all your conversations** for future reference
- **Rename and organize** your analysis sessions
- **Search through** your chat history to find previous analyses
- **Continue conversations** by adding new content to existing chats

### 🖼️ **Image Analysis**
- **Upload images** directly or paste them into your conversations
- **Analyze screenshots** of social media posts, articles, or any visual content
- **Combine text and images** for comprehensive analysis
- **Automatic image compression** handles large files efficiently

## 🚀 Installation

### Quick Install (Recommended)

> 📥 **[Download from Releases](https://github.com/QwertyMcQwertz/debunkr.org-dashboard/releases/latest)** ← Click here to get the latest version!

**🦊 Firefox**
1. **[Download `debunkr-dashboard-firefox.xpi`](https://github.com/QwertyMcQwertz/debunkr.org-dashboard/releases/latest)** from the latest release
2. Go to `about:debugging` → This Firefox
3. Click "Load Temporary Add-on" → Select the `.xpi` file
4. ✅ Extension installed!

**🌐 Chrome/Edge/Brave**  
1. **[Download `debunkr-dashboard-chrome.zip`](https://github.com/QwertyMcQwertz/debunkr.org-dashboard/releases/latest)** from the latest release and extract it
2. Go to `chrome://extensions/` (or your browser's extension page)
3. Enable "Developer mode" → Click "Load unpacked" 
4. Select the extracted folder
5. ✅ Extension installed!

### Setup
1. Click the extension icon in your toolbar
2. Click Settings (⚙️) and enter your [Poe API key](https://poe.com/api_key)
3. Test the connection and save
4. Right-click any text on websites to start analyzing!

> **Note:** Firefox extensions are temporary and removed on restart. Chrome extensions persist until manually removed.

### Developers

Clone this repository and follow the Quick Install steps above, or use the build scripts for development.

## 💡 How to Use

### 🆕 Start Your First Analysis

**The Easy Way (Recommended):**
1. **Find some text** on any website that looks suspicious or biased
2. **Highlight the text** by clicking and dragging over it
3. **Right-click** on the highlighted text
4. **Choose "debunkr.org Dashboard" → "New Chat"**
5. **Watch the magic happen** - the text appears in a clean chat interface with AI analysis

**The Direct Way:**
1. **Click the debunkr.org Dashboard icon** in your toolbar
2. **Type or paste** any text you want analyzed
3. **Hit Enter** or click the send button

### 🖼️ Analyzing Images

1. **Open the debunkr.org Dashboard**
2. **Click the 📷 image icon** next to the text input
3. **Select an image** from your computer or **paste an image** directly
4. **Add text** if you want to ask specific questions about the image
5. **Send** and get detailed visual analysis

### 📚 Managing Your Conversations

**Rename a Chat:**
- **Hover over** any chat in the sidebar and **click the ✏️ edit icon**
- Or **click the chat title** at the top and edit it directly

**Delete a Chat:**
- **Hover over** any chat in the sidebar and **click the 🗑️ delete icon**

**Find Old Conversations:**
- **Use the search box** at the top of the sidebar to search through all your chats

**Continue a Previous Conversation:**
1. **Highlight text** on any webpage
2. **Right-click** → "debunkr.org Dashboard"
3. **Choose one of your existing chat names** to add the text to that conversation

### 🔔 Tab Notifications

When you're waiting for an analysis and switch to another tab, you'll see:
- **The tab icon blinks red** with an exclamation mark
- **The tab title shows "💬 New Message"** to let you know your analysis is ready

## 🛠️ Settings & Features

### ⚙️ Settings Panel
- **API Key Management** - Update or test your Poe API key anytime
- **Connection Testing** - Make sure everything is working properly

### 🎨 Interface Features
- **Clean Design** - Familiar chat interface that's easy to use
- **Dark Mode Ready** - Comfortable for extended reading sessions  
- **Responsive Layout** - Works well at any window size
- **Smart Tab Management** - Won't create duplicate tabs when opening source links

### 🔒 Privacy & Data
- **Everything stays local** - Your conversations are stored on your device only
- **No tracking** - We don't collect any personal information
- **Encrypted storage** - Your data is protected even on your own computer
- **Source attribution** - See where analyzed text came from with clickable links

## 🛠️ Development

### Building the Extension

This extension uses a clean build system that creates browser-specific packages without modifying the main manifest.json:

```bash
# Build both Chrome and Firefox packages
./build.sh

# Development builds with more options
./dev-build.sh --help                # Show all options
./dev-build.sh chrome                # Build Chrome only
./dev-build.sh firefox               # Build Firefox only  
./dev-build.sh both --dev            # Keep build directory for debugging
./dev-build.sh both --clean          # Clean packages before building
```

### NPM Scripts (if you have Node.js)

```bash
npm run build              # Build both browsers
npm run build:chrome       # Build Chrome only
npm run build:firefox      # Build Firefox only  
npm run build:dev          # Development build (both browsers)
npm run build:clean        # Clean build (both browsers)
npm test                   # Test build process
npm run release            # Production release build
```

### CI/CD and Automation

The repository includes GitHub Actions workflows for automated building and releasing:

- **`build-test.yml`** - Runs on all pushes and PRs to validate builds
- **`build-and-release.yml`** - Creates releases with packages when you push a version tag
- **`manual-build.yml`** - Manual workflow for testing specific browser builds

#### Creating a Release

1. Update version in `manifest.json`, `manifest-chrome.json`, `manifest-firefox.json`, and `package.json`
2. Commit your changes: `git commit -am "Bump version to 2.2.0"`
3. Create and push a tag: `git tag v2.2.0 && git push origin v2.2.0`
4. GitHub Actions will automatically build and create a release with downloadable packages

#### Manual Testing

Use the "Manual Build" workflow in GitHub Actions to test specific browsers or development builds without creating a release.

### Cross-Browser Architecture

The extension uses a sophisticated cross-browser compatibility system:

- **`manifest.json`** - Main manifest (Chrome/Chromium)
- **`manifest-chrome.json`** - Chrome-specific configuration  
- **`manifest-firefox.json`** - Firefox-specific configuration
- **`browser-polyfill.js`** - WebExtensions polyfill for cross-browser APIs
- **`src/browser-compat.js`** - Custom cross-browser API wrapper
- **`src/background.js`** - Chrome service worker with cross-browser imports
- **`src/background-firefox.js`** - Firefox-specific background script

### File Structure

```
debunkr.org-dashboard/
├── src/                          # Source files
│   ├── background.js            # Chrome service worker
│   ├── background-firefox.js    # Firefox background script
│   ├── browser-compat.js        # Cross-browser API wrapper
│   └── ...                      # Other source files
├── packages/                     # Built extension packages
│   ├── debunkr-dashboard-chrome.zip
│   └── debunkr-dashboard-firefox.xpi
├── manifest.json                # Main manifest (Chrome)
├── manifest-chrome.json         # Chrome-specific manifest
├── manifest-firefox.json        # Firefox-specific manifest
├── browser-polyfill.js          # WebExtensions polyfill
├── build.sh                     # Production build script
└── dev-build.sh                 # Development build script
```

## 🆘 Need Help?

### ❌ Common Issues & Solutions

**"Please make sure your Poe API key is configured"**
- Go to Settings (⚙️) and add your API key from [poe.com/api_key](https://poe.com/api_key)
- Make sure you copied the complete API key
- Try the "Test Connection" button

**Right-click menu doesn't show debunkr.org Dashboard**
- Make sure you **selected text first** before right-clicking
- Try refreshing the webpage
- Check that the extension is enabled in your browser's extensions page

**Analysis takes a long time or times out**
- Large images or very long text can take longer to process
- Try breaking up very long text into smaller pieces
- Check your internet connection

**Can't see my old conversations**
- Your chats are saved locally - they should persist between browser sessions
- If you're not seeing them, try refreshing the extension page
- Make sure you didn't clear your browser data

**Images won't upload**
- Supported formats: JPEG, PNG, GIF, WebP
- Large images are automatically compressed
- Try copying and pasting the image instead of uploading

### 💬 Get Support
If you're still having trouble, you can:
- Check the browser console for error messages (F12 → Console tab)
- Try reloading the extension in your browser's extensions page
- Restart your browser if issues persist

---

**Ready to start analyzing web content with a critical eye? Install the debunkr.org Dashboard and begin scrolling with scrutiny!** 🔍

*Version 2.1 - Powered by Poe AI*