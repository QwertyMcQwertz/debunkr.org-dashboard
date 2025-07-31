# API Reference - Misinformation Manager

## Overview

This document provides comprehensive API documentation for all classes and methods in the Misinformation Manager extension. The extension follows a modular architecture with clear separation of concerns across four main classes.

## ChatManager Class

**File**: `chat.js`  
**Purpose**: Main orchestrator class that coordinates all extension functionality

### Constructor

```javascript
new ChatManager()
```
Initializes the ChatManager with all dependent modules and begins the initialization sequence.

**Properties**:
- `currentChatId: number|null` - ID of currently active chat
- `chats: Map<number, Object>` - Map of all chat objects keyed by ID  
- `nextChatId: number` - Next available chat ID for new conversations
- `pendingText: string|null` - Text pending processing from context menu
- `pendingSource: string|null` - Source URL for pending text
- `storageManager: StorageManager` - Handles encryption and persistence
- `openaiClient: OpenAIClient` - Manages OpenAI API communication
- `uiManager: UIManager` - Controls DOM and user interface

### Initialization Methods

#### `initializeFromURL()`
Parses URL parameters for context menu integration. Handles different action types: newChat, selectChat, continueChat. Extracts and decodes text content and source URLs from URL parameters.

#### `async initializeStorage()`
Initializes application state from Chrome storage. Loads encrypted chat data and handles URL-based actions. Creates initial chat if none exist, otherwise loads most recent.

#### `initializeEventListeners()`
Sets up all DOM event listeners for user interactions. Handles chat management, search, settings, and message operations using event delegation for dynamically created elements.

### Chat Management Methods

#### `createInitialChat()`
Creates the first chat when no chats exist. Sets up a new empty chat and makes it active. Used during initial app load when storage is empty.

#### `findEmptyChat(): number|null`
Finds an existing chat with no messages to prevent creating duplicate empty chats.

**Returns**: Chat ID of empty chat, or null if none found.

#### `createNewChat()`
Creates new chat or switches to existing empty chat. Optimizes chat creation by reusing empty chats when possible. Triggered by "New Chat" button in sidebar.

#### `createNewChatWithText()`
Creates new chat with pre-filled text from context menu. Optimizes by reusing empty chats and sets appropriate title from source URL. Used when user selects "New Chat" from context menu with selected text.

#### `showChatSelector()`
Displays chat selection interface for context menu text. Allows users to choose existing chat or create new one. Used when multiple chats exist and user selects text from web page.

#### `loadChat(chatId: number)`
Loads and displays specific chat by ID. Updates all UI components and saves current state.

**Parameters**:
- `chatId: number` - ID of chat to load and display

#### `updateChatTitle(newTitle: string)`
Updates chat title and persists changes. Validates title is different and non-empty before saving.

**Parameters**:
- `newTitle: string` - New title for the current chat

#### `renameChat(chatId: number)`
Prompts user to rename a chat and updates the title if changed.

**Parameters**:
- `chatId: number` - ID of chat to rename

#### `deleteChat(chatId: number)`
Deletes a chat and switches to another if it was currently active.

**Parameters**:
- `chatId: number` - ID of chat to delete

### Message Operations

#### `sendMessage()`
Sends user message and triggers AI response. Handles quote formatting, auto-title generation, and message persistence. Clears input after sending and initiates AI response flow.

#### `async getAIResponse(userMessage: string)`
Gets AI response from OpenAI Assistant. Handles API key validation, loading states, and error handling. Updates chat with loading message, then replaces with actual response.

**Parameters**:
- `userMessage: string` - User's message to send to AI

### Search and Navigation

#### `searchChats(query: string)`
Searches through chat titles and message content. Filters chat history display based on search query. Searches both chat titles and all message content for matches.

**Parameters**:
- `query: string` - Search term to filter chats by

#### `updateChatHeader()`
Updates chat header with source link and editable title. Sets up event listeners for source link clicks and title editing. Only shows header for chats with source URLs.

#### `preFillInput(includeSource: boolean = false)`
Pre-fills input with pending text from context menu. Shows text as quote block instead of direct input for better UX. Clears pending state after processing.

**Parameters**:
- `includeSource: boolean` - Whether to include source URL (deprecated)

### Utility Methods

#### `extractDomainFromUrl(url: string): string`
Extracts domain name from URL for chat titles.

**Parameters**:
- `url: string` - Full URL to extract domain from

**Returns**: Domain name or fallback text

