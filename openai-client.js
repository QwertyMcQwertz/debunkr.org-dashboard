/**
 * OpenAI API Client Module
 * Handles all communication with OpenAI's Assistants API
 * 
 * Features:
 * - Secure API key management through StorageManager
 * - OpenAI Assistant API integration (v2)
 * - Exponential backoff for polling operations (500ms to 8s intervals)
 * - Thread and run management
 * - Connection testing for API key validation
 * - Comprehensive error handling and timeout protection
 * 
 * API Flow:
 * 1. Create thread for conversation context
 * 2. Add user message to thread
 * 3. Create run with specific assistant ID
 * 4. Poll for completion with exponential backoff
 * 5. Retrieve and return assistant response
 * 
 * @class OpenAIClient
 */
class OpenAIClient {
  /**
   * Initialize OpenAI client with storage manager dependency
   * @param {StorageManager} storageManager - Storage manager for API key access
   * @constructor
   */
  constructor(storageManager) {
    /** @type {StorageManager} Reference to storage manager for API key operations */
    this.storageManager = storageManager;
  }

  /**
   * Test OpenAI API connection with provided API key
   * Makes a simple request to validate API key without consuming tokens
   * @param {string} apiKey - OpenAI API key to test
   * @returns {Promise<boolean>} True if connection successful, false otherwise
   */
  async testConnection(apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error testing OpenAI connection:', error);
      return false;
    }
  }

  /**
   * Send message to OpenAI Assistant and return response
   * Creates a new thread, adds message, runs assistant, and polls for completion
   * Uses exponential backoff to efficiently wait for response
   * 
   * @param {string} message - User message to send to assistant
   * @returns {Promise<string>} Assistant's response text
   * @throws {Error} If API key missing, API request fails, or timeout occurs
   */
  async sendMessage(message) {
    try {
      const apiKey = await this.storageManager.getOpenAIApiKey();
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please configure it in Settings.');
      }

      // Create a thread
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!threadResponse.ok) {
        const error = await threadResponse.json();
        throw new Error(`Failed to create thread: ${error.error?.message || 'Unknown error'}`);
      }

      const thread = await threadResponse.json();

      // Add message to thread
      const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          role: 'user',
          content: message
        })
      });

      if (!messageResponse.ok) {
        const error = await messageResponse.json();
        throw new Error(`Failed to add message: ${error.error?.message || 'Unknown error'}`);
      }

      // Create run with the specified assistant
      const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          assistant_id: 'asst_1WukdMISy691nNjcLIwjKFfs'
        })
      });

      if (!runResponse.ok) {
        const error = await runResponse.json();
        throw new Error(`Failed to create run: ${error.error?.message || 'Unknown error'}`);
      }

      const run = await runResponse.json();

      // Poll for completion with exponential backoff
      const response = await this.pollForCompletion(apiKey, thread.id, run.id);
      return response;
    } catch (error) {
      console.error('Error communicating with OpenAI:', error);
      throw error;
    }
  }

  /**
   * Poll for run completion with exponential backoff
   * Starts with 500ms intervals and increases to maximum 8s intervals
   * Prevents overwhelming the API while ensuring responsive completion detection
   * 
   * @param {string} apiKey - OpenAI API key for authentication
   * @param {string} threadId - Thread ID to poll
   * @param {string} runId - Run ID to monitor
   * @returns {Promise<string>} Completed assistant response
   * @throws {Error} If polling timeout exceeded or run fails
   */
  async pollForCompletion(apiKey, threadId, runId) {
    let runStatus = await this.getRunStatus(apiKey, threadId, runId);
    let pollInterval = 500; // Start with 500ms
    let maxInterval = 8000; // Max 8 seconds
    let attempts = 0;
    const maxAttempts = 60; // Maximum 60 attempts (up to 5 minutes total)
    
    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      if (attempts >= maxAttempts) {
        throw new Error('Request timeout: Assistant is taking too long to respond');
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      runStatus = await this.getRunStatus(apiKey, threadId, runId);
      attempts++;
      
      // Exponential backoff: increase interval up to max
      pollInterval = Math.min(pollInterval * 1.5, maxInterval);
    }

    if (runStatus.status !== 'completed') {
      throw new Error(`Run failed with status: ${runStatus.status}`);
    }

    // Get messages
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!messagesResponse.ok) {
      throw new Error('Failed to get messages');
    }

    const messages = await messagesResponse.json();
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
    
    if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
      return assistantMessage.content[0].text.value;
    }
    
    throw new Error('No response from assistant');
  }

  /**
   * Get current status of a running assistant operation
   * Used by polling mechanism to check completion progress
   * 
   * @param {string} apiKey - OpenAI API key for authentication
   * @param {string} threadId - Thread ID containing the run
   * @param {string} runId - Run ID to check status for
   * @returns {Promise<Object>} Run status object from OpenAI API
   * @throws {Error} If status request fails
   */
  async getRunStatus(apiKey, threadId, runId) {
    const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    if (!statusResponse.ok) {
      throw new Error('Failed to check run status');
    }
    
    return await statusResponse.json();
  }
}