/**
 * Storage and encryption management module
 * Handles all data persistence, encryption/decryption, and Chrome storage operations
 * 
 * Features:
 * - AES-GCM encryption for sensitive chat data
 * - Debounced saves to prevent excessive storage operations
 * - Secure API key management
 * - Automatic encryption key generation and storage
 * 
 * @class StorageManager
 */
class StorageManager {
  /**
   * Initialize the storage manager
   * @constructor
   */
  constructor() {
    /** @type {number|null} Timeout ID for debounced saves */
    this.saveTimeout = null;
    /** @type {string|null} Cached decrypted API key to avoid repeated decryption */
    this.cachedApiKey = null;
    /** @type {number} Cache timestamp for API key */
    this.cacheTimestamp = 0;
    /** @type {number} Cache validity duration (5 minutes) */
    this.cacheValidityMs = 5 * 60 * 1000;
  }

  /**
   * Save chat data to Chrome storage with encryption
   * @param {Map} chats - Map of chat objects keyed by chat ID
   * @param {number} nextChatId - Next available chat ID
   * @param {number|null} currentChatId - Currently active chat ID
   * @returns {Promise<void>}
   */
  async saveData(chats, nextChatId, currentChatId) {
    try {
      // Convert Map to plain object and encrypt sensitive data
      const chatsObj = Object.fromEntries(chats);
      const encryptedChats = await this.encryptData(chatsObj);
      
      // Also save chat titles separately for context menu (unencrypted for easy access)
      const chatTitles = {};
      for (const [chatId, chat] of chats) {
        chatTitles[chatId] = {
          title: chat.title,
          lastActivity: chat.lastActivity,
          hasMessages: chat.messages.length > 0
        };
      }
      
      await chrome.storage.local.set({
        encryptedChats: encryptedChats,
        chatTitles: chatTitles,
        nextChatId: nextChatId,
        currentChatId: currentChatId
      });
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  /**
   * Debounced save to prevent excessive storage operations
   * Delays save operation and cancels previous pending saves
   * @param {Map} chats - Map of chat objects
   * @param {number} nextChatId - Next available chat ID
   * @param {number|null} currentChatId - Currently active chat ID
   * @param {number} [delay=1000] - Delay in milliseconds before saving
   */
  debouncedSave(chats, nextChatId, currentChatId, delay = 1000) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveData(chats, nextChatId, currentChatId);
      this.saveTimeout = null;
    }, delay);
  }

  /**
   * Immediate save for critical operations (bypasses debouncing)
   * Used for operations like chat deletion or renaming that need immediate persistence
   * @param {Map} chats - Map of chat objects
   * @param {number} nextChatId - Next available chat ID
   * @param {number|null} currentChatId - Currently active chat ID
   * @returns {Promise<void>}
   */
  async forceSave(chats, nextChatId, currentChatId) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.saveData(chats, nextChatId, currentChatId);
  }

  /**
   * Load and decrypt chat data from Chrome storage
   * @returns {Promise<{chats: Map, nextChatId: number, currentChatId: number|null}>} Decrypted chat data
   * @throws {Error} If storage access fails
   */
  async loadData() {
    try {
      const result = await chrome.storage.local.get(['encryptedChats', 'nextChatId', 'currentChatId']);
      
      let chats = new Map();
      if (result.encryptedChats) {
        try {
          // Decrypt and parse chat data
          const decryptedData = await this.decryptData(result.encryptedChats);
          chats = new Map(Object.entries(decryptedData).map(([k, v]) => [parseInt(k), v]));
        } catch (decryptError) {
          console.warn('Failed to decrypt chat data, starting fresh');
          chats = new Map();
        }
      }
      
      return {
        chats,
        nextChatId: result.nextChatId || 1,
        currentChatId: result.currentChatId || null
      };
    } catch (error) {
      console.error('Error loading from storage:', error);
      throw error;
    }
  }

  /**
   * Encrypt data using AES-GCM algorithm
   * @param {any} data - Data to encrypt (will be JSON stringified)
   * @returns {Promise<Array<number>|string>} Encrypted data as byte array, or JSON string as fallback
   */
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

  /**
   * Decrypt data using AES-GCM algorithm
   * Handles both encrypted byte arrays and fallback JSON strings
   * @param {Array<number>|string} encryptedArray - Encrypted data as byte array or JSON string fallback
   * @returns {Promise<any>} Decrypted and parsed data object
   * @throws {Error} If decryption fails (indicates corrupted data or wrong key)
   */
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

  /**
   * Get existing encryption key or create new one
   * Generates AES-GCM 256-bit key and stores it in Chrome storage
   * Keys persist across browser sessions for consistent encryption
   * @returns {Promise<CryptoKey>} AES-GCM encryption key for data operations
   */
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

  /**
   * Securely save API key with encryption
   * API keys are encrypted before storage to protect user credentials
   * @param {string} apiKey - Poe API key to encrypt and store
   * @throws {Error} If encryption or storage operation fails
   */
  async saveApiKey(apiKey) {
    try {
      console.log('[StorageManager] Saving API key');
      const encryptedKey = await this.encryptData(apiKey);
      await chrome.storage.local.set({
        encryptedApiKey: encryptedKey
      });
      
      // Update cache
      this.cachedApiKey = apiKey;
      this.cacheTimestamp = Date.now();
      console.log('[StorageManager] API key saved and cached');
    } catch (error) {
      console.error('[StorageManager] Error saving API key:', error);
      // Clear cache on save error
      this.cachedApiKey = null;
      this.cacheTimestamp = 0;
      throw error;
    }
  }

  /**
   * Retrieve and decrypt API key
   * Returns null if no key is stored, allowing graceful handling
   * @returns {Promise<string|null>} Decrypted API key or null if not found
   * @throws {Error} If decryption fails (corrupted key or storage error)
   */
  async getApiKey() {
    try {
      // Check cache first
      const now = Date.now();
      if (this.cachedApiKey && (now - this.cacheTimestamp) < this.cacheValidityMs) {
        console.log('[StorageManager] Returning cached API key');
        return this.cachedApiKey;
      }

      console.log('[StorageManager] Retrieving API key from storage');
      
      // First try the new key name, then fall back to old name for migration
      const result = await chrome.storage.local.get(['encryptedApiKey', 'encryptedOpenAIKey']);
      let decryptedKey = null;
      
      if (result.encryptedApiKey) {
        decryptedKey = await this.decryptData(result.encryptedApiKey);
      } else if (result.encryptedOpenAIKey) {
        decryptedKey = await this.decryptData(result.encryptedOpenAIKey);
      }
      
      // Cache the result
      if (decryptedKey) {
        this.cachedApiKey = decryptedKey;
        this.cacheTimestamp = now;
        console.log('[StorageManager] API key cached successfully');
      }
      
      return decryptedKey;
    } catch (error) {
      console.error('[StorageManager] Error retrieving API key:', error);
      // Clear cache on error
      this.cachedApiKey = null;
      this.cacheTimestamp = 0;
      throw error;
    }
  }

  // Legacy method names for backward compatibility
  async saveOpenAIApiKey(apiKey) {
    return this.saveApiKey(apiKey);
  }

  async getOpenAIApiKey() {
    return this.getApiKey();
  }
}