#### `async openOrFocusUrl(url: string)`
Opens URL in new tab or focuses existing tab with same URL.

**Parameters**:
- `url: string` - URL to open or focus

#### `async openSettings()`
Opens settings modal and loads current API key if available.

---

## StorageManager Class

**File**: `storage-manager.js`  
**Purpose**: Handles all data persistence, encryption/decryption, and Chrome storage operations

### Constructor

```javascript
new StorageManager()
```
Initializes the storage manager with debounced save capability.

**Properties**:
- `saveTimeout: number|null` - Timeout ID for debounced saves

### Data Persistence Methods

#### `async saveData(chats: Map, nextChatId: number, currentChatId: number|null)`
Saves chat data to Chrome storage with encryption. Converts Map to plain object and encrypts sensitive data. Also saves chat titles separately for context menu access.

**Parameters**:
- `chats: Map` - Map of chat objects keyed by chat ID
- `nextChatId: number` - Next available chat ID
- `currentChatId: number|null` - Currently active chat ID

#### `debouncedSave(chats: Map, nextChatId: number, currentChatId: number|null, delay: number = 1000)`
Debounced save to prevent excessive storage operations. Delays save operation and cancels previous pending saves.

**Parameters**:
- `chats: Map` - Map of chat objects
- `nextChatId: number` - Next available chat ID
- `currentChatId: number|null` - Currently active chat ID
- `delay: number` - Delay in milliseconds before saving (default: 1000)

#### `async forceSave(chats: Map, nextChatId: number, currentChatId: number|null)`
Immediate save for critical operations, bypassing debouncing. Used for operations like chat deletion or renaming that need immediate persistence.

**Parameters**:
- `chats: Map` - Map of chat objects
- `nextChatId: number` - Next available chat ID
- `currentChatId: number|null` - Currently active chat ID

#### `async loadData(): Promise<{chats: Map, nextChatId: number, currentChatId: number|null}>`
Loads and decrypts chat data from Chrome storage.

**Returns**: Object containing decrypted chat data
**Throws**: Error if storage access fails

### Encryption Methods

#### `async encryptData(data: any): Promise<Array<number>|string>`
Encrypts data using AES-GCM algorithm. Returns encrypted data as byte array, or JSON string as fallback.

**Parameters**:
- `data: any` - Data to encrypt (will be JSON stringified)

**Returns**: Encrypted data as byte array, or JSON string as fallback

#### `async decryptData(encryptedArray: Array<number>|string): Promise<any>`
Decrypts data using AES-GCM algorithm. Handles both encrypted byte arrays and fallback JSON strings.

**Parameters**:
- `encryptedArray: Array<number>|string` - Encrypted data as byte array or JSON string fallback

**Returns**: Decrypted and parsed data object
**Throws**: Error if decryption fails (indicates corrupted data or wrong key)

#### `async getOrCreateEncryptionKey(): Promise<CryptoKey>`
Gets existing encryption key or creates new one. Generates AES-GCM 256-bit key and stores it in Chrome storage. Keys persist across browser sessions for consistent encryption.

**Returns**: AES-GCM encryption key for data operations

### API Key Management

#### `async saveOpenAIApiKey(apiKey: string)`
Securely saves OpenAI API key with encryption. API keys are encrypted before storage to protect user credentials.

**Parameters**:
- `apiKey: string` - OpenAI API key to encrypt and store

**Throws**: Error if encryption or storage operation fails

#### `async getOpenAIApiKey(): Promise<string|null>`
Retrieves and decrypts OpenAI API key. Returns null if no key is stored, allowing graceful handling.

**Returns**: Decrypted API key or null if not found
**Throws**: Error if decryption fails (corrupted key or storage error)

---

## OpenAIClient Class

**File**: `openai-client.js`  
**Purpose**: Handles all communication with OpenAI's Assistants API

### Constructor

```javascript
new OpenAIClient(storageManager: StorageManager)
```
Initializes OpenAI client with storage manager dependency.

**Parameters**:
- `storageManager: StorageManager` - Storage manager for API key access

**Properties**:
- `storageManager: StorageManager` - Reference to storage manager for API key operations

### API Methods

#### `async testConnection(apiKey: string): Promise<boolean>`
Tests OpenAI API connection with provided API key. Makes a simple request to validate API key without consuming tokens.

**Parameters**:
- `apiKey: string` - OpenAI API key to test

**Returns**: True if connection successful, false otherwise

