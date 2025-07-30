<template>
  <!-- Upload Dialog -->
  <div v-if="showUploadDialog" class="dialog-overlay" @click="closeUploadDialog">
    <div class="dialog upload-dialog" @click.stop>
      <h3><i class="fas fa-cloud-upload-alt"></i> Upload Media</h3>

      <!-- Upload Type Selector -->
      <div class="upload-type-selector">
        <button class="btn-upload-type" :class="{ active: uploadType === 'photos' }" @click="setUploadType('photos')">
          <i class="fas fa-image"></i>
          Photos
        </button>
        <button class="btn-upload-type" :class="{ active: uploadType === 'videos' }" @click="setUploadType('videos')">
          <i class="fas fa-video"></i>
          Videos
        </button>
      </div>

      <!-- Upload UI - hidden after upload completes -->
      <div v-if="!(uploadProgress === 100 && !uploading)">

        <!-- File Drop Zone -->
        <div class="upload-zone" :class="{ 'dragging': isDragging }" @drop="handleDrop" @dragover.prevent
          @dragenter="isDragging = true" @dragleave="isDragging = false" @click="triggerFileInput">
          <input ref="fileInput" type="file" :accept="uploadType === 'photos' ? 'image/*' : 'video/*'" multiple
            @change="handleFileSelect" style="display: none;" />
          <div class="upload-content">
            <i :class="uploadType === 'photos' ? 'fas fa-cloud-upload-alt' : 'fas fa-video'" class="upload-icon"></i>
            <p class="upload-text">
              {{ uploadType === 'photos' ? 'Drag and drop photos here or click to select' : 'Drag and drop videos here or click to select' }}
            </p>
            <p class="upload-hint">
              {{ uploadType === 'photos' ? 'Supports JPG and HEIC files (optimized for fast display)' : 'Supports MOV, MP4 and other video formats (up to 2GB each)' }}
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

              <button v-if="!uploading" @click="removeFile(index)" class="btn-remove">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      </div> <!-- End of upload UI conditional -->

      <div class="dialog-actions">
        <button class="btn-secondary" @click="closeUploadDialog">
          {{ uploadProgress === 100 && !uploading ? 'Done' : 'Cancel' }}
        </button>
        <button v-if="uploadProgress < 100" class="btn-primary" @click="uploadFiles"
          :disabled="selectedFiles.length === 0 || uploading">
          {{ uploading ? 'Uploading...' : `Upload ${selectedFiles.length} ${uploadType === 'photos' ? 'Photo' :
          'Video'}${selectedFiles.length !== 1 ? 's' : ''}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import authService from '../services/auth.js'
import apiService from '../services/api.js'

// Props
const props = defineProps({
  showUploadDialog: {
    type: Boolean,
    default: false
  }
})

// Constants
const BUCKET_NAME = 'photovault'

// Emits
const emit = defineEmits(['close'])

// Reactive data
const uploadType = ref('photos')
const isDragging = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const selectedFiles = ref([])
const isMobileDevice = ref(false)
const uploadedFiles = ref(new Set())
const failedFiles = ref(new Set())
const error = ref(null)

// Template refs
const fileInput = ref(null)

// Upload type management
const setUploadType = (type) => {
  uploadType.value = type
  selectedFiles.value = [] // Clear selected files when switching type
}
const requestNotificationPermission = () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}
// File handling methods
const handleDrop = (event) => {
  event.preventDefault()
  isDragging.value = false
  const files = Array.from(event.dataTransfer.files)
  addFiles(files)
}

const handleFileSelect = (event) => {
  const files = Array.from(event.target.files)
  addFiles(files)
}

const triggerFileInput = () => {
  fileInput.value?.click()
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

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1)
}

// Upload functionality
const uploadFiles = async () => {
  if (selectedFiles.value.length === 0) return
  
  // Check permission before proceeding
  const actionType = uploadType.value === 'photos' ? 'upload_photos' : 'upload_photos'
  if (!authService.canPerformAction(actionType)) {
    error.value = `You do not have permission to upload ${uploadType.value}`
    return
  }
  
  // Request notification permission
  requestNotificationPermission()
  
  uploading.value = true
  uploadProgress.value = 0
  error.value = null
  
  // Reset upload tracking
  uploadedFiles.value = new Set()
  failedFiles.value = new Set()
  
  try {
    uploadStatus.value = `Starting upload of ${selectedFiles.value.length} files...`
    console.log('📤 Uploading files:', selectedFiles.value.map(f => f.name))
        
    // Upload files
    const response = await apiService.uploadFile(
      BUCKET_NAME, 
      selectedFiles.value, 
      props.albumName
    )

    if (!response.success) {
      throw new Error(response.error || 'Upload failed')
    } else {
        console.log('📤 Upload response:', response);
        closeUploadDialog(response.data.jobId);
    }
    

    
  } catch (err) {
    error.value = `Upload failed: ${err.message}`
    console.error('Upload failed:', err)
  } finally {
    uploading.value = false
    
  }
}

// Dialog management
const closeUploadDialog = (jobId) => {
  // Reset component state
  selectedFiles.value = []
  uploadProgress.value = 0
  uploadStatus.value = ''
  uploading.value = false
  uploadedFiles.value = new Set()
  failedFiles.value = new Set()
  error.value = null
  isDragging.value = false
  
  // Emit close event to parent
  emit('close', { jobId })
}

// Utility methods
const formatFileSize = (bytes) => {
  // TODO: Implement file size formatting
  // Convert bytes to human readable format (KB, MB, GB)
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const detectMobileDevice = () => {
  // TODO: Implement mobile device detection
  // Set isMobileDevice.value based on user agent or screen size
  isMobileDevice.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// Lifecycle
onMounted(() => {
  // TODO: Implement mobile device detection
  detectMobileDevice()
})
</script>


<style scoped>
/* Dialog overlay and base dialog styles */
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

/* Upload type selector */
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

/* Mobile warning */
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

/* Upload zone */
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





/* Progress bar */

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

/* Selected files */
.selected-files {
  margin-bottom: 1.5rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
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


/* Dialog actions */
.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-primary {
  background: #2196f3;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.3s ease;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.3s ease;
}

.btn-primary:disabled {
  background: #b0bec5;
  color: #fff;
  cursor: not-allowed;
}
</style>