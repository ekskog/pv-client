<template>
  <div class="w-full">
    <!-- Photo Grid -->
    <div
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 transform-gpu"
    >
      <PhotoCard
        v-for="photo in currentPagePhotos"
        :key="photo.name"
        :photo="photo"
        :photo-metadata-lookup="photoMetadataLookup"
        :image-loaded="imageLoadedMap[photo.name]"
        :bucket-name="bucketName"
        @click="$emit('photoClick', photo)"
        @image-load="$emit('imageLoad', $event)"
        @image-error="$emit('imageError', $event)"
        @image-load-start="$emit('imageLoadStart', $event)"
      />
    </div>

    <!-- Pagination Controls -->
    <div class="flex justify-center items-center gap-2 flex-wrap mt-8" v-if="totalPages > 1">
      <!-- Previous Button -->
      <button 
        @click="goToPage(currentPage - 1)"
        :disabled="currentPage === 1"
        class="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200 transition-colors font-medium"
      >
        <i class="fas fa-chevron-left mr-2"></i>Previous
      </button>

      <!-- Page Numbers -->
      <div class="flex items-center gap-1 flex-wrap">
        <!-- First Page -->
        <button 
          v-if="showFirstPage"
          @click="goToPage(1)"
          class="min-w-10 h-10 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-500 font-medium transition-colors"
          :class="{ 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600': currentPage === 1 }"
        >
          1
        </button>

        <!-- First Ellipsis -->
        <span v-if="showFirstEllipsis" class="px-2 text-gray-500 font-medium">...</span>

        <!-- Visible Page Range -->
        <button
          v-for="page in visiblePages"
          :key="page"
          @click="goToPage(page)"
          class="min-w-10 h-10 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-500 font-medium transition-colors"
          :class="{ 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600': currentPage === page }"
        >
          {{ page }}
        </button>

        <!-- Last Ellipsis -->
        <span v-if="showLastEllipsis" class="px-2 text-gray-500 font-medium">...</span>

        <!-- Last Page -->
        <button 
          v-if="showLastPage"
          @click="goToPage(totalPages)"
          class="min-w-10 h-10 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-500 font-medium transition-colors"
          :class="{ 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600': currentPage === totalPages }"
        >
          {{ totalPages }}
        </button>
      </div>

      <!-- Next Button -->
      <button 
        @click="goToPage(currentPage + 1)"
        :disabled="currentPage === totalPages"
        class="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200 transition-colors font-medium"
      >
        Next<i class="fas fa-chevron-right ml-2"></i>
      </button>
    </div>

    <!-- Pagination Info -->
    <div class="text-center mt-4 text-sm text-gray-600" v-if="photos.length > 0">
      Showing {{ startItem }} - {{ endItem }} of {{ photos.length }} photos
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import PhotoCard from './PhotoCard.vue'

const props = defineProps({
  photos: { type: Array, required: true },
  photoMetadataLookup: { type: Object, required: true },
  imageLoadedMap: { type: Object, required: true },
  bucketName: { type: String, required: true },
  currentPage: { type: Number, required: true },
  itemsPerPage: { type: Number, default: 24 }
})

const emit = defineEmits([
  'photoClick', 
  'imageLoad', 
  'imageError', 
  'imageLoadStart',
  'pageChange'
])

// THIS IS THE KEY CHANGE - PROPER PAGINATION SLICE
const currentPagePhotos = computed(() => {
  const startIndex = (props.currentPage - 1) * props.itemsPerPage
  const endIndex = startIndex + props.itemsPerPage
  return props.photos.slice(startIndex, endIndex)
})

const totalPages = computed(() => {
  return Math.ceil(props.photos.length / props.itemsPerPage)
})

const startItem = computed(() => {
  if (props.photos.length === 0) return 0
  return (props.currentPage - 1) * props.itemsPerPage + 1
})

const endItem = computed(() => {
  return Math.min(props.currentPage * props.itemsPerPage, props.photos.length)
})

// Smart pagination controls
const visiblePages = computed(() => {
  const maxVisible = 5
  const delta = Math.floor(maxVisible / 2)
  let start = Math.max(2, props.currentPage - delta)
  let end = Math.min(totalPages.value - 1, props.currentPage + delta)

  if (props.currentPage <= delta + 1) {
    end = Math.min(totalPages.value - 1, maxVisible - 1)
  }
  if (props.currentPage >= totalPages.value - delta) {
    start = Math.max(2, totalPages.value - maxVisible + 2)
  }

  const pages = []
  for (let i = start; i <= end; i++) {
    if (i > 1 && i < totalPages.value) {
      pages.push(i)
    }
  }
  return pages
})

const showFirstPage = computed(() => {
  return totalPages.value > 1 && !visiblePages.value.includes(1)
})

const showLastPage = computed(() => {
  return totalPages.value > 1 && !visiblePages.value.includes(totalPages.value)
})

const showFirstEllipsis = computed(() => {
  return visiblePages.value.length > 0 && visiblePages.value[0] > 2
})

const showLastEllipsis = computed(() => {
  const lastVisible = visiblePages.value[visiblePages.value.length - 1]
  return visiblePages.value.length > 0 && lastVisible < totalPages.value - 1
})

// THIS IS THE KEY METHOD - EMITS PAGE CHANGE TO PARENT
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value && page !== props.currentPage) {
    console.log('📄 PhotoGrid: emitting pageChange event for page', page)
    emit('pageChange', page)
    
    // Scroll to top
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 50)
  }
}

// Debug logs
onMounted(() => {
  console.log('📋 PhotoGrid: mounted')
  console.log('📋 PhotoGrid: total photos =', props.photos.length)
  console.log('📋 PhotoGrid: currentPage =', props.currentPage)
  console.log('📋 PhotoGrid: itemsPerPage =', props.itemsPerPage)
  console.log('📋 PhotoGrid: totalPages =', totalPages.value)
  console.log('📋 PhotoGrid: showing photos', startItem.value, '-', endItem.value)
})

watch(() => props.currentPage, (newPage) => {
  console.log('📋 PhotoGrid: currentPage prop changed to', newPage)
  console.log('📋 PhotoGrid: now showing photos', startItem.value, '-', endItem.value)
})
</script>