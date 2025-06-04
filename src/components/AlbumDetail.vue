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
          v-for="photo in photos" 
          :key="photo.name"
          class="photo-card"
          @click="openPhoto(photo)"
        >
          <div class="photo-thumbnail">
            <img :src="getPhotoUrl(photo)" :alt="photo.name" @error="handleImageError">
            <div class="photo-overlay">
              <button 
                class="btn-delete-photo" 
                @click.stop="confirmDeletePhoto(photo)"
                title="Delete Photo"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="photo-info">
            <span class="photo-name">{{ getPhotoDisplayName(photo.name) }}</span>
            <span class="photo-size">{{ formatFileSize(photo.size) }}</span>
          </div>
        </div>
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
              Supports JPG, PNG, GIF files
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
        <div v-if="selectedFiles.length > 0 && !uploading" class="selected-files">
          <h4>Selected Files ({{ selectedFiles.length }})</h4>
          <div class="file-list">
            <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">{{ formatFileSize(file.size) }}</span>
              <button @click="removeFile(index)" class="btn-remove">
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
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
const showUploadDialog = ref(false)
const showDeletePhotoDialog = ref(false)
const selectedFiles = ref([])
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const isDragging = ref(false)
const photoToDelete = ref(null)
const deletingPhoto = ref(false)
const fileInput = ref(null)

// Constants
const BUCKET_NAME = 'photovault'

// Methods
const loadPhotos = async () => {
  loading.value = true
  error.value = null
  
  try {
    console.log(`Loading photos for album: ${props.albumName}`)
    // Ensure we have a single trailing slash for the prefix
    const prefix = props.albumName.endsWith('/') ? props.albumName : props.albumName + '/'
    const response = await apiService.getBucketContents(BUCKET_NAME, prefix)
    console.log('Album contents response:', response)
    
    if (response.success && response.data) {
      // Filter only image files
      const imageFiles = (response.data.objects || []).filter(obj => 
        obj.name && 
        !obj.name.endsWith('/') && 
        /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(obj.name)
      )
      
      photos.value = imageFiles
      console.log(`Loaded ${imageFiles.length} photos`)
    } else {
      throw new Error(response.error || 'Failed to load album photos')
    }
  } catch (err) {
    console.error('Error loading photos:', err)
    error.value = `Error loading photos: ${err.message}`
  } finally {
    loading.value = false
  }
}

const getPhotoUrl = (photo) => {
  // Use the API service method for getting object URLs
  return apiService.getObjectUrl(BUCKET_NAME, photo.name)
}

const getPhotoDisplayName = (filename) => {
  return filename.split('/').pop() || filename
}

const handleImageError = (event) => {
  console.error('Failed to load image:', event.target.src)
  event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
}

const openPhoto = (photo) => {
  emit('photoOpened', photo)
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
  
  try {
    uploadStatus.value = `Uploading ${selectedFiles.value.length} files...`
    
    // Use the API's upload endpoint with files array and folderPath
    const response = await apiService.uploadFile(BUCKET_NAME, selectedFiles.value, props.albumName)
    
    if (!response.success) {
      throw new Error(response.error || 'Upload failed')
    }
    
    uploadProgress.value = 100
    uploadStatus.value = 'Upload complete!'
    
    // Close dialog and refresh photos
    setTimeout(() => {
      closeUploadDialog()
      loadPhotos()
    }, 1000)
    
  } catch (err) {
    console.error('Upload error:', err)
    error.value = `Upload failed: ${err.message}`
  } finally {
    uploading.value = false
    uploadProgress.value = 0
    uploadStatus.value = ''
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
    console.error('Error deleting photo:', err)
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

// Lifecycle
onMounted(() => {
  loadPhotos()
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
  margin: 0 0 1rem 0;
}

.empty-state p {
  color: #666;
  margin: 0 0 2rem 0;
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.photo-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
}

.photo-card:hover {
  border-color: #2196f3;
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.1);
  transform: translateY(-2px);
}

.photo-thumbnail {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.photo-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.photo-card:hover .photo-overlay {
  opacity: 1;
}

.btn-delete-photo {
  background: #f44336;
  color: white;
  border: none;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-delete-photo:hover {
  background: #d32f2f;
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
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.file-name {
  font-weight: 500;
  color: #333;
  flex: 1;
  word-break: break-word;
}

.file-size {
  font-size: 0.8rem;
  color: #666;
  margin: 0 1rem;
}

.btn-remove {
  background: #f44336;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
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
</style>
