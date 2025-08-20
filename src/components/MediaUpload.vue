<template>
  <!-- Upload Dialog -->
  <div
    v-if="showUploadDialog"
    class="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-6"
    @click="closeUploadDialog"
  >
    <div
      class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto"
      @click.stop
    >
      <h3 class="text-lg font-semibold mb-6 flex items-center gap-2">
        <i class="fas fa-cloud-upload-alt text-blue-500"></i> Upload Media
      </h3>

      <!-- Upload Type Selector -->
      <div class="flex gap-2 mb-6">
        <button
          class="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-lg text-gray-600 text-sm font-medium hover:border-blue-500 hover:text-blue-500 transition"
          @click="triggerUpload('photos')"
        >
          <i class="fas fa-image text-base"></i> Photos
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-lg text-gray-600 text-sm font-medium hover:border-blue-500 hover:text-blue-500 transition"
          @click="triggerUpload('videos')"
        >
          <i class="fas fa-video text-base"></i> Videos
        </button>
      </div>

      <!-- Hidden File Input -->
      <input
        ref="fileInput"
        type="file"
        :accept="uploadType === 'photos' ? 'image/*' : 'video/*'"
        multiple
        @change="handleFileSelect"
        class="hidden"
      />

      <!-- Selected Files Summary -->
      <div v-if="selectedFiles.length > 0" class="mb-6 text-sm text-gray-700">
        <p>
          <strong>{{ selectedFiles.length }}</strong>
          file{{ selectedFiles.length > 1 ? 's' : '' }} selected —
          <strong>{{ totalSizeMB }}</strong> MB total
        </p>
      </div>

      <!-- Upload Progress -->
      <div v-if="uploading" class="mb-6">
        <div class="w-full h-2 bg-gray-200 rounded overflow-hidden mb-2">
          <div
            class="h-full bg-blue-500 transition-all duration-300"
            :style="{ width: `${uploadProgress}%` }"
          ></div>
        </div>
        <p class="text-center text-sm text-gray-600">{{ uploadStatus }}</p>
      </div>

      <!-- Dialog Actions -->
      <div class="flex justify-end gap-4 mt-6">
        <button
          class="bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300 transition"
          @click="closeUploadDialog"
        >
          {{ uploadProgress === 100 && !uploading ? 'Done' : 'Cancel' }}
        </button>
        <button
          v-if="uploadProgress < 100"
          class="bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-600 transition disabled:bg-blue-300 disabled:cursor-not-allowed"
          @click="uploadFiles"
          :disabled="selectedFiles.length === 0 || uploading"
        >
          {{ uploading ? 'Uploading...' : `Upload ${selectedFiles.length} ${uploadType === 'photos' ? 'Photo' : 'Video'}${selectedFiles.length !== 1 ? 's' : ''}` }}
        </button>
      </div>
    </div>
  </div>

  <!-- Upload Complete Modal -->
  <div
    v-if="showUploadCompleteModal"
    class="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-6"
    @click="showUploadCompleteModal = false"
  >
    <div
      class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md"
      @click.stop
    >
      <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
        <i class="fas fa-check-circle text-green-500"></i> Upload Complete
      </h3>
      <p class="text-sm text-gray-700 mb-6">
        Your files have been uploaded. The album will refresh automatically when processing is complete.
      </p>
      <div class="flex justify-end">
        <button
          class="bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-600 transition"
          @click="confirmUploadComplete"
        >
          OK
        </button>
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
      emit('close', { jobId: pendingJobId.value })
      console.log('close emitted')
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
  console.log('[MediaUpload] closeUploadDialog called, jobId:', jobId)
  selectedFiles.value = []
  uploadProgress.value = 0
  uploadStatus.value = ''
  uploading.value = false
  uploadedFiles.value = new Set()
  failedFiles.value = new Set()
  error.value = null
  emit('close')
  console.log('[MediaUpload] close event emitted')
}


// Detect mobile (optional)
onMounted(() => {
  // You can add mobile-specific logic here if needed
})
</script>


