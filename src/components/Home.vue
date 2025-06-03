<template>
  <div class="home">
    <div class="hero">
      <h1 class="hero-title">PhotoVault</h1>
      <p class="hero-subtitle">Minimalist photo gallery and storage management</p>
      <div class="hero-actions">
        <button class="btn-primary" @click="$emit('navigate', 'buckets')">
          <i class="fas fa-folder"></i> Browse Storage
        </button>
      </div>
    </div>

    <div class="features">
      <div class="feature-card" @click="$emit('navigate', 'albums')">
        <div class="feature-icon"><i class="fas fa-layer-group"></i></div>
        <h3>Organize</h3>
        <p>Create and manage albums to organize your photos efficiently.</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon"><i class="fas fa-chart-bar"></i></div>
        <h3>Statistics</h3>
        <p>View detailed statistics including object counts and storage usage for each bucket.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// Emits
defineEmits(['navigate'])
</script>

<style scoped>
.home {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.hero {
  text-align: center;
  padding: 4rem 0;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 3rem;
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  color: #333;
  margin: 0 0 1rem 0;
  background: linear-gradient(135deg, #2196f3, #1976d2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: #666;
  margin: 0 0 2rem 0;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary {
  background: #2196f3;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
  min-height: 44px; /* Touch-friendly target */
}

.btn-primary:hover {
  background: #1976d2;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.feature-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;
}

.feature-card:hover {
  border-color: #2196f3;
  box-shadow: 0 4px 16px rgba(33, 150, 243, 0.1);
  transform: translateY(-2px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
  margin: 0 0 1rem 0;
}

.feature-card p {
  color: #666;
  line-height: 1.6;
  margin: 0;
}

@media (max-width: 768px) {
  .home {
    padding: 1rem;
  }
  
  .hero {
    padding: 2.5rem 0;
    margin-bottom: 2rem;
  }
  
  .hero-title {
    font-size: 2.25rem;
  }
  
  .hero-subtitle {
    font-size: 1.1rem;
    padding: 0 1rem;
  }
  
  .btn-primary {
    padding: 0.875rem 1.5rem;
    font-size: 0.95rem;
  }
  
  .features {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-top: 1.5rem;
  }
  
  .feature-card {
    padding: 1.5rem;
  }
  
  .feature-icon {
    font-size: 2.5rem;
  }
}

@media (max-width: 480px) {
  .home {
    padding: 0.75rem;
  }
  
  .hero {
    padding: 2rem 0;
    margin-bottom: 1.5rem;
  }
  
  .hero-title {
    font-size: 1.875rem;
  }
  
  .hero-subtitle {
    font-size: 1rem;
  }
  
  .btn-primary {
    padding: 0.75rem 1.25rem;
    font-size: 0.9rem;
  }
  
  .features {
    gap: 1rem;
  }
  
  .feature-card {
    padding: 1.25rem;
  }
  
  .feature-icon {
    font-size: 2.25rem;
  }
  
  .feature-card h3 {
    font-size: 1.1rem;
  }
  
  .feature-card p {
    font-size: 0.95rem;
  }
}
</style>
