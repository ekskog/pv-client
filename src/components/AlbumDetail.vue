<template>

  <!-- Use the new AlbumHeader component -->
  <AlbumHeader :album-name="albumName" :photo-count="visiblePhotos.length" :loading="loading"
    :can-upload-photos="canUploadPhotos" @back="$emit('back')" @refresh="refreshAlbum"
    @upload="showUploadDialog = true" />

  <!-- Loading State -->
  <div v-if="loading" class="loading">
    <div class="spinner"></div>
    <p>Loading album photos...</p>
  </div>

  <!-- Error State -->
  <div v-if="error" class="error">
    <p><i class="fas fa-exclamation-triangle"></i> {{ error }}</p>
    <button class="btn-secondary" @click="loadPhotos">Try Again</button>
  </div>

  <!-- Photos Grid -->
  <div v-if="!loading && !error" class="photos-section">
    <!-- Empty State -->
    <div v-if="visiblePhotos.length === 0" class="empty-state">
      <div class="empty-icon"><i class="fas fa-images"></i></div>
      <h3>No Photos Yet</h3>
      <p>Start building your album by adding some photos!</p>
    </div>

    <!-- Photos Grid -->
    <div v-else class="photos-grid">
      <div v-for="photo in paginatedVisiblePhotos" :key="photo.name" class="photo-card" @click="openPhoto(photo)">
        <div class="photo-item">
          <img :src="getOptimizedPhotoUrl(photo)" :alt="photo.name" @error="handleImageError" @load="handleImageLoad"
            @loadstart="handleImageLoadStart" class="photo-image" loading="lazy" :data-full-src="getPhotoUrl(photo)">
          <!-- Loading placeholder for images -->
          <div class="image-loading-placeholder">
            <i class="fas fa-image"></i>
          </div>
        </div>
        <div class="photo-info">
          <div class="photo-timestamp">
            <i class="fas fa-clock"></i>
            {{ formatPhotoTimestamp(photo) }}
          </div>
          <div class="photo-gps">
            <i class="fas fa-map-marker-alt"></i>
            {{ formatPhotoGPS(photo) }}
          </div>
        </div>
      </div>

      <!-- Load More Trigger (Invisible) -->
      <div class="load-more-trigger" v-if="paginatedVisiblePhotos.length < visiblePhotos.length"></div>
    </div>
  </div>

  <MediaUpload 
    :showUploadDialog="showUploadDialog" :album-name="albumName"
    @close="handleUploadDialogClose"
  />

  <!-- Delete Photo Confirmation -->
  <div v-if="showDeletePhotoDialog" class="dialog-overlay" @click="closeDeletePhotoDialog">
    <div class="dialog" @click.stop>
      <h3>Delete Photo</h3>
      <p>Are you sure you want to delete "<strong>{{ getPhotoDisplayName(photoToDelete?.name) }}</strong>"?</p>
      <p class="warning"><i class="fas fa-exclamation-triangle"></i> This action cannot be undone.</p>
      <div class="dialog-actions">
        <button class="btn-secondary" @click="closeDeletePhotoDialog">Cancel</button>
        <button class="btn-danger" @click="deletePhoto" :disabled="deletingPhoto">
          {{ deletingPhoto ? 'Deleting...' : 'Delete Photo' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Lightbox Viewer -->
  <div v-if="showLightbox" class="lightbox-overlay" @click="closeLightbox">
    <div class="lightbox-container" @click.stop>
      <!-- Navigation Controls -->
      <button class="lightbox-nav lightbox-prev" @click.stop="previousPhoto" :disabled="currentPhotoIndex === 0"
        title="Previous Photo (←)">
        <i class="fas fa-chevron-left"></i>
      </button>

      <button class="lightbox-nav lightbox-next" @click.stop="nextPhoto"
        :disabled="currentPhotoIndex === lightboxPhotos.length - 1" title="Next Photo (→)">
        <i class="fas fa-chevron-right"></i>
      </button>

      <!-- Close Button -->
      <button class="lightbox-close" @click.stop="closeLightbox" title="Close (Esc)">
        <i class="fas fa-times"></i>
      </button>

      <!-- Photo Display -->
      <div class="lightbox-content">
        <div class="lightbox-image-container">
          <!-- Backend handles all conversions -->
          <img v-if="currentPhoto" :src="getPhotoUrl(currentPhoto)" :alt="currentPhoto.name" class="lightbox-image"
            @error="handleLightboxImageError" @load="handleLightboxImageLoad">

          <!-- Loading placeholder -->
          <div v-if="lightboxLoading" class="lightbox-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading image...</p>
          </div>
        </div>

        <!-- Photo Info -->
        <div class="lightbox-info">
          <div class="lightbox-photo-details">
            <p class="lightbox-photo-meta">
              {{ currentPhotoIndex + 1 }} of {{ lightboxPhotos.length }}
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="lightbox-actions">
            <button @click="downloadPhoto(currentPhoto)" class="btn-lightbox-action" title="Download Photo">
              <i class="fas fa-download"></i>
            </button>
            <button v-if="canDeletePhoto" @click="confirmDeletePhoto(currentPhoto)"
              class="btn-lightbox-action btn-danger-action" title="Delete Photo">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import apiService from '../services/api.js'
import authService from '../services/auth.js'
import AlbumHeader from './AlbumHeader.vue'
import MediaUpload from './MediaUpload.vue'

// Props
const props = defineProps({
  albumName: {
    type: String,
    required: true
  }
})

// Emits
const emit = defineEmits(['back', 'photoOpened'])

// Core reactive state
const loading = ref(false)
const error = ref(null)
const photos = ref([])
const albumMetadata = ref(null)
const photoMetadataLookup = ref({})
const locationCache = ref(new Map())

// Upload/Delete state
const showUploadDialog = ref(false)
const showDeletePhotoDialog = ref(false)
const photoToDelete = ref(null)
const deletingPhoto = ref(false)

// Lightbox state
const showLightbox = ref(false)
const currentPhotoIndex = ref(0)
const lightboxLoading = ref(false)

// Progressive loading stats
const preloadStats = ref({
  total: 0,
  preloaded: 0,
  percentage: 0,
  currentlyFetchingFullSize: null,
  readyImages: []
})

// Progress tracker interval reference for cleanup
const progressTracker = ref(null)

// SSE state
const processingNotifications = ref(false)
const eventSource = ref(null)
const processingStatus = ref('')
const processingJobId = ref(null)

// Computed properties
const currentPhoto = computed(() => {
  const photo = lightboxPhotos.value[currentPhotoIndex.value] || null

  if (photo) {
    console.log('Current file showing in lightbox:', {
      name: photo.name,
      size: photo.size,
      type: photo.name.split('.').pop().toUpperCase(),
      index: currentPhotoIndex.value,
      totalFiles: lightboxPhotos.value.length
    })
  }

  return photo
})

// Permission checks
const canUploadPhotos = computed(() => {
  return authService.canPerformAction('upload_photos')
})

const canDeletePhoto = computed(() => {
  return authService.canPerformAction('delete_photo')
})

// Show all regular image files (no thumbnail filtering)
const visiblePhotos = computed(() => {
  return photos.value.filter(photo => {
    const isRegularImage = /\.(avif|jpg|jpeg|png|gif|heic)$/i.test(photo.name)
    const isThumbnail = /_thumb\./i.test(photo.name)
    return isRegularImage && !isThumbnail
  })
})

// Use the same photos for lightbox navigation
const lightboxPhotos = computed(() => {
  return visiblePhotos.value
})

// Virtual scrolling
const currentPage = ref(1)
const paginatedVisiblePhotos = computed(() => {
  const endIndex = currentPage.value * ITEMS_PER_PAGE
  return visiblePhotos.value.slice(0, endIndex)
})

// Constants
const BUCKET_NAME = 'photovault'
const ITEMS_PER_PAGE = 50

// Core Methods
const handleUploadDialogClose = (payload) => {
  showUploadDialog.value = false

  if (payload?.jobId) {
    console.log('Upload jobId received from child:', payload.jobId)
    startProcessingListener(payload.jobId)
  }
}

const loadPhotos = async () => {
  console.log('🔄 Loading album:', props.albumName)
  loading.value = true
  error.value = null

  try {
    let cleanAlbumName = props.albumName.trim()
    cleanAlbumName = cleanAlbumName.replace(/\/+$/, '')
    const prefix = cleanAlbumName + '/'

    // STEP 1: Load metadata FIRST
    console.log('📄 Loading metadata first...')
    await loadAlbumMetadata(cleanAlbumName)

    // STEP 2: Then load photos
    console.log('📡 Loading photos...')
    const response = await apiService.getBucketContents(BUCKET_NAME, prefix)

    if (response.success && response.data) {
      const allFiles = (response.data.objects || []).filter(obj => {
        return obj.name && !obj.name.endsWith('/')
      })

      // STEP 3: Set photos after metadata is ready
      photos.value = allFiles
      
      console.log('✅ Photos and metadata loaded:', {
        photosCount: allFiles.length,
        metadataCount: Object.keys(photoMetadataLookup.value).length
      })

      resetVirtualScrolling()
    } else {
      throw new Error(response.error || 'Failed to load album photos')
    }
  } catch (err) {
    console.error('❌ Error loading photos:', err)
    error.value = `Error loading photos: ${err.message}`
  } finally {
    loading.value = false
  }
}

const refreshAlbum = async () => {
  console.log('🔄 Refreshing album:', props.albumName)
  await loadPhotos()
}

const loadAlbumMetadata = async (albumName) => {
  try {
    const metadataFileName = `${albumName}/${albumName}.json`
    const metadataUrl = apiService.getObjectUrl(BUCKET_NAME, metadataFileName)

    console.log('📄 Loading metadata from:', metadataUrl)
    const response = await fetch(metadataUrl)
    
    if (response.ok) {
      const metadata = await response.json()
      albumMetadata.value = metadata

      const lookup = {}
      if (metadata.media && Array.isArray(metadata.media)) {
        metadata.media.forEach((mediaMeta) => {
          if (mediaMeta.sourceImage) {
            const filename = mediaMeta.sourceImage.split('/').pop()
            lookup[filename] = mediaMeta
            lookup[mediaMeta.sourceImage] = mediaMeta
          }
        })
      }
      
      photoMetadataLookup.value = lookup
      
      console.log('📄 Metadata loaded:', Object.keys(lookup).length, 'entries')
      
      // FORCE REACTIVITY: If photos are already loaded, trigger re-render
      if (photos.value.length > 0) {
        console.log('🔄 Forcing photo re-render after metadata load')
        const currentPhotos = photos.value
        photos.value = []
        await nextTick()
        photos.value = currentPhotos
      }
      
    } else {
      console.warn('📄 Metadata file not found:', metadataFileName)
    }
  } catch (err) {
    console.warn('📄 Could not load album metadata:', err.message)
  }
}

const formatPhotoTimestamp = (photo) => {
  // Return loading state if metadata isn't ready yet
  if (Object.keys(photoMetadataLookup.value).length === 0) {
    return 'Loading...'
  }

  const filename = photo.name.split('/').pop()
  let metadata = photoMetadataLookup.value[filename] || photoMetadataLookup.value[photo.name]

  // AVIF fallback logic
  if (!metadata && photo.name.includes('.avif')) {
    const baseName = filename.replace(/\.avif$/i, '')
    const possibleOriginals = Object.keys(photoMetadataLookup.value).filter(key => {
      const originalBase = key.replace(/\.[^.]+$/, '')
      return baseName.includes(originalBase) || originalBase.includes(baseName)
    })

    if (possibleOriginals.length > 0) {
      metadata = photoMetadataLookup.value[possibleOriginals[0]]
    }
  }

  if (!metadata || !metadata.timestamp) {
    return 'No date'
  }

  try {
    const date = new Date(metadata.timestamp)
    return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Invalid date'
  }
}

const formatPhotoGPS = (photo) => {
  // Return loading state if metadata isn't ready yet
  if (Object.keys(photoMetadataLookup.value).length === 0) {
    return 'Loading...'
  }

  const cacheKey = photo.name

  if (locationCache.value.has(cacheKey)) {
    return locationCache.value.get(cacheKey)
  }

  const filename = photo.name.split('/').pop()
  let metadata = photoMetadataLookup.value[filename] || photoMetadataLookup.value[photo.name]

  // AVIF fallback
  if (!metadata && photo.name.includes('.avif')) {
    const baseName = filename.replace(/\.avif$/i, '')
    const possibleOriginals = Object.keys(photoMetadataLookup.value).filter(key => {
      const originalBase = key.replace(/\.[^.]+$/, '')
      return baseName.includes(originalBase) || originalBase.includes(baseName)
    })

    if (possibleOriginals.length > 0) {
      metadata = photoMetadataLookup.value[possibleOriginals[0]]
    }
  }

  if (metadata && metadata.location) {
    locationCache.value.set(cacheKey, metadata.location)
    return metadata.location
  }

  if (metadata && metadata.coordinates) {
    locationCache.value.set(cacheKey, metadata.coordinates)
    return metadata.coordinates
  }

  return 'No location'
}

// Photo URL methods
const downloadPhoto = (photo) => {
  const downloadUrl = apiService.getObjectUrl(BUCKET_NAME, photo.name)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = getPhotoDisplayName(photo.name)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const getPhotoUrl = (photo) => {
  return apiService.getObjectUrl(BUCKET_NAME, photo.name)
}

const getOptimizedPhotoUrl = (photo) => {
  return apiService.getObjectUrl(BUCKET_NAME, photo.name)
}

const getPhotoDisplayName = (filename) => {
  return filename.split('/').pop() || filename
}

// Image loading and preloading
const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

const loadImageProgressively = async (photo, imgElement) => {
  try {
    const photoSrc = getPhotoUrl(photo)

    preloadStats.value.currentlyFetchingFullSize = photo.name

    preloadImage(photoSrc).then(() => {
      imgElement.dataset.fullLoaded = 'true'

      if (!preloadStats.value.readyImages.includes(photo.name)) {
        preloadStats.value.readyImages.push(photo.name)
      }

      preloadStats.value.currentlyFetchingFullSize = null
      trackProgressiveLoadingStats()
    }).catch((error) => {
      console.warn(`Preload failed for ${photo.name}:`, error.message)
      preloadStats.value.currentlyFetchingFullSize = null
    })

  } catch (error) {
    console.error(`Failed to load image for ${photo.name}:`, error)
  }
}

// Image event handlers
const handleImageError = (event) => {
  const imgElement = event.target
  const originalSrc = imgElement.src
  const photoName = imgElement.alt || 'unknown'

  console.error('❌ Image failed to load:', photoName, 'from', originalSrc)

  event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
}

const handleImageLoadStart = (event) => {
  const imgElement = event.target
  const photoName = imgElement.alt || 'unknown'
  console.log('🔄 Started loading image:', photoName)
}

const handleImageLoad = (event) => {
  // Image loaded successfully - could add tracking here if needed
}

// Lightbox methods
const openPhoto = async (photo) => {
  const targetPhotoIndex = lightboxPhotos.value.findIndex(p => p.name === photo.name)

  if (targetPhotoIndex === -1) {
    console.error(`Could not find photo in lightbox array: ${photo.name}`)
    return
  }

  const gridImage = document.querySelector(`img[alt="${photo.name}"][data-full-loaded="true"]`)
  const isPreloaded = gridImage && gridImage.dataset.fullLoaded === 'true'

  currentPhotoIndex.value = targetPhotoIndex
  showLightbox.value = true

  if (!isPreloaded) {
    lightboxLoading.value = true
  }

  document.addEventListener('keydown', handleLightboxKeyboard)
}

const closeLightbox = () => {
  showLightbox.value = false
  lightboxLoading.value = false
  document.removeEventListener('keydown', handleLightboxKeyboard)
}

const nextPhoto = () => {
  if (currentPhotoIndex.value < lightboxPhotos.value.length - 1) {
    const nextPhoto = lightboxPhotos.value[currentPhotoIndex.value + 1]
    const nextGridImage = document.querySelector(`img[alt="${nextPhoto.name}"][data-full-loaded="true"]`)
    const isNextPreloaded = nextGridImage && nextGridImage.dataset.fullLoaded === 'true'

    if (!isNextPreloaded) {
      lightboxLoading.value = true
    }

    currentPhotoIndex.value++
  }
}

const previousPhoto = () => {
  if (currentPhotoIndex.value > 0) {
    const prevPhoto = lightboxPhotos.value[currentPhotoIndex.value - 1]
    const prevGridImage = document.querySelector(`img[alt="${prevPhoto.name}"][data-full-loaded="true"]`)
    const isPrevPreloaded = prevGridImage && prevGridImage.dataset.fullLoaded === 'true'

    if (!isPrevPreloaded) {
      lightboxLoading.value = true
    }

    currentPhotoIndex.value--
  }
}

const handleLightboxKeyboard = (event) => {
  switch (event.key) {
    case 'Escape':
      closeLightbox()
      break
    case 'ArrowLeft':
      previousPhoto()
      break
    case 'ArrowRight':
      nextPhoto()
      break
  }
}

const handleLightboxImageError = async (event) => {
  event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIGNhbm5vdCBiZSBsb2FkZWQ8L3RleHQ+PC9zdmc+'
}

const handleLightboxImageLoad = (event) => {
  lightboxLoading.value = false
}

// Delete photo methods
const confirmDeletePhoto = (photo) => {
  if (!authService.canPerformAction('delete_photo')) {
    error.value = 'You do not have permission to delete photos'
    return
  }

  photoToDelete.value = photo
  showDeletePhotoDialog.value = true
}

const deletePhoto = async () => {
  if (!photoToDelete.value) return

  deletingPhoto.value = true
  error.value = null

  try {
    console.log('🗑️ Deleting photo:', photoToDelete.value.name, 'from bucket:', BUCKET_NAME)
    const response = await apiService.deleteObject(BUCKET_NAME, photoToDelete.value.name)
    console.log('🗑️ Delete response:', response)

    if (response.success) {
      if (showLightbox.value && currentPhoto.value && currentPhoto.value.name === photoToDelete.value.name) {
        closeLightbox()
      }

      await loadPhotos()
      closeDeletePhotoDialog()
    } else {
      throw new Error(response.error || 'Failed to delete photo')
    }
  } catch (err) {
    console.error('🗑️ Delete error:', err)
    error.value = `Failed to delete photo: ${err.message}`
  } finally {
    deletingPhoto.value = false
  }
}

const closeDeletePhotoDialog = () => {
  showDeletePhotoDialog.value = false
  photoToDelete.value = null
  deletingPhoto.value = false
}

// Progressive loading and performance
const trackProgressiveLoadingStats = () => {
  const allImages = document.querySelectorAll('.photo-image')
  const preloadedImages = document.querySelectorAll('.photo-image[data-full-loaded="true"]')
  const totalImages = allImages.length
  const preloadedCount = preloadedImages.length
  const preloadPercentage = totalImages > 0 ? Math.round((preloadedCount / totalImages) * 100) : 0

  preloadStats.value = {
    total: totalImages,
    preloaded: preloadedCount,
    percentage: preloadPercentage,
    currentlyFetchingFullSize: preloadStats.value.currentlyFetchingFullSize,
    readyImages: preloadStats.value.readyImages
  }

  return {
    total: totalImages,
    preloaded: preloadedCount,
    percentage: preloadPercentage
  }
}

const startAggressivePreloading = () => {
  const imageElements = document.querySelectorAll('.photo-image')

  imageElements.forEach((img, index) => {
    const photoName = img.alt
    const photo = visiblePhotos.value.find(p => p.name === photoName)

    if (photo) {
      setTimeout(() => {
        loadImageProgressively(photo, img)
      }, index * 100)
    }
  })
}

const preloadVisibleImages = () => {
  const imageElements = document.querySelectorAll('.photo-image[loading="lazy"]')
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target
        const photoName = img.alt
        const photo = visiblePhotos.value.find(p => p.name === photoName)
        
        if (photo) {
          loadImageProgressively(photo, img)
        }

        observer.unobserve(img)
      }
    })
  }, {
    rootMargin: '100px',
    threshold: 0.1
  })

  imageElements.forEach(img => observer.observe(img))
}

