/**
 * Debug utility service for HBVU PHOTOS frontend
 * 
 * This service provides controlled logging functionality that can be toggled
 * via environment variables in Kubernetes deployments.
 * 
 * Usage:
 * import { debugLog, debugError, debugWarn } from '@/services/debug.js'
 * 
 * debugLog('component:lightbox', 'Opening photo in lightbox', { photoName, index })
 * debugError('api:upload', 'Upload failed', error)
 * debugWarn('performance', 'Slow image load detected', { loadTime, photoName })
 */

import debug from 'debug'

// Debug namespace configuration
const DEBUG_NAMESPACES = {
  // Component debugging
  LIGHTBOX: 'hbvu:lightbox',
  GALLERY: 'hbvu:gallery',
  UPLOAD: 'hbvu:upload',
  AUTH: 'hbvu:auth',
  NAVIGATION: 'hbvu:navigation',
  
  // API debugging
  API_REQUEST: 'hbvu:api:request',
  API_RESPONSE: 'hbvu:api:response',
  API_ERROR: 'hbvu:api:error',
  
  // Performance debugging
  PERFORMANCE: 'hbvu:performance',
  IMAGE_LOADING: 'hbvu:image:loading',
  
  // General debugging
  GENERAL: 'hbvu:general',
  ERROR: 'hbvu:error',
  WARNING: 'hbvu:warning'
}

// Initialize debug instances
const debugInstances = {}
Object.entries(DEBUG_NAMESPACES).forEach(([key, namespace]) => {
  debugInstances[key] = debug(namespace)
})

// Check if debugging is enabled via environment variables
const isDebugEnabled = () => {
  // Check various environment variable patterns
  const debugEnv = import.meta.env.VITE_DEBUG || 
                   import.meta.env.DEBUG || 
                   import.meta.env.VITE_DEBUG_MODE ||
                   'false'
  
  // Enable debug if any of these values are truthy
  return debugEnv === 'true' || 
         debugEnv === '1' || 
         debugEnv === 'on' || 
         debugEnv === 'enabled' ||
         debugEnv.includes('hbvu')
}

// Configure debug based on environment
const configureDebug = () => {
  if (isDebugEnabled()) {
    // Get the debug pattern from environment
    const debugPattern = import.meta.env.VITE_DEBUG_PATTERN || 
                         import.meta.env.VITE_DEBUG || 
                         'hbvu:*'
    
    // Enable debug with the specified pattern
    debug.enabled = () => true
    localStorage.setItem('debug', debugPattern)
    
    console.log('🐛 Debug mode enabled with pattern:', debugPattern)
  } else {
    // Disable all debug output
    debug.enabled = () => false
    localStorage.removeItem('debug')
  }
}

// Initialize debug configuration
configureDebug()

/**
 * Generic debug logger
 * @param {string} namespace - Debug namespace (e.g., 'lightbox', 'api:request')
 * @param {string} message - Log message
 * @param {any} data - Additional data to log
 */
export const debugLog = (namespace, message, data = null) => {
  if (!isDebugEnabled()) return
  
  const debugKey = Object.keys(DEBUG_NAMESPACES).find(key => 
    DEBUG_NAMESPACES[key].includes(namespace) || 
    namespace.toUpperCase() === key
  )
  
  const debugInstance = debugKey ? debugInstances[debugKey] : debugInstances.GENERAL
  
  if (data) {
    debugInstance(`${message}:`, data)
  } else {
    debugInstance(message)
  }
}

/**
 * Lightbox-specific debug logging
 */
export const debugLightbox = (message, data = null) => {
  debugLog('lightbox', message, data)
}

/**
 * Gallery-specific debug logging
 */
export const debugGallery = (message, data = null) => {
  debugLog('gallery', message, data)
}

/**
 * Upload-specific debug logging
 */
export const debugUpload = (message, data = null) => {
  debugLog('upload', message, data)
}

/**
 * API-specific debug logging
 */
export const debugApi = (type, message, data = null) => {
  debugLog(`api:${type}`, message, data)
}

/**
 * Performance debug logging
 */
export const debugPerformance = (message, data = null) => {
  debugLog('performance', message, data)
}

/**
 * Error debug logging (always visible if debug is enabled)
 */
export const debugError = (namespace, message, error = null) => {
  if (!isDebugEnabled()) return
  
  const debugInstance = debugInstances.ERROR
  
  if (error) {
    debugInstance(`❌ [${namespace}] ${message}:`, error)
  } else {
    debugInstance(`❌ [${namespace}] ${message}`)
  }
}

/**
 * Warning debug logging
 */
export const debugWarn = (namespace, message, data = null) => {
  if (!isDebugEnabled()) return
  
  const debugInstance = debugInstances.WARNING
  
  if (data) {
    debugInstance(`⚠️ [${namespace}] ${message}:`, data)
  } else {
    debugInstance(`⚠️ [${namespace}] ${message}`)
  }
}

/**
 * Image loading debug logging
 */
export const debugImageLoading = (message, data = null) => {
  debugLog('image:loading', message, data)
}

/**
 * App-level debugging for main application events
 */
export const debugApp = (message, data = null) => {
  debugLog('GENERAL', message, data)
}

/**
 * Check if a specific debug namespace is enabled
 */
export const isDebugNamespaceEnabled = (namespace) => {
  if (!isDebugEnabled()) return false
  
  const debugKey = Object.keys(DEBUG_NAMESPACES).find(key => 
    DEBUG_NAMESPACES[key].includes(namespace) || 
    namespace.toUpperCase() === key
  )
  
  return debugKey ? debugInstances[debugKey].enabled : false
}

/**
 * Get current debug configuration info
 */
export const getDebugInfo = () => {
  return {
    enabled: isDebugEnabled(),
    pattern: localStorage.getItem('debug') || 'none',
    environment: {
      VITE_DEBUG: import.meta.env.VITE_DEBUG,
      VITE_DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE,
      VITE_DEBUG_PATTERN: import.meta.env.VITE_DEBUG_PATTERN
    },
    namespaces: DEBUG_NAMESPACES
  }
}

// Export debug instances for advanced usage
export { debugInstances, DEBUG_NAMESPACES }

export default {
  debugLog,
  debugLightbox,
  debugGallery,
  debugUpload,
  debugApi,
  debugPerformance,
  debugError,
  debugWarn,
  debugImageLoading,
  debugApp,
  isDebugNamespaceEnabled,
  getDebugInfo
}
