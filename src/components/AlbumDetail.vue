<template>
  <div class="album-detail">
    <!-- Header -->
    <div class="album-header">
      <button class="btn-back" @click="$emit('back')">
        <i class="fas fa-arrow-left"></i> Back to Albums
      </button>
      <div class="album-info">
        <h1><i class="fas fa-folder-open"></i> {{ albumName }}</h1>
        <p class="subtitle">{{ visiblePhotos.length }} photos</p>
      </div>
      <div class="header-actions">
        <button 
          class="btn-secondary btn-refresh" 
          @click="refreshAlbum"
          :disabled="loading"
          title="Refresh album"
        >
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
        </button>
        <button 
          v-if="canUploadPhotos"
          class="btn-primary" 
          @click="showUploadDialog = true"
        >
          <i class="fas fa-plus"></i> Add Photos
        </button>
      </div>
    </div>

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
        <button 
          v-if="canUploadPhotos"
          class="btn-primary" 
          @click="showUploadDialog = true"
        >
          <i class="fas fa-plus"></i> Add Photos
        </button>
      </div>

      <!-- Photos Grid -->
      <div v-else class="photos-grid">
        <div 
          v-for="photo in paginatedVisiblePhotos" 
          :key="photo.name"
          class="photo-card"
          @click="openPhoto(photo)"
        >
          <div class="photo-thumbnail">
            <!-- All images in grid are now pre-processed (thumbnails for HEIC, originals for others) -->
            <img 
              :src="getOptimizedPhotoUrl(photo)" 
              :alt="photo.name" 
              @error="handleImageError"
              @load="handleImageLoad"
              @loadstart="handleImageLoadStart"
              class="photo-image"
              loading="lazy"
              :data-full-src="getPhotoUrl(photo)"
            >
            
            <!-- Status indicators removed - backend handles conversion -->
            
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

    <!-- Preloading Progress Indicator -->
    <div v-if="!loading && !error && visiblePhotos.length > 0" class="preload-status">
      <div class="preload-header">
        <i class="fas fa-download"></i>
        <span>Lightbox Ready: {{ preloadStats.preloaded }}/{{ preloadStats.thumbnails }}</span>
        <div class="preload-percentage">{{ preloadStats.percentage }}%</div>
      </div>
      <div class="preload-progress-bar">
        <div 
          class="preload-progress-fill" 
          :style="{ width: preloadStats.percentage + '%' }"
        ></div>
      </div>
      <div class="preload-details">
        <!-- Currently Fetching Display -->
        <span v-if="preloadStats.currentlyFetchingFullSize" class="preload-current-file">
          <i class="fas fa-download fa-pulse"></i>
          Fetching full-size AVIF: {{ getPhotoDisplayName(preloadStats.currentlyFetchingFullSize) }}
        </span>
        <span v-else-if="preloadStats.percentage < 100" class="preload-status-text">
          <i class="fas fa-sync fa-spin"></i> Background preloading full-size images for instant lightbox...
        </span>
        <span v-else-if="preloadStats.percentage >= 100" class="preload-complete-text">
          <i class="fas fa-check-circle"></i> All images ready! Lightbox will be instant.
        </span>
        
        <!-- Ready Images List -->
        <div v-if="preloadStats.readyImages.length > 0" class="preload-ready-list">
          <div class="ready-list-header">
            <i class="fas fa-check-circle"></i>
            <span>Full-size images ready for instant lightbox ({{ preloadStats.readyImages.length }}):</span>
          </div>
          <div class="ready-images-grid">
            <span 
              v-for="readyImage in preloadStats.readyImages" 
              :key="readyImage"
              class="ready-image-item"
              :title="readyImage"
            >
              {{ getPhotoDisplayName(readyImage) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Dialog -->
    <div v-if="showUploadDialog" class="dialog-overlay" @click="closeUploadDialog">
      <div class="dialog upload-dialog" @click.stop>
        <h3><i class="fas fa-cloud-upload-alt"></i> Upload Media</h3>
        
        <!-- Upload Type Selector -->
        <div class="upload-type-selector">
          <button 
            class="btn-upload-type" 
            :class="{ active: uploadType === 'photos' }"
            @click="setUploadType('photos')"
          >
            <i class="fas fa-image"></i>
            Photos
          </button>
          <button 
            class="btn-upload-type" 
            :class="{ active: uploadType === 'videos' }"
            @click="setUploadType('videos')"
          >
            <i class="fas fa-video"></i>
            Videos
          </button>
        </div>
        
        <!-- Processing Info -->
        <div class="processing-info">
          <i class="fas fa-info-circle"></i>
          <span>Images are processed in the background after upload. Use the refresh button to check progress.</span>
        </div>
        
        <!-- Mobile Warning -->
        <div v-if="isMobileDevice" class="mobile-warning">
          <i class="fas fa-mobile-alt"></i>
          <span>Keep this app open during upload for progress updates</span>
        </div>
        
        <!-- File Drop Zone -->
        <div 
          class="upload-zone"
          :class="{ 'dragging': isDragging }"
          @drop="handleDrop"
          @dragover.prevent
          @dragenter="isDragging = true"
          @dragleave="isDragging = false"
          @click="triggerFileInput"
        >
          <input
            ref="fileInput"
            type="file"
            :accept="uploadType === 'photos' ? 'image/*' : 'video/*'"
            multiple
            @change="handleFileSelect"
            style="display: none;"
          />
          <div class="upload-content">
            <i :class="uploadType === 'photos' ? 'fas fa-cloud-upload-alt' : 'fas fa-video'" class="upload-icon"></i>
            <p class="upload-text">
              {{ uploadType === 'photos' ? 'Drag and drop photos here or click to select' : 'Drag and drop videos here or click to select' }}
            </p>
            <p class="upload-hint">
              {{ uploadType === 'photos' ? 'Supports JPG, PNG, GIF, HEIC files (optimized for fast display)' : 'Supports MOV, MP4 and other video formats (up to 2GB each)' }}
            </p>
          </div>
        </div>

        <!-- Upload Progress -->
        <div v-if="uploading" class="upload-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${uploadProgress}%` }"></div>
          </div>
          <p class="progress-text">{{ uploadStatus }}</p>
        </div>

        <!-- Selected Files -->
        <div v-if="selectedFiles.length > 0" class="selected-files">
          <h4>Selected Files ({{ selectedFiles.length }})</h4>
          <div class="file-list">
            <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
              <div class="file-info">
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
              </div>
              
              <!-- Individual file progress -->
              <div v-if="uploading" class="file-progress">
                <div v-if="fileUploadProgress[file.name] === -1" class="file-status error">
                  <i class="fas fa-exclamation-triangle"></i>
                  <span>Failed</span>
                </div>
                <div v-else-if="uploadedFiles.has(file.name)" class="file-status success">
                  <i class="fas fa-check"></i>
                  <span>Complete</span>
                </div>
                <div v-else-if="fileUploadProgress[file.name] > 0" class="file-status uploading">
                  <div class="mini-progress-bar">
                    <div class="mini-progress-fill" :style="{ width: `${fileUploadProgress[file.name]}%` }"></div>
                  </div>
                  <span>{{ Math.round(fileUploadProgress[file.name]) }}%</span>
                </div>
                <div v-else class="file-status waiting">
                  <i class="fas fa-clock"></i>
                  <span>Waiting</span>
                </div>
              </div>
              
              <button v-if="!uploading" @click="removeFile(index)" class="btn-remove">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <button class="btn-secondary" @click="closeUploadDialog">
            {{ uploadProgress === 100 && !uploading ? 'Done' : 'Cancel' }}
          </button>
          <!-- Mobile manual refresh button -->
          <button 
            v-if="isMobileDevice && uploading && uploadProgress < 100"
            class="btn-secondary btn-refresh-mobile" 
            @click="manualRefreshProgress"
            title="Refresh progress status"
          >
            <i class="fas fa-sync-alt"></i>
          </button>
          <button 
            v-if="uploadProgress < 100"
            class="btn-primary" 
            @click="uploadFiles"
            :disabled="selectedFiles.length === 0 || uploading"
          >
            {{ uploading ? 'Uploading...' : `Upload ${selectedFiles.length} ${uploadType === 'photos' ? 'Photo' : 'Video'}${selectedFiles.length !== 1 ? 's' : ''}` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Photo Confirmation -->
    <div v-if="showDeletePhotoDialog" class="dialog-overlay" @click="closeDeletePhotoDialog">
      <div class="dialog" @click.stop>
        <h3>Delete Photo</h3>
        <p>Are you sure you want to delete "<strong>{{ getPhotoDisplayName(photoToDelete?.name) }}</strong>"?</p>
        <p class="warning"><i class="fas fa-exclamation-triangle"></i> This action cannot be undone.</p>
        <div class="dialog-actions">
          <button class="btn-secondary" @click="closeDeletePhotoDialog">Cancel</button>
          <button 
            class="btn-danger" 
            @click="deletePhoto"
            :disabled="deletingPhoto"
          >
            {{ deletingPhoto ? 'Deleting...' : 'Delete Photo' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Lightbox Viewer -->
    <div v-if="showLightbox" class="lightbox-overlay" @click="closeLightbox">
      <div class="lightbox-container" @click.stop>
        <!-- Navigation Controls -->
        <button 
          class="lightbox-nav lightbox-prev" 
          @click.stop="previousPhoto"
          :disabled="currentPhotoIndex === 0"
          title="Previous Photo (←)"
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        
        <button 
          class="lightbox-nav lightbox-next" 
          @click.stop="nextPhoto"
          :disabled="currentPhotoIndex === lightboxPhotos.length - 1"
          title="Next Photo (→)"
        >
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
            <img 
              v-if="currentPhoto"
              :src="getPhotoUrl(currentPhoto)" 
              :alt="currentPhoto.name"
              class="lightbox-image"
              @error="handleLightboxImageError"
              @load="handleLightboxImageLoad"
            >
            
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
              <button 
                @click="downloadPhoto(currentPhoto)" 
                class="btn-lightbox-action"
                title="Download Photo"
              >
                <i class="fas fa-download"></i>
              </button>
              <button 
                v-if="canDeletePhoto"
                @click="confirmDeletePhoto(currentPhoto)" 
                class="btn-lightbox-action btn-danger-action"
                title="Delete Photo"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import apiService from '../services/api.js'
import authService from '../services/auth.js'

// Props
const props = defineProps({
  albumName: {
    type: String,
    required: true
  }
})

// Emits
const emit = defineEmits(['back', 'photoOpened'])

// Reactive state
const loading = ref(false)
const error = ref(null)
const photos = ref([])
const albumMetadata = ref(null)
const photoMetadataLookup = ref({})
// Removed HEIC conversion variables - backend handles all conversions
const showUploadDialog = ref(false)
const showDeletePhotoDialog = ref(false)
const uploadType = ref('photos') // 'photos' or 'videos'
const selectedFiles = ref([])
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const currentJobId = ref(null) // Track current upload job ID for manual refresh
const fileUploadProgress = ref({}) // Track individual file progress
const uploadedFiles = ref(new Set()) // Track completed uploads
const failedFiles = ref(new Set()) // Track failed uploads
const isDragging = ref(false)
const photoToDelete = ref(null)
const deletingPhoto = ref(false)
const fileInput = ref(null)

// Lightbox state
const showLightbox = ref(false)
const currentPhotoIndex = ref(0)
const lightboxLoading = ref(false)
const currentImageInfo = ref('')

// Progressive loading stats
const preloadStats = ref({
  thumbnails: 0,
  preloaded: 0,
  percentage: 0,
  currentlyFetchingFullSize: null, // Track full-size filename currently being fetched
  readyImages: [] // List of full-size filenames ready for instant lightbox
})

// Progress tracker interval reference for cleanup
const progressTracker = ref(null)

// Computed properties
const currentPhoto = computed(() => {
  const photo = lightboxPhotos.value[currentPhotoIndex.value] || null
  
  // Log current file showing in lightbox for debugging
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

// Mobile device detection
const isMobileDevice = computed(() => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
})

const canDeletePhoto = computed(() => {
  return authService.canPerformAction('delete_photo')
})

// Constants
const BUCKET_NAME = 'photovault'
const ITEMS_PER_PAGE = 50

// Methods
const loadPhotos = async () => {
  console.log('🔄 Loading album:', props.albumName)
  loading.value = true
  error.value = null
  
  // Clear previous data
  cleanupBlobUrls()
  
  try {
    // Clean the album name and ensure we have exactly one trailing slash
    let cleanAlbumName = props.albumName.trim()
    // Remove any trailing slashes first
    cleanAlbumName = cleanAlbumName.replace(/\/+$/, '')
    // Add exactly one trailing slash
    const prefix = cleanAlbumName + '/'
    
    console.log('📡 API request for prefix:', prefix)
    const response = await apiService.getBucketContents(BUCKET_NAME, prefix)
    
    console.log('📥 API response:', response)
    
    if (response.success && response.data) {
      
      // Load ALL files returned by backend (no filtering)
      const allFiles = (response.data.objects || []).filter(obj => {
        // Only exclude folders (names ending with '/')
        return obj.name && !obj.name.endsWith('/');
      })
      
      console.log('📁 Files found:', allFiles.length, allFiles.map(f => f.name))
      
      photos.value = allFiles
      
      // Load album metadata
      await loadAlbumMetadata(cleanAlbumName)
      
      // Reset pagination
      resetVirtualScrolling()
      
      console.log('✅ Album loaded successfully')
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

// Refresh album data
const refreshAlbum = async () => {
  console.log('🔄 Refreshing album:', props.albumName)
  await loadPhotos()
}

// Manual refresh for mobile progress tracking
const manualRefreshProgress = async () => {
  console.log('📱 Manual progress refresh requested')
  if (!currentJobId.value) {
    console.warn('📱 No active job ID for manual refresh')
    return
  }
  
  try {
    console.log(`📱 Manually checking job status: ${currentJobId.value}`)
    const result = await apiService.getJobStatus(currentJobId.value)
    
    if (result.success) {
      const job = result.data
      console.log(`📱 Manual refresh - Job status: ${job.status}, Progress: ${job.progress?.processed}/${job.progress?.total}`)
      
      // Update progress manually
      const processed = job.progress?.processed || 0
      const total = job.progress?.total || selectedFiles.value.length
      const progressPercentage = Math.round((processed / total) * 100)
      
      uploadProgress.value = progressPercentage
      
      // Update status message
      switch (job.status) {
        case 'completed':
          uploadProgress.value = 100
          uploadStatus.value = 'All files processed successfully!'
          uploading.value = false
          await loadPhotos()
          break
        case 'failed':
          uploadStatus.value = `Upload failed: ${job.error || 'Unknown error'}`
          uploading.value = false
          break
        default:
          uploadStatus.value = `Processing... ${progressPercentage}% (${processed}/${total})`
      }
    } else {
      console.error('📱 Manual refresh failed:', result.error)
      uploadStatus.value = `Status check failed: ${result.error}`
    }
  } catch (error) {
    console.error('📱 Manual refresh error:', error)
    uploadStatus.value = `Status check error: ${error.message}`
  }
}

// Load album metadata JSON file
const loadAlbumMetadata = async (albumName) => {
  try {
    const metadataFileName = `${albumName}/${albumName}.json`
    const metadataUrl = apiService.getObjectUrl(BUCKET_NAME, metadataFileName)
    
    console.log('📄 Loading metadata from:', metadataUrl)
    const response = await fetch(metadataUrl)
    if (response.ok) {
      const metadata = await response.json()
      albumMetadata.value = metadata
      
      // Create lookup table for quick access - use the correct structure
      const lookup = {}
      if (metadata.images && Array.isArray(metadata.images)) {
        metadata.images.forEach(imageMeta => {
          if (imageMeta.sourceImage) {
            // Extract just the filename from the full path
            const filename = imageMeta.sourceImage.split('/').pop()
            lookup[filename] = imageMeta
            // Also store with full path for exact matches
            lookup[imageMeta.sourceImage] = imageMeta
          }
        })
      }
      photoMetadataLookup.value = lookup
      console.log('📄 Metadata loaded successfully for', Object.keys(lookup).length, 'images')
      console.log('📄 Available metadata keys:', Object.keys(lookup))
    } else {
      console.warn('📄 Metadata file not found:', metadataFileName)
    }
  } catch (err) {
    console.warn('📄 Could not load album metadata:', err.message)
  }
}

// Format timestamp for display
const formatPhotoTimestamp = (photo) => {
  // Try to get metadata for the current photo name or its original version
  const filename = photo.name.split('/').pop() // Get just the filename
  let metadata = photoMetadataLookup.value[filename] || photoMetadataLookup.value[photo.name]
  
  // If not found and this is an AVIF variant, try to find the original
  if (!metadata && photo.name.includes('.avif')) {
    // Try to match with original filename patterns
    const possibleOriginals = Object.keys(photoMetadataLookup.value).filter(key => {
      // Extract base name without extension and compare
      const baseName = filename.replace(/(_thumb)?\.avif$/i, '')
      const originalBase = key.replace(/\.[^.]+$/, '')
      return baseName.includes(originalBase) || originalBase.includes(baseName)
    })
    
    if (possibleOriginals.length > 0) {
      metadata = photoMetadataLookup.value[possibleOriginals[0]]
    }
  }
  
  console.log('🕒 Timestamp lookup for', filename, ':', metadata?.exif?.dateTaken)
  
  if (!metadata || !metadata.exif || !metadata.exif.dateTaken) {
    return 'No date'
  }
  
  try {
    const date = new Date(metadata.exif.dateTaken)
    return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
  } catch {
    return 'Invalid date'
  }
}

// Format GPS coordinates for display
const formatPhotoGPS = (photo) => {
  // Try to get metadata for the current photo name or its original version
  const filename = photo.name.split('/').pop() // Get just the filename
  let metadata = photoMetadataLookup.value[filename] || photoMetadataLookup.value[photo.name]
  
  // If not found and this is an AVIF variant, try to find the original
  if (!metadata && photo.name.includes('.avif')) {
    // Try to match with original filename patterns
    const possibleOriginals = Object.keys(photoMetadataLookup.value).filter(key => {
      // Extract base name without extension and compare
      const baseName = filename.replace(/(_thumb)?\.avif$/i, '')
      const originalBase = key.replace(/\.[^.]+$/, '')
      return baseName.includes(originalBase) || originalBase.includes(baseName)
    })
    
    if (possibleOriginals.length > 0) {
      metadata = photoMetadataLookup.value[possibleOriginals[0]]
    }
  }
  
  console.log('📍 GPS lookup for', filename, ':', metadata?.exif?.gpsCoordinates)
  
  if (!metadata || !metadata.exif || !metadata.exif.gpsCoordinates) {
    return 'No location'
  }
  
  try {
    // Parse GPS coordinates from string format "lat,lng"
    const coords = metadata.exif.gpsCoordinates.split(',')
    if (coords.length === 2) {
      const lat = parseFloat(coords[0]).toFixed(4)
      const lng = parseFloat(coords[1]).toFixed(4)
      return `${lat}, ${lng}`
    }
  } catch (err) {
    console.warn('Error parsing GPS coordinates:', err)
  }
  
  return 'Invalid location'
}

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
  // If this is a thumbnail file, get the corresponding full-size file for lightbox
  if (/_thumb\.avif$/i.test(photo.name)) {
    const fullSizeFilename = photo.name.replace(/_thumb\.avif$/i, '.avif')
    const url = apiService.getObjectUrl(BUCKET_NAME, fullSizeFilename)
    
    return url
  }
  
  // If this is already a full-size file, use it directly
  const url = apiService.getObjectUrl(BUCKET_NAME, photo.name)
  
  return url
}

const getOptimizedPhotoUrl = (photo) => {
  // Since visiblePhotos now contains only thumbnail files, use them directly
  const url = apiService.getObjectUrl(BUCKET_NAME, photo.name)
  return url
}

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
    // Step 1: Thumbnail is already loading via img src attribute (fast ~50KB)
    const optimizedSrc = getOptimizedPhotoUrl(photo)
    
    // Step 2: Start preloading full resolution in background for instant lightbox (slow ~4.5MB)
    const fullSrc = getPhotoUrl(photo)
    if (fullSrc !== optimizedSrc) {
      // Convert thumbnail filename to full-size filename for display
      const fullSizeFilename = photo.name.replace(/_thumb\.avif$/i, '.avif')
      
      // Set currently fetching full-size filename (not thumbnail)
      preloadStats.value.currentlyFetchingFullSize = fullSizeFilename
      
      preloadImage(fullSrc).then(() => {
        // Step 3: Mark as ready for instant lightbox display
        imgElement.dataset.fullLoaded = 'true'
        
        // Add to ready images list if not already there
        if (!preloadStats.value.readyImages.includes(fullSizeFilename)) {
          preloadStats.value.readyImages.push(fullSizeFilename)
        }
        
        // Clear currently fetching status
        preloadStats.value.currentlyFetchingFullSize = null
        
        // Update progress immediately when a preload completes
        trackProgressiveLoadingStats()
      }).catch((error) => {
        // Failed to preload full resolution, but thumbnail is still available
        console.warn(`Background preload failed for ${photo.name}:`, error.message)
        
        // Clear currently fetching status on error
        preloadStats.value.currentlyFetchingFullSize = null
      })
    } else {
      // No separate full-size version available
      imgElement.dataset.fullLoaded = 'true'
    }
    
  } catch (error) {
    // Failed to load optimized image
    console.error(`Failed to load thumbnail for ${photo.name}:`, error)
  }
}

const getPhotoDisplayName = (filename) => {
  return filename.split('/').pop() || filename
}

const handleImageError = (event) => {
  const imgElement = event.target
  const originalSrc = imgElement.src
  const photoName = imgElement.alt || 'unknown'
  
  console.error('❌ Image failed to load:', photoName, 'from', originalSrc)
  
  // Set fallback image
  event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
}

const handleImageLoadStart = (event) => {
  const imgElement = event.target
  const photoName = imgElement.alt || 'unknown'
  
  console.log('🔄 Started loading image:', photoName)
}

const handleImageLoad = (event) => {
  const imgElement = event.target
  const photoName = imgElement.alt || 'unknown'
  
  console.log('✅ Image loaded successfully:', photoName)
}

const handleHeicImageError = async (event, photo) => {
  // Since backend converts everything to AVIF, show fallback image
  event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIHVuYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg=='
}

const openPhoto = async (photo) => {
  // photo.name could be a thumbnail file (e.g., "IMG_8848_thumb.avif") or regular file
  // We need to find the corresponding photo in lightbox
  
  let targetPhotoIndex = -1
  
  if (/_thumb\.avif$/i.test(photo.name)) {
    // Convert thumbnail name to full-size name
    const fullSizeFilename = photo.name.replace(/_thumb\.avif$/i, '.avif')
    targetPhotoIndex = lightboxPhotos.value.findIndex(p => p.name === fullSizeFilename)
  } else {
    // If it's already a full-size file, search directly
    targetPhotoIndex = lightboxPhotos.value.findIndex(p => p.name === photo.name)
  }
  
  if (targetPhotoIndex === -1) {
    console.error(`Could not find corresponding full-size photo for: ${photo.name}`)
    return
  }
  
  // Check if full-size image was already preloaded in background
  const gridImage = document.querySelector(`img[alt="${photo.name}"][data-full-loaded="true"]`)
  const isPreloaded = gridImage && gridImage.dataset.fullLoaded === 'true'
  
  // Open the lightbox directly with AVIF file
  currentPhotoIndex.value = targetPhotoIndex
  showLightbox.value = true
  
  // If image wasn't preloaded, show loading state briefly
  if (!isPreloaded) {
    lightboxLoading.value = true
  }
  
  // Add keyboard event listener
  document.addEventListener('keydown', handleLightboxKeyboard)
}

const closeLightbox = () => {
  showLightbox.value = false
  lightboxLoading.value = false
  
  // Remove keyboard event listener
  document.removeEventListener('keydown', handleLightboxKeyboard)
}

const nextPhoto = () => {
  if (currentPhotoIndex.value < lightboxPhotos.value.length - 1) {
    // Check if next image was preloaded
    const nextPhoto = lightboxPhotos.value[currentPhotoIndex.value + 1]
    const nextGridImage = document.querySelector(`img[alt="${nextPhoto.name}"][data-full-loaded="true"]`)
    const isNextPreloaded = nextGridImage && nextGridImage.dataset.fullLoaded === 'true'
    
    // Show loading state if next image wasn't preloaded
    if (!isNextPreloaded) {
      lightboxLoading.value = true
    }
    
    currentPhotoIndex.value++
  }
}

const previousPhoto = () => {
  if (currentPhotoIndex.value > 0) {
    // Check if previous image was preloaded
    const prevPhoto = lightboxPhotos.value[currentPhotoIndex.value - 1]
    const prevGridImage = document.querySelector(`img[alt="${prevPhoto.name}"][data-full-loaded="true"]`)
    const isPrevPreloaded = prevGridImage && prevGridImage.dataset.fullLoaded === 'true'
    
    // Show loading state if previous image wasn't preloaded
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
  // Since backend handles all conversions to AVIF, show generic error
  event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIGNhbm5vdCBiZSBsb2FkZWQ8L3RleHQ+PC9zdmc+'
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event) => {
  const files = Array.from(event.target.files)
  addFiles(files)
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragging.value = false
  const files = Array.from(event.dataTransfer.files)
  addFiles(files)
}

const addFiles = (files) => {
  let validFiles
  let fileTypeDescription
  
  if (uploadType.value === 'photos') {
    validFiles = files.filter(file => file.type.startsWith('image/'))
    fileTypeDescription = 'image files'
  } else {
    validFiles = files.filter(file => file.type.startsWith('video/'))
    fileTypeDescription = 'video files'
  }
  
  selectedFiles.value.push(...validFiles)
  
  if (validFiles.length !== files.length) {
    alert(`${files.length - validFiles.length} files were skipped (only ${fileTypeDescription} are allowed)`)
  }
}

const setUploadType = (type) => {
  uploadType.value = type
  selectedFiles.value = [] // Clear selected files when switching type
}

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1)
}

const uploadFiles = async () => {
  if (selectedFiles.value.length === 0) return
  
  // Check permission before proceeding
  const actionType = uploadType.value === 'photos' ? 'upload_photos' : 'upload_photos' // For now using same permission
  if (!authService.canPerformAction(actionType)) {
    error.value = `You do not have permission to upload ${uploadType.value}`
    return
  }
  
  uploading.value = true
  uploadProgress.value = 0
  error.value = null
  
  // Initialize progress tracking for each file
  fileUploadProgress.value = {}
  uploadedFiles.value = new Set()
  failedFiles.value = new Set()
  
  selectedFiles.value.forEach(file => {
    fileUploadProgress.value[file.name] = 0
  })
  
  try {
    uploadStatus.value = `Starting upload of ${selectedFiles.value.length} files...`
    
    // Detect mobile device for specific handling
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    console.log('📱 Mobile device detected:', isMobile)
    
    // Mobile-specific: Add visibility change listener to warn about backgrounding
    let visibilityChangeHandler = null
    if (isMobile) {
      visibilityChangeHandler = () => {
        if (document.hidden && uploading.value) {
          console.warn('📱 App backgrounded during upload - may affect progress updates')
        }
      }
      document.addEventListener('visibilitychange', visibilityChangeHandler)
    }
    
    // Use the async upload system that returns a job ID
    const response = await apiService.uploadFile(
      BUCKET_NAME, 
      selectedFiles.value, 
      props.albumName
    )
    
    if (!response.success) {
      throw new Error(response.error || 'Upload failed')
    }
    
    // Check if we got a job ID (async processing)
    if (response.data.jobId) {
      const jobId = response.data.jobId
      uploadStatus.value = isMobile ? 'Upload queued... (Keep app open)' : 'Upload queued for processing...'
      
      // Mobile-specific: Show warning about keeping app open
      if (isMobile) {
        console.log('📱 Mobile upload started - advising user to keep app open')
      }
      
      // Poll job status until completion with conversion progress tracking
      await apiService.pollJobUntilComplete(
        jobId,
        (job) => {
          // Update progress based on job status
          const processed = job.progress?.processed || 0
          const total = job.progress?.total || selectedFiles.value.length
          const progressPercentage = Math.round((processed / total) * 100)
          
          uploadProgress.value = progressPercentage
          
          // Update individual file progress
          if (job.results && Array.isArray(job.results)) {
            job.results.forEach(result => {
              if (result.originalName) {
                uploadedFiles.value.add(result.originalName)
                fileUploadProgress.value[result.originalName] = 100
              }
            })
          }
          
          // Update failed files
          if (job.errors && Array.isArray(job.errors)) {
            job.errors.forEach(error => {
              if (error.filename) {
                failedFiles.value.add(error.filename)
                fileUploadProgress.value[error.filename] = -1
              }
            })
          }
          
          switch (job.status) {
            case 'queued':
              uploadStatus.value = isMobile ? 'Queued... (Keep app open)' : 'Upload queued for processing...'
              break
            case 'processing':
              uploadStatus.value = isMobile 
                ? `Converting... ${processed}/${total} (Keep app open)`
                : `Converting images... ${processed}/${total} files processed`
              // Update progress for currently processing files
              selectedFiles.value.forEach(file => {
                if (!uploadedFiles.value.has(file.name) && !failedFiles.value.has(file.name)) {
                  fileUploadProgress.value[file.name] = processed < total ? 50 : 100
                }
              })
              break
            default:
              uploadStatus.value = `Processing... ${progressPercentage}%`
          }
        }
      )
      
      // Clean up visibility listener
      if (visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', visibilityChangeHandler)
      }
      
      uploadProgress.value = 100
      uploadStatus.value = 'All files processed successfully!'
      
      // Don't auto-close dialog - let user see completion status
      await loadPhotos() // Refresh the photo list
      
    } else {
      // Immediate response (new async system) - files are being processed in background
      if (response.data.status === 'processing') {
        // Mark all files as being processed
        selectedFiles.value.forEach(file => {
          fileUploadProgress.value[file.name] = 50 // Show as "in progress"
        })
        
        uploadProgress.value = 100
        uploadStatus.value = `${response.data.filesReceived} files received and are being converted in the background. Use the refresh button to check progress.`
        
        // Show a more informative message
        console.log('📤 Files sent for background processing:', response.data.filesReceived)
        
        // Auto-refresh after a short delay to show immediate feedback
        setTimeout(async () => {
          await loadPhotos()
        }, 2000)
        
      } else {
        // Legacy synchronous upload (fallback) - handle as before
        const uploaded = response.data.uploaded || []
        const errors = response.errors || []
        
        uploaded.forEach(file => {
          uploadedFiles.value.add(file.originalName)
          fileUploadProgress.value[file.originalName] = 100
        })
        
        if (errors.length > 0) {
          errors.forEach(error => {
            failedFiles.value.add(error.filename)
            fileUploadProgress.value[error.filename] = -1
          })
        }
        
        uploadProgress.value = 100
        
        if (errors.length > 0) {
          uploadStatus.value = `${uploaded.length} files uploaded, ${errors.length} failed`
        } else {
          uploadStatus.value = 'All files uploaded successfully!'
        }
      }
    }
    
  } catch (err) {
    error.value = `Upload failed: ${err.message}`
    console.error('Upload failed:', err)
  } finally {
    uploading.value = false
    
    // Clean up any event listeners (mobile-specific)
    if (typeof visibilityChangeHandler !== 'undefined' && visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', visibilityChangeHandler)
    }
  }
}

const confirmDeletePhoto = (photo) => {
  // Check permission before showing dialog
  if (!authService.canPerformAction('delete_photo')) {
    error.value = 'You do not have permission to delete photos'
    return
  }
  
  photoToDelete.value = photo
  showDeletePhotoDialog.value = true
}

const deletePhoto = async () => {
  if (!photoToDelete.value) return
  
  // Debug alert to confirm function is called
  alert(`About to delete: ${photoToDelete.value.name}`)
  
  deletingPhoto.value = true
  error.value = null
  
  try {
    console.log('🗑️ Deleting photo:', photoToDelete.value.name, 'from bucket:', BUCKET_NAME)
    const response = await apiService.deleteObject(BUCKET_NAME, photoToDelete.value.name)
    console.log('🗑️ Delete response:', response)
    
    if (response.success) {
      // Close lightbox if the deleted photo was being viewed
      if (showLightbox.value && currentPhoto.value && currentPhoto.value.name === photoToDelete.value.name) {
        closeLightbox()
      }
      
      await loadPhotos() // Refresh the list
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

const closeUploadDialog = () => {
  showUploadDialog.value = false
  selectedFiles.value = []
  uploading.value = false
  uploadProgress.value = 0
  uploadStatus.value = ''
  isDragging.value = false
  fileUploadProgress.value = {}
  uploadedFiles.value = new Set()
  failedFiles.value = new Set()
}

const closeDeletePhotoDialog = () => {
  showDeletePhotoDialog.value = false
  photoToDelete.value = null
  deletingPhoto.value = false
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Cleanup function for blob URLs (now mostly unused since backend handles conversions)
const cleanupBlobUrls = () => {
  // Function kept for compatibility but mostly unused now
}

// Performance monitoring with 3-step progressive loading tracking
const trackImageLoadTime = (photoName, startTime) => {
  const loadTime = Date.now() - startTime
  
  // Track slow loading images (>2 seconds) - could be used for analytics
  if (loadTime > 2000) {
    console.warn('Slow image load detected:', { photoName, loadTime })
  }
}

// Track progressive loading statistics
const trackProgressiveLoadingStats = () => {
  const allImages = document.querySelectorAll('.photo-image')
  const preloadedImages = document.querySelectorAll('.photo-image[data-full-loaded="true"]')
  const thumbnailImages = allImages.length
  const preloadedCount = preloadedImages.length
  const preloadPercentage = thumbnailImages > 0 ? Math.round((preloadedCount / thumbnailImages) * 100) : 0
  
  // Update reactive stats for UI display - preserve existing tracking properties
  preloadStats.value = {
    thumbnails: thumbnailImages,
    preloaded: preloadedCount,
    percentage: preloadPercentage,
    currentlyFetchingFullSize: preloadStats.value.currentlyFetchingFullSize, // Preserve current file being fetched
    readyImages: preloadStats.value.readyImages // Preserve ready images list
  }
  
  return {
    thumbnails: thumbnailImages,
    preloaded: preloadedCount,
    percentage: preloadPercentage
  }
}

// Aggressive background preloading: Start immediately after thumbnails load
const startAggressivePreloading = () => {
  const imageElements = document.querySelectorAll('.photo-image')
  
  imageElements.forEach((img, index) => {
    const photoName = img.alt
    const photo = visiblePhotos.value.find(p => p.name === photoName)
    
    if (photo) {
      // Add small delay between images to avoid overwhelming the browser
      setTimeout(() => {
        loadImageProgressively(photo, img)
      }, index * 100) // 100ms delay between each image
    }
  })
}

// Batch image preloading for visible images with enhanced progressive loading
const preloadVisibleImages = () => {
  const imageElements = document.querySelectorAll('.photo-image[loading="lazy"]')
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target
        const startTime = Date.now()
        
        img.addEventListener('load', () => {
          trackImageLoadTime(img.alt, startTime)
        }, { once: true })
        
        // Enhanced: Start progressive loading for visible thumbnails
        const photoName = img.alt
        const photo = visiblePhotos.value.find(p => p.name === photoName)
        if (photo) {
          loadImageProgressively(photo, img)
        }
        
        observer.unobserve(img)
      }
    })
  }, { 
    rootMargin: '100px', // Increased margin for earlier preloading
    threshold: 0.1 // Trigger when 10% visible
  })
  
  imageElements.forEach(img => observer.observe(img))
}

// Simplified HEIC setup - no longer needed since we use server variants first
const setupHeicLazyConversion = () => {
  // This function is kept for compatibility but HEIC handling is now automatic
  // through the handleHeicImageError fallback system
}

const handleLightboxImageLoad = (event) => {
  const img = event.target
  if (img && img.naturalWidth && img.naturalHeight) {
    currentImageInfo.value = `${img.naturalWidth} × ${img.naturalHeight}`
  }
  
  // Hide loading state once image loads
  lightboxLoading.value = false
}

// Show thumbnail files and regular files (for backward compatibility)
const visiblePhotos = computed(() => {
  // Show thumbnail files preferentially, but fall back to regular files if no thumbnail exists
  const thumbnails = photos.value.filter(photo => /_thumb\.avif$/i.test(photo.name))
  
  const regularFiles = photos.value.filter(photo => {
    // Include regular images that don't have a corresponding thumbnail
    const isRegularImage = /\.(avif|jpg|jpeg|png|gif|heic)$/i.test(photo.name) && !/_thumb\.avif$/i.test(photo.name)
    if (!isRegularImage) return false
    
    // Check if there's a corresponding thumbnail
    const baseName = photo.name.replace(/\.(avif|jpg|jpeg|png|heic)$/i, '')
    const hasThumbnail = photos.value.some(p => p.name === `${baseName}_thumb.avif`)
    return !hasThumbnail // Only include if no thumbnail exists
  })

  const result = [...thumbnails, ...regularFiles]
  return result
})

// Map thumbnails to full-size files for lightbox navigation
const lightboxPhotos = computed(() => {
  // For each photo in the grid, find the corresponding full-size file
  const result = visiblePhotos.value.map(photo => {
    // If it's a thumbnail, convert to full-size filename
    if (/_thumb\.avif$/i.test(photo.name)) {
      const fullSizeFilename = photo.name.replace(/_thumb\.avif$/i, '.avif')
      
      // Find the full-size file in the photos array
      const fullSizePhoto = photos.value.find(p => p.name === fullSizeFilename)
      
      if (fullSizePhoto) {
        return fullSizePhoto
      } else {
        // Fallback to thumbnail if no full-size version found
        return photo
      }
    } else {
      // If it's already a regular file, use it as-is for lightbox
      return photo
    }
  })
  
  return result
})

// Virtual scrolling is now based on visiblePhotos computed property
const currentPage = ref(1)
const paginatedVisiblePhotos = computed(() => {
  const endIndex = currentPage.value * ITEMS_PER_PAGE
  const result = visiblePhotos.value.slice(0, endIndex)
  
  return result
})

const loadMorePhotos = () => {
  if (paginatedVisiblePhotos.value.length < visiblePhotos.value.length) {
    currentPage.value++
  }
}

const resetVirtualScrolling = () => {
  currentPage.value = 1
}

// Intersection observer for infinite scroll
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

// Lifecycle
onMounted(async () => {
  await loadPhotos()
  
  // Setup 3-step progressive loading system after images are loaded
  setTimeout(() => {
    // Start aggressive background preloading immediately
    startAggressivePreloading()
    
    // Also setup intersection observer for additional optimizations
    preloadVisibleImages()
    setupInfiniteScroll()
    setupHeicLazyConversion() // Setup HEIC lazy conversion
    
    // Track initial progressive loading statistics
    trackProgressiveLoadingStats()
    
    // Set up periodic tracking every 2 seconds to monitor progress
    progressTracker.value = setInterval(() => {
      const stats = trackProgressiveLoadingStats()
      
      // Stop tracking when we reach 100% preload percentage
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
  border: 1px solid #e0e0e0;
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
  /* Optimize for thumbnails */
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

.photo-thumbnail {
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

.photo-image:not([src=""]) + .image-loading-placeholder {
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
  0% { opacity: 0; transform: scale(0.5); }
  20% { opacity: 1; transform: scale(1.1); }
  40% { opacity: 1; transform: scale(1); }
  90% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1); }
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
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  gap: 1rem;
}

.file-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
  word-break: break-word;
}

.file-size {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.25rem;
}

.file-progress {
  display: flex;
  align-items: center;
  min-width: 120px;
  justify-content: flex-end;
}

.file-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.file-status.success {
  color: #4caf50;
}

.file-status.error {
  color: #f44336;
}

.file-status.uploading {
  color: #2196f3;
}

.file-status.waiting {
  color: #666;
}

.mini-progress-bar {
  width: 60px;
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
}

.mini-progress-fill {
  height: 100%;
  background: #2196f3;
  transition: width 0.3s ease;
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
  height: calc(100% - 80px); /* Reserve space for info bar */
  min-height: 0; /* Allow shrinking */
}

.lightbox-image {
  max-width: 100%;
  max-height: calc(100vh - 120px); /* Account for info bar at bottom */
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
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200px); }
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
    max-height: calc(100vh - 140px); /* More space for mobile info bar */
  }
  
  .lightbox-image-container {
    height: calc(100% - 100px); /* Adjust for mobile info bar */
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
