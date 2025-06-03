<template>
  <div 
    class="bucket-card"
    :class="{ 'active': isSelected }"
    @click="$emit('click')"
  >
    <div class="bucket-icon">📁</div>
    <div class="bucket-name">{{ bucket.name }}</div>
    <div class="bucket-date">{{ formatDate(bucket.creationDate) }}</div>
    <div class="bucket-stats">
      <div class="stat-item" v-if="stats?.status === 'loaded'">
        <span class="stat-label">Objects:</span>
        <span class="stat-value">{{ stats.objectCount.toLocaleString() }}</span>
      </div>
      <div class="stat-item" v-if="stats?.status === 'loaded' && stats.totalSize > 0">
        <span class="stat-label">Size:</span>
        <span class="stat-value">{{ formatFileSize(stats.totalSize) }}</span>
      </div>
      <div class="stat-item loading" v-else-if="stats?.status === 'timeout'">
        <span class="stat-label">Too large to scan</span>
      </div>
      <div class="stat-item error" v-else-if="stats?.status === 'error'">
        <span class="stat-label">Error loading</span>
      </div>
      <div class="stat-item loading" v-else>
        <span class="stat-label">Loading...</span>
      </div>
    </div>
  </div>
</template>

<script setup>
// Props
defineProps({
  bucket: {
    type: Object,
    required: true
  },
  stats: {
    type: Object,
    default: null
  },
  isSelected: {
    type: Boolean,
    default: false
  }
})

// Emits
defineEmits(['click'])

// Utility functions
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.bucket-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 120px;
}

.bucket-card:hover {
  border-color: #2196f3;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.1);
}

.bucket-card.active {
  border-color: #2196f3;
  background: #f3f9ff;
}

.bucket-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.bucket-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
  word-break: break-word;
}

.bucket-date {
  font-size: 0.875rem;
  color: #666;
}

.bucket-stats {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f0f0f0;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #888;
  font-weight: 500;
}

.stat-value {
  font-size: 0.75rem;
  color: #333;
  font-weight: 600;
}

.stat-item.loading .stat-label {
  color: #bbb;
  font-style: italic;
}

.stat-item.error .stat-label {
  color: #d32f2f;
  font-style: italic;
}

@media (max-width: 768px) {
  .bucket-card {
    padding: 0.875rem;
    min-height: 100px;
  }
  
  .bucket-icon {
    font-size: 1.75rem;
  }
  
  .bucket-name {
    font-size: 0.95rem;
  }
  
  .bucket-date {
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .bucket-card {
    padding: 0.75rem;
  }
  
  .stat-label,
  .stat-value {
    font-size: 0.7rem;
  }
}
</style>
