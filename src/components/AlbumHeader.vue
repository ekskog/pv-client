<template>
  <div
    class="flex items-center justify-between gap-4 mb-8 pb-4 border-b border-gray-200 dark:border-gray-700 flex-wrap"
  >
    <!-- Back Button -->
    <button
      v-if="!isPublic"
      class="flex-shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 px-4 py-2 rounded-md text-sm transition"
      @click="$emit('back')"
    >
      <i class="fas fa-arrow-left"></i>
    </button>

    <!-- Album Info -->
    <div class="flex items-center gap-3 flex-grow min-w-0">
      <h2
        class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 truncate"
      >
        <i class="fas fa-images text-blue-500"></i> {{ cleanAlbumName }}
      </h2>
      <span class="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {{ photoCount }} photos
      </span>
    </div>

    <!-- Header Actions -->
    <div class="flex items-center gap-3 flex-shrink-0">
      <button
        v-if="!isPublic"
        class="bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 px-3 py-2 rounded-md text-sm transition flex items-center justify-center disabled:opacity-60"
        @click="$emit('refresh')"
        :disabled="loading"
        title="Refresh album"
      >
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
      </button>

      <button
        v-if="canUploadPhotos"
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold transition disabled:opacity-60"
        @click="$emit('upload')"
      >
        <i class="fas fa-plus"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from "vue";

const props = defineProps({
  albumName: { type: String, required: true },
  photoCount: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  canUploadPhotos: { type: Boolean, default: false },
  isPublic: { type: Boolean, default: false },
});

const cleanAlbumName = computed(() => {
  const match = props.albumName.match(/^(.*)\.(\d{2})\/$/);
  return match ? `${match[1]} (${match[2]})` : props.albumName;
});

const emit = defineEmits(["back", "refresh", "upload"]);

const isPublic = ref(false);

onMounted(() => {
  isPublic.value = window.location.hash.startsWith("#/public/");
});
</script>
