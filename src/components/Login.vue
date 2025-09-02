<template>
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-8"
    ref="loginContainer"
  >
    <div
      class="w-full max-w-md bg-white rounded-2xl p-12 shadow-2xl"
    >
      <!-- Header -->
      <div class="text-center mb-8">
        <div
          class="w-20 h-20 mx-auto mb-6 flex items-center justify-center text-white text-3xl rounded-full bg-gradient-to-br from-blue-500 to-blue-700"
        >
          <i class="fas fa-camera"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 mb-2">HBVU PHOTOS</h1>
        <p class="text-green-700 text-sm">Please sign in to continue</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleLogin" class="mb-8 space-y-6">
        <div>
          <label for="username" class="block mb-2 font-semibold text-gray-800 text-sm">Username</label>
          <input
            id="username"
            ref="usernameInput"
            v-model="username"
            type="text"
            placeholder="Enter your username"
            required
            :disabled="loading"
            autocomplete="username"
            class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-gray-100 disabled:opacity-70"
          />
        </div>

        <div>
          <label for="password" class="block mb-2 font-semibold text-gray-800 text-sm">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="Enter your password"
            required
            :disabled="loading"
            autocomplete="current-password"
            class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-gray-100 disabled:opacity-70"
          />
        </div>

        <!-- Turnstile Widget -->
        <div class="flex justify-center">
          <div 
            ref="turnstileRef"
            class="cf-turnstile" 
            :data-sitekey="TURNSTILE_SITE_KEY"
            data-callback="onTurnstileSuccess"
            data-error-callback="onTurnstileError"
            data-theme="light"
            data-size="normal"
          ></div>
        </div>
        
        <div
          v-if="turnstileError"
          class="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          <i class="fas fa-exclamation-triangle"></i>
          {{ turnstileError }}
        </div>

        <button
          type="submit"
          :disabled="loading || !isFormValid || !turnstileToken"
          class="w-full flex items-center justify-center gap-2 px-4 py-3 text-white font-semibold text-base rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed min-h-[50px]"
        >
          <i v-if="loading" class="fas fa-spinner fa-spin"></i>
          <span>{{ loading ? 'Signing in...' : 'Sign In' }}</span>
        </button>

        <div
          v-if="error"
          class="mt-4 flex items-center gap-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          <i class="fas fa-exclamation-triangle"></i>
          {{ error }}
        </div>

        <button
          type="button"
          @click="emit('close')"
          :disabled="loading"
          class="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 text-gray-700 font-medium text-base border-2 border-gray-300 rounded-lg transition hover:bg-gray-100 hover:border-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i class="fas fa-times-circle"></i>
          Cancel
        </button>
      </form>

      <!-- Security Notice -->
      <div class="text-center text-sm text-gray-500">
        <small class="flex items-center justify-center gap-1">🔒 Your credentials are transmitted securely</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import authService from '../services/auth.js'

const emit = defineEmits(['login-success', 'close'])

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const usernameInput = ref(null)
const turnstileRef = ref(null)
const turnstileToken = ref('')
const turnstileError = ref('')
const widgetId = ref(null)

// Replace with your actual Turnstile site key
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

const isFormValid = computed(() => {
  return username.value.trim() && password.value.trim()
})

// Global callback functions for Turnstile
window.onTurnstileSuccess = (token) => {
  turnstileToken.value = token
  turnstileError.value = ''
}

window.onTurnstileError = (errorCode) => {
  turnstileError.value = 'Security verification failed. Please try again.'
  turnstileToken.value = ''
}

const renderTurnstile = () => {
  if (window.turnstile && turnstileRef.value && !widgetId.value) {
    try {
      widgetId.value = window.turnstile.render(turnstileRef.value, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: 'onTurnstileSuccess',
        'error-callback': 'onTurnstileError',
        theme: 'light',
        size: 'normal'
      })
    } catch (err) {
      console.error('Failed to render Turnstile:', err)
      turnstileError.value = 'Security widget failed to load'
    }
  }
}

const resetTurnstile = () => {
  if (window.turnstile && widgetId.value) {
    window.turnstile.reset(widgetId.value)
    turnstileToken.value = ''
    turnstileError.value = ''
  }
}

const handleLogin = async () => {
  if (!isFormValid.value) return
  
  if (!turnstileToken.value) {
    turnstileError.value = 'Please complete the security verification'
    return
  }

  loading.value = true
  error.value = ''

  try {
    // Pass the Turnstile token to your auth service
    const result = await authService.login(username.value.trim(), password.value, turnstileToken.value)
    if (result.success) {
      emit('login-success', result.user)
      username.value = ''
      password.value = ''
      turnstileToken.value = ''
    } else {
      error.value = result.error || 'Login failed'
      resetTurnstile() // Reset on failure
    }
  } catch (err) {
    error.value = err.message || 'An unexpected error occurred'
    resetTurnstile() // Reset on error
  } finally {
    loading.value = false
  }
}

const handleKeyDown = (e) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  if (usernameInput.value) {
    usernameInput.value.focus()
  }

  // Wait for Turnstile script to load and render widget
  const checkTurnstile = () => {
    if (window.turnstile) {
      renderTurnstile()
    } else {
      setTimeout(checkTurnstile, 100)
    }
  }
  checkTurnstile()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  // Clean up global functions
  delete window.onTurnstileSuccess
  delete window.onTurnstileError
})
</script>
