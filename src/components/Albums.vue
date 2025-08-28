<template>
  <div class="max-w-[1200px] mx-auto px-4 py-8">
    <div class="flex flex-wrap justify-between items-center mb-12 gap-4">
      <div class="text-left md:text-center">
        <h1 class="text-4xl font-bold text-gray-800 mb-2">Photo Albums</h1>
        <p class="text-lg text-gray-600 mb-8">Organize your photos into albums</p>
      </div>
      <div class="flex items-center gap-3 justify-center flex-wrap">
        <button @click="refreshAlbums" :disabled="loading" title="Refresh albums"
          class="bg-gray-100 text-gray-800 border border-gray-300 px-4 py-3 rounded-md text-sm font-medium transition hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i> Refresh
        </button>
        <button v-if="canCreateAlbum" @click="showCreateDialog = true"
          class="bg-blue-500 text-white px-4 py-3 rounded-md text-sm font-semibold shadow-md transition hover:bg-blue-600 hover:-translate-y-[1px] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
          <i class="fas fa-plus"></i> Create New Album
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
      <p>Loading albums...</p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="text-center py-8 text-red-500">
      <p><i class="fas fa-exclamation-triangle"></i> {{ error }}</p>
      <button @click="loadAlbums"
        class="mt-4 bg-gray-100 text-gray-800 border border-gray-300 px-4 py-3 rounded-md text-sm transition hover:bg-gray-200">
        Try Again
      </button>
    </div>

    <!-- Albums Grid -->
    <div v-if="!loading && !error" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <div v-for="album in albums" :key="album.name" @click="openAlbum(album)"
        class="bg-white border border-gray-200 rounded-xl p-6 text-center transition cursor-pointer relative hover:border-blue-500 hover:shadow-lg hover:-translate-y-[2px]">
        <div class="text-4xl mb-4"><i class="fas fa-images"></i></div>
        <h3 class="text-base font-semibold text-gray-800 mb-2">{{ getAlbumDisplayName(album.name) }}</h3>
        <p class="text-sm text-blue-500 font-medium mb-2">{{ album.fileCount || 0 }} photos</p>
        <p class="text-xs text-gray-500 mb-4">Created {{ formatDate(album.lastModified) }}</p>
        <div class="absolute top-3 right-3 opacity-0 hover:opacity-100 transition">
          <button v-if="canDeleteAlbum" @click.stop="confirmDelete(album)" title="Delete Album"
            class="bg-red-500 text-white px-2 py-2 rounded text-xs transition hover:bg-red-600">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="albums.length === 0" class="col-span-full text-center py-16 px-8">
        <div class="text-5xl mb-4"><i class="fas fa-camera"></i></div>
        <h3 class="text-xl text-gray-800 mb-4">No Albums Yet</h3>
        <p class="text-gray-600 mb-6">
          <span v-if="canCreateAlbum">Create your first photo album to get started!</span>
          <span v-else>No albums available to view.</span>
        </p>
        <button v-if="canCreateAlbum" @click="showCreateDialog = true"
          class="bg-blue-500 text-white px-4 py-3 rounded-md text-sm font-semibold shadow-md transition hover:bg-blue-600">
          Create Album
        </button>
      </div>
    </div>

    <!-- Create Album Dialog -->
    <div v-if="showCreateDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]"
      @click="closeDialog">
      <div class="bg-white rounded-xl p-8 w-full max-w-md shadow-xl" @click.stop>
        <h3 class="text-lg font-semibold text-gray-800 mb-6">Create New Album</h3>
        <div class="mb-6">
          <label for="albumName" class="block mb-2 font-medium text-gray-800">Album Name:</label>
          <input id="albumName" v-model="newAlbumName" type="text" placeholder="Enter album name..."
            @keyup.enter="createAlbum" ref="albumNameInput"
            class="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
        </div>
        <div class="flex justify-end gap-4 flex-wrap sm:flex-nowrap">
          <button @click="closeDialog"
            class="bg-gray-100 text-gray-800 border border-gray-300 px-4 py-3 rounded-md text-sm transition hover:bg-gray-200">
            Cancel
          </button>
          <button @click="createAlbum" :disabled="!newAlbumName.trim() || creating"
            class="bg-blue-500 text-white px-4 py-3 rounded-md text-sm font-semibold shadow-md transition hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed">
            {{ creating ? 'Creating...' : 'Create Album' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]"
      @click="closeDeleteDialog">
      <div class="bg-white rounded-xl p-8 w-full max-w-md shadow-xl" @click.stop>
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Delete Album</h3>
        <p class="mb-4">Are you sure you want to delete the album "<strong>{{ getAlbumDisplayName(albumToDelete?.name)
        }}</strong>"?</p>
        <p class="text-orange-500 text-sm mb-6"><i class="fas fa-exclamation-triangle"></i> This action cannot be undone
          and will delete all photos in this album.</p>
        <div class="flex justify-end gap-4 flex-wrap sm:flex-nowrap">
          <button @click="closeDeleteDialog"
            class="bg-gray-100 text-gray-800 border border-gray-300 px-4 py-3 rounded-md text-sm transition hover:bg-gray-200">
            Cancel
          </button>
          <button @click="deleteAlbum" :disabled="deleting"
            class="bg-red-500 text-white px-4 py-3 rounded-md text-sm font-semibold transition hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed">
            {{ deleting ? 'Deleting...' : 'Delete Album' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import apiService from '../services/api.js'
import authService from '../services/auth.js'

// Emits
const emit = defineEmits(['navigate', 'openAlbum'])

// Reactive state
const loading = ref(false)
const error = ref(null)
const albums = ref([])
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const newAlbumName = ref('')
const creating = ref(false)
const deleting = ref(false)
const albumToDelete = ref(null)
const albumNameInput = ref(null)

// Computed properties for permission checks
const canCreateAlbum = computed(() => {
  return authService.canPerformAction('create_album')
})

const canDeleteAlbum = computed(() => {
  return authService.canPerformAction('delete_album')
})

// Constants
const BUCKET_NAME = 'photovault' // The correct bucket name

// Methods
const loadAlbums = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await apiService.getAlbums(BUCKET_NAME)
    console.log('[ALBUMS LINE 155] API response:', response)

    if (response.success && response.albums) {
      // Map backend fields to the shape expected by your frontend
      const albumsWithDates = response.albums.map((album) => {
        return {
          name: album.name,                                // keep the name as is
          lastModified: album.updated_at 
            ? new Date(album.updated_at).toISOString() 
            : null,                                       // use DB updated_at
          fileCount: album.fileCount ?? 0,                 // backend already gives this
        }
      })

      albums.value = albumsWithDates
    } else {
      throw new Error(response.error || 'Failed to load albums - API returned unsuccessful response')
    }
  } catch (err) {
    console.error('[ALBUMS ERROR]', err)
    error.value = `Error loading albums: ${err.message}. Check browser console for details.`
  } finally {
    loading.value = false
  }
}