// Virtual scrolling
const loadMorePhotos = () => {
  if (paginatedVisiblePhotos.value.length < visiblePhotos.value.length) {
    currentPage.value++
  }
}

const resetVirtualScrolling = () => {
  currentPage.value = 1
}

const setupInfiniteScroll = () => {
  const sentinel = document.querySelector('.load-more-trigger')
  if (!sentinel) return

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && paginatedVisiblePhotos.value.length < visiblePhotos.value.length) {
        loadMorePhotos()
      }
    })
  }, { threshold: 0.1 })

  observer.observe(sentinel)
}

// SSE Methods for Upload Processing
const startProcessingListener = (jobId) => {
  console.log('Starting SSE processing listener for jobId:', jobId)
  if (eventSource.value) {
    eventSource.value.close()
  }

  processingJobId.value = jobId
  processingNotifications.value = true
  processingStatus.value = 'Starting photo processing...'

  const sseUrl = apiService.getProcessingStatusUrl(jobId)
  eventSource.value = new EventSource(sseUrl)

  eventSource.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('SSE message received:', data)
      handleProcessingUpdate(data)
    } catch (error) {
      console.error('Error parsing SSE message:', error)
    }
  }

  eventSource.value.onerror = (error) => {
    console.error('SSE connection error:', error)
    setTimeout(() => {
      if (processingNotifications.value) {
        startProcessingListener(jobId)
      }
    }, 5000)
  }

  setTimeout(() => {
    if (eventSource.value) {
      stopProcessingListener()
    }
  }, 600000)
}

