<template>
  <section class="buckets-section">
    <h2>Storage Buckets</h2>
    <div class="buckets-grid">
      <BucketCard
        v-for="bucket in buckets"
        :key="bucket.name"
        :bucket="bucket"
        :stats="bucketStats[bucket.name]"
        :is-selected="selectedBucket === bucket.name"
        @click="$emit('bucket-selected', bucket.name)"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import BucketCard from './BucketCard.vue'
import apiService from '../../services/api.js'

// Props
const props = defineProps({
  selectedBucket: {
    type: String,
    default: ''
  }
})

// Emits
defineEmits(['bucket-selected'])

// Reactive state
const buckets = ref([])
const bucketStats = ref({})
const loading = ref(false)
const error = ref(null)

// Methods
const loadBucketStats = async (bucketName) => {
  try {
    // Add timeout for large buckets (30 seconds)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    const response = await apiService.getBucketContents(bucketName, '', { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (response.success && response.data) {
      // Calculate total size from objects if available
      const objects = response.data.objects || []
      const totalSize = objects.reduce((sum, obj) => sum + (obj.size || 0), 0)
      
      bucketStats.value[bucketName] = {
        objectCount: response.data.totalObjects || 0,
        totalSize: totalSize,
        status: 'loaded'
      }
    }
  } catch (err) {
    console.warn(`Failed to load stats for bucket ${bucketName}:`, err)
    // Set error state if the call fails
    bucketStats.value[bucketName] = { 
      objectCount: 0, 
      totalSize: 0, 
      status: err.name === 'AbortError' ? 'timeout' : 'error'
    }
  }
}

const loadBuckets = async () => {
  try {
    loading.value = true
    error.value = null
    const response = await apiService.getBuckets()
    buckets.value = response.data || []
    
    // Load statistics for each bucket in the background (non-blocking)
    buckets.value.forEach(bucket => {
      loadBucketStats(bucket.name)
    })
  } catch (err) {
    console.error('Error loading buckets:', err)
    error.value = 'Failed to load buckets: ' + err.message
  } finally {
    loading.value = false
  }
}

// Initialize
onMounted(async () => {
  await loadBuckets()
})
</script>

<style scoped>
.buckets-section h2 {
  margin-bottom: 1rem;
  color: #333;
  font-weight: 500;
}

.buckets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}
</style>
