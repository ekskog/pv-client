<template>
  <div class="max-w-4xl mx-auto px-6 py-10">
    <!-- Header -->
    <div class="mb-10 text-center">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-3">
        <i class="fas fa-cog text-blue-500"></i> Settings
      </h1>
      <p class="text-gray-600 dark:text-gray-400 text-sm mt-2">
        Configure your PhotoVault application settings
      </p>
    </div>

    <!-- Card -->
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">

      <!-- Admin Password Reset -->
      <div class="px-8 py-10 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-8">
          <i class="fas fa-user-shield text-indigo-500"></i> Admin: Reset User Password
        </h2>

        <!-- Select User -->
        <div class="mb-6">
          <label for="selectedUser" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Select User
          </label>
          <select
            id="selectedUser"
            v-model="selectedUserId"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="isLoadingUsers"
          >
            <option value="">-- Choose a user --</option>
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.username }} ({{ user.email }})
            </option>
          </select>
        </div>

        <!-- New Password -->
        <div class="mb-6">
          <label for="newPassword" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            New Password
          </label>
          <input
            id="newPassword"
            v-model="newPassword"
            type="password"
            placeholder="Enter new password"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Reset Button -->
        <button
          @click="resetUserPassword"
          class="inline-flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-60"
          :disabled="!selectedUserId || !newPassword || isResettingPassword"
        >
          <i class="fas fa-key" v-if="!isResettingPassword"></i>
          <i class="fas fa-spinner fa-spin" v-else></i>
          Reset Password
        </button>

        <!-- Feedback Message -->
        <div
          v-if="passwordResetMessage"
          :class="[
            'mt-6 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium',
            passwordResetMessage.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          ]"
        >
          <i :class="passwordResetMessage.icon"></i>
          {{ passwordResetMessage.text }}
        </div>
      </div>

      <!-- Actions -->
      <div class="px-8 py-6 bg-gray-50 dark:bg-gray-800 flex flex-wrap gap-4">
        <button
          @click="saveSettings"
          class="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          :disabled="isSaving || !hasChanges"
        >
          <i class="fas fa-save" v-if="!isSaving"></i>
          <i class="fas fa-spinner fa-spin" v-else></i>
          Save Settings
        </button>

        <button
          @click="resetToDefaults"
          class="inline-flex items-center gap-2 px-5 py-3 bg-yellow-400 text-gray-900 rounded-lg font-semibold hover:bg-yellow-500 transition disabled:opacity-60"
          :disabled="isSaving"
        >
          <i class="fas fa-undo"></i>
          Reset to Defaults
        </button>

        <button
          @click="reloadApplication"
          class="inline-flex items-center gap-2 px-5 py-3 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
          v-if="requiresReload"
        >
          <i class="fas fa-refresh"></i>
          Reload Application
        </button>
      </div>
    </div>

    <!-- Global Message -->
    <div
      v-if="message"
      :class="[
        'mt-8 px-5 py-4 rounded-lg flex items-center gap-2 text-sm font-medium',
        message.type === 'success'
          ? 'bg-green-100 text-green-800 border border-green-300'
          : 'bg-red-100 text-red-800 border border-red-300'
      ]"
    >
      <i :class="message.icon"></i>
      {{ message.text }}
    </div>
  </div>
</template>



<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import configService from '../services/config.js'

// Reactive state
const currentConfig = ref({})
const originalConfig = ref({}) // Store original for comparison
const formData = reactive({
  apiUrl: ''
})
const validationErrors = reactive({})
const message = ref(null)
const isTestingConnection = ref(false)
const isSaving = ref(false)
const connectionTestResult = ref(null)
const requiresReload = ref(false)

const users = ref([])
const selectedUserId = ref('')
const newPassword = ref('')
const isLoadingUsers = ref(false)
const isResettingPassword = ref(false)
const passwordResetMessage = ref(null)

// Computed
const hasChanges = computed(() => {
  return formData.apiUrl !== originalConfig.value.apiUrl
})

// Methods
const loadCurrentConfig = () => {
  currentConfig.value = config
  originalConfig.value = { ...config } // Store a copy for comparison
  formData.apiUrl = config.apiUrl
}

