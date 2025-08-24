<template>
  <div
    class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 transform-gpu"
  >
    <PhotoCard
      v-for="photo in paginatedPhotos"
      :key="photo.name"
      :photo="photo"
      :photo-metadata-lookup="photoMetadataLookup"
      :image-loaded="imageLoadedMap[photo.name]"
      :bucket-name="bucketName"
      @click="$emit('photoClick', photo)"
      @image-load="$emit('imageLoad', $event)"
      @image-error="$emit('imageError', $event)"
      @image-load-start="$emit('imageLoadStart', $event)"
    />
    
    <!-- Load More Trigger -->
    <div
      class="h-4"
      v-if="paginatedPhotos.length < photos.length"
    ></div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import PhotoCard from './PhotoCard.vue'

const props = defineProps({
  photos: { type: Array, required: true },
  photoMetadataLookup: { type: Object, required: true },
  imageLoadedMap: { type: Object, required: true },
  bucketName: { type: String, required: true },
  currentPage: { type: Number, required: true },
  itemsPerPage: { type: Number, default: 50 }
})

const emit = defineEmits(['photoClick', 'imageLoad', 'imageError', 'imageLoadStart'])

const paginatedPhotos = computed(() => {
  const endIndex = props.currentPage * props.itemsPerPage
  return props.photos.slice(0, endIndex)
})

// Debug logs
onMounted(() => {
  console.log('📋 PhotoGrid: mounted with', props.photos.length, 'photos')
  console.log('📋 PhotoGrid: currentPage =', props.currentPage)
  console.log('📋 PhotoGrid: paginatedPhotos =', paginatedPhotos.value.length)
})

onUnmounted(() => {
  console.log('📋 PhotoGrid: unmounted')
})

watch(() => paginatedPhotos.value.length, (newCount) => {
  console.log('📋 PhotoGrid: paginatedPhotos changed to', newCount, 'photos')
})
</script>