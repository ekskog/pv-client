<template>
  <header class="header">
    <h1 class="logo">
      <i class="fas fa-camera"></i>
    </h1>
    <div class="health-status" :class="{ 'healthy': isHealthy, 'unhealthy': !isHealthy }">
      {{ healthStatus }}
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import apiService from '../services/api.js'

// Reactive state
const isHealthy = ref(false)
const healthStatus = ref('Checking...')

// Methods
const checkHealth = async () => {
  try {
    const health = await apiService.getHealth()
    isHealthy.value = health.status === 'healthy'
    healthStatus.value = isHealthy.value ? 'Connected' : 'Disconnected'
  } catch (err) {
    isHealthy.value = false
    healthStatus.value = 'Offline'
  }
}

// Initialize
onMounted(async () => {
  await checkHealth()
})
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.logo {
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.logo i {
  font-size: 1.8rem;
  color: #4a90e2;
  transition: color 0.3s ease;
}

.logo i:hover {
  color: #357abd;
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

@media (max-width: 768px) {
  .header {
    padding: 1rem;
  }
  
  .logo {
    font-size: 1.25rem;
  }
  
  .health-status {
    font-size: 0.8rem;
    padding: 0.2rem 0.6rem;
  }
}

@media (max-width: 480px) {
  .header {
    padding: 0.75rem;
  }
  
  .logo {
    font-size: 1.1rem;
  }
  
  .health-status {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
  }
}
</style>
