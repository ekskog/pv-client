<template>
  <div
    class="bg-white border border-gray-200 rounded-lg overflow-hidden transition-all duration-200 cursor-pointer hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 will-change-transform"
    @click="$emit('click', photo)"
  >
    <div class="relative w-full aspect-square overflow-hidden bg-gray-50">
      <img
        :src="getOptimizedPhotoUrl(photo)"
        :alt="photo.name"
        @error="$emit('imageError', $event)"
        @load="$emit('imageLoad', $event)"
        @loadstart="$emit('imageLoadStart', $event)"
        class="w-full h-full object-cover transition-opacity duration-300"
        loading="lazy"
        :data-full-src="getPhotoUrl(photo)"
      />
      <!-- Loading placeholder for images -->
      <div
        class="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400 text-2xl transition-opacity duration-300 pointer-events-none"
        :class="{
          'opacity-0': imageLoaded,
          'opacity-100': !imageLoaded,
        }"
      >
        <i class="fas fa-image"></i>
      </div>
    </div>
    <div class="p-3">
      <div class="flex items-center gap-2 text-sm text-gray-600 mb-1">
        <i class="fas fa-clock text-xs text-gray-400 w-3"></i>
        {{ formatPhotoTimestamp(photo) }}
      </div>
      <div class="flex items-center gap-2 text-sm text-gray-600">
        <i class="fas fa-map-marker-alt text-xs text-gray-400 w-3"></i>
        {{ formatPhotoGPS(photo) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import apiService from '../services/api.js'

const props = defineProps({
  photo: { type: Object, required: true },
  photoMetadataLookup: { type: Object, required: true },
  imageLoaded: { type: Boolean, default: false },
  bucketName: { type: String, required: true }
})

const emit = defineEmits(['click', 'imageLoad', 'imageError', 'imageLoadStart'])

const locationCache = ref(new Map())

// Move the formatting methods here from PhotoGrid
const formatPhotoTimestamp = (photo) => {
  if (Object.keys(props.photoMetadataLookup).length === 0) {
    return "Loading...";
  }

  const filename = photo.name.split("/").pop();
  let metadata = props.photoMetadataLookup[filename] || props.photoMetadataLookup[photo.name];

  // AVIF fallback logic
  if (!metadata && photo.name.includes(".avif")) {
    const baseName = filename.replace(/\.avif$/i, "");
    const possibleOriginals = Object.keys(props.photoMetadataLookup).filter((key) => {
      const originalBase = key.replace(/\.[^.]+$/, "");
      return baseName.includes(originalBase) || originalBase.includes(baseName);
    });

    if (possibleOriginals.length > 0) {
      metadata = props.photoMetadataLookup[possibleOriginals[0]];
    }
  }

  if (!metadata || !metadata.timestamp) {
    return "No date";
  }

  try {
    const date = new Date(metadata.timestamp);
    return (
      date.toLocaleDateString("en-GB") +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return "Invalid date";
  }
};

const formatPhotoGPS = (photo) => {
  if (Object.keys(props.photoMetadataLookup).length === 0) {
    return "Loading...";
  }

  const cacheKey = photo.name;
  if (locationCache.value.has(cacheKey)) {
    return locationCache.value.get(cacheKey);
  }

  const filename = photo.name.split("/").pop();
  let metadata = props.photoMetadataLookup[filename] || props.photoMetadataLookup[photo.name];

  // AVIF fallback
  if (!metadata && photo.name.includes(".avif")) {
    const baseName = filename.replace(/\.avif$/i, "");
    const possibleOriginals = Object.keys(props.photoMetadataLookup).filter((key) => {
      const originalBase = key.replace(/\.[^.]+$/, "");
      return baseName.includes(originalBase) || originalBase.includes(baseName);
    });

    if (possibleOriginals.length > 0) {
      metadata = props.photoMetadataLookup[possibleOriginals[0]];
    }
  }

  if (metadata && metadata.location) {
    locationCache.value.set(cacheKey, metadata.location);
    return metadata.location;
  }

  if (metadata && metadata.coordinates) {
    locationCache.value.set(cacheKey, metadata.coordinates);
    return metadata.coordinates;
  }

  return "No location";
};

const getPhotoUrl = (photo) => {
  return apiService.getObjectUrl(props.bucketName, photo.name);
};

const getOptimizedPhotoUrl = (photo) => {
  return apiService.getObjectUrl(props.bucketName, photo.name);
};

onMounted(() => {
  console.log('🖼️ PhotoCard: mounted for photo', props.photo.name)
  console.log('🖼️ PhotoCard: imageLoaded =', props.imageLoaded)
  console.log('🖼️ PhotoCard: has metadata =', Object.keys(props.photoMetadataLookup).length > 0)
})

onUnmounted(() => {
  console.log('🖼️ PhotoCard: unmounted for photo', props.photo.name)
})

// Add to the emit handlers to see events
const handleClick = () => {
  console.log('🖼️ PhotoCard: clicked', props.photo.name)
  emit('click', props.photo)
}

const handleImageLoad = (event) => {
  console.log('🖼️ PhotoCard: image loaded for', props.photo.name)
  emit('imageLoad', event)
}

const handleImageError = (event) => {
  console.log('🖼️ PhotoCard: image error for', props.photo.name)
  emit('imageError', event)
}

const handleImageLoadStart = (event) => {
  console.log('🖼️ PhotoCard: image load start for', props.photo.name)
  emit('imageLoadStart', event)
}

</script>