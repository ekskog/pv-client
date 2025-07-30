<template>
  <div class="album-header">
    <button class="btn-back" @click="$emit('back')">
      <i class="fas fa-arrow-left"></i> Back to Albums
    </button>
    <div class="album-info">
      <h1><i class="fas fa-folder-open"></i> {{ albumName }}</h1>
      <p class="subtitle">{{ photoCount }} photos</p>
    </div>
    <div class="header-actions">
      <button 
        class="btn-secondary btn-refresh" 
        @click="$emit('refresh')"
        :disabled="loading"
        title="Refresh album"
      >
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
      </button>
      <button 
        v-if="canUploadPhotos"
        class="btn-primary" 
        @click="$emit('upload')"
      >
        <i class="fas fa-plus"></i> Add Media
      </button>
    </div>
  </div>
</template>

<script setup>
// Props
const props = defineProps({
  albumName: {
    type: String,
    required: true
  },
  photoCount: {
    type: Number,
    default: 0
  },
  loading: {
    type: Boolean,
    default: false
  },
  canUploadPhotos: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['back', 'refresh', 'upload'])
</script>

<style scoped>
.album-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.btn-back {
  background: #555;
  color: #333;
  border: 1px solid #491b1b;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.btn-back:hover {
  background: #e0e0e0;
}

.album-info h1 {
  font-size: 2rem;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.album-info .subtitle {
  font-size: 1rem;
  color: #666;
  margin: 0.25rem 0 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-refresh {
  min-width: 44px;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-refresh .fas.fa-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn-primary {
  background: #2196f3;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

@media (max-width: 768px) {
  .album-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .album-info {
    text-align: center;
  }
}
</style>