const handleProcessingUpdate = (data) => {
  console.log('Processing update:', data.type, data.message)
  switch (data.type) {
    case 'connected':
      processingStatus.value = 'Connected to photo processing service...'
      break

    case 'complete':
      processingStatus.value = 'Photo processing complete! 🎉'
      showProcessingCompleteNotification()

      setTimeout(async () => {
        await refreshAlbum()
        console.log('Album refreshed after processing complete')
        stopProcessingListener()
      }, 2000)
      break

    case 'failed':
      processingStatus.value = 'Photo processing failed. Please try again.'
      setTimeout(() => {
        stopProcessingListener()
      }, 5000)
      break

    default:
      processingStatus.value = data.message || 'Processing photos...'
  }
}

const showProcessingCompleteNotification = () => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Photo Processing Complete!', {
      body: 'Your photos are now ready to view in the album.',
      icon: '/favicon.ico'
    })
  }

  console.log('📸 Photo processing complete notification')
}

const stopProcessingListener = () => {
  console.log('Stopping SSE processing listener >>> ', eventSource.value)
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
  }

  processingNotifications.value = false
  processingStatus.value = ''
  processingJobId.value = null
}

// Lifecycle
onMounted(async () => {
  await loadPhotos()

  setTimeout(() => {
    startAggressivePreloading()
    preloadVisibleImages()
    setupInfiniteScroll()
    trackProgressiveLoadingStats()

    progressTracker.value = setInterval(() => {
      const stats = trackProgressiveLoadingStats()

      if (stats.percentage >= 100) {
        clearInterval(progressTracker.value)
        progressTracker.value = null
      }
    }, 2000)
  }, 100)
})

