<template>
  <nav class="navigation">
    <div class="nav-links">
      <button 
        class="nav-link"
        :class="{ active: currentView === 'home' }"
        @click="$emit('navigate', 'home')"
      >
        🏠 Home
      </button>
      <button 
        class="nav-link"
        :class="{ active: currentView === 'buckets' }"
        @click="$emit('navigate', 'buckets')"
      >
        📁 Storage Buckets
      </button>
    </div>
  </nav>
</template>

<script setup>
// Props
defineProps({
  currentView: {
    type: String,
    default: 'home'
  }
})

// Emits
defineEmits(['navigate'])
</script>

<style scoped>
.navigation {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 2rem;
}

.nav-links {
  display: flex;
  gap: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.nav-link {
  background: none;
  border: none;
  padding: 1rem 1.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: #2196f3;
  background: #f8f9ff;
}

.nav-link.active {
  color: #2196f3;
  border-bottom-color: #2196f3;
  background: #f8f9ff;
}
</style>
