<template>
  <div class="album-detail">
    <!-- Header -->
    <div class="album-header">
      <button class="btn-back" @click="$emit('back')">
        <i class="fas fa-arrow-left"></i> Back to Albums
      </button>
      <div class="album-info">
        <h1><i class="fas fa-folder-open"></i> {{ albumName }}</h1>
        <p class="subtitle">{{ photos.length }} photos</p>
      </div>
      <button class="btn-primary" @click="showUploadDialog = true">
        <i class="fas fa-plus"></i> Add Photos
      </button>
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
      <div v-if="photos.length === 0" class="empty-state">
        <div class="empty-icon"><i class="fas fa-images"></i></div>
        <h3>No Photos Yet</h3>
        <p>Start building your album by adding some photos!</p>
        <button class="btn-primary" @click="showUploadDialog = true">
          <i class="fas fa-plus"></i> Add Photos
        </button>
      </div>

      <!-- Photos Grid -->
      <div v-else class="photos-grid">
        <div 
          v-for="photo in visiblePhotos" 
          :key="photo.name"
          class="photo-card"
          @click="openPhoto(photo)"
        >
          <div class="photo-thumbnail">
            <!-- Non-HEIC files: Display immediately with lazy loading and compression -->
            <img 
              v-if="!isHeicFile(photo.name)"
              :src="getOptimizedPhotoUrl(photo)" 
              :alt="photo.name" 
              @error="handleImageError"
              class="photo-image"
              loading="lazy"
              :data-full-src="getPhotoUrl(photo)"
            >
            
            <!-- HEIC files: Show converted image if available -->
            <img 
              v-else-if="isHeicFile(photo.name) && heicConversionStates[photo.name] === 'success' && convertedImages[photo.name]"
              :src="convertedImages[photo.name]" 
              :alt="photo.name" 
              @error="handleImageError"
              class="photo-image"
              loading="lazy"
            >
            
            <!-- HEIC files: Show loading state while converting -->
            <div v-else-if="isHeicFile(photo.name) && heicConversionStates[photo.name] === 'loading'" class="heic-loading">
              <i class="fas fa-spinner fa-spin"></i>
              <span>Converting HEIC...</span>
            </div>
            
            <!-- HEIC files: Show error state if conversion failed -->
            <div v-else-if="isHeicFile(photo.name) && heicConversionStates[photo.name] === 'error'" class="heic-error">
              <i class="fas fa-exclamation-triangle"></i>
              <span>Failed to convert HEIC</span>
              <button @click.stop="downloadPhoto(photo)" class="download-btn">
                <i class="fas fa-download"></i> Download Original
              </button>
            </div>
            
            <!-- HEIC files: Placeholder that triggers lazy conversion -->
            <div 
              v-else
              class="heic-placeholder" 
              :data-photo-name="photo.name"
              ref="heicPlaceholderRefs"
            >
              <i class="fas fa-image"></i>
              <span>HEIC Image</span>
            </div>
            
            <!-- Loading placeholder for images -->
            <div v-if="!isHeicFile(photo.name)" class="image-loading-placeholder">
              <i class="fas fa-image"></i>
            </div>
          </div>
          <div class="photo-info">
            <span class="photo-name">{{ getPhotoDisplayName(photo.name) }}</span>
            <span class="photo-size">{{ formatFileSize(photo.size) }}</span>
          </div>
        </div>

        <!-- Load More Trigger (Invisible) -->
        <div class="load-more-trigger" v-if="photos.length > visiblePhotos.length"></div>
      </div>
    </div>

    <!-- Upload Dialog -->
    <div v-if="showUploadDialog" class="dialog-overlay" @click="closeUploadDialog">
      <div class="dialog upload-dialog" @click.stop>
        <h3><i class="fas fa-cloud-upload-alt"></i> Upload Photos</h3>
        
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
            accept="image/*"
            multiple
            @change="handleFileSelect"
            style="display: none;"
          />
          <div class="upload-content">
            <i class="fas fa-cloud-upload-alt upload-icon"></i>
            <p class="upload-text">
              Drag and drop photos here or click to select
            </p>
            <p class="upload-hint">
              Supports JPG, PNG, GIF, HEIC files (HEIC images converted for web display)
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
          <button class="btn-secondary" @click="closeUploadDialog" :disabled="uploading">
            Cancel
          </button>
          <button 
            class="btn-primary" 
            @click="uploadPhotos"
            :disabled="selectedFiles.length === 0 || uploading"
          >
            {{ uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Photo${selectedFiles.length !== 1 ? 's' : ''}` }}
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
          :disabled="currentPhotoIndex === photos.length - 1"
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
            <!-- Regular images -->
            <img 
              v-if="currentPhoto && !isHeicFile(currentPhoto.name)"
              :src="getPhotoUrl(currentPhoto)" 
              :alt="currentPhoto.name"
              class="lightbox-image"
              @error="handleLightboxImageError"
            >
            
            <!-- HEIC images: Show converted version -->
            <img 
              v-else-if="currentPhoto && isHeicFile(currentPhoto.name) && heicConversionStates[currentPhoto.name] === 'success' && convertedImages[currentPhoto.name]"
              :src="convertedImages[currentPhoto.name]" 
              :alt="currentPhoto.name"
              class="lightbox-image"
            >
            
            <!-- HEIC loading state -->
            <div v-else-if="currentPhoto && isHeicFile(currentPhoto.name) && heicConversionStates[currentPhoto.name] === 'loading'" class="lightbox-heic-loading">
              <i class="fas fa-spinner fa-spin"></i>
              <p>Converting HEIC image...</p>
            </div>
            
            <!-- HEIC error state -->
            <div v-else-if="currentPhoto && isHeicFile(currentPhoto.name) && heicConversionStates[currentPhoto.name] === 'error'" class="lightbox-heic-error">
              <i class="fas fa-exclamation-triangle"></i>
              <p>Failed to convert HEIC file</p>
              <button @click="downloadPhoto(currentPhoto)" class="btn-download-lightbox">
                <i class="fas fa-download"></i> Download Original
              </button>
            </div>

            <!-- Loading placeholder -->
            <div v-if="lightboxLoading" class="lightbox-loading">
              <i class="fas fa-spinner fa-spin"></i>
              <p>Loading image...</p>
            </div>
          </div>

          <!-- Photo Info -->
          <div class="lightbox-info">
            <div class="lightbox-photo-details">
              <h3>{{ getPhotoDisplayName(currentPhoto?.name) }}</h3>
              <p class="lightbox-photo-meta">
                {{ formatFileSize(currentPhoto?.size) }} • 
                {{ currentPhotoIndex + 1 }} of {{ photos.length }}
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
import heic2any from 'heic2any'
import apiService from '../services/api.js'

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
const convertedImages = ref({}) // Store converted HEIC images as blob URLs
const heicConversionStates = ref({}) // Track conversion states: 'loading', 'success', 'error'
const showUploadDialog = ref(false)
const showDeletePhotoDialog = ref(false)
const selectedFiles = ref([])
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
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

// Computed properties
const currentPhoto = computed(() => {
  return photos.value[currentPhotoIndex.value] || null
})

// Constants
const BUCKET_NAME = 'photovault'
const ITEMS_PER_PAGE = 50

// Methods
const loadPhotos = async () => {
  loading.value = true
  error.value = null
  
  // Clear previous conversion states and images
  heicConversionStates.value = {}
  cleanupBlobUrls()
  
  try {
    // Clean the album name and ensure we have exactly one trailing slash
    let cleanAlbumName = props.albumName.trim()
    // Remove any trailing slashes first
    cleanAlbumName = cleanAlbumName.replace(/\/+$/, '')
    // Add exactly one trailing slash
    const prefix = cleanAlbumName + '/'
    
    const response = await apiService.getBucketContents(BUCKET_NAME, prefix)
    
    if (response.success && response.data) {
      
      // Filter only image files (including HEIC from iPhone)
      const imageFiles = (response.data.objects || []).filter(obj => 
        obj.name && 
        !obj.name.endsWith('/') && 
        /\.(jpg|jpeg|png|gif|bmp|webp|heic|heif)$/i.test(obj.name)
      )
      
      
      photos.value = imageFiles
      
      // Initialize virtual scrolling with the loaded photos
      resetVirtualScrolling()
      
      // DON'T convert HEIC files immediately - do it on-demand only
      // Initialize HEIC states as 'pending' for lazy conversion
      initializeHeicStates(imageFiles)
    } else {
      throw new Error(response.error || 'Failed to load album photos')
    }
  } catch (err) {
    error.value = `Error loading photos: ${err.message}`
  } finally {
    loading.value = false
  }
}

const initializeHeicStates = (imageFiles) => {
  const heicFiles = imageFiles.filter(photo => isHeicFile(photo.name))
  
  // Just initialize states as 'pending' - don't start conversion yet
  const initialStates = {}
  heicFiles.forEach(photo => {
    initialStates[photo.name] = 'pending'
  })
  heicConversionStates.value = { ...heicConversionStates.value, ...initialStates }
}

const convertHeicImageOnDemand = async (photo) => {
  // If already converted or in progress, don't start again
  if (heicConversionStates.value[photo.name] === 'success' || 
      heicConversionStates.value[photo.name] === 'loading') {
    return
  }
  
  // Set to loading state
  heicConversionStates.value = { 
    ...heicConversionStates.value, 
    [photo.name]: 'loading' 
  }
  
  try {
    // Fetch the HEIC file
    const response = await fetch(apiService.getObjectUrl(BUCKET_NAME, photo.name))
    if (!response.ok) {
      throw new Error(`Failed to fetch HEIC file: ${response.statusText}`)
    }
    
    // Convert to blob
    const heicBlob = await response.blob()
    
    // Convert HEIC to JPEG with optimized settings for thumbnails
    const convertedBlob = await heic2any({
      blob: heicBlob,
      toType: 'image/jpeg',
      quality: 0.7, // Slightly better quality since we're doing fewer conversions
      maxWidth: 1200, // Larger size since it's on-demand
      maxHeight: 1200
    })
    
    // Create blob URL for display and update state
    const blobUrl = URL.createObjectURL(convertedBlob)
    
    // Force reactivity by creating new objects
    convertedImages.value = { ...convertedImages.value, [photo.name]: blobUrl }
    heicConversionStates.value = { ...heicConversionStates.value, [photo.name]: 'success' }
    
  } catch (error) {
    heicConversionStates.value = { ...heicConversionStates.value, [photo.name]: 'error' }
  }
}

const isHeicFile = (filename) => {
  return /\.(heic|heif)$/i.test(filename)
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
  // For non-HEIC files, use the API service method for getting object URLs
  return apiService.getObjectUrl(BUCKET_NAME, photo.name)
}

const getOptimizedPhotoUrl = (photo) => {
  // For thumbnails, we'll add query parameters to hint the server
  // This prepares for when backend thumbnail support is added
  const baseUrl = apiService.getObjectUrl(BUCKET_NAME, photo.name)
  
  // Add thumbnail parameters (backend can implement these later)
  // For now, this just returns the regular URL but is ready for backend optimization
  return `${baseUrl}&thumbnail=true&size=300x300&quality=70`
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
    // First load optimized/thumbnail version
    const optimizedSrc = getOptimizedPhotoUrl(photo)
    await preloadImage(optimizedSrc)
    
    // Then progressively enhance with full resolution when user hovers or clicks
    imgElement.addEventListener('mouseenter', async () => {
      if (!imgElement.dataset.fullLoaded) {
        try {
          const fullSrc = getPhotoUrl(photo)
          await preloadImage(fullSrc)
          imgElement.src = fullSrc
          imgElement.dataset.fullLoaded = 'true'
        } catch (error) {
          // Failed to load full resolution image
        }
      }
    }, { once: true })
    
  } catch (error) {
    // Failed to load optimized image
  }
}

const getPhotoDisplayName = (filename) => {
  return filename.split('/').pop() || filename
}

const handleImageError = (event) => {
  event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
}

const openPhoto = (photo) => {
  // Find the photo index in the photos array
  const photoIndex = photos.value.findIndex(p => p.name === photo.name)
  if (photoIndex !== -1) {
    currentPhotoIndex.value = photoIndex
    showLightbox.value = true
    
    // Add keyboard event listener
    document.addEventListener('keydown', handleLightboxKeyboard)
  }
}

const closeLightbox = () => {
  showLightbox.value = false
  lightboxLoading.value = false
  
  // Remove keyboard event listener
  document.removeEventListener('keydown', handleLightboxKeyboard)
}

const nextPhoto = () => {
  console.log('Next photo clicked. Current index:', currentPhotoIndex.value, 'Total photos:', photos.value.length)
  if (currentPhotoIndex.value < photos.value.length - 1) {
    currentPhotoIndex.value++
    console.log('Moving to next photo. New index:', currentPhotoIndex.value)
  } else {
    console.log('Already at last photo')
  }
}

const previousPhoto = () => {
  console.log('Previous photo clicked. Current index:', currentPhotoIndex.value)
  if (currentPhotoIndex.value > 0) {
    currentPhotoIndex.value--
    console.log('Moving to previous photo. New index:', currentPhotoIndex.value)
  } else {
    console.log('Already at first photo')
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

const handleLightboxImageError = (event) => {
  // Lightbox image failed to load
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
  const imageFiles = files.filter(file => file.type.startsWith('image/'))
  selectedFiles.value.push(...imageFiles)
  
  if (imageFiles.length !== files.length) {
    alert(`${files.length - imageFiles.length} files were skipped (only image files are allowed)`)
  }
}

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1)
}

const uploadPhotos = async () => {
  if (selectedFiles.value.length === 0) return
  
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
    uploadStatus.value = `Uploading ${selectedFiles.value.length} files...`
    
    let completedUploads = 0
    const totalFiles = selectedFiles.value.length
    
    // Upload files one by one to track individual progress
    for (const file of selectedFiles.value) {
      try {
        uploadStatus.value = `Uploading ${file.name}...`
        
        const response = await apiService.uploadSingleFile(
          BUCKET_NAME, 
          file, 
          props.albumName,
          (progress) => {
            // Update individual file progress
            fileUploadProgress.value = {
              ...fileUploadProgress.value,
              [file.name]: progress
            }
            
            // Calculate overall progress
            const totalProgress = Object.values(fileUploadProgress.value).reduce((sum, prog) => sum + prog, 0)
            const completedFilesProgress = completedUploads * 100
            uploadProgress.value = Math.round((totalProgress + completedFilesProgress) / totalFiles)
          }
        )
        
        if (response.success) {
          uploadedFiles.value.add(file.name)
          fileUploadProgress.value = {
            ...fileUploadProgress.value,
            [file.name]: 100
          }
          completedUploads++
        } else {
          throw new Error(response.error || 'Upload failed')
        }
      } catch (err) {
        failedFiles.value.add(file.name)
        fileUploadProgress.value = {
          ...fileUploadProgress.value,
          [file.name]: -1 // -1 indicates error
        }
        console.error(`Failed to upload ${file.name}:`, err)
      }
    }
    
    uploadProgress.value = 100
    
    if (failedFiles.value.size > 0) {
      uploadStatus.value = `${uploadedFiles.value.size} files uploaded, ${failedFiles.value.size} failed`
    } else {
      uploadStatus.value = 'All files uploaded successfully!'
    }
    
    // Close dialog and refresh photos after a delay
    setTimeout(() => {
      closeUploadDialog()
      loadPhotos()
    }, 2000)
    
  } catch (err) {
    error.value = `Upload failed: ${err.message}`
  } finally {
    uploading.value = false
  }
}

const confirmDeletePhoto = (photo) => {
  photoToDelete.value = photo
  showDeletePhotoDialog.value = true
}

const deletePhoto = async () => {
  if (!photoToDelete.value) return
  
  deletingPhoto.value = true
  error.value = null
  
  try {
    const response = await apiService.deleteObject(BUCKET_NAME, photoToDelete.value.name)
    
    if (response.success) {
      await loadPhotos() // Refresh the list
      closeDeletePhotoDialog()
    } else {
      throw new Error(response.error || 'Failed to delete photo')
    }
  } catch (err) {
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

// Cleanup function for blob URLs
const cleanupBlobUrls = () => {
  Object.values(convertedImages.value).forEach(url => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  })
  convertedImages.value = {}
}

// Performance monitoring
const trackImageLoadTime = (photoName, startTime) => {
  const loadTime = Date.now() - startTime
  
  // Track slow loading images (>2 seconds) - could be used for analytics
  if (loadTime > 2000) {
    // Slow image load detected
  }
}

// Batch image preloading for visible images
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
        
        observer.unobserve(img)
      }
    })
  }, { rootMargin: '50px' })
  
  imageElements.forEach(img => observer.observe(img))
}

// Intersection observer for HEIC lazy conversion
const setupHeicLazyConversion = () => {
  const heicPlaceholders = document.querySelectorAll('.heic-placeholder[data-photo-name]')
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const placeholder = entry.target
        const photoName = placeholder.dataset.photoName
        
        // Find the photo object
        const photo = photos.value.find(p => p.name === photoName)
        if (photo && heicConversionStates.value[photoName] === 'pending') {
          // Start converting this HEIC image
          convertHeicImageOnDemand(photo)
        }
        
        // Stop observing this placeholder
        observer.unobserve(placeholder)
      }
    })
  }, { 
    rootMargin: '100px', // Start conversion 100px before the image is visible
    threshold: 0.1 
  })
  
  heicPlaceholders.forEach(placeholder => observer.observe(placeholder))
}

// Virtual scrolling for large photo collections (optional optimization)
const visiblePhotos = ref([])
const currentPage = ref(1)

const loadMorePhotos = () => {
  const startIndex = (currentPage.value - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  
  const newPhotos = photos.value.slice(startIndex, endIndex)
  
  if (newPhotos.length > 0) {
    visiblePhotos.value = [...visiblePhotos.value, ...newPhotos]
    currentPage.value++
    
    // Setup HEIC lazy conversion for newly loaded photos
    setTimeout(() => {
      setupHeicLazyConversion()
    }, 50)
  }
}

const resetVirtualScrolling = () => {
  visiblePhotos.value = []
  currentPage.value = 1
  loadMorePhotos()
}

// Intersection observer for infinite scroll
const setupInfiniteScroll = () => {
  const sentinel = document.querySelector('.load-more-trigger')
  if (!sentinel) return
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && visiblePhotos.value.length < photos.value.length) {
        loadMorePhotos()
      }
    })
  }, { threshold: 0.1 })
  
  observer.observe(sentinel)
}

// Lifecycle
onMounted(async () => {
  await loadPhotos()
  
  // Setup performance monitoring and lazy loading after images are loaded
  setTimeout(() => {
    preloadVisibleImages()
    setupInfiniteScroll()
    setupHeicLazyConversion() // Setup HEIC lazy conversion
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

.photo-info {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.photo-name {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
  word-break: break-word;
}

.photo-size {
  font-size: 0.8rem;
  color: #666;
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
  z-index: 1000;
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
.lightbox-heic-error {
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
.lightbox-heic-loading i {
  font-size: 3rem;
  margin-bottom: 1rem;
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
</style>