onUnmounted(() => {
  cleanupBlobUrls()
  // Clean up keyboard listener if lightbox is open
  document.removeEventListener('keydown', handleLightboxKeyboard)
  // Clean up SSE connection
  stopProcessingListener()
})
</script>

<style scoped>
.album-detail {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.album-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.btn-back {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
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
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
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

.btn-danger {
  background: #f44336;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.btn-danger:hover:not(:disabled) {
  background: #d32f2f;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 3rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #2196f3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.error {
  text-align: center;
  padding: 2rem;
  color: #f44336;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon {
  font-size: 4rem;
  color: #ccc;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.5rem;
  color: #333;
  margin: 0;
}

.empty-state p {
  color: #666;
  margin: 0 0 2rem 0;
}

/* Performance optimizations */
.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  /* Enable hardware acceleration */
  transform: translateZ(0);
  will-change: scroll-position;
}

.photo-card {
  background: white;
  border: 1px solid black;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  /* Enable hardware acceleration for hover effects */
  will-change: transform, box-shadow;
  /* Optimize repaint areas */
  contain: layout;
}

.photo-card:hover {
  border-color: #2196f3;
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.1);
  transform: translateY(-2px) translateZ(0);
}

/* Image loading optimization */
.photo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.3s ease;
  /* Improve image rendering */
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  /* Optimize for full-size images */
  filter: contrast(1.02) saturate(1.05);
}

