<template>
  <nav class="navigation">
    <div class="nav-links">
      <button 
        class="nav-link"
        :class="{ active: currentView === 'home' }"
        @click="$emit('navigate', 'home')"
      >
        <i class="fas fa-home"></i> Home
      </button>
      <button 
        class="nav-link"
        :class="{ active: currentView === 'albums' }"
        @click="$emit('navigate', 'albums')"
      >
        <i class="fas fa-layer-group"></i> Albums
      </button>
      <button 
        class="nav-link"
        :class="{ active: currentView === 'buckets' }"
        @click="$emit('navigate', 'buckets')"
      >
        <i class="fas fa-database"></i> Storage Buckets
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
  white-space: nowrap;
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

@media (max-width: 768px) {
  .navigation {
    padding: 0 1rem;
  }
  
  .nav-links {
    gap: 0.5rem;
    justify-content: center;
  }
  
  .nav-link {
    padding: 0.875rem 1rem;
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .navigation {
    padding: 0 0.5rem;
  }
  
  .nav-links {
    gap: 0.25rem;
  }
  
  .nav-link {
    padding: 0.75rem 0.75rem;
    font-size: 0.75rem;
  }
}
</style>
