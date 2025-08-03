<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="login-icon">
          <i class="fas fa-camera"></i>
        </div>
        <h1>HBVU PHOTOS</h1>
        <p class="login-subtitle">Please sign in to continue</p>

        <!-- Demo Mode Warning -->
        <div v-if="isDemoMode" class="demo-warning">
          ⚠️ <strong>Demo Mode</strong> - Using test credentials
        </div>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="Enter your username"
            required
            :disabled="loading"
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="Enter your password"
            required
            :disabled="loading"
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="login-btn" :disabled="loading || !isFormValid">
          <i v-if="loading" class="fas fa-spinner fa-spin"></i>
          <span>{{ loading ? 'Signing in...' : 'Sign In' }}</span>
        </button>

        <div v-if="error" class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          {{ error }}
        </div>
      </form>

      <!-- Demo Information (only show in demo mode) -->
      <div v-if="isDemoMode" class="demo-info">
        <h4>Demo Mode Active</h4>
        <p class="demo-description">
          This is a demonstration environment. Please contact your administrator for login credentials.
        </p>
      </div>

      <!-- Security Notice -->
      <div class="security-notice">
        <small>🔒 Your credentials are transmitted securely</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import authService from '../services/auth.js'

// Emits
const emit = defineEmits(['login-success'])

// Reactive state
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

// Computed properties
const isFormValid = computed(() => {
  return username.value.trim() && password.value.trim()
})

// Check if in demo mode
const isDemoMode = computed(() => {
  return authService.getConfig().demoMode
})

// Methods
const handleLogin = async () => {
  if (!isFormValid.value) return

  loading.value = true
  error.value = ''

  try {
    const result = await authService.login(username.value.trim(), password.value)
    
    if (result.success) {
      emit('login-success', result.user)
      // Clear form
      username.value = ''
      password.value = ''
    } else {
      error.value = result.error || 'Login failed'
    }
  } catch (err) {
    error.value = err.message || 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 2rem;
}

.login-card {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 420px;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-icon {
  display: inline-block;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #2196f3, #1976d2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  font-size: 2rem;
  color: white;
}

.login-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #333;
  margin: 0 0 0.5rem 0;
}

.login-subtitle {
  color: #656;
  margin: 0;
  font-size: 1rem;
}

.login-form {
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.form-group input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.form-group input:disabled {
  background: #f8f9fa;
  opacity: 0.7;
}

.login-btn {
  width: 100%;
  background: linear-gradient(135deg, #2196f3, #1976d2);
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 50px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(33, 150, 243, 0.3);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.demo-warning {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
  padding: 8px 12px;
  border-radius: 4px;
  margin: 10px 0;
  font-size: 0.9em;
  text-align: center;
}

.demo-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #e9ecef;
  text-align: center;
}

.demo-info h4 {
  margin: 0 0 1rem 0;
  color: #495057;
  font-size: 1rem;
  font-weight: 600;
}

.demo-description {
  font-size: 0.9rem;
  line-height: 1.4;
  color: #6c757d;
  margin: 0;
}

.security-notice {
  text-align: center;
  margin-top: 15px;
  color: #6c757d;
}

.security-notice small {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

@media (max-width: 480px) {
  .login-container {
    padding: 1rem;
  }
  
  .login-card {
    padding: 2rem;
  }
  
  .login-icon {
    width: 60px;
    height: 60px;
    font-size: 1.5rem;
  }
  
  .login-header h1 {
    font-size: 1.5rem;
  }
  
  .demo-accounts {
    gap: 0.75rem;
  }
}
</style>
