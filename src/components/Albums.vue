<template>
  <div class="max-w-[1200px] mx-auto px-4 py-8">
    <div class="flex flex-wrap justify-between items-center gap-4 mb-12">

      <!-- Actions Section -->
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Sort Controls (only show when albums exist) -->
        <div v-if="!loading && !error && albums.length > 0" class="flex items-center gap-2 flex-wrap">
          <span class="text-sm text-gray-600 hidden sm:inline">Sort by:</span>

          <!-- Date sorting buttons -->
          <div class="flex bg-white border border-gray-300 rounded-md overflow-hidden">
            <button
              @click="sortOrder = 'date-desc'"
              :class="['px-3 py-2 text-sm transition whitespace-nowrap', sortOrder === 'date-desc' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200']"
            >
              <i class="fas fa-calendar-alt mr-1"></i><span class="hidden lg:inline">Date</span> &darr;
            </button>
            <button
              @click="sortOrder = 'date-asc'"
              :class="['px-3 py-2 text-sm transition whitespace-nowrap', sortOrder === 'date-asc' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200']"
            >
              <i class="fas fa-calendar-alt mr-1"></i><span class="hidden lg:inline">Date</span> &uarr;
            </button>
          </div>

          <!-- Name sorting buttons -->
          <div class="flex bg-white border border-gray-300 rounded-md overflow-hidden">
            <button
              @click="sortOrder = 'name-asc'"
              :class="['px-3 py-2 text-sm transition whitespace-nowrap', sortOrder === 'name-asc' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200']"
            >
              <i class="fas fa-sort-alpha-down mr-1"></i><span class="hidden lg:inline">Name</span> &darr;
            </button>
            <button
              @click="sortOrder = 'name-desc'"
              :class="['px-3 py-2 text-sm transition whitespace-nowrap', sortOrder === 'name-desc' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200']"
            >
              <i class="fas fa-sort-alpha-up mr-1"></i><span class="hidden lg:inline">Name</span> &uarr;
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <button @click="refreshAlbums" :disabled="loading" title="Refresh albums"
          class="bg-gray-100 text-gray-800 border border-gray-300 px-4 py-3 rounded-md text-sm font-medium transition hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i> <span class="hidden sm:inline">Refresh</span>
        </button>
        <button v-if="canCreateAlbum" @click="showCreateDialog = true"
          class="bg-blue-500 text-white px-4 py-3 rounded-md text-sm font-semibold shadow-md transition hover:bg-blue-600 hover:-translate-y-[1px] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap">
          <i class="fas fa-plus"></i> <span class="hidden sm:inline">Create Album</span>
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



    <!-- Albums Grid with Always Visible Actions -->
    <div v-if="!loading && !error" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <div v-for="album in sortedAlbums" :key="album.name"
        class="bg-white border border-gray-200 rounded-xl overflow-hidden transition cursor-pointer hover:border-blue-500 hover:shadow-lg hover:-translate-y-[2px]">
        
        <!-- Album Content - Clickable area -->
        <div @click="openAlbum(album)" class="p-6 text-center">
          <div class="text-4xl mb-4 text-gray-600"><i class="fas fa-images"></i></div>
          <h3 class="text-base font-semibold text-gray-800 mb-2">{{ getAlbumDisplayName(album.name) }}</h3>
          <p class="text-sm text-blue-500 font-medium mb-2">{{ album.fileCount || 0 }} photos</p>
          <p class="text-xs text-gray-500">Created {{ formatDate(album.lastModified) }}</p>
        </div>

        <!-- Always Visible Action Buttons -->
        <div class="px-4 pb-4 flex justify-center gap-2">
          <button v-if="canRenameAlbum" 
            @click.stop="confirmRename(album)" 
            title="Rename Album"
            class="bg-blue-500 text-white px-3 py-2 rounded-md text-sm transition hover:bg-blue-600 shadow-sm flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center">
            <i class="fas fa-edit"></i>
            <span class="hidden sm:inline">Rename</span>
          </button>
          <button v-if="canDeleteAlbum" 
            @click.stop="confirmDelete(album)" 
            title="Delete Album"
            class="bg-red-500 text-white px-3 py-2 rounded-md text-sm transition hover:bg-red-600 shadow-sm flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center">
            <i class="fas fa-trash"></i>
            <span class="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="albums.length === 0" class="col-span-full text-center py-16 px-8">
        <div class="text-5xl mb-4 text-gray-400"><i class="fas fa-camera"></i></div>
        <h3 class="text-xl text-gray-800 mb-4">No Albums Yet</h3>
        <p class="text-gray-600 mb-6">
          <span v-if="canCreateAlbum">Create your first photo album to get started!</span>
          <span v-else>No albums available to view.</span>
        </p>
        <button v-if="canCreateAlbum" @click="showCreateDialog = true"
          class="bg-blue-500 text-white px-6 py-3 rounded-md text-sm font-semibold shadow-md transition hover:bg-blue-600">
          <i class="fas fa-plus mr-2"></i>Create Album
        </button>
      </div>
    </div>

    <!-- Create Album Dialog -->
    <div v-if="showCreateDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]"
      @click="closeDialog">
      <div class="bg-white rounded-xl p-8 w-full max-w-md shadow-xl mx-4" @click.stop>
        <h3 class="text-lg font-semibold text-gray-800 mb-6">Create New Album</h3>
        <div class="mb-6">
          <label for="albumName" class="block mb-2 font-medium text-gray-800">Album Name:</label>
          <input id="albumName" v-model="newAlbumName" type="text" placeholder="Enter album name..."
            @keyup.enter="createAlbum" ref="albumNameInput"
            class="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
        </div>
        <div class="mb-6">
          <label for="albumDescription" class="block mb-2 font-medium text-gray-800">Description (optional):</label>
          <textarea 
            id="albumDescription" 
            v-model="newAlbumDescription" 
            placeholder="Enter album description..."
            rows="3"
            class="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
          ></textarea>
        </div>
        <div class="mb-6">
          <label for="albumMonth" class="block mb-2 font-medium text-gray-800">Month:</label>
          <select id="albumMonth" v-model="newAlbumMonth"
            class="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
            <option value="">Select month...</option>
            <option value="01">January</option>
            <option value="02">February</option>
            <option value="03">March</option>
            <option value="04">April</option>
            <option value="05">May</option>
            <option value="06">June</option>
            <option value="07">July</option>
            <option value="08">August</option>
            <option value="09">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>
        </div>
        <div class="mb-6">
          <label for="albumYear" class="block mb-2 font-medium text-gray-800">Year:</label>
          <input id="albumYear" v-model="newAlbumYear" type="number" placeholder="Enter year (e.g., 2025)" min="1900" max="2100"
            class="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
        </div>
        <div class="flex justify-end gap-4 flex-wrap sm:flex-nowrap">
          <button @click="closeDialog"
            class="bg-gray-100 text-gray-800 border border-gray-300 px-4 py-3 rounded-md text-sm transition hover:bg-gray-200 min-w-[80px]">
            Cancel
          </button>
          <button @click="createAlbum" :disabled="!newAlbumName.trim() || creating"
            class="bg-blue-500 text-white px-4 py-3 rounded-md text-sm font-semibold shadow-md transition hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed min-w-[120px]">
            {{ creating ? 'Creating...' : 'Create Album' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]"
      @click="closeDeleteDialog">
      <div class="bg-white rounded-xl p-8 w-full max-w-md shadow-xl mx-4" @click.stop>
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Delete Album</h3>
        <p class="mb-4">Are you sure you want to delete the album "<strong>{{ getAlbumDisplayName(albumToDelete?.name)
        }}</strong>"?</p>
        <p class="text-orange-600 text-sm mb-6 bg-orange-50 p-3 rounded-md">
          <i class="fas fa-exclamation-triangle mr-2"></i>This action cannot be undone and will delete all photos in this album.
        </p>
        <div class="flex justify-end gap-4 flex-wrap sm:flex-nowrap">
          <button @click="closeDeleteDialog"
            class="bg-gray-100 text-gray-800 border border-gray-300 px-4 py-3 rounded-md text-sm transition hover:bg-gray-200 min-w-[80px]">
            Cancel
          </button>
          <button @click="deleteAlbum" :disabled="deleting"
            class="bg-red-500 text-white px-4 py-3 rounded-md text-sm font-semibold transition hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed min-w-[120px]">
            {{ deleting ? 'Deleting...' : 'Delete Album' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Rename Album Dialog -->
    <div v-if="showRenameDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]"
      @click="closeRenameDialog">
      <div class="bg-white rounded-xl p-8 w-full max-w-md shadow-xl mx-4" @click.stop>
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Rename Album</h3>
        <p class="mb-4">Enter a new name for the album "<strong>{{ getAlbumDisplayName(albumToRename?.name) }}</strong>".</p>
        <div class="mb-6">
          <label for="renameAlbumName" class="block mb-2 font-medium text-gray-800">New Album Name:</label>
          <input id="renameAlbumName" v-model="newAlbumNameForRename" type="text" placeholder="Enter new album name..."
            @keyup.enter="renameAlbum" ref="renameAlbumNameInput"
            class="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
        </div>
        <div class="flex justify-end gap-4 flex-wrap sm:flex-nowrap">
          <button @click="closeRenameDialog"
            class="bg-gray-100 text-gray-800 border border-gray-300 px-4 py-3 rounded-md text-sm transition hover:bg-gray-200 min-w-[80px]">
            Cancel
          </button>
          <button @click="renameAlbum" :disabled="!newAlbumNameForRename.trim() || renaming || newAlbumNameForRename.trim() === albumToRename?.name"
            class="bg-blue-500 text-white px-4 py-3 rounded-md text-sm font-semibold shadow-md transition hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed min-w-[120px]">
            {{ renaming ? 'Renaming...' : 'Rename Album' }}
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
const showRenameDialog = ref(false)
const newAlbumName = ref('')
const newAlbumDescription = ref('')
const newAlbumMonth = ref('')
const newAlbumYear = ref('')
const newAlbumNameForRename = ref('')
const creating = ref(false)
const deleting = ref(false)
const renaming = ref(false)
const albumToDelete = ref(null)
const albumToRename = ref(null)
const albumNameInput = ref(null)
const renameAlbumNameInput = ref(null)
const sortOrder = ref('date-desc') // 'date-desc', 'date-asc', 'name-asc', 'name-desc'

// Computed properties for permission checks
const canCreateAlbum = computed(() => {
  const result = authService.canPerformAction('create_album')
  console.log('[ALBUMS DEBUG] canCreateAlbum:', result)
  return result
})

const canDeleteAlbum = computed(() => {
  const result = authService.canPerformAction('delete_album')
  console.log('[ALBUMS DEBUG] canDeleteAlbum:', result)
  return result
})

const canRenameAlbum = computed(() => {
  const result = authService.canPerformAction('delete_album')
  console.log('[ALBUMS DEBUG] canRenameAlbum:', result)
  return result
})

// Computed property for sorted albums
const sortedAlbums = computed(() => {
  return [...albums.value].sort((a, b) => {
    switch (sortOrder.value) {
      case 'date-desc':
        if (!a.lastModified) return 1
        if (!b.lastModified) return -1
        return new Date(b.lastModified) - new Date(a.lastModified)
      case 'date-asc':
        if (!a.lastModified) return 1
        if (!b.lastModified) return -1
        return new Date(a.lastModified) - new Date(b.lastModified)
      case 'name-asc':
        return a.name.localeCompare(b.name)
      case 'name-desc':
        return b.name.localeCompare(a.name)
      default:
        return 0
    }
  })
})

// Constants
const BUCKET_NAME = 'photovault'

// Methods
const loadAlbums = async () => {
  console.log('[ALBUMS DEBUG] Loading albums...')
  loading.value = true
  error.value = null

  try {
    const response = await apiService.getAlbums(BUCKET_NAME)
    console.log('[ALBUMS DEBUG] API response:', response)

    if (response.success && response.albums) {
      const albumsWithDates = response.albums.map((album) => {
        return {
          name: album.name,
          lastModified: album.updated_at 
            ? new Date(album.updated_at).toISOString() 
            : null,
          fileCount: album.fileCount ?? 0,
        }
      })

      albums.value = albumsWithDates
      console.log('[ALBUMS DEBUG] Processed albums:', albumsWithDates)
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

  console.log('[ALBUMS DEBUG] Creating album:', newAlbumName.value.trim())

  if (!authService.canPerformAction('create_album')) {
    console.log('[ALBUMS DEBUG] No permission to create albums')
    error.value = 'You do not have permission to create albums'
    return
  }

  creating.value = true
  error.value = null

  try {
    const albumName = newAlbumName.value.trim()
    const albumDescription = newAlbumDescription.value.trim() || null
    const albumMonth = newAlbumMonth.value || null
    const albumYear = newAlbumYear.value || null

    console.log('[ALBUMS DEBUG] Album creation params:', {
      name: albumName,
      description: albumDescription,
      month: albumMonth,
      year: albumYear
    })

    const response = await apiService.createFolder(albumName, albumDescription, albumMonth, albumYear)
    console.log('[ALBUMS DEBUG] Create album response:', response)

    if (response.success) {
      closeDialog()
      await loadAlbums()
    } else {
      throw new Error(response.error || 'Failed to create album')
    }
  } catch (err) {
    console.error('[ALBUMS DEBUG] Create album error:', err)
    error.value = `Failed to create album: ${err.message}`
  } finally {
    creating.value = false
  }
}

const confirmDelete = (album) => {
  console.log('[ALBUMS DEBUG] Confirm delete called for album:', album.name)
  
  if (!authService.canPerformAction('delete_album')) {
    console.log('[ALBUMS DEBUG] No permission to delete albums')
    error.value = 'You do not have permission to delete albums'
    return
  }

  albumToDelete.value = album
  showDeleteDialog.value = true
  console.log('[ALBUMS DEBUG] Delete dialog shown for:', album.name)
}

const deleteAlbum = async () => {
  if (!albumToDelete.value) return

  console.log('[ALBUMS DEBUG] Deleting album:', albumToDelete.value.name)
  deleting.value = true
  error.value = null

  try {
    const response = await apiService.deleteFolder(BUCKET_NAME, albumToDelete.value.name)
    console.log('[ALBUMS DEBUG] Delete album response:', response)

    if (response.success) {
      await loadAlbums()
      closeDeleteDialog()
    } else {
      throw new Error(response.error || 'Failed to delete album')
    }
  } catch (err) {
    console.error('[ALBUMS DEBUG] Delete album error:', err)
    error.value = `Failed to delete album: ${err.message}`
  } finally {
    deleting.value = false
  }
}

const confirmRename = (album) => {
  console.log('[ALBUMS DEBUG] Confirm rename called for album:', album.name)
  
  if (!authService.canPerformAction('delete_album')) {
    console.log('[ALBUMS DEBUG] No permission to rename albums')
    error.value = 'You do not have permission to rename albums'
    return
  }

  albumToRename.value = album
  newAlbumNameForRename.value = album.name
  showRenameDialog.value = true
  console.log('[ALBUMS DEBUG] Rename dialog shown for:', album.name)
}

const renameAlbum = async () => {
  if (!albumToRename.value || !newAlbumNameForRename.value.trim()) return

  console.log('[ALBUMS DEBUG] Renaming album from:', albumToRename.value.name, 'to:', newAlbumNameForRename.value.trim())
  renaming.value = true
  error.value = null

  try {
    const response = await apiService.renameFolder(albumToRename.value.name, newAlbumNameForRename.value.trim())
    console.log('[ALBUMS DEBUG] Rename album response:', response)

    if (response.success) {
      await loadAlbums()
      closeRenameDialog()
    } else {
      throw new Error(response.error || 'Failed to rename album')
    }
  } catch (err) {
    console.error('[ALBUMS DEBUG] Rename album error:', err)
    error.value = `Failed to rename album: ${err.message}`
  } finally {
    renaming.value = false
  }
}

const openAlbum = (album) => {
  console.log('[ALBUMS DEBUG] Opening album:', album.name)
  emit('openAlbum', album)
}

const closeDialog = () => {
  console.log('[ALBUMS DEBUG] Closing create dialog')
  showCreateDialog.value = false
  newAlbumName.value = ''
  newAlbumDescription.value = ''
  newAlbumMonth.value = ''
  newAlbumYear.value = ''
  creating.value = false
}

const closeDeleteDialog = () => {
  console.log('[ALBUMS DEBUG] Closing delete dialog')
  showDeleteDialog.value = false
  albumToDelete.value = null
  deleting.value = false
}

const closeRenameDialog = () => {
  console.log('[ALBUMS DEBUG] Closing rename dialog')
  showRenameDialog.value = false
  albumToRename.value = null
  newAlbumNameForRename.value = ''
  renaming.value = false
}

const getAlbumDisplayName = (folderName) => {
  return folderName.replace(/\.+/g, ' ')
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  return new Date(dateString).toLocaleDateString()
}

const refreshAlbums = async () => {
  console.log('[ALBUMS DEBUG] Refreshing albums...')
  await loadAlbums()
}

// Focus input when dialog opens
const focusInput = async () => {
  await nextTick()
  if (albumNameInput.value) {
    albumNameInput.value.focus()
  }
}

watch(showCreateDialog, (newVal) => {
  if (newVal) {
    focusInput()
  }
})

const focusRenameInput = async () => {
  await nextTick()
  if (renameAlbumNameInput.value) {
    renameAlbumNameInput.value.focus()
    renameAlbumNameInput.value.select()
  }
}

watch(showRenameDialog, (newVal) => {
  if (newVal) {
    focusRenameInput()
  }
})

// Lifecycle
onMounted(() => {
  console.log('[ALBUMS DEBUG] Component mounted, loading albums...')
  loadAlbums()
})
</script>

<style scoped>
/* Ensure buttons have proper touch targets for mobile */
button {
  min-height: 44px;
}

/* Smooth transitions */
.transition {
  transition: all 0.2s ease-in-out;
}
</style>
