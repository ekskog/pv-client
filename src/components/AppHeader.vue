<template>
  <header class="header">
    <!-- Home Shortcut -->
    <div class="logo" @click="$emit('navigate', 'home')">
      <i class="fas fa-camera"></i>
    </div>

    <!-- Navigation Buttons -->
    <div class="nav-links">
      <button 
        class="nav-link"
        :class="{ active: currentView === 'albums' }"
        @click="$emit('navigate', 'albums')"
      >
        <i class="fas fa-layer-group"></i> Albums
      </button>
      <button 
        v-if="isAdmin"
        class="nav-link"
        :class="{ active: currentView === 'settings' }"
        @click="$emit('navigate', 'settings')"
      >
        <i class="fas fa-cog"></i> Settings
      </button>
    </div>

    <!-- Status + User Menu -->
    <div class="header-right">
      <div class="health-status" :class="{ healthy: isHealthy, unhealthy: !isHealthy }">
        {{ healthStatus }}
      </div>
      <div class="user-menu" @click="toggleUserDropdown" ref="userMenuRef">
        <div class="user-info">
          <div class="user-avatar">
            <i class="fas fa-user-circle"></i>
          </div>
          <div class="user-details">
            <div class="user-name">{{ currentUser?.name || 'User' }}</div>
          </div>
          <i class="fas fa-chevron-down dropdown-arrow" :class="{ open: showUserDropdown }"></i>
        </div>

        <!-- Dropdown -->
        <div v-if="showUserDropdown" class="user-dropdown">
          <button class="dropdown-item" @click="changePassword">
            <i class="fas fa-key"></i> Change Password
          </button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item logout-item" @click="logout">
            <i class="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Password Dialog -->
    <PasswordChange
      v-if="showPasswordDialog"
      :user="currentUser"
      :show="showPasswordDialog"
      @close="closePasswordDialog"
      @success="handlePasswordSuccess"
    />
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import apiService from '../services/api.js'
import PasswordChange from './PasswordChange.vue'

const props = defineProps({
  currentView: String,
  currentUser: Object
})
const emit = defineEmits(['navigate', 'logout'])

const isHealthy = ref(false)
const healthStatus = ref('Checking...')
const checkHealth = async () => {
  try {
    const health = await apiService.getHealth()
    isHealthy.value = health.status === 'healthy'
    healthStatus.value = isHealthy.value ? 'Connected' : 'Disconnected'
  } catch {
    isHealthy.value = false
    healthStatus.value = 'Offline'
  }
}
onMounted(() => checkHealth())

const isAdmin = computed(() => props.currentUser?.role === 'admin')
const showUserDropdown = ref(false)
const showPasswordDialog = ref(false)
const userMenuRef = ref(null)

const toggleUserDropdown = (e) => {
  e.stopPropagation()
  showUserDropdown.value = !showUserDropdown.value
}
const changePassword = () => {
  showUserDropdown.value = false
  showPasswordDialog.value = true
}
const closePasswordDialog = () => showPasswordDialog.value = false
const handlePasswordSuccess = () => showPasswordDialog.value = false
const logout = () => {
  showUserDropdown.value = false
  emit('logout')
}
const handleClickOutside = (e) => {
  if (userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    showUserDropdown.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 1rem 2rem;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.logo {
  font-size: 1.5rem;
  color: #333;
  cursor: pointer;
}
.logo i {
  font-size: 1.8rem;
  color: #4a90e2;
}
.logo i:hover {
  color: #357abd;
}

.nav-links {
  display: flex;
  gap: 1rem;
}
.nav-link {
  background: none;
  border: none;
  padding: 0.75rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #666;
  border-bottom: 2px solid transparent;
}
.nav-link:hover,
.nav-link.active {
  color: #2196f3;
  background: #f8f9ff;
  border-bottom-color: #2196f3;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
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

.user-menu {
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.user-avatar {
  width: 32px;
  height: 32px;
  background: #e3f2fd;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #1976d2;
}
.user-details {
  display: flex;
  flex-direction: column;
}
.user-name {
  font-size: 0.875rem;
  font-weight: 600;
}
.dropdown-arrow {
  font-size: 0.75rem;
  transition: transform 0.2s;
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
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 180px;
  z-index: 1000;
  margin-top: 0.5rem;
}
.dropdown-item {
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #333;
}
.dropdown-item:hover {
  background: #f8f9fa;
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

@media (max-width: 480px) {
  .header {
    padding: 1rem;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .nav-links {
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .nav-link {
    flex: 1 0 40%;
    padding: 0.6rem 0.5rem;
    font-size: 0.75rem;
  }

  .user-details {
    display: none;
  }

  .dropdown-arrow {
    margin-left: 0;
  }
}
</style>
