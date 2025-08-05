<template>
  <div id="app">
    <!-- Show login screen if not authenticated -->
    <Login 
      v-if="!isAuthenticated"
      @login-success="handleLoginSuccess"
    />

    <!-- Main app when authenticated -->
    <div v-else>
      <AppHeader
        :currentView="currentView"
        :currentUser="currentUser"
        @navigate="handleNavigation"
        @logout="handleLogout"
      />

      <main class="main">
        <Home 
          v-if="currentView === 'home'"
          @navigate="handleNavigation"
        />
        <Albums 
          v-else-if="currentView === 'albums'"
          @navigate="handleNavigation"
          @openAlbum="handleAlbumOpen"
        />
        <AlbumDetail 
          v-else-if="currentView === 'album-detail'"
          :albumName="selectedAlbumName"
          @back="handleBackToAlbums"
          @photoOpened="handlePhotoOpen"
        />
        <UserManagement 
          v-else-if="currentView === 'users'"
        />
        <Settings 
          v-else-if="currentView === 'settings'"
        />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import Home from './components/Home.vue'
import Albums from './components/Albums.vue'
import AlbumDetail from './components/AlbumDetail.vue'
import Login from './components/Login.vue'
import UserManagement from './components/UserManagement.vue'
import Settings from './components/Settings.vue'
import authService from './services/auth.js'

// State
const currentView = ref('home')
const selectedAlbumName = ref('')
const isAuthenticated = ref(false)
const currentUser = ref(null)
const userRole = computed(() => currentUser.value?.role || 'user')

// Lifecycle
onMounted(async () => {
  await authService.init()
  updateAuthState()
  window.addEventListener('storage', handleStorageChange)
})
onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
})

// Auth
const updateAuthState = () => {
  isAuthenticated.value = authService.isAuthenticated()
  currentUser.value = authService.getCurrentUser()
}
const handleStorageChange = (event) => {
  if (event.key === 'hbvu_auth_token' && !event.newValue) {
    updateAuthState()
  }
}

// Handlers
const handleNavigation = (view) => currentView.value = view
const handleAlbumOpen = (album) => {
  selectedAlbumName.value = album.name
  currentView.value = 'album-detail'
}
const handleBackToAlbums = () => {
  selectedAlbumName.value = ''
  currentView.value = 'albums'
}
const handlePhotoOpen = (photo) => {
  // TODO: show photo lightbox if needed
}
const handleLoginSuccess = () => {
  updateAuthState()
  currentView.value = 'home'
}
const handleLogout = () => {
  authService.logout()
  updateAuthState()
  currentView.value = 'home'
}
</script>

<style scoped>
#app {
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #fafafa;
}

.main {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
