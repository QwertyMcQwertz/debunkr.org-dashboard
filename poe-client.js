/**
 * Poe API Client Module
 * Handles all communication with Poe's API for the debunkr.org bot.
 * This client uses the Chat Completions endpoint provided by Poe.
 *
 * Features:
 * - Secure API key management through StorageManager.
 * - Client-side conversation history management for persistent chats.
 * - Connection testing for API key validation.
 * - Simplified, single-call API interaction.
 *
 * API Flow:
 * 1. The ChatManager provides the entire message history for a conversation.
 * 2. This client formats the history and sends it to the Poe API.
 * 3. The Poe API processes the request using the proprietary 'debunkr.org' bot.
 * 4. The response is returned directly to the ChatManager.
 *
 * @class PoeClient
 */
class PoeClient {
  /**
   * Initialize Poe client with storage manager dependency.
   * @param {StorageManager} storageManager - Storage manager for API key access.
   * @constructor
   */
  constructor(storageManager) {
    /** @type {StorageManager} Reference to storage manager for API key operations. */
    this.storageManager = storageManager;
    /** @type {string} The base URL for the Poe API. */
    this.baseUrl = 'https://api.poe.com/v1';
    /** @type {string|null} Cached API key to avoid repeated decryption */
    this.cachedApiKey = null;
    /** @type {number} Cache timestamp for API key */
    this.cacheTimestamp = 0;
    /** @type {number} Cache validity in milliseconds (5 minutes) */
    this.cacheValidity = 5 * 60 * 1000;
    /** @type {number} Last API request timestamp for throttling */
    this.lastRequestTime = 0;
    /** @type {number} Minimum interval between requests (ms) */
    this.minRequestInterval = 1000;
    /** @type {Map} Simple cache for identical requests */
    this.requestCache = new Map();
    /** @type {number} Maximum cache size */
    this.maxCacheSize = 20;
  }

  /**
   * Get API key with caching to avoid repeated decryption
   * @returns {Promise<string>} API key
   */
  async getCachedApiKey() {
    const now = Date.now();
    
    // Check if cache is valid
    if (this.cachedApiKey && (now - this.cacheTimestamp) < this.cacheValidity) {
      return this.cachedApiKey;
    }
    
    // Refresh cache
    this.cachedApiKey = await this.storageManager.getOpenAIApiKey();
    this.cacheTimestamp = now;
    
    return this.cachedApiKey;
  }

  /**
   * Clear API key cache (call when API key changes)
   */
  clearApiKeyCache() {
    this.cachedApiKey = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Clear request cache (call when chats are deleted to prevent resurrection)
   */
  clearRequestCache() {
    this.requestCache.clear();
    console.log('[PoeClient] Request cache cleared');
  }

  /**
   * Test Poe API connection with the provided API key.
   * Makes a minimal request to validate the key with timeout protection.
   * @param {string} apiKey - Poe API key to test.
   * @returns {Promise<boolean>} True if the connection is successful, false otherwise.
   */
  async testConnection(apiKey) {
    // Validate API key format
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
      console.warn('Invalid API key format');
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      console.log('Testing connection to Poe API...');
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'debunkr.org',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1 // Minimize API usage for test
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('Poe connection test status:', response.status);
      return response.ok;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('Connection test timed out');
        return false;
      }
      console.error('Error testing Poe connection:', error);
      return false;
    }
  }


  /**
   * Send message history to the Poe bot and return the response.
   * @param {Array<Object>} messageHistory - The full history of the conversation.
   * @param {Array<Object>} images - Optional array of image objects with data, type, and fileName.
   * @returns {Promise<string>} The assistant's response text.
   * @throws {Error} If API key is missing or the API request fails.
   */
  async sendMessage(messageHistory, images = []) {
    // Check cache for identical requests
    const cacheKey = this.generateCacheKey(messageHistory, images);
    if (this.requestCache.has(cacheKey)) {
      console.log('Returning cached response');
      return this.requestCache.get(cacheKey);
    }

    // Throttle requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`Throttling request, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const apiKey = await this.getCachedApiKey(); // Gets the Poe API key with caching
      if (!apiKey) {
        throw new Error('Poe API key not configured. Please configure it in Settings.');
      }

      // Validate inputs
      if (!Array.isArray(messageHistory) || messageHistory.length === 0) {
        throw new Error('Invalid message history provided.');
      }

      // Limit message history to recent messages to reduce payload size
      const maxMessages = 20;
      const recentHistory = messageHistory.length > maxMessages 
        ? messageHistory.slice(-maxMessages) 
        : messageHistory;

      // Map the extension's message format to the API's expected format.
      const apiMessages = recentHistory.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant', // Ensure correct roles
        content: msg.content,
      }));

      // If images are provided for the current message, add them to the last user message
      if (images.length > 0 && apiMessages.length > 0) {
        // Find the last user message instead of just the last message
        const lastUserMessage = apiMessages.slice().reverse().find(msg => msg.role === 'user');
        if (lastUserMessage) {
          const userText = lastUserMessage.content && lastUserMessage.content !== '[Image]' && lastUserMessage.content.trim()
            ? lastUserMessage.content
            : 'Please analyze this image';
            
          const contentParts = [
            { type: 'text', text: userText }
          ];
          
          images.forEach((image) => {
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: image.data
              }
            });
          });
          
          lastUserMessage.content = contentParts;
        }
      }

      const requestBody = {
        model: 'debunkr.org',
        messages: apiMessages,
      };


      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || 
          (response.status === 401 ? 'Invalid or expired API key' :
           response.status === 429 ? 'API rate limit exceeded' :
           response.status === 503 ? 'Service temporarily unavailable' :
           response.statusText || 'Unknown API error');
        throw new Error(`Poe API Error: ${errorMessage}`);
      }

      const chatCompletion = await response.json();

      if (chatCompletion.choices && chatCompletion.choices.length > 0) {
        const responseContent = chatCompletion.choices[0].message.content;
        
        // Cache successful responses
        this.cacheResponse(cacheKey, responseContent);
        
        // Update request timing
        this.lastRequestTime = Date.now();
        
        return responseContent;
      }

      throw new Error('No response from assistant.');
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      console.error('Error communicating with Poe API:', error);
      throw error;
    }
  }

  /**
   * Generate cache key for request deduplication
   * @param {Array} messageHistory - Message history
   * @param {Array} images - Image attachments
   * @returns {string} Cache key
   */
  generateCacheKey(messageHistory, images) {
    // Create a hash of the last few messages and images for caching
    const lastMessages = messageHistory.slice(-3).map(msg => `${msg.type}:${msg.content}`).join('|');
    const imageHashes = images.map(img => img.data.substring(0, 100)).join('|');
    
    // Use a simple hash instead of btoa to avoid character encoding issues
    let hash = 0;
    const str = lastMessages + imageHashes;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 16);
  }

  /**
   * Cache API response with size management
   * @param {string} cacheKey - Cache key
   * @param {string} response - API response to cache
   */
  cacheResponse(cacheKey, response) {
    // Remove oldest entry if cache is full
    if (this.requestCache.size >= this.maxCacheSize) {
      const firstKey = this.requestCache.keys().next().value;
      this.requestCache.delete(firstKey);
    }
    
    this.requestCache.set(cacheKey, response);
    console.log(`Cached response (cache size: ${this.requestCache.size})`);
  }
}