/* Loading states with smooth transitions */
.photo-image.loading {
  opacity: 0;
  filter: blur(2px);
}

.photo-image.loaded {
  opacity: 1;
  filter: none;
}

.photo-item {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: #f8f9fa;
}

.photo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.3s ease;
}

.image-loading-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  color: #ccc;
  font-size: 2rem;
  z-index: 1;
  opacity: 1;
  transition: opacity 0.3s ease;
}

.photo-image:not([src=""])+.image-loading-placeholder {
  opacity: 0;
  pointer-events: none;
}

/* Progressive loading states */
.photo-image[data-full-loaded="true"] {
  filter: none;
}

.photo-image:not([data-full-loaded="true"]) {
  filter: blur(0.5px) brightness(1.1);
}

/* Lazy loading optimization */
.photo-image[loading="lazy"] {
  content-visibility: auto;
  contain-intrinsic-size: 200px 200px;
}

.heic-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.5rem;
  background: #f8f9fa;
  color: #2196f3;
  font-size: 0.9rem;
}

.heic-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.5rem;
  background: #ffeaa7;
  color: #e17055;
  font-size: 0.8rem;
  padding: 1rem;
  text-align: center;
}

.heic-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.5rem;
  background: #f0f0f0;
  color: #999;
  font-size: 0.9rem;
}

