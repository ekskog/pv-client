<template>
  <div class="settings">
    <div class="settings-header">
      <h1><i class="fas fa-cog"></i> Settings</h1>
      <p>Configure your PhotoVault application settings</p>
    </div>

    <div class="settings-content">
      <!-- API Configuration Section -->
      <div class="settings-section">
        <h2><i class="fas fa-server"></i> API Configuration</h2>

        <div class="form-group">
          <label for="apiUrl">API Server URL</label>
          <div class="input-group">
            <input id="apiUrl" v-model="formData.apiUrl" type="url" placeholder="https://vault-api.hbvu.su"
              class="form-input" :class="{ error: validationErrors.apiUrl }" />
            <button @click="testConnection" class="btn btn-secondary" :disabled="isTestingConnection">
              <i class="fas fa-plug" v-if="!isTestingConnection"></i>
              <i class="fas fa-spinner fa-spin" v-else></i>
              Test
            </button>
          </div>
          <div v-if="validationErrors.apiUrl" class="error-message">
            {{ validationErrors.apiUrl }}
          </div>
          <div v-if="connectionTestResult" class="test-result" :class="connectionTestResult.type">
            <i :class="connectionTestResult.icon"></i>
            {{ connectionTestResult.message }}
          </div>
        </div>

        <div class="form-group">
          <label>Current API URL</label>
          <div class="current-value">{{ currentConfig.apiUrl }}</div>
        </div>
      </div>

      <!-- Admin-Assisted Password Reset -->
      <div class="settings-section">
        <h2><i class="fas fa-user-shield"></i> Admin: Reset User Password</h2>

        <div class="form-group">
          <label for="selectedUser">Select User</label>
          <select id="selectedUser" v-model="selectedUserId" class="form-input" :disabled="isLoadingUsers">
            <option value="">-- Choose a user --</option>
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.username }} ({{ user.email }})
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="newPassword">New Password</label>
          <input id="newPassword" v-model="newPassword" type="password" placeholder="Enter new password"
            class="form-input" />
        </div>

        <button @click="resetUserPassword" class="btn btn-danger"
          :disabled="!selectedUserId || !newPassword || isResettingPassword">
          <i class="fas fa-key" v-if="!isResettingPassword"></i>
          <i class="fas fa-spinner fa-spin" v-else></i>
          Reset Password
        </button>

        <div v-if="passwordResetMessage" class="message" :class="passwordResetMessage.type">
          <i :class="passwordResetMessage.icon"></i>
          {{ passwordResetMessage.text }}
        </div>
      </div>


      <!-- Actions -->
      <div class="settings-actions">
        <button @click="saveSettings" class="btn btn-primary" :disabled="isSaving || !hasChanges">
          <i class="fas fa-save" v-if="!isSaving"></i>
          <i class="fas fa-spinner fa-spin" v-else></i>
          Save Settings
        </button>

        <button @click="resetToDefaults" class="btn btn-warning" :disabled="isSaving">
          <i class="fas fa-undo"></i>
          Reset to Defaults
        </button>

        <button @click="reloadApplication" class="btn btn-info" v-if="requiresReload">
          <i class="fas fa-refresh"></i>
          Reload Application
        </button>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="message" class="message" :class="message.type">
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
  const config = configService.getConfig()
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

<style scoped>
.settings {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.settings-header {
  margin-bottom: 2rem;
  text-align: center;
}

.settings-header h1 {
  color: #333;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.settings-header p {
  color: #666;
  margin: 0;
}

.settings-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.settings-section {
  padding: 2rem;
  border-bottom: 1px solid #e0e0e0;
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section h2 {
  color: #333;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

.input-group {
  display: flex;
  gap: 0.5rem;
}

.form-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #007bff;
}

.form-input.error {
  border-color: #dc3545;
}

.current-value {
  padding: 0.75rem;
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-family: monospace;
  color: #666;
}

.help-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #666;
  line-height: 1.4;
}

.error-message {
  margin-top: 0.5rem;
  color: #dc3545;
  font-size: 0.875rem;
}

.test-result {
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.test-result.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.test-result.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6ca;
}

.settings-actions {
  padding: 2rem;
  background: #f8f9fa;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-warning {
  background: #ffc107;
  color: #212529;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
}

.btn-info {
  background: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background: #117a8b;
}

.message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

@media (max-width: 768px) {
  .settings {
    padding: 1rem;
  }

  .settings-section {
    padding: 1.5rem;
  }

  .settings-actions {
    padding: 1.5rem;
    flex-direction: column;
  }

  .input-group {
    flex-direction: column;
  }
}
</style>