const validateForm = () => {
  const errors = {}

  // Validate API URL
  if (!formData.apiUrl) {
    errors.apiUrl = 'API URL is required'
  } else {
    try {
      new URL(formData.apiUrl)
    } catch (e) {
      errors.apiUrl = 'Please enter a valid URL'
    }
  }

  Object.assign(validationErrors, errors)
  return Object.keys(errors).length === 0
}

const testConnection = async () => {
  if (!validateForm()) return

  isTestingConnection.value = true
  connectionTestResult.value = null

  try {
    const result = await configService.testApiConnection(formData.apiUrl)

    if (result.success) {
      connectionTestResult.value = {
        type: 'success',
        icon: 'fas fa-check-circle',
        message: 'Connection successful!'
      }
    } else {
      connectionTestResult.value = {
        type: 'error',
        icon: 'fas fa-exclamation-circle',
        message: `Connection failed: ${result.error || 'Unknown error'}`
      }
    }
  } catch (error) {
    connectionTestResult.value = {
      type: 'error',
      icon: 'fas fa-exclamation-circle',
      message: `Test failed: ${error.message}`
    }
  } finally {
    isTestingConnection.value = false
  }
}

const saveSettings = async () => {
  if (!validateForm()) return

  isSaving.value = true
  message.value = null

  try {
    const success = configService.saveConfig({
      apiUrl: formData.apiUrl
    })

    if (success) {
      message.value = {
        type: 'success',
        icon: 'fas fa-check-circle',
        text: 'Settings saved successfully!'
      }

      // Check if API URL changed (requires reload)
      if (formData.apiUrl !== originalConfig.value.apiUrl) {
        requiresReload.value = true
      }

      loadCurrentConfig()

      // Clear message after 3 seconds
      setTimeout(() => {
        message.value = null
      }, 3000)
    } else {
      throw new Error('Failed to save configuration')
    }
  } catch (error) {
    message.value = {
      type: 'error',
      icon: 'fas fa-exclamation-circle',
      text: `Failed to save settings: ${error.message}`
    }
  } finally {
    isSaving.value = false
  }
}

const resetToDefaults = () => {
  if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
    configService.reset()
    loadCurrentConfig()
    requiresReload.value = true

    message.value = {
      type: 'success',
      icon: 'fas fa-check-circle',
      text: 'Settings reset to defaults!'
    }

    setTimeout(() => {
      message.value = null
    }, 3000)
  }
}

const fetchUsers = async () => {
  isLoadingUsers.value = true
  passwordResetMessage.value = null

  try {
    const response = await fetch(`${formData.apiUrl}/auth/users`, {
      headers: { Authorization: `Bearer ${configService.getToken()}` }
    })
    const data = await response.json()
    if (response.ok) {
      users.value = data.users
    } else {
      throw new Error(data.error || 'Failed to fetch users')
    }
  } catch (error) {
    passwordResetMessage.value = {
      type: 'error',
      icon: 'fas fa-exclamation-triangle',
      text: `Error fetching users: ${error.message}`
    }
  } finally {
    isLoadingUsers.value = false
  }
}

const resetUserPassword = async () => {
  if (!selectedUserId.value || !newPassword.value) return
  isResettingPassword.value = true
  passwordResetMessage.value = null

  try {
    const response = await fetch(`${formData.apiUrl}/auth/users/${selectedUserId.value}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${configService.getToken()}`
      },
      body: JSON.stringify({ newPassword: newPassword.value })
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Failed to reset password')

    passwordResetMessage.value = {
      type: 'success',
      icon: 'fas fa-check-circle',
      text: `Password reset for user ID ${selectedUserId.value} successful`
    }
    newPassword.value = ''
  } catch (error) {
    passwordResetMessage.value = {
      type: 'error',
      icon: 'fas fa-exclamation-circle',
      text: `Error: ${error.message}`
    }
  } finally {
    isResettingPassword.value = false
  }
}

const reloadApplication = () => {
  window.location.reload()
}

// Lifecycle
onMounted(() => {
  loadCurrentConfig()
  loadCurrentConfig()
  fetchUsers()
})
</script>
