<template>
  <div id="app">
    <!-- Show login screen if not authenticated -->
    <Login 
      v-if="!isAuthenticated"
      @login-success="handleLoginSuccess"
    />
    
    <!-- Main app when authenticated -->
    <div v-else>
      <AppHeader />
      <Navigation 
        :currentView="currentView"
        :currentUser="currentUser"
        @navigate="handleNavigation"
        @logout="handleLogout"
      />

      <main class="main">
        <!-- Home View -->
        <Home 
          v-if="currentView === 'home'"
          @navigate="handleNavigation"
        />

        <!-- Albums View -->
        <Albums 
          v-else-if="currentView === 'albums'"
          @navigate="handleNavigation"
          @openAlbum="handleAlbumOpen"
        />

        <!-- Album Detail View -->
        <AlbumDetail 
          v-else-if="currentView === 'album-detail'"
          :albumName="selectedAlbumName"
          @back="handleBackToAlbums"
          @photoOpened="handlePhotoOpen"
        />

        <!-- Bucket Explorer View -->
        <BucketExplorer 
          v-else-if="currentView === 'buckets'"
        />

        <!-- User Management View (Admin Only) -->
        <UserManagement 
          v-else-if="currentView === 'users'"
        />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import Navigation from './components/Navigation.vue'
import Home from './components/Home.vue'
import Albums from './components/Albums.vue'
import AlbumDetail from './components/AlbumDetail.vue'
import BucketExplorer from './components/BucketExplorer.vue'
import Login from './components/Login.vue'
import UserManagement from './components/UserManagement.vue'
import authService from './services/auth.js'

// Reactive state
const currentView = ref('home')
const selectedAlbumName = ref('')
const isAuthenticated = ref(false)
const currentUser = ref(null)

// Computed properties
const userRole = computed(() => currentUser.value?.role || 'user')

// Initialize auth service
onMounted(async () => {
  await authService.init()
  isAuthenticated.value = authService.isAuthenticated()
  currentUser.value = authService.getCurrentUser()
})

// Methods
const handleNavigation = (view) => {
  currentView.value = view
}

const handleAlbumOpen = (album) => {
  selectedAlbumName.value = album.name
  currentView.value = 'album-detail'
}

const handleBackToAlbums = () => {
  currentView.value = 'albums'
  selectedAlbumName.value = ''
}

const handlePhotoOpen = (photo) => {
  // TODO: Implement photo lightbox/viewer
}

const handleLoginSuccess = (user) => {
  currentUser.value = user
  isAuthenticated.value = true
  currentView.value = 'home'
}

const handleLogout = () => {
  authService.logout()
  currentUser.value = null
  isAuthenticated.value = false
  currentView.value = 'home'
}
</script>

<style scoped>
/* Minimalist HBVU PHOTOS Styles */
#app {
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #fafafa;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.logo {
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.health-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.healthy {
  background: #e8f5e8;
  color: #2e7d32;
}

.unhealthy {
  background: #fde8e8;
  color: #c62828;
}

.main {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  font-size: 1.1rem;
}

.error {
  color: #c62828;
  background: #fde8e8;
  border-radius: 8px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.buckets-section h2 {
  margin-bottom: 1rem;
  color: #333;
  font-weight: 500;
}

.buckets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.bucket-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bucket-card:hover {
  border-color: #2196f3;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.1);
}

.bucket-card.active {
  border-color: #2196f3;
  background: #f3f9ff;
}

.bucket-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.bucket-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.bucket-date {
  font-size: 0.875rem;
  color: #666;
}

.bucket-stats {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f0f0f0;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #888;
  font-weight: 500;
}

.stat-value {
  font-size: 0.75rem;
  color: #333;
  font-weight: 600;
}

.stat-item.loading .stat-label {
  color: #bbb;
  font-style: italic;
}

.stat-item.error .stat-label {
  color: #d32f2f;
  font-style: italic;
}

.contents-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e0e0e0;
}

.contents-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.contents-header h2 {
  margin: 0;
  color: #333;
}

.btn-primary {
  background: #2196f3;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.btn-primary:hover {
  background: #1976d2;
}

.btn-secondary {
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.breadcrumb {
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.breadcrumb-item {
  color: #2196f3;
  cursor: pointer;
  text-decoration: underline;
}

.separator {
  margin: 0 0.5rem;
  color: #666;
}

.contents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.folder-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  text-align: center;
}

.folder-item:hover {
  border-color: #2196f3;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.1);
}

.folder-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.folder-name {
  font-weight: 500;
  word-break: break-word;
}

.delete-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.folder-item:hover .delete-btn {
  opacity: 1;
}

.back-button {
  background: #f8f9fa;
  border-color: #dee2e6;
}

.modal-overlay {
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

.modal {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  min-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.modal input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 1rem;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