.download-btn {
  background: #2196f3;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.7rem;
  margin-top: 0.5rem;
}

.download-btn:hover {
  background: #1976d2;
}

/* HEIC Conversion Status Indicators */
.heic-conversion-status {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  pointer-events: none;
}

.heic-conversion-status.converting {
  background: rgba(33, 150, 243, 0.9);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

.heic-conversion-status.converted {
  background: rgba(76, 175, 80, 0.9);
  color: white;
  padding: 4px 6px;
  border-radius: 50%;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  animation: checkmarkShow 2s ease-in-out;
}

.heic-conversion-status.error {
  background: rgba(244, 67, 54, 0.9);
  color: white;
  padding: 4px 6px;
  border-radius: 50%;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conversion-spinner {
  display: flex;
  align-items: center;
  gap: 4px;
}

.conversion-text {
  font-size: 0.7rem;
  font-weight: 500;
}

@keyframes checkmarkShow {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }

  20% {
    opacity: 1;
    transform: scale(1.1);
  }

  40% {
    opacity: 1;
    transform: scale(1);
  }

  90% {
    opacity: 1;
    transform: scale(1);
  }

  100% {
    opacity: 0;
    transform: scale(1);
  }
}

.photo-info {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.photo-timestamp,
.photo-gps {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #666;
}

.photo-timestamp i,
.photo-gps i {
  width: 12px;
  font-size: 0.75rem;
  color: #888;
}

.photo-name {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
  word-break: break-word;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.dialog {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  min-width: 400px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.upload-dialog {
  min-width: 500px;
}

.upload-type-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.btn-upload-type {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  color: #666;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-upload-type:hover {
  border-color: #2196f3;
  color: #2196f3;
}

.btn-upload-type.active {
  border-color: #2196f3;
  background: #2196f3;
  color: #fff;
}

.btn-upload-type i {
  font-size: 1rem;
}

.mobile-warning {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #856404;
}

.mobile-warning i {
  color: #f39c12;
  font-size: 1rem;
}

.dialog h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
}

.upload-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 1.5rem;
}

.upload-zone:hover,
.upload-zone.dragging {
  border-color: #2196f3;
  background: #f3f9ff;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upload-icon {
  font-size: 3rem;
  color: #ccc;
}

.upload-text {
  font-size: 1.1rem;
  font-weight: 500;
  margin: 0;
  color: #333;
}

.upload-hint {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
}

.upload-progress {
  margin-bottom: 1.5rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #2196f3;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.9rem;
  color: #666;
  text-align: center;
  margin: 0;
}

.selected-files {
  margin-bottom: 1.5rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #2196f3;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.9rem;
  color: #666;
  text-align: center;
  margin: 0;
}

.selected-files {
  margin-bottom: 1.5rem;
}

.selected-files h4 {
  margin: 0 0 1rem 0;
  color: #333;
}

.file-list {
  max-height: 200px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  font-size: 0.9rem;
  word-break: break-word;
}

.file-size {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.25rem;
}

.btn-remove {
  background: #f44336;
  color: white;
  border: none;
  padding: 0.25rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.7rem;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-remove:hover {
  background: #d32f2f;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.warning {
  color: #ff9800;
  font-size: 0.9rem;
  margin: 1rem 0;
}

.processing-info {
  background: #e8f5e8;
  border: 1px solid #b8e6b8;
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #2d6a2d;
}

.processing-info i {
  color: #28a745;
  font-size: 1rem;
}

@media (max-width: 768px) {
  .album-detail {
    padding: 1rem;
  }

  .album-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .album-info {
    text-align: center;
  }

  .photos-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }

  .dialog {
    min-width: auto;
    margin: 1rem;
  }

  .upload-dialog {
    min-width: auto;
  }

  .dialog-actions {
    flex-direction: column;
  }
}

/* Lightbox Styles */
.lightbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  cursor: pointer;
}

.lightbox-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}