#### `async sendMessage(message: string): Promise<string>`
Sends message to OpenAI Assistant and returns response. Creates a new thread, adds message, runs assistant, and polls for completion using exponential backoff.

**Parameters**:
- `message: string` - User message to send to assistant

**Returns**: Assistant's response text
**Throws**: Error if API key missing, API request fails, or timeout occurs

#### `async pollForCompletion(apiKey: string, threadId: string, runId: string): Promise<string>`
Polls for run completion with exponential backoff. Starts with 500ms intervals and increases to maximum 8s intervals. Prevents overwhelming the API while ensuring responsive completion detection.

**Parameters**:
- `apiKey: string` - OpenAI API key for authentication
- `threadId: string` - Thread ID to poll
- `runId: string` - Run ID to monitor

**Returns**: Completed assistant response
**Throws**: Error if polling timeout exceeded or run fails

#### `async getRunStatus(apiKey: string, threadId: string, runId: string): Promise<Object>`
Gets current status of a running assistant operation. Used by polling mechanism to check completion progress.

**Parameters**:
- `apiKey: string` - OpenAI API key for authentication
- `threadId: string` - Thread ID containing the run
- `runId: string` - Run ID to check status for

**Returns**: Run status object from OpenAI API
**Throws**: Error if status request fails

---

## UIManager Class

**File**: `ui-manager.js`  
**Purpose**: Controls all DOM manipulation, rendering, and user interface interactions

### Constructor

```javascript
new UIManager()
```
Initializes the UI manager with DOM element caching and quote state management.

**Properties**:
- `cachedElements: Object<string, HTMLElement>` - Cache of frequently accessed DOM elements
- `currentQuote: Object|null` - Currently active quote block data

### DOM Management Methods

#### `getElement(id: string): HTMLElement|null`
Gets cached DOM element by ID for improved performance. Elements are cached on first access to avoid repeated querySelector calls.

**Parameters**:
- `id: string` - Element ID to retrieve

**Returns**: The DOM element or null if not found

#### `sanitizeInput(input: string): string`
Sanitizes user input to prevent XSS attacks. Uses textContent assignment to escape HTML entities.

**Parameters**:
- `input: string` - Raw user input to sanitize

**Returns**: HTML-escaped safe string

### Message Rendering

#### `formatMessage(content: string): string`
Formats message content with quote block support. Detects quoted text patterns and wraps them in styled quote blocks. Handles multiline content and additional context after quotes.

**Parameters**:
- `content: string` - Raw message content to format

**Returns**: HTML-formatted message content

#### `renderMessages(currentChat: Object|null)`
Renders all messages for the current chat. Displays welcome message for empty chats or renders message list. Automatically sets up copy button event listeners.

**Parameters**:
- `currentChat: Object|null` - Chat object containing messages array

#### `setupCopyButtons(currentChat: Object)`
Sets up event listeners for message copy buttons. Attaches click handlers to all copy buttons in the current message list.

**Parameters**:
- `currentChat: Object` - Chat object for accessing message data

### Copy Functionality

#### `async copyMessageToClipboard(messageId: string|number, currentChat: Object, buttonElement: HTMLElement)`
Copies message content to clipboard with visual feedback. Uses modern Clipboard API with fallback for older browsers. Strips HTML formatting to copy plain text only.

**Parameters**:
- `messageId: string|number` - ID of message to copy
- `currentChat: Object` - Chat object containing messages
- `buttonElement: HTMLElement` - Button element for visual feedback

#### `getPlainTextFromMessage(content: string): string`
Extracts plain text from HTML-formatted message content. Creates temporary DOM element to strip HTML tags safely.

**Parameters**:
- `content: string` - HTML content to convert to plain text

**Returns**: Plain text without HTML formatting

#### `fallbackCopyToClipboard(text: string, buttonElement: HTMLElement)`
Fallback clipboard copy method for older browsers. Uses deprecated execCommand as fallback when Clipboard API unavailable.

**Parameters**:
- `text: string` - Text content to copy
- `buttonElement: HTMLElement` - Button element for visual feedback

#### `showCopyFeedback(buttonElement: HTMLElement)`
Shows visual feedback when copy operation succeeds. Temporarily changes button appearance and text to indicate success.

**Parameters**:
- `buttonElement: HTMLElement` - Button to show feedback on

### Chat History Management

#### `updateChatHistoryDisplay(chats: Map, currentChatId: number|null, filteredChats: Array|null = null)`
Updates the sidebar chat history display. Shows sorted list of chats with preview text and action buttons. Supports filtered chat lists for search functionality.

