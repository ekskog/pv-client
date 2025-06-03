<template>
  <!-- PhotoVault Bucket Explorer - CI/CD Test v3 -->
  <div class="bucket-explorer">
    <div v-if="loading" class="loading">
      Loading...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else class="content">
      <!-- Bucket List -->
      <BucketList 
        :selectedBucket="selectedBucket"
        @bucket-selected="handleBucketSelected"
      />

      <!-- Folder Browser (when bucket is selected) -->
      <FolderBrowser 
        v-if="selectedBucket"
        :bucketName="selectedBucket"
        @error="handleError"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import BucketList from './bucket/BucketList.vue'
import FolderBrowser from './folder/FolderBrowser.vue'

// Reactive state
const loading = ref(false)
const error = ref(null)
const selectedBucket = ref('')

// Methods
const handleBucketSelected = (bucketName) => {
  selectedBucket.value = bucketName
  error.value = null // Clear any previous errors
}

const handleError = (errorMessage) => {
  error.value = errorMessage
}
</script>

<style scoped>
.bucket-explorer {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  font-size: 1.1rem;
}

.error {
  color: #c62828;
  background: #fde8e8;
  border-radius: 8px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

@media (max-width: 768px) {
  .bucket-explorer {
    padding: 1rem;
  }
  
  .loading, .error {
    padding: 1.5rem;
    font-size: 1rem;
  }
  
  .content {
    gap: 1.5rem;
  }
}

@media (max-width: 480px) {
  .bucket-explorer {
    padding: 0.75rem;
  }
  
  .loading, .error {
    padding: 1rem;
    font-size: 0.95rem;
  }
  
  .content {
    gap: 1rem;
  }
}
</style>
