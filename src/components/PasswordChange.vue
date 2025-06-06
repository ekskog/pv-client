<template>
  <div class="password-change-overlay" @click="closeDialog">
    <div class="password-change-dialog" @click.stop>
      <div class="dialog-header">
        <h3>
          <i class="fas fa-key"></i>
          Change Password
        </h3>
        <button class="close-btn" @click="closeDialog">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="dialog-body">
        <div v-if="isOwnPassword" class="info-banner">
          <i class="fas fa-info-circle"></i>
          You are changing your own password. You will need to log in again after changing it.
        </div>

        <div v-else class="info-banner admin-banner">
          <i class="fas fa-shield-alt"></i>
          You are changing the password for <strong>{{ user?.name || user?.username }}</strong>
        </div>

        <form @submit.prevent="changePassword" class="password-form">
          <!-- Current Password (only for own password) -->
          <div v-if="isOwnPassword" class="form-group">
            <label for="currentPassword">Current Password:</label>
            <div class="password-input">
              <input
                id="currentPassword"
                v-model="currentPassword"
                :type="showCurrentPassword ? 'text' : 'password'"
                placeholder="Enter your current password"
                required
                :disabled="loading"
              />
              <button
                type="button"
                class="password-toggle"
                @click="showCurrentPassword = !showCurrentPassword"
              >
                <i :class="showCurrentPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
              </button>
            </div>
          </div>

          <!-- New Password -->
          <div class="form-group">
            <label for="newPassword">New Password:</label>
            <div class="password-input">
              <input
                id="newPassword"
                v-model="newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                placeholder="Enter new password"
                required
                minlength="6"
                :disabled="loading"
              />
              <button
                type="button"
                class="password-toggle"
                @click="showNewPassword = !showNewPassword"
              >
                <i :class="showNewPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
              </button>
            </div>
            <div class="password-strength">
              <div class="strength-meter">
                <div class="strength-bar" :class="passwordStrength.class" :style="{ width: passwordStrength.width }"></div>
              </div>
              <span class="strength-text" :class="passwordStrength.class">{{ passwordStrength.text }}</span>
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="form-group">
            <label for="confirmPassword">Confirm New Password:</label>
            <div class="password-input">
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Confirm new password"
                required
                :disabled="loading"
              />
              <button
                type="button"
                class="password-toggle"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <i :class="showConfirmPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
              </button>
            </div>
            <div v-if="confirmPassword && !passwordsMatch" class="validation-error">
              <i class="fas fa-exclamation-triangle"></i>
              Passwords do not match
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            {{ error }}
          </div>

          <!-- Success Message -->
          <div v-if="success" class="success-message">
            <i class="fas fa-check-circle"></i>
            {{ success }}
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeDialog" :disabled="loading">
              Cancel
            </button>
            <button 
              type="submit" 
              class="btn-primary" 
              :disabled="!canSubmit || loading"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-key"></i>
              {{ loading ? 'Changing...' : 'Change Password' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import authService from '../services/auth.js'

// Props
const props = defineProps({
  user: {
    type: Object,
    required: true
  },
  show: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['close', 'success'])

// Reactive state
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

// Password visibility toggles
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

// Computed properties
const isOwnPassword = computed(() => {
  const currentUser = authService.getCurrentUser()
  return currentUser && currentUser.id === props.user.id
})

const passwordsMatch = computed(() => {
  return newPassword.value === confirmPassword.value
})

const passwordStrength = computed(() => {
  const password = newPassword.value
  if (!password) return { class: '', width: '0%', text: '' }

  let score = 0
  let feedback = []

  // Length check
  if (password.length >= 8) score += 2
  else if (password.length >= 6) score += 1

  // Character variety
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  // Determine strength
  if (score <= 2) return { class: 'weak', width: '25%', text: 'Weak' }
  if (score <= 4) return { class: 'fair', width: '50%', text: 'Fair' }
  if (score <= 6) return { class: 'good', width: '75%', text: 'Good' }
  return { class: 'strong', width: '100%', text: 'Strong' }
})

const canSubmit = computed(() => {
  if (loading.value) return false
  if (!newPassword.value || !confirmPassword.value) return false
  if (!passwordsMatch.value) return false
  if (newPassword.value.length < 6) return false
  if (isOwnPassword.value && !currentPassword.value) return false
  return true
})

// Methods
const changePassword = async () => {
  if (!canSubmit.value) return

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    // In demo mode, simulate password change
    if (authService.getConfig().demoMode) {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // For demo, we can't actually change passwords
      if (isOwnPassword.value) {
        // Simulate current password check using configured demo credentials
        const currentUser = authService.getCurrentUser()
        const demoConfig = authService.getConfig()
        
        // Check current password against demo configuration
        let expectedPassword = ''
        if (currentUser.username === demoConfig.adminUsername) {
          expectedPassword = demoConfig.adminPassword
        } else if (currentUser.username === demoConfig.userUsername) {
          expectedPassword = demoConfig.userPassword
        }
        
        if (expectedPassword && currentPassword.value !== expectedPassword) {
          throw new Error('Current password is incorrect')
        }
      }
      
      success.value = 'Password changed successfully! (Demo mode - actual password not changed)'
      
      // Close dialog after success
      setTimeout(() => {
        emit('success', {
          userId: props.user.id,
          isOwnPassword: isOwnPassword.value
        })
        closeDialog()
      }, 1500)
      
    } else {
      // Production mode - call backend API
      const response = await authService.changePassword({
        userId: props.user.id,
        currentPassword: isOwnPassword.value ? currentPassword.value : undefined,
        newPassword: newPassword.value
      })
      
      success.value = 'Password changed successfully!'
      
      setTimeout(() => {
        emit('success', {
          userId: props.user.id,
          isOwnPassword: isOwnPassword.value
        })
        closeDialog()
      }, 1500)
    }
    
  } catch (err) {
    error.value = err.message || 'Failed to change password'
  } finally {
    loading.value = false
  }
}

const closeDialog = () => {
  // Reset form
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  error.value = ''
  success.value = ''
  showCurrentPassword.value = false
  showNewPassword.value = false
  showConfirmPassword.value = false
  
  emit('close')
}

// Watch for show prop changes to reset form
watch(() => props.show, (newVal) => {
  if (newVal) {
    // Reset form when dialog opens
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    error.value = ''
    success.value = ''
  }
})
</script>

<style scoped>
.password-change-overlay {
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
  padding: 1rem;
}

.password-change-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.dialog-header h3 {
  margin: 0;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.dialog-body {
  padding: 1.5rem;
}

.info-banner {
  background: #dbeafe;
  border: 1px solid #93c5fd;
  color: #1e40af;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.admin-banner {
  background: #fef3c7;
  border-color: #fcd34d;
  color: #92400e;
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.password-input {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input input {
  width: 100%;
  padding: 0.75rem;
  padding-right: 3rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.password-input input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.password-toggle {
  position: absolute;
  right: 0.75rem;
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: color 0.2s;
}

.password-toggle:hover {
  color: #374151;
}

.password-strength {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.strength-meter {
  flex: 1;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.strength-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s, background-color 0.3s;
}

.strength-bar.weak { background: #ef4444; }
.strength-bar.fair { background: #f59e0b; }
.strength-bar.good { background: #10b981; }
.strength-bar.strong { background: #059669; }

.strength-text {
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 60px;
}

.strength-text.weak { color: #ef4444; }
.strength-text.fair { color: #f59e0b; }
.strength-text.good { color: #10b981; }
.strength-text.strong { color: #059669; }

.validation-error {
  margin-top: 0.5rem;
  color: #ef4444;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.error-message, .success-message {
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.error-message {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.success-message {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #059669;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary, .btn-primary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-secondary {
  background: #f9fafb;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-primary {
  background: #3b82f6;
  border: 1px solid #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled, .btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .password-change-dialog {
    margin: 1rem;
    max-width: none;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .btn-secondary, .btn-primary {
    width: 100%;
    justify-content: center;
  }
}
</style>