**Parameters**:
- `chats: Map` - Map of all chat objects
- `currentChatId: number|null` - ID of currently active chat
- `filteredChats: Array|null` - Optional filtered subset of chats

#### `getLastMessagePreview(chat: Object): string`
Generates preview text for chat history sidebar. Shows truncated version of last message or placeholder for empty chats.

**Parameters**:
- `chat: Object` - Chat object with messages array

**Returns**: Preview text for display in sidebar

#### `updateChatHeader(currentChat: Object|null): Object|null`
Updates chat header with source URL and editable title. Shows header only for chats that originated from web content. Returns elements for event binding in main chat manager.

**Parameters**:
- `currentChat: Object|null` - Current chat object

**Returns**: Object with sourceLink and titleInput elements, or null

### Quote Block Management

#### `showInputQuote(text: string, sourceUrl: string|null)`
Displays quote block in input area. Shows quoted text with source URL and remove button. Updates input placeholder to guide user interaction.

**Parameters**:
- `text: string` - Text content to quote
- `sourceUrl: string|null` - Source URL for attribution

#### `hideInputQuote()`
Hides and clears the input quote block. Resets currentQuote state and restores default input placeholder.

#### `getFormattedMessageWithQuote(): string`
Formats user message with quoted text for LLM processing. Combines quoted text and user input into properly formatted message. Source URLs are excluded from LLM messages (UI display only).

**Returns**: Formatted message ready for LLM processing

### Chat Selection Interface

#### `displayChatSelector(chats: Map, pendingText: string): Object`
Displays chat selection interface for context menu text. Shows existing chats sorted by activity with preview text. Used when user selects text from web pages.

**Parameters**:
- `chats: Map` - Map of all available chats
- `pendingText: string` - Selected text to be added to chosen chat

**Returns**: Object with selector elements for event binding

### UI Utility Methods

#### `adjustTextareaHeight()`
Dynamically adjusts textarea height based on content. Grows textarea as user types, with maximum height limit. Provides better user experience for longer messages.

#### `updateSendButton()`
Updates send button enabled/disabled state. Button is enabled when there's text input OR an active quote block. Prevents sending empty messages while allowing quote-only messages.

#### `scrollToBottom()`
Scrolls messages container to bottom. Used after adding new messages to keep conversation in view.

#### `focusInput()`
Focuses the message input textarea. Used to restore focus after various UI operations.

#### `clearInput()`
Clears message input and resets UI state. Resets textarea height and updates send button state.

### Settings Modal Management

#### `showSettingsStatus(message: string, type: string)`
Displays status message in settings modal. Shows success, error, or loading states for settings operations.

**Parameters**:
- `message: string` - Status message to display
- `type: string` - Status type: 'success', 'error', or 'loading'

#### `openSettingsModal(): HTMLElement`
Opens the settings modal dialog.

**Returns**: The modal element for further manipulation

#### `closeSettingsModal()`
Closes settings modal and resets status display. Clears any status messages and hides the modal.

---

## Data Structures

### Chat Object
```javascript
{
  id: number,              // Unique chat identifier
  title: string,           // Display title for chat
  messages: Array<Message>, // Array of message objects
  lastActivity: string,    // ISO timestamp of last activity
  sourceUrl?: string,      // Original source URL (optional)
  lastSourceUrl?: string   // Most recent source URL (optional)
}
```

### Message Object
```javascript
{
  id: string|number,       // Unique message identifier
  type: 'user'|'assistant', // Message sender type
  content: string,         // Message text content
  timestamp: string,       // ISO timestamp
  isLoading?: boolean,     // Loading state (optional)
  isError?: boolean        // Error state (optional)
}
```

### Quote Object
```javascript
{
  text: string,           // Quoted text content
  sourceUrl: string|null  // Source URL for attribution
}
```

## Error Handling

All async methods follow consistent error handling patterns:
- Storage errors fall back to in-memory operation
- API errors provide clear user messages with retry options  
- Encryption errors fall back to unencrypted storage with warnings
- Network issues queue operations for retry

## Security Considerations

- All user input is sanitized before DOM insertion
- API keys are encrypted with AES-GCM before storage
- Chat data is encrypted at rest
- No user data is transmitted except to OpenAI API
- Content Security Policy prevents code injection

This API reference provides complete documentation for integrating with or extending the Misinformation Manager extension.