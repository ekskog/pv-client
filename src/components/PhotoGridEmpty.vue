<template>
  <div class="text-center py-16">
    <div class="text-6xl text-gray-300 mb-4">
      <i class="fas fa-images"></i>
    </div>
    <h3 class="text-2xl font-semibold text-gray-700 mb-2">No Photos Yet</h3>
    <p class="text-gray-500 mb-8">
      Start building your album by adding some photos!
    </p>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  console.log('📭 PhotoGridEmpty: mounted')
})

onUnmounted(() => {
  console.log('📭 PhotoGridEmpty: unmounted')
})
</script>