.lightbox-content {
  display: flex;
  flex-direction: column;
  max-width: 95vw;
  max-height: 95vh;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.lightbox-image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
  height: calc(100% - 80px);
  /* Reserve space for info bar */
  min-height: 0;
  /* Allow shrinking */
}

.lightbox-image {
  max-width: 100%;
  max-height: calc(100vh - 120px);
  /* Account for info bar at bottom */
  width: auto;
  height: auto;
  object-fit: contain;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  display: block;
  margin: 0 auto;
}

.lightbox-loading,
.lightbox-heic-loading,
.lightbox-heic-error,
.lightbox-heic-converting {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
}

.lightbox-loading i,
.lightbox-heic-loading i,
.lightbox-heic-converting i {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.lightbox-heic-converting {
  background: rgba(33, 150, 243, 0.1);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.conversion-progress {
  width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 1rem;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #2196f3, #21cbf3);
  border-radius: 2px;
  animation: progressIndeterminate 2s infinite linear;
}

@keyframes progressIndeterminate {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(200px);
  }
}

.lightbox-heic-error {
  color: #ffcdd2;
}

.lightbox-heic-error i {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: #f44336;
}

.btn-download-lightbox {
  background: #2196f3;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 1rem;
  transition: background 0.2s ease;
}

.btn-download-lightbox:hover {
  background: #1976d2;
}

.lightbox-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  z-index: 100;
}

