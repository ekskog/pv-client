<template>
  <div class="max-w-3xl mx-auto p-8">
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center gap-2">
        <i class="fas fa-cog"></i> Settings
      </h1>
      <p class="text-gray-600 dark:text-gray-400">Configure your PhotoVault application settings</p>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <!-- API Configuration Section -->
      <div class="p-8 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-6">
          <i class="fas fa-server"></i> API Configuration
        </h2>

        <div class="mb-6">
          <label for="apiUrl" class="block mb-2 font-semibold text-gray-800 dark:text-gray-100">API Server URL</label>
          <div class="flex flex-col md:flex-row gap-2">
            <input
              id="apiUrl"
              v-model="formData.apiUrl"
              type="url"
              placeholder="https://vault-api.hbvu.su"
              :class="[
                'flex-1 px-4 py-3 border rounded-md text-base transition-colors',
                validationErrors.apiUrl ? 'border-red-500' : 'border-gray-300 focus:border-blue-500',
                'dark:bg-gray-900 dark:text-white dark:border-gray-600'
              ]"
            />
            <button
              @click="testConnection"
              class="px-4 py-3 bg-gray-600 text-white rounded-md font-semibold flex items-center gap-2 disabled:opacity-60"
              :disabled="isTestingConnection"
            >
              <i class="fas fa-plug" v-if="!isTestingConnection"></i>
              <i class="fas fa-spinner fa-spin" v-else></i>
              Test
            </button>
          </div>
          <div v-if="validationErrors.apiUrl" class="mt-2 text-sm text-red-600">
            {{ validationErrors.apiUrl }}
          </div>
          <div
            v-if="connectionTestResult"
            :class="[
              'mt-2 p-2 rounded text-sm flex items-center gap-2',
              connectionTestResult.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            ]"
          >
            <i :class="connectionTestResult.icon"></i>
            {{ connectionTestResult.message }}
          </div>
        </div>

        <div>
          <label class="block mb-2 font-semibold text-gray-800 dark:text-gray-100">Current API URL</label>
          <div class="px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-gray-600 dark:text-gray-300">
            {{ currentConfig.apiUrl }}
          </div>
        </div>
      </div>

      <!-- Admin-Assisted Password Reset -->
      <div class="p-8 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-6">
          <i class="fas fa-user-shield"></i> Admin: Reset User Password
        </h2>

        <div class="mb-6">
          <label for="selectedUser" class="block mb-2 font-semibold text-gray-800 dark:text-gray-100">Select User</label>
          <select
            id="selectedUser"
            v-model="selectedUserId"
            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-900 dark:text-white"
            :disabled="isLoadingUsers"
          >
            <option value="">-- Choose a user --</option>
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.username }} ({{ user.email }})
            </option>
          </select>
        </div>

        <div class="mb-6">
          <label for="newPassword" class="block mb-2 font-semibold text-gray-800 dark:text-gray-100">New Password</label>
          <input
            id="newPassword"
            v-model="newPassword"
            type="password"
            placeholder="Enter new password"
            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-900 dark:text-white"
          />
        </div>

        <button
          @click="resetUserPassword"
          class="px-4 py-3 bg-red-600 text-white rounded-md font-semibold flex items-center gap-2 disabled:opacity-60"
          :disabled="!selectedUserId || !newPassword || isResettingPassword"
        >
          <i class="fas fa-key" v-if="!isResettingPassword"></i>
          <i class="fas fa-spinner fa-spin" v-else></i>
          Reset Password
        </button>

        <div
          v-if="passwordResetMessage"
          :class="[
            'mt-4 p-3 rounded flex items-center gap-2 font-medium',
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
      <div class="p-8 bg-gray-100 dark:bg-gray-700 flex flex-wrap gap-4">
        <button
          @click="saveSettings"
          class="px-4 py-3 bg-blue-600 text-white rounded-md font-semibold flex items-center gap-2 disabled:opacity-60"
          :disabled="isSaving || !hasChanges"
        >
          <i class="fas fa-save" v-if="!isSaving"></i>
          <i class="fas fa-spinner fa-spin" v-else></i>
          Save Settings
        </button>

        <button
          @click="resetToDefaults"
          class="px-4 py-3 bg-yellow-400 text-gray-900 rounded-md font-semibold flex items-center gap-2 disabled:opacity-60"
          :disabled="isSaving"
        >
          <i class="fas fa-undo"></i>
          Reset to Defaults
        </button>

        <button
          @click="reloadApplication"
          class="px-4 py-3 bg-cyan-600 text-white rounded-md font-semibold flex items-center gap-2"
          v-if="requiresReload"
        >
          <i class="fas fa-refresh"></i>
          Reload Application
        </button>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <div
      v-if="message"
      :class="[
        'mt-6 p-4 rounded flex items-center gap-2 font-medium',
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
