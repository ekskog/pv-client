<template>
  <!-- Upload Dialog -->
  <div v-if="showUploadDialog" class="dialog-overlay" @click="closeUploadDialog">
    <div class="dialog upload-dialog" @click.stop>
      <h3><i class="fas fa-cloud-upload-alt"></i> Upload Media</h3>

      <!-- Upload Type Selector -->
      <div class="upload-type-selector">
        <button class="btn-upload-type" @click="triggerUpload('photos')">
          <i class="fas fa-image"></i>
          Photos
        </button>
        <button class="btn-upload-type" @click="triggerUpload('videos')">
          <i class="fas fa-video"></i>
          Videos
        </button>
      </div>

      <!-- Hidden File Input -->
      <input
        ref="fileInput"
        type="file"
        :accept="uploadType === 'photos' ? 'image/*' : 'video/*'"
        multiple
        @change="handleFileSelect"
        style="display: none;"
      />

      <!-- Selected Files Summary -->
      <div v-if="selectedFiles.length > 0" class="selected-summary">
        <p>
          <strong>{{ selectedFiles.length }}</strong> file{{ selectedFiles.length > 1 ? 's' : '' }} selected —
          <strong>{{ totalSizeMB }}</strong> MB total
        </p>
      </div>

      <!-- Upload Progress -->
      <div v-if="uploading" class="upload-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${uploadProgress}%` }"></div>
        </div>
        <p class="progress-text">{{ uploadStatus }}</p>
      </div>

      <!-- Dialog Actions -->
      <div class="dialog-actions">
        <button class="btn-secondary" @click="closeUploadDialog">
          {{ uploadProgress === 100 && !uploading ? 'Done' : 'Cancel' }}
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

  <!-- Upload Complete Modal -->
  <div v-if="showUploadCompleteModal" class="dialog-overlay" @click="showUploadCompleteModal = false">
    <div class="dialog" @click.stop>
      <h3><i class="fas fa-check-circle" style="color: #4caf50;"></i> Upload Complete</h3>
      <p>Your files have been uploaded. The album will refresh automatically when processing is complete.</p>
      <div class="dialog-actions">
        <button class="btn-primary" @click="confirmUploadComplete">OK</button>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, onMounted, computed } from 'vue'
import authService from '../services/auth.js'
import apiService from '../services/api.js'

// Props
const props = defineProps({
  showUploadDialog: {
    type: Boolean,
    default: false
  },
  albumName: {
    type: String,
    default: 'Test'
  }
})

// Emits
const emit = defineEmits(['close'])

// Constants
const BUCKET_NAME = 'photovault'

// Reactive state
const uploadType = ref('photos')
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const selectedFiles = ref([])
const uploadedFiles = ref(new Set())
const failedFiles = ref(new Set())
const error = ref(null)
const fileInput = ref(null)
const showUploadCompleteModal = ref(false)
const pendingJobId = ref(null)


// Trigger upload flow
const triggerUpload = (type) => {
  uploadType.value = type
  selectedFiles.value = []
  fileInput.value?.click()
}

// File selection
const handleFileSelect = (event) => {
  const files = Array.from(event.target.files)
  const validFiles = files.filter(file =>
    uploadType.value === 'photos'
      ? file.type.startsWith('image/')
      : file.type.startsWith('video/')
  )

  selectedFiles.value.push(...validFiles)

  if (validFiles.length !== files.length) {
    alert(`Some files were skipped. Only ${uploadType.value} are allowed.`)
  }
}

const totalSizeMB = computed(() => {
  const totalBytes = selectedFiles.value.reduce((sum, file) => sum + file.size, 0)
  return (totalBytes / (1024 * 1024)).toFixed(2)
})

// Upload files
const uploadFiles = async () => {
  if (selectedFiles.value.length === 0) return

  const actionType = uploadType.value === 'photos' ? 'upload_photos' : 'upload_photos'
  if (!authService.canPerformAction(actionType)) {
    error.value = `You do not have permission to upload ${uploadType.value}`
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  error.value = null
  uploadedFiles.value = new Set()
  failedFiles.value = new Set()

  try {
    uploadStatus.value = `Starting upload of ${selectedFiles.value.length} files...`
    const response = await apiService.uploadFile(
      BUCKET_NAME,
      selectedFiles.value,
      props.albumName
    )

    if (!response.success) {
      throw new Error(response.error || 'Upload failed')
    } else {
      pendingJobId.value = response.data.jobId
      showUploadCompleteModal.value = true
    }

  } catch (err) {
    error.value = `Upload failed: ${err.message}`
    console.error('Upload failed:', err)
  } finally {
    uploading.value = false
  }
}

const confirmUploadComplete = () => {
  showUploadCompleteModal.value = false
  closeUploadDialog(pendingJobId.value)
}

// Close dialog
const closeUploadDialog = (jobId) => {
  selectedFiles.value = []
  uploadProgress.value = 0
  uploadStatus.value = ''
  uploading.value = false
  uploadedFiles.value = new Set()
  failedFiles.value = new Set()
  error.value = null

  emit('close', { jobId })
}

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Detect mobile (optional)
onMounted(() => {
  // You can add mobile-specific logic here if needed
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

.btn-upload-type i {
  font-size: 1rem;
}

/* Upload progress */
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

/* Selected files */
.selected-files {
  margin-bottom: 1.5rem;
}

.selected-summary {
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  color: #444;
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
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  word-break: break-word;
  margin-bottom: 0.5rem;
}

.file-info {
  display: flex;
  flex-direction: column;
}

.file-name {
  font-weight: 500;
}

.file-size {
  font-size: 0.8rem;
  color: #666;
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
