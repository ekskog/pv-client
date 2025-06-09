<!--
  Debug Control Panel Component
  
  This component provides a floating debug panel for development
  that shows debug status and allows toggling debug modes.
  
  Only shows when VITE_DEBUG is enabled.
-->

<template>
  <div v-if="showDebugPanel" class="debug-panel">
    <div class="debug-header" @click="togglePanel">
      <i class="fas fa-bug"></i>
      <span>Debug</span>
      <i class="fas" :class="isPanelOpen ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
    </div>
    
    <div v-if="isPanelOpen" class="debug-content">
      <div class="debug-info">
        <h4>Debug Status</h4>
        <div class="debug-item">
          <span class="debug-label">Enabled:</span>
          <span class="debug-value" :class="debugInfo.enabled ? 'enabled' : 'disabled'">
            {{ debugInfo.enabled ? 'Yes' : 'No' }}
          </span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Pattern:</span>
          <span class="debug-value">{{ debugInfo.pattern }}</span>
        </div>
      </div>
      
      <div class="debug-controls">
        <h4>Quick Controls</h4>
        <button 
          class="debug-btn" 
          :class="{ active: isNamespaceEnabled('lightbox') }"
          @click="toggleNamespace('lightbox')"
        >
          Lightbox
        </button>
        <button 
          class="debug-btn" 
          :class="{ active: isNamespaceEnabled('gallery') }"
          @click="toggleNamespace('gallery')"
        >
          Gallery
        </button>
        <button 
          class="debug-btn" 
          :class="{ active: isNamespaceEnabled('api') }"
          @click="toggleNamespace('api')"
        >
          API
        </button>
        <button 
          class="debug-btn" 
          :class="{ active: isNamespaceEnabled('performance') }"
          @click="toggleNamespace('performance')"
        >
          Performance
        </button>
      </div>
      
      <div class="debug-actions">
        <button class="debug-btn enable-all" @click="enableAll">
          Enable All
        </button>
        <button class="debug-btn disable-all" @click="disableAll">
          Disable All
        </button>
        <button class="debug-btn clear-logs" @click="clearConsole">
          Clear Console
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { 
  getDebugInfo, 
  isDebugNamespaceEnabled,
  DEBUG_NAMESPACES
} from '../services/debug.js'

// Reactive state
const isPanelOpen = ref(false)
const debugInfo = ref(getDebugInfo())

// Check if debug panel should be shown
const showDebugPanel = computed(() => {
  return import.meta.env.VITE_DEBUG === 'true' || 
         import.meta.env.VITE_DEBUG_MODE === 'true' ||
         import.meta.env.MODE === 'development'
})

// Methods
const togglePanel = () => {
  isPanelOpen.value = !isPanelOpen.value
}

const isNamespaceEnabled = (namespace) => {
  return isDebugNamespaceEnabled(namespace)
}

const toggleNamespace = (namespace) => {
  const currentPattern = localStorage.getItem('debug') || ''
  const namespacePattern = `hbvu:${namespace}*`
  
  if (currentPattern.includes(namespacePattern)) {
    // Remove this namespace
    const newPattern = currentPattern
      .split(',')
      .filter(p => !p.includes(namespace))
      .join(',')
    localStorage.setItem('debug', newPattern)
  } else {
    // Add this namespace
    const newPattern = currentPattern ? `${currentPattern},${namespacePattern}` : namespacePattern
    localStorage.setItem('debug', newPattern)
  }
  
  // Refresh debug info
  debugInfo.value = getDebugInfo()
  
  // Reload page to apply changes
  setTimeout(() => window.location.reload(), 100)
}

const enableAll = () => {
  localStorage.setItem('debug', 'hbvu:*')
  debugInfo.value = getDebugInfo()
  setTimeout(() => window.location.reload(), 100)
}

const disableAll = () => {
  localStorage.removeItem('debug')
  debugInfo.value = getDebugInfo()
  setTimeout(() => window.location.reload(), 100)
}

const clearConsole = () => {
  console.clear()
}

// Update debug info periodically
onMounted(() => {
  setInterval(() => {
    debugInfo.value = getDebugInfo()
  }, 5000)
})
</script>

<style scoped>
.debug-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.9);
  color: #00ff00;
  border: 1px solid #333;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  z-index: 10000;
  min-width: 250px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.debug-header {
  padding: 8px 12px;
  background: #1a1a1a;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #333;
}

.debug-header:hover {
  background: #2a2a2a;
}

.debug-content {
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.debug-info h4,
.debug-controls h4 {
  margin: 0 0 8px 0;
  color: #ffffff;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.debug-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.debug-label {
  color: #888;
}

.debug-value {
  color: #00ff00;
  font-weight: bold;
}

.debug-value.enabled {
  color: #00ff00;
}

.debug-value.disabled {
  color: #ff6b6b;
}

.debug-controls {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #333;
}

.debug-btn {
  background: #333;
  color: #fff;
  border: 1px solid #555;
  padding: 4px 8px;
  margin: 2px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.2s ease;
}

.debug-btn:hover {
  background: #444;
}

.debug-btn.active {
  background: #00ff00;
  color: #000;
  border-color: #00ff00;
}

.debug-actions {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #333;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.debug-btn.enable-all {
  background: #4caf50;
  border-color: #4caf50;
}

.debug-btn.disable-all {
  background: #f44336;
  border-color: #f44336;
}

.debug-btn.clear-logs {
  background: #ff9800;
  border-color: #ff9800;
  color: #000;
}
</style>
