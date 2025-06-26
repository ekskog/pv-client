<template>
  <nav class="navigation">
    <div class="nav-container">
      <div class="nav-links">
        <button 
          class="nav-link"
          :class="{ active: currentView === 'home' }"
          @click="$emit('navigate', 'home')"
        >
          <i class="fas fa-home"></i> Home
        </button>
        <button 
          class="nav-link"
          :class="{ active: currentView === 'albums' }"
          @click="$emit('navigate', 'albums')"
        >
          <i class="fas fa-layer-group"></i> Albums
        </button>
        
        <!-- Admin only navigation -->
        <button 
          v-if="isAdmin"
          class="nav-link"
          :class="{ active: currentView === 'users' }"
          @click="$emit('navigate', 'users')"
        >
          <i class="fas fa-users"></i> Users
        </button>
      </div>

      <!-- User menu -->
      <div class="user-menu" @click="toggleUserDropdown" ref="userMenuRef">
        <div class="user-info">
          <div class="user-avatar">
            <i :class="isAdmin ? 'fas fa-crown' : 'fas fa-user'"></i>
          </div>
          <div class="user-details">
            <div class="user-name">{{ currentUser?.name || 'User' }}</div>
            <div class="user-role">{{ currentUser?.role || 'user' }}</div>
          </div>
          <i class="fas fa-chevron-down dropdown-arrow" :class="{ open: showUserDropdown }"></i>
        </div>
        
        <!-- User dropdown menu -->
        <div v-if="showUserDropdown" class="user-dropdown">
          <button class="dropdown-item" @click="changePassword">
            <i class="fas fa-key"></i>
            Change Password
          </button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item logout-item" @click="logout">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Password Change Dialog -->
    <PasswordChange
      v-if="showPasswordDialog"
      :user="currentUser"
      :show="showPasswordDialog"
      @close="closePasswordDialog"
      @success="handlePasswordSuccess"
    />
  </nav>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import authService from '../services/auth.js'
import PasswordChange from './PasswordChange.vue'

// Props
const props = defineProps({
  currentView: {
    type: String,
    default: 'home'
  },
  currentUser: {
    type: Object,
    default: null
  }
})

// Emits
const emit = defineEmits(['navigate', 'logout'])

// Reactive state
const showUserDropdown = ref(false)
const showPasswordDialog = ref(false)
const userMenuRef = ref(null)

// Computed properties
const isAdmin = computed(() => {
  return props.currentUser?.role === 'admin'
})

// Methods
const toggleUserDropdown = (event) => {
  event.stopPropagation()
  showUserDropdown.value = !showUserDropdown.value
}

const changePassword = () => {
  showUserDropdown.value = false
  showPasswordDialog.value = true
}

const closePasswordDialog = () => {
  showPasswordDialog.value = false
}

const handlePasswordSuccess = (data) => {
  // Show success message
  // If user changed their own password, they might need to re-authenticate
  if (data.isOwnPassword) {
    // In a real app, you might want to redirect to login
  }
}

const logout = () => {
  showUserDropdown.value = false
  emit('logout')
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target)) {
    showUserDropdown.value = false
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.navigation {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 2rem;
}

.nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.nav-links {
  display: flex;
  gap: 1rem;
}

.nav-link {
  background: none;
  border: none;
  padding: 1rem 1.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.nav-link:hover {
  color: #2196f3;
  background: #f8f9ff;
}

.nav-link.active {
  color: #2196f3;
  border-bottom-color: #2196f3;
  background: #f8f9ff;
}

.user-menu {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.user-info:hover {
  background: #f8f9fa;
}

.user-avatar {
  width: 36px;
  height: 36px;
  background: #e3f2fd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1976d2;
  font-size: 1rem;
}

.user-details {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
  line-height: 1.2;
}

.user-role {
  font-size: 0.75rem;
  color: #666;
  text-transform: capitalize;
  line-height: 1.2;
}

.dropdown-arrow {
  margin-left: 0.25rem;
  font-size: 0.75rem;
  color: #666;
  transition: transform 0.2s ease;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  z-index: 1000;
  margin-top: 0.5rem;
}

.dropdown-item {
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #333;
  transition: background-color 0.2s ease;
}

.dropdown-item:hover {
  background: #f8f9fa;
}

.dropdown-item:first-child {
  border-radius: 8px 8px 0 0;
}

.dropdown-item:last-child {
  border-radius: 0 0 8px 8px;
}

.dropdown-divider {
  height: 1px;
  background: #e0e0e0;
  margin: 0.25rem 0;
}

.logout-item {
  color: #f44336;
}

.logout-item:hover {
  background: #ffebee;
}

@media (max-width: 768px) {
  .navigation {
    padding: 0 1rem;
  }
  
  .nav-container {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 0;
  }
  
  .nav-links {
    gap: 0.5rem;
    justify-content: center;
  }
  
  .nav-link {
    padding: 0.875rem 1rem;
    font-size: 0.8rem;
  }

  .user-info {
    padding: 0;
  }

  .user-details {
    display: none;
  }
}

@media (max-width: 480px) {
  .navigation {
    padding: 0 0.5rem;
  }
  
  .nav-links {
    gap: 0.25rem;
  }
  
  .nav-link {
    padding: 0.75rem 0.75rem;
    font-size: 0.75rem;
  }
}
</style>