const createAlbum = async () => {
  if (!newAlbumName.value.trim()) return

  // Check permission before proceeding
  if (!authService.canPerformAction('create_album')) {
    error.value = 'You do not have permission to create albums'
    return
  }

  creating.value = true
  error.value = null

  try {
    const albumName = newAlbumName.value.trim()

    // Use the correct API endpoint to create a folder
    const response = await apiService.createFolder(BUCKET_NAME, albumName)

    if (response.success) {
      closeDialog() // Close dialog first to show loading state
      await loadAlbums() // Refresh the list
    } else {
      throw new Error(response.error || 'Failed to create album')
    }
  } catch (err) {
    error.value = `Failed to create album: ${err.message}`
  } finally {
    creating.value = false
  }
}

const confirmDelete = (album) => {
  // Check permission before showing dialog
  if (!authService.canPerformAction('delete_album')) {
    error.value = 'You do not have permission to delete albums'
    return
  }

  albumToDelete.value = album
  showDeleteDialog.value = true
}

const deleteAlbum = async () => {
  if (!albumToDelete.value) return

  deleting.value = true
  error.value = null

  try {
    const response = await apiService.deleteFolder(BUCKET_NAME, albumToDelete.value.name)

    if (response.success) {
      await loadAlbums() // Refresh the list
      closeDeleteDialog()
    } else {
      throw new Error(response.error || 'Failed to delete album')
    }
  } catch (err) {
    error.value = `Failed to delete album: ${err.message}`
  } finally {
    deleting.value = false
  }
}

const openAlbum = (album) => {
  emit('openAlbum', album)
}

const closeDialog = () => {
  showCreateDialog.value = false
  newAlbumName.value = ''
  creating.value = false
}

const closeDeleteDialog = () => {
  showDeleteDialog.value = false
  albumToDelete.value = null
  deleting.value = false
}

const getAlbumDisplayName = (folderName) => {
  // Remove trailing slash if present
  return folderName.replace(/\.+/g, ' '); // or whatever formatting you want
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  return new Date(dateString).toLocaleDateString()
}

const refreshAlbums = async () => {
  await loadAlbums()
}

// Focus input when dialog opens
const focusInput = async () => {
  await nextTick()
  if (albumNameInput.value) {
    albumNameInput.value.focus()
  }
}

// Watch for dialog opening
watch(showCreateDialog, (newVal) => {
  if (newVal) {
    focusInput()
  }
})

// Lifecycle
onMounted(() => {
  loadAlbums()
})
</script>
