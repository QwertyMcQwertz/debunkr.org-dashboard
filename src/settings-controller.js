/**
 * Settings Controller
 * Manages application settings, API key configuration, and settings UI
 * 
 * Features:
 * - Settings modal management
 * - API key validation and testing
 * - Settings persistence
 * - User feedback and error handling
 * 
 * @class SettingsController
 */
class SettingsController {
  /**
   * Initialize settings controller
   * @param {EventBus} eventBus - Event bus for communication
   * @param {StorageManager} storageManager - Storage manager instance
   * @param {PoeClient} poeClient - Poe API client for testing
   * @param {UIManager} uiManager - UI manager for modal operations
   * @constructor
   */
  constructor(eventBus, storageManager, poeClient, uiManager) {
    /** @type {EventBus} Event bus instance */
    this.eventBus = eventBus;
    
    /** @type {StorageManager} Storage manager instance */
    this.storageManager = storageManager;
    
    /** @type {PoeClient} Poe API client */
    this.poeClient = poeClient;
    
    /** @type {UIManager} UI manager instance */
    this.uiManager = uiManager;
    
    /** @type {boolean} Whether settings listeners are set up */
    this.listenersSetup = false;
    
    /** @type {Object} Current settings state */
    this.currentSettings = {
      apiKey: null,
      isValid: false
    };

    this.setupEventListeners();
  }

  /**
   * Set up event listeners for settings-related events
   */
  setupEventListeners() {
    this.eventBus.on(EventTypes.SETTINGS_OPENED, this.handleSettingsOpened.bind(this));
    this.eventBus.on(EventTypes.SETTINGS_SAVED, this.handleSettingsSaved.bind(this));
    this.eventBus.on(EventTypes.SETTINGS_TEST, this.handleSettingsTest.bind(this));
    this.eventBus.on(EventTypes.UI_UPDATE, this.handleUIUpdate.bind(this));
  }

  /**
   * Open settings modal
   */
  async openSettings() {
    try {
      // Check if modal is already open
      const modal = this.uiManager.getElement('settingsModal');
      if (modal && modal.style.display !== 'none') {
        this.closeSettings();
        return;
      }

      // Open modal
      this.uiManager.openSettingsModal();
      
      // Load current API key
      const apiKeyInput = this.uiManager.getElement('apiKeyInput');
      try {
        const decryptedKey = await this.storageManager.getOpenAIApiKey();
        if (decryptedKey) {
          apiKeyInput.value = decryptedKey;
          this.currentSettings.apiKey = decryptedKey;
          this.currentSettings.isValid = true;
        }
      } catch (error) {
        console.error('[SettingsController] Error loading API key:', error);
        this.showSettingsStatus('Error loading API key', 'error');
      }

      // Set up event listeners if not already done
      if (!this.listenersSetup) {
        this.setupSettingsEventListeners();
        this.listenersSetup = true;
      }

      // Emit settings opened event
      this.eventBus.emit(EventTypes.SETTINGS_OPENED, {
        hasApiKey: Boolean(this.currentSettings.apiKey)
      });

    } catch (error) {
      console.error('[SettingsController] Error opening settings:', error);
      this.eventBus.emit(EventTypes.SETTINGS_ERROR, {
        operation: 'open',
        error: error.message
      });
    }
  }

  /**
   * Close settings modal
   */
  closeSettings() {
    this.uiManager.closeSettingsModal();
    
    this.eventBus.emit(EventTypes.UI_UPDATE, {
      type: 'settingsClosed'
    });
  }

  /**
   * Set up settings modal event listeners
   */
  setupSettingsEventListeners() {
    const closeBtn = this.uiManager.getElement('closeSettings');
    const saveBtn = this.uiManager.getElement('saveSettings');
    const testBtn = this.uiManager.getElement('testConnection');
    const toggleBtn = this.uiManager.getElement('toggleApiKey');
    const apiKeyInput = this.uiManager.getElement('apiKeyInput');
    const modal = this.uiManager.getElement('settingsModal');

    // Validate elements exist
    if (!closeBtn || !saveBtn || !toggleBtn || !apiKeyInput || !modal) {
      console.error('[SettingsController] Settings elements not found');
      return;
    }

    // Close modal handlers
    const closeModal = () => this.closeSettings();
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    // Toggle API key visibility
    toggleBtn.onclick = () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? '👁️' : '👁️‍🗨️';
    };

