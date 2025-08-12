/**
 * Poe API Client Module
 * Handles all communication with Poe's API for the debunkr.org bot.
 * This client uses the OpenAI-compatible Chat Completions endpoint provided by Poe.
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
  }

  /**
   * Test Poe API connection with the provided API key.
   * Makes a simple request to the /bots endpoint to validate the key.
   * @param {string} apiKey - Poe API key to test.
   * @returns {Promise<boolean>} True if the connection is successful, false otherwise.
   */
  async testConnection(apiKey) {
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
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      console.log('Poe connection test status:', response.status);
      return response.ok;
    } catch (error) {
      console.error('Error testing Poe connection:', error);
      return false;
    }
  }

  /**
   * Send message history to the Poe bot and return the response.
   * @param {Array<Object>} messageHistory - The full history of the conversation.
   * @returns {Promise<string>} The assistant's response text.
   * @throws {Error} If API key is missing or the API request fails.
   */
  async sendMessage(messageHistory) {
    try {
      const apiKey = await this.storageManager.getOpenAIApiKey(); // This now gets the Poe key
      if (!apiKey) {
        throw new Error('Poe API key not configured. Please configure it in Settings.');
      }

      // Map the extension's message format to the API's expected format.
      const apiMessages = messageHistory.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant', // Ensure correct roles
        content: msg.content,
      }));

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'debunkr.org',
          messages: apiMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Poe API Error: ${errorData.error?.message || response.statusText}`);
      }

      const chatCompletion = await response.json();

      if (chatCompletion.choices && chatCompletion.choices.length > 0) {
        return chatCompletion.choices[0].message.content;
      }

      throw new Error('No response from assistant.');
    } catch (error) {
      console.error('Error communicating with Poe API:', error);
      throw error;
    }
  }
}