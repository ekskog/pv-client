<template>
  <div id="app" class="min-h-screen font-sans bg-gray-50">
    <!-- Header visible to all users -->
    <AppHeader
      :currentView="currentView"
      :currentUser="currentUser"
      :isAuthenticated="isAuthenticated"
      @navigate="handleNavigation"
      @logout="handleLogout"
      @login="handleLoginTrigger"
      @register="handleRegisterTrigger"
    />

    <!-- Main content: accessible to guests and logged-in users -->
    <main class="px-6 py-8 max-w-screen-xl mx-auto">
      <Home v-if="currentView === 'home'" @navigate="handleNavigation" />
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
        v-if="isAuthenticated"
      />
      <Settings v-else-if="currentView === 'settings'" v-if="isAuthenticated" />
    </main>

    <!-- Login modal only appears when triggered -->
    <Login
      v-if="showLogin"
      @login-success="handleLoginSuccess"
      @close="handleLoginClose"
    />

    <!-- Register modal only appears when triggered -->
    <Register
      v-if="showRegister"
      @register-success="handleRegisterSuccess"
      @close="handleRegisterClose"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import AppHeader from "./components/AppHeader.vue";
import Home from "./components/Home.vue";
import Albums from "./components/Albums.vue";
import AlbumDetail from "./components/AlbumDetail.vue";
import Login from "./components/Login.vue";
import UserManagement from "./components/UserManagement.vue";
import Settings from "./components/Settings.vue";
import Register from "./components/Register.vue";
import authService from "./services/auth.js";

// Reactive state
const currentView = ref("home");
const selectedAlbumName = ref("");
const showLogin = ref(false);
const showRegister = ref(false);
const isAuthenticated = ref(false);
const currentUser = ref(null);
const userRole = computed(() => currentUser.value?.role || "guest");

// Lifecycle
onMounted(async () => {
  await authService.init();
  updateAuthState();
  currentView.value = isAuthenticated.value ? "albums" : "home";
  window.addEventListener("storage", handleStorageChange);
});

onUnmounted(() => {
  window.removeEventListener("storage", handleStorageChange);
});

// Auth state
const updateAuthState = () => {
  isAuthenticated.value = authService.isAuthenticated();
  currentUser.value = authService.getCurrentUser();
};

const handleStorageChange = (event) => {
  if (event.key === "hbvu_auth_token" && !event.newValue) {
    updateAuthState();
  }
};

// Navigation
const handleNavigation = (view) => {
  currentView.value = view;
};

const handleAlbumOpen = (album) => {
  selectedAlbumName.value = album.name;
  currentView.value = "album-detail";
};

const handleBackToAlbums = () => {
  selectedAlbumName.value = "";
  currentView.value = "albums";
};

const handlePhotoOpen = (photo) => {
  // TODO: Show lightbox or photo viewer
};

// Login flow
const handleLoginTrigger = () => {
  showLogin.value = true;
};

const handleLoginClose = () => {
  showLogin.value = false;
};

const handleLoginSuccess = () => {
  showLogin.value = false;
  updateAuthState();
  currentView.value = "home";
};

// Register flow
const handleRegisterTrigger = () => {
  showRegister.value = true;
};

const handleRegisterClose = () => {
  showRegister.value = false;
};

const handleRegisterSuccess = () => {
  showRegister.value = false;
  showLogin.value = true;
};

// Logout
const handleLogout = () => {
  authService.logout();
  updateAuthState();
  currentView.value = "home";
};
</script>
