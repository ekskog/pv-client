<template>
  <div class="albums">
    <div class="albums-header">
      <div class="header-content">
        <h1>Photo Albums</h1>
        <p class="subtitle">Organize your photos into albums</p>
      </div>
      <div class="header-actions">
        <button 
          class="btn-secondary"
          @click="refreshAlbums" 
          :disabled="loading"
          title="Refresh albums"
        >
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i> Refresh
        </button>
        <button 
          v-if="canCreateAlbum"
          class="btn-primary" 
          @click="showCreateDialog = true"
        >
          <i class="fas fa-plus"></i> Create New Album
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading albums...</p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error">
      <p><i class="fas fa-exclamation-triangle"></i> {{ error }}</p>
      <button class="btn-secondary" @click="loadAlbums">Try Again</button>
    </div>

    <!-- Albums Grid -->
    <div v-if="!loading && !error" class="albums-grid">
      <div 
        v-for="album in albums" 
        :key="album.name"
        class="album-card"
        @click="openAlbum(album)"
      >
        <div class="album-icon"><i class="fas fa-images"></i></div>
        <h3>{{ getAlbumDisplayName(album.name) }}</h3>
        <p class="album-info">
          {{ album.fileCount || 0 }} photos
        </p>
        <p class="album-date">
          Created {{ formatDate(album.lastModified) }}
        </p>
        <div class="album-actions">
          <button 
            v-if="canDeleteAlbum"
            class="btn-danger-small" 
            @click.stop="confirmDelete(album)"
            title="Delete Album"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="albums.length === 0" class="empty-state">
        <div class="empty-icon"><i class="fas fa-camera"></i></div>
        <h3>No Albums Yet</h3>
        <p v-if="canCreateAlbum">Create your first photo album to get started!</p>
        <p v-else>No albums available to view.</p>
        <button 
          v-if="canCreateAlbum"
          class="btn-primary" 
          @click="showCreateDialog = true"
        >
          Create Album
        </button>
      </div>
    </div>

    <!-- Create Album Dialog -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click="closeDialog">
      <div class="dialog" @click.stop>
        <h3>Create New Album</h3>
        <div class="form-group">
          <label for="albumName">Album Name:</label>
          <input 
            id="albumName"
            v-model="newAlbumName" 
            type="text" 
            placeholder="Enter album name..."
            @keyup.enter="createAlbum"
            ref="albumNameInput"
          />
        </div>
        <div class="dialog-actions">
          <button class="btn-secondary" @click="closeDialog">Cancel</button>
          <button 
            class="btn-primary" 
            @click="createAlbum"
            :disabled="!newAlbumName.trim() || creating"
          >
            {{ creating ? 'Creating...' : 'Create Album' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteDialog" class="dialog-overlay" @click="closeDeleteDialog">
      <div class="dialog" @click.stop>
        <h3>Delete Album</h3>
        <p>Are you sure you want to delete the album "<strong>{{ getAlbumDisplayName(albumToDelete?.name) }}</strong>"?</p>
        <p class="warning"><i class="fas fa-exclamation-triangle"></i> This action cannot be undone and will delete all photos in this album.</p>
        <div class="dialog-actions">
          <button class="btn-secondary" @click="closeDeleteDialog">Cancel</button>
          <button 
            class="btn-danger" 
            @click="deleteAlbum"
            :disabled="deleting"
          >
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
    const response = await apiService.getBucketContents(BUCKET_NAME)
    
    if (response.success && response.data) {
      
      // Filter only folders (albums) from the response
      // Check both folders array and objects array for folder-like items
      const foldersFromFolders = response.data.folders || []
      const foldersFromObjects = (response.data.objects || []).filter(obj => 
        obj.name && obj.name.endsWith('/') && obj.name !== '/'
      ).map(obj => ({
        ...obj,
        name: obj.name.replace(/\/$/, '') // Remove trailing slash for display
      }))
      
      const foundAlbums = [...foldersFromFolders, ...foldersFromObjects]
      
      // For each album, fetch the files inside to get the earliest creation date
      const albumsWithDates = await Promise.all(foundAlbums.map(async (album) => {
        try {
          // Use the album name directly like AlbumDetail does
          let cleanAlbumName = album.name.trim()
          cleanAlbumName = cleanAlbumName.replace(/\/+$/, '')
          const prefix = cleanAlbumName + '/'
          
          const albumResponse = await apiService.getBucketContents(BUCKET_NAME, prefix)
          if (albumResponse.success && albumResponse.data && albumResponse.data.objects) {
            const files = albumResponse.data.objects.filter(obj => 
              obj.name && !obj.name.endsWith('/')
            )
            
            // Find the earliest file date (album creation date)
            if (files.length > 0) {
              const earliestDate = files.reduce((earliest, file) => {
                if (!file.lastModified) return earliest
                const fileDate = new Date(file.lastModified)
                return !earliest || fileDate < earliest ? fileDate : earliest
              }, null)
              
              // Count actual photos using the same logic as AlbumDetail
              // Filter out folders and JSON metadata files, then count all image files
              const imageFiles = files.filter(obj => {
                // Only exclude folders (names ending with '/')
                if (obj.name && obj.name.endsWith('/')) return false
                
                // Skip metadata JSON files from the count
                if (obj.name.endsWith('.json') && obj.name.includes('/')) {
                  const pathParts = obj.name.split('/')
                  const fileName = pathParts[pathParts.length - 1]
                  const folderName = pathParts[pathParts.length - 2]
                  if (fileName === `${folderName}.json`) {
                    return false
                  }
                }
                
                // Skip thumbnail files from the count
                if (obj.name.includes('_thumb.')) {
                  return false
                }
                
                return true
              })
              
              const actualPhotoCount = imageFiles.length
              
              return {
                ...album,
                lastModified: earliestDate?.toISOString(),
                fileCount: actualPhotoCount
              }
            }
          }
          return { ...album, lastModified: null, fileCount: 0 }
        } catch (err) {
          console.warn(`Failed to get file dates for album ${album.name}:`, err)
          return { ...album, lastModified: null, fileCount: 0 }
        }
      }))
      
      albums.value = albumsWithDates
    } else {
      throw new Error(response.error || 'Failed to load albums - API returned unsuccessful response')
    }
  } catch (err) {
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
  return folderName.replace(/\/$/, '')
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

<style scoped>
.albums {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.albums-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-content {
  text-align: left;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.albums-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #333;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  font-size: 1.1rem;
  color: #666;
  margin: 0 0 2rem 0;
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
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
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

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.fa-spin {
  animation: fa-spin 1s infinite linear;
}

@keyframes fa-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

.btn-danger-small {
  background: #f44336;
  color: white;
  border: none;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

.btn-danger-small:hover {
  background: #d32f2f;
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

.albums-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
}

.album-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
}

.album-card:hover {
  border-color: #2196f3;
  box-shadow: 0 4px 16px rgba(33, 150, 243, 0.1);
  transform: translateY(-2px);
}

.album-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.album-card h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  margin: 0 0 0.5rem 0;
}

.album-info {
  font-size: 0.9rem;
  color: #2196f3;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
}

.album-date {
  font-size: 0.8rem;
  color: #999;
  margin: 0 0 1rem 0;
}

.album-actions {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.album-card:hover .album-actions {
  opacity: 1;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon {
  font-size: 4rem;
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
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.dialog h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
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
  .albums {
    padding: 1rem;
  }
  
  .albums-header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  
  .header-content {
    text-align: center;
  }
  
  .header-actions {
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .albums-header h1 {
    font-size: 2rem;
  }
  
  .albums-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .dialog {
    min-width: auto;
    margin: 1rem;
  }
  
  .dialog-actions {
    flex-direction: column;
  }
}
</style>