.lightbox-nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-50%) scale(1.1);
}

.lightbox-nav:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.lightbox-prev {
  left: 2rem;
}

.lightbox-next {
  right: 2rem;
}

.lightbox-close {
  position: absolute;
  top: 2rem;
  right: 2rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  z-index: 100;
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.lightbox-info {
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  color: white;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 8px;
  margin-top: auto;
  flex-shrink: 0;
  width: 100%;
  max-width: 800px;
}

.lightbox-photo-details h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.lightbox-photo-meta {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.8;
}

.lightbox-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-lightbox-action {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.btn-lightbox-action:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.btn-danger-action:hover {
  background: rgba(244, 67, 54, 0.8);
}

/* Mobile responsiveness for lightbox */
@media (max-width: 768px) {
  .lightbox-nav {
    width: 50px;
    height: 50px;
    font-size: 1.2rem;
  }

  .lightbox-prev {
    left: 1rem;
  }

  .lightbox-next {
    right: 1rem;
  }

  .lightbox-close {
    top: 1rem;
    right: 1rem;
    width: 40px;
    height: 40px;
    font-size: 1rem;
  }

  .lightbox-info {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
    padding: 1rem;
  }

  .lightbox-content {
    max-width: 98vw;
    max-height: 98vh;
  }

  .lightbox-image {
    max-height: calc(100vh - 140px);
    /* More space for mobile info bar */
  }

  .lightbox-image-container {
    height: calc(100% - 100px);
    /* Adjust for mobile info bar */
  }
}

/* Preload Status Styles */
.preload-status {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.preload-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.preload-header i {
  color: #2196f3;
  font-size: 1rem;
}

.preload-percentage {
  margin-left: auto;
  font-weight: 600;
  color: #2196f3;
}

.preload-progress-bar {
  width: 100%;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.preload-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2196f3, #21cbf3);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.preload-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preload-status-text {
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preload-status-text i {
  color: #2196f3;
}

.preload-current-file {
  color: #333;
  font-weight: 500;
  background: #e3f2fd;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border-left: 3px solid #2196f3;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
}

.preload-complete-text {
  color: #4caf50;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.preload-complete-text i {
  color: #4caf50;
}

.preload-ready-list {
  margin-top: 0.75rem;
  border-top: 1px solid #e9ecef;
  padding-top: 0.75rem;
}

.ready-list-header {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.ready-list-header i {
  color: #4caf50;
  font-size: 0.9rem;
}

.ready-images-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-height: 120px;
  overflow-y: auto;
}

.ready-image-item {
  background: #e8f5e8;
  color: #2e7d32;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  border: 1px solid #a5d6a7;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.ready-image-item i {
  color: #4caf50;
  font-size: 0.7rem;
}

@media (max-width: 768px) {
  .preload-status {
    padding: 0.75rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
  }

  .preload-header {
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .preload-current-file {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
  }

  .ready-list-header {
    font-size: 0.85rem;
    margin-bottom: 0.4rem;
  }

  .ready-images-grid {
    gap: 0.4rem;
    max-height: 100px;
  }

  .ready-image-item {
    padding: 0.2rem 0.4rem;
    font-size: 0.75rem;
  }
}
</style>
