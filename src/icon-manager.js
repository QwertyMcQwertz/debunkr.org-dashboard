/**
 * Icon Manager
 * Centralized management of application icons and visual assets
 * 
 * Features:
 * - Consistent icon usage across the application
 * - Dynamic icon loading and fallbacks
 * - Icon optimization and caching
 * - SVG icon utilities
 * 
 * @class IconManager
 */
class IconManager {
  /**
   * Initialize icon manager
   * @constructor
   */
  constructor() {
    /** @type {Object} Available extension icons */
    this.extensionIcons = {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png', 
      48: 'icons/icon48.png',
      128: 'icons/icon128.png'
    };

    /** @type {Object} Available SVG logos */
    this.logos = {
      full: 'assets/debunkr_logo.svg',
      half: 'assets/debunkr_logo_half.svg'
    };

    /** @type {Object} SVG icons used in the UI */
    this.svgIcons = {
      settings: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.79a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>`,
      
      send: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2.5 10L17.5 10M17.5 10L12.5 5M17.5 10L12.5 15"/>
      </svg>`,
      
      imageUpload: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="m21 15-3.086-3.086a2 2 0 00-2.828 0L6 21"/>
      </svg>`,
      
      sidebarCollapse: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>`,
      
      newChat: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>`,
      
      copy: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
      </svg>`,
      
      copied: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"/>
      </svg>`,
      
      rename: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>`,
      
      delete: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3,6 5,6 21,6"/>
        <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
      </svg>`,
      
      search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>`,
      
      close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>`,
      
      eye: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>`,
      
      eyeOff: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>`
    };

    /** @type {Map} Cache for loaded icons */
    this.iconCache = new Map();
  }

  /**
   * Get extension icon path by size
   * @param {number} size - Icon size (16, 32, 48, 128)
   * @returns {string} Icon path
   */
  getExtensionIcon(size) {
    return this.extensionIcons[size] || this.extensionIcons[16];
  }

  /**
   * Get logo path
   * @param {string} type - Logo type ('full' or 'half')
   * @returns {string} Logo path
   */
  getLogo(type = 'full') {
    return this.logos[type] || this.logos.full;
  }

  /**
   * Get SVG icon by name
   * @param {string} name - Icon name
   * @param {Object} options - Icon options
   * @returns {string} SVG icon HTML
   */
  getSVGIcon(name, options = {}) {
    const icon = this.svgIcons[name];
    if (!icon) {
      console.warn(`[IconManager] Icon '${name}' not found`);
      return '';
    }

    // Apply custom attributes if provided
    if (options.width || options.height || options.className) {
      let modifiedIcon = icon;
      
      if (options.width) {
        modifiedIcon = modifiedIcon.replace(/width="[\d]+"/, `width="${options.width}"`);
      }
      if (options.height) {
        modifiedIcon = modifiedIcon.replace(/height="[\d]+"/, `height="${options.height}"`);
      }
      if (options.className) {
        modifiedIcon = modifiedIcon.replace(/<svg/, `<svg class="${options.className}"`);
      }
      
      return modifiedIcon;
    }

    return icon;
  }

  /**
   * Create icon button element
   * @param {string} iconName - Name of SVG icon
   * @param {Object} options - Button options
   * @returns {HTMLElement} Button element with icon
   */
  createIconButton(iconName, options = {}) {
    const button = document.createElement('button');
    button.className = options.className || 'icon-button';
    button.title = options.title || '';
    button.type = options.type || 'button';
    
    if (options.id) {
      button.id = options.id;
    }

    const icon = this.getSVGIcon(iconName, {
      width: options.iconWidth,
      height: options.iconHeight
    });
    
    button.innerHTML = icon + (options.text ? ` ${options.text}` : '');
    
    if (options.onClick) {
      button.addEventListener('click', options.onClick);
    }

    return button;
  }

  /**
   * Update existing icon in element
   * @param {HTMLElement} element - Element containing the icon
   * @param {string} iconName - New icon name
   */
  updateIcon(element, iconName) {
    const icon = this.getSVGIcon(iconName);
    if (icon && element) {
      element.innerHTML = icon;
    }
  }

  /**
   * Preload extension icons for better performance
   * @returns {Promise<void>} Promise that resolves when icons are preloaded
   */
  async preloadIcons() {
    const preloadPromises = Object.values(this.extensionIcons).map(iconPath => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.iconCache.set(iconPath, img);
          resolve(img);
        };
        img.onerror = reject;
        img.src = iconPath;
      });
    });

    try {
      await Promise.all(preloadPromises);
      console.log('[IconManager] Extension icons preloaded successfully');
    } catch (error) {
      console.warn('[IconManager] Some icons failed to preload:', error);
    }
  }

  /**
   * Get all available icon names
   * @returns {Object} Available icons by category
   */
  getAvailableIcons() {
    return {
      extension: Object.keys(this.extensionIcons),
      logos: Object.keys(this.logos),
      svg: Object.keys(this.svgIcons)
    };
  }

  /**
   * Validate icon exists
   * @param {string} iconName - Icon name to validate
   * @param {string} category - Icon category ('svg', 'extension', 'logo')
   * @returns {boolean} Whether icon exists
   */
  hasIcon(iconName, category = 'svg') {
    switch (category) {
      case 'svg':
        return iconName in this.svgIcons;
      case 'extension':
        return iconName in this.extensionIcons;
      case 'logo':
        return iconName in this.logos;
      default:
        return false;
    }
  }

  /**
   * Generate CSS for icon styling
   * @returns {string} CSS for icon styling
   */
  generateIconCSS() {
    return `
      .icon-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      
      .icon-button:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }
      
      .icon-button:active {
        background-color: rgba(0, 0, 0, 0.1);
      }
      
      .icon-button svg {
        display: block;
      }
      
      .icon-loading {
        animation: icon-spin 1s linear infinite;
      }
      
      @keyframes icon-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
  }

  /**
   * Clean up icon manager
   */
  cleanup() {
    this.iconCache.clear();
    console.log('[IconManager] Cleanup completed');
  }
}

// Make IconManager globally available
if (typeof window !== 'undefined') {
  window.IconManager = IconManager;
}