    // Save settings
    saveBtn.onclick = async () => {
      await this.saveSettings();
    };

    // Test connection
    if (testBtn) {
      testBtn.onclick = async () => {
        await this.testConnection();
      };
    }

    // Real-time validation
    apiKeyInput.addEventListener('input', (e) => {
      this.validateApiKeyFormat(e.target.value);
    });

    console.log('[SettingsController] Event listeners set up');
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    const apiKeyInput = this.uiManager.getElement('apiKeyInput');
    const saveBtn = this.uiManager.getElement('saveSettings');
    
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      this.showSettingsStatus('Please enter a Poe API key', 'error');
      return;
    }

    // Validate API key format
    if (!this.validateApiKeyFormat(apiKey)) {
      this.showSettingsStatus('Invalid API key format', 'error');
      return;
    }

    try {
      saveBtn.disabled = true;
      this.showSettingsStatus('Saving...', 'loading');
      
      // Save to storage
      await this.storageManager.saveOpenAIApiKey(apiKey);
      
      // Clear API key cache in PoeClient to force refresh
      if (this.poeClient && typeof this.poeClient.clearApiKeyCache === 'function') {
        this.poeClient.clearApiKeyCache();
      }
      
      // Update current settings
      this.currentSettings.apiKey = apiKey;
      this.currentSettings.isValid = true;
      
      this.showSettingsStatus('Settings saved successfully!', 'success');
      
      // Emit save event
      this.eventBus.emit(EventTypes.SETTINGS_SAVED, {
        apiKey: Boolean(apiKey),
        timestamp: new Date().toISOString()
      });
      
      // Auto-close after success
      setTimeout(() => this.closeSettings(), 1500);
      
    } catch (error) {
      console.error('[SettingsController] Error saving settings:', error);
      this.showSettingsStatus('Error saving settings. Please try again.', 'error');
      
      this.eventBus.emit(EventTypes.SETTINGS_ERROR, {
        operation: 'save',
        error: error.message
      });
    } finally {
      saveBtn.disabled = false;
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    const apiKeyInput = this.uiManager.getElement('apiKeyInput');
    const testBtn = this.uiManager.getElement('testConnection');
    
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      this.showSettingsStatus('Please enter an API key first', 'error');
      return;
    }

    if (!this.validateApiKeyFormat(apiKey)) {
      this.showSettingsStatus('Invalid API key format', 'error');
      return;
    }

    try {
      testBtn.disabled = true;
      this.showSettingsStatus('Testing connection...', 'loading');
      
      console.log('[SettingsController] Testing API connection');
      
      const success = await this.poeClient.testConnection(apiKey);
      
      if (success) {
        this.showSettingsStatus('Connection successful!', 'success');
        this.currentSettings.isValid = true;
        
        this.eventBus.emit(EventTypes.SETTINGS_TEST, {
          success: true,
          apiKey: Boolean(apiKey)
        });
      } else {
        this.showSettingsStatus('Connection failed. Please check your API key.', 'error');
        this.currentSettings.isValid = false;
        
        this.eventBus.emit(EventTypes.SETTINGS_TEST, {
          success: false,
          apiKey: Boolean(apiKey)
        });
      }
      
    } catch (error) {
      console.error('[SettingsController] Error testing connection:', error);
      this.showSettingsStatus('Connection test failed: ' + error.message, 'error');
      this.currentSettings.isValid = false;
      
      this.eventBus.emit(EventTypes.SETTINGS_ERROR, {
        operation: 'test',
        error: error.message
      });
    } finally {
      testBtn.disabled = false;
    }
  }

  /**
   * Validate API key format
   * @param {string} apiKey - API key to validate
   * @returns {boolean} Whether format is valid
   */
  validateApiKeyFormat(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic validation: should be at least 10 characters
    if (apiKey.length < 10) {
      return false;
    }

    // Check for obvious placeholder text
    const invalidPatterns = [
      'your-api-key',
      'enter-your-key',
      'api-key-here',
      'placeholder'
    ];

    const lowerKey = apiKey.toLowerCase();
    for (const pattern of invalidPatterns) {
      if (lowerKey.includes(pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Show status message in settings modal
   * @param {string} message - Status message
   * @param {string} type - Status type ('success', 'error', 'loading')
   */
  showSettingsStatus(message, type) {
    this.uiManager.showSettingsStatus(message, type);
  }

  /**
   * Get current API key status
   * @returns {Promise<Object>} API key status
   */
  async getCurrentApiKeyStatus() {
    try {
      const apiKey = await this.storageManager.getOpenAIApiKey();
      return {
        hasApiKey: Boolean(apiKey),
        isValid: this.currentSettings.isValid,
        keyLength: apiKey ? apiKey.length : 0
      };
    } catch (error) {
      console.error('[SettingsController] Error getting API key status:', error);
      return {
        hasApiKey: false,
        isValid: false,
        keyLength: 0,
        error: error.message
      };
    }
  }

  /**
   * Validate current settings
   * @returns {Promise<Object>} Validation result
   */
  async validateCurrentSettings() {
    const status = await this.getCurrentApiKeyStatus();
    
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (!status.hasApiKey) {
      result.valid = false;
      result.errors.push('No API key configured');
    } else if (!status.isValid) {
      result.warnings.push('API key has not been tested');
    }

    return result;
  }

  /**
   * Import settings from object
   * @param {Object} settings - Settings to import
   */
  async importSettings(settings) {
    try {
      if (settings.apiKey) {
        await this.storageManager.saveOpenAIApiKey(settings.apiKey);
        this.currentSettings.apiKey = settings.apiKey;
        this.currentSettings.isValid = false; // Require re-validation
      }

      this.eventBus.emit(EventTypes.SETTINGS_SAVED, {
        imported: true,
        timestamp: new Date().toISOString()
      });

      console.log('[SettingsController] Settings imported successfully');
    } catch (error) {
      console.error('[SettingsController] Error importing settings:', error);
      throw error;
    }
  }

  /**
   * Export current settings
   * @returns {Promise<Object>} Exported settings
   */
  async exportSettings() {
    try {
      const status = await this.getCurrentApiKeyStatus();
      
      return {
        hasApiKey: status.hasApiKey,
        isValid: status.isValid,
        exportedAt: new Date().toISOString(),
        // Note: We don't export the actual API key for security
      };
    } catch (error) {
      console.error('[SettingsController] Error exporting settings:', error);
      throw error;
    }
  }

  /**
   * Event handlers
   */
  handleSettingsOpened(data) {
    console.log('[SettingsController] Settings opened');
  }

  handleSettingsSaved(data) {
    console.log('[SettingsController] Settings saved');
  }

  handleSettingsTest(data) {
    console.log(`[SettingsController] Connection test: ${data.success ? 'success' : 'failed'}`);
  }

  handleUIUpdate(data) {
    if (data.type === 'openSettings') {
      this.openSettings();
    } else if (data.type === 'closeSettings') {
      this.closeSettings();
    }
  }

  /**
   * Get diagnostic information
   * @returns {Promise<Object>} Diagnostic data
   */
  async getDiagnostics() {
    const status = await this.getCurrentApiKeyStatus();
    
    return {
      hasApiKey: status.hasApiKey,
      isValid: status.isValid,
      listenersSetup: this.listenersSetup,
      keyLength: status.keyLength
    };
  }

  /**
   * Clean up settings controller
   */
  async cleanup() {
    // Close settings if open
    this.closeSettings();
    
    // Clear current settings
    this.currentSettings = {
      apiKey: null,
      isValid: false
    };
    
    this.listenersSetup = false;
    
    console.log('[SettingsController] Cleanup completed');
  }
}