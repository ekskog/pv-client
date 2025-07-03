// Configuration Service
// Manages runtime configuration including API URL

class ConfigService {
  constructor() {
    this.defaultConfig = {
      apiUrl: import.meta.env.VITE_API_URL || 'https://vault-api.hbvu.su',
      authMode: import.meta.env.VITE_AUTH_MODE || 'demo'
    }
    
    console.log('🔧 Config: Environment variables:', {
      VITE_API_URL: import.meta.env.VITE_API_URL,
      VITE_AUTH_MODE: import.meta.env.VITE_AUTH_MODE
    })
    
    this.config = this.loadConfig()
    console.log('🔧 Config: Final loaded config:', this.config)
  }

  // Load configuration from localStorage or use defaults
  loadConfig() {
    try {
      const stored = localStorage.getItem('photovault_config')
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...this.defaultConfig, ...parsed }
      }
    } catch (error) {
      console.warn('Failed to load stored config:', error)
    }
    
    return { ...this.defaultConfig }
  }

  // Save configuration to localStorage
  saveConfig(newConfig) {
    try {
      const oldConfig = { ...this.config }
      const updatedConfig = { ...this.config, ...newConfig }
      
      // Check if there are actual changes
      const hasChanges = Object.keys(newConfig).some(key => 
        oldConfig[key] !== updatedConfig[key]
      )
      
      if (!hasChanges) {
        return true
      }
      
      this.config = updatedConfig
      localStorage.setItem('photovault_config', JSON.stringify(this.config))
      
      // Emit custom event to notify other parts of the app
      window.dispatchEvent(new CustomEvent('config-changed', { 
        detail: { 
          config: this.config,
          changes: newConfig,
          previous: oldConfig
        }
      }))
      
      return true
    } catch (error) {
      console.error('Failed to save config:', error)
      return false
    }
  }

  // Get current configuration
  getConfig() {
    return { ...this.config }
  }

  // Get specific config value
  get(key) {
    return this.config[key]
  }

  // Set specific config value
  set(key, value) {
    return this.saveConfig({ [key]: value })
  }

  // Reset to defaults
  reset() {
    this.config = { ...this.defaultConfig }
    localStorage.removeItem('photovault_config')
    
    window.dispatchEvent(new CustomEvent('config-changed', { 
      detail: this.config 
    }))
    
    return true
  }

  // Get API URL (most commonly used)
  getApiUrl() {
    return this.config.apiUrl
  }

  // Set API URL
  setApiUrl(url) {
    // Basic URL validation
    try {
      new URL(url)
      return this.set('apiUrl', url)
    } catch (error) {
      console.error('Invalid URL:', url)
      return false
    }
  }

  // Test API connection
  async testApiConnection(url = null) {
    const testUrl = url || this.getApiUrl()
    
    try {
      const response = await fetch(`${testUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000
      })
      
      return {
        success: response.ok,
        status: response.status,
        url: testUrl
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        url: testUrl
      }
    }
  }
}

// Create and export singleton instance
const configService = new ConfigService()
export default configService
