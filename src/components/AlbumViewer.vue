<template>
  <div class="max-w-6xl mx-auto p-8">
    <!-- Use the new AlbumHeader component -->
    <AlbumHeader
      :album-name="albumName"
      :photo-count="visiblePhotos.length"
      :loading="loading"
      :can-upload-photos="canUploadPhotos"
      :is-public="isPublic"
      @back="$emit('back')"
      @refresh="refreshAlbum"
      @upload="showUploadDialog = true"
    />

    <!-- Sort Controls - Add this section -->
    <div v-if="!loading && !error && visiblePhotos.length > 0" class="flex justify-end items-center mb-6">
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-600">Sort by:</span>
        <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button 
            @click="sortOrder = 'chronological'"
            :class="[
              'px-3 py-1 text-sm rounded-md transition-colors',
              sortOrder === 'chronological' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            ]"
          >
            Oldest First
          </button>
          <button 
            @click="sortOrder = 'reverse'"
            :class="[
              'px-3 py-1 text-sm rounded-md transition-colors',
              sortOrder === 'reverse' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            ]"
          >
            Newest First
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div
        class="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"
      ></div>
      <p class="text-gray-600">Loading album photos...</p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="text-center py-8 text-red-500">
      <p class="mb-4">
        <i class="fas fa-exclamation-triangle mr-2"></i> {{ error }}
      </p>
      <button
        class="bg-gray-100 text-gray-700 border border-gray-300 px-6 py-3 rounded-md hover:bg-gray-200 transition-colors"
        @click="loadPhotos"
      >
        Try Again
      </button>
    </div>

    <!-- Empty State -->
    <PhotoGridEmpty v-if="!loading && !error && visiblePhotos.length === 0" />

    <!-- Photos Grid with Pagination (now uses sortedPhotos) -->
    <PhotoGrid
      :photos="sortedPhotos"
      :photo-metadata-lookup="photoMetadataLookup"
      :image-loaded-map="imageLoadedMap"
      :album-name="albumName"
      :items-per-page="24"
      :auto-load="false"
      @photo-click="openPhoto"
      @image-load="handleImageLoad"
      @image-error="handleImageError"
      @image-load-start="handleImageLoadStart"
    />

    <!-- Upload Dialog -->
    <MediaUpload
      :showUploadDialog="showUploadDialog"
      :album-name="albumName"
      @close="handleUploadDialogClose"
    />

    <!-- Delete Photo Dialog -->
    <div v-if="showDeletePhotoDialog">
      <DeletePhotoDialog
        :show="showDeletePhotoDialog"
        :photoName="
          photoToDelete ? getPhotoDisplayName(photoToDelete.name) : ''
        "
        :deleting="deletingPhoto"
        @cancel="closeDeletePhotoDialog"
        @delete="handleDialogDelete"
      />
    </div>

    <!-- Lightbox Viewer (now uses sortedLightboxPhotos) -->
    <PhotoLightbox
      :show="showLightbox"
      :photos="sortedLightboxPhotos"
      :current-index="currentPhotoIndex"
      :loading="lightboxLoading"
      :can-delete="canDeletePhoto"
      bucket-name="photovault"
      :album-name="albumName"
      :photo-metadata-lookup="photoMetadataLookup"
      @close="closeLightbox"
      @next-photo="nextPhoto"
      @previous-photo="previousPhoto"
      @delete-photo="confirmDeletePhoto"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from "vue";
import apiService from "../services/api.js";
import authService from "../services/auth.js";
import SSEService from "../services/sseService.js";

import AlbumHeader from "./AlbumHeader.vue";
import MediaUpload from "./MediaUpload.vue";
import PhotoLightbox from "./PhotoLightbox.vue";
import DeletePhotoDialog from "./DeletePhotoDialog.vue";
import PhotoGridEmpty from "./PhotoGridEmpty.vue";
import PhotoGrid from "./PhotoGrid.vue";

const props = defineProps({ albumName: String, isPublic: Boolean });
const emit = defineEmits(["back", "photoOpened"]);

const BUCKET_NAME = "photovault";
const ITEMS_PER_PAGE = 25;

const loading = ref(false);
const error = ref(null);
const photos = ref([]);
const albumMetadata = ref(null);
const photoMetadataLookup = ref({});
const locationCache = ref(new Map());
const imageLoadedMap = ref({});
const currentPage = ref(1);
const showUploadDialog = ref(false);
const showLightbox = ref(false);
const currentPhotoIndex = ref(0);
const lightboxLoading = ref(false);
const showDeletePhotoDialog = ref(false);
const photoToDelete = ref(null);
const deletingPhoto = ref(false);
const preloadStats = ref({
  total: 0,
  preloaded: 0,
  percentage: 0,
  currentlyFetchingFullSize: null,
  readyImages: [],
});
const progressTracker = ref(null);

const processingNotifications = ref(false);
const processingStatus = ref("");
const processingJobId = ref(null);
let sseService = null;

// NEW: Sort order state
const sortOrder = ref('chronological'); // 'chronological' or 'reverse'

// Helper function to sort photos by timestamp
const sortPhotosByTimestamp = (photosArray, order = 'chronological') => {
  return [...photosArray].sort((a, b) => {
    const metadataA = photoMetadataLookup.value[a.fullPath] || photoMetadataLookup.value[a.name];
    const metadataB = photoMetadataLookup.value[b.fullPath] || photoMetadataLookup.value[b.name];
    
    const timestampA = metadataA?.timestamp;
    const timestampB = metadataB?.timestamp;
    
    // Handle missing timestamps - put them at the end
    if (!timestampA && !timestampB) return 0;
    if (!timestampA) return 1;
    if (!timestampB) return -1;
    
    // Parse timestamps and sort
    const dateA = new Date(timestampA);
    const dateB = new Date(timestampB);
    
    // Switch direction based on sort order
    const direction = order === 'reverse' ? -1 : 1;
    return direction * (dateA - dateB);
  });
};

const currentPhoto = computed(
  () => sortedLightboxPhotos.value[currentPhotoIndex.value] || null
);
const canUploadPhotos = computed(() =>
  authService.canPerformAction("upload_photos")
);
const canDeletePhoto = computed(() => true);

const visiblePhotos = computed(() =>
  photos.value.filter(
    (p) =>
      /\.(avif|jpg|jpeg|png|gif|heic)$/i.test(p.name) &&
      !/_thumb\./i.test(p.name)
  )
);

// NEW: Sorted photos computed property
const sortedPhotos = computed(() => {
  if (!visiblePhotos.value.length) return [];
  return sortPhotosByTimestamp(visiblePhotos.value, sortOrder.value);
});

// NEW: Sorted lightbox photos computed property
const sortedLightboxPhotos = computed(() => sortedPhotos.value);

const handleUploadDialogClose = (payload) => {
  showUploadDialog.value = false;
  if (payload?.jobId) {
    startProcessingListener(payload.jobId);
  }
};

const resetPagination = () => (currentPage.value = 1);

const loadPhotos = async () => {
  loading.value = true;
  error.value = null;
  try {
    const albumName = props.albumName.trim().replace(/\/+$/, "");
    await loadAlbumMetadata(albumName);

    const response = await apiService.getAlbumContents(albumName);

    if (response.success && response.album.objects) {
      const allFiles = response.album.objects
        .filter((obj) => obj.name && !obj.name.endsWith("/"))
        .map((obj) => {
          // Remove album prefix from the object name
          const nameWithoutAlbum = obj.name.startsWith(`${albumName}/`)
            ? obj.name.slice(albumName.length + 1)
            : obj.name;

          return {
            ...obj,
            name: nameWithoutAlbum, // safe name for keys and display
            fullPath: obj.name, // full path for fetching from backend/MinIO
          };
        });

      photos.value = allFiles;

      resetPagination();
    } else {
      throw new Error(response.error || "Failed to load album photos");
    }
  } catch (err) {
    error.value = `Error loading photos: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

const refreshAlbum = async () => await loadPhotos();

const loadAlbumMetadata = async (albumName) => {
  try {
    const metadataUrl = apiService.getObject(albumName, `${albumName}.json`);
    const response = await fetch(metadataUrl);
    if (response.ok) {
      const metadata = await response.json();
      console.log(`DEBUG METADATA: ${Date.now()} >> ${JSON.stringify(metadata)}`);
      albumMetadata.value = metadata;
      const lookup = {};
      if (Array.isArray(metadata.media)) {
        metadata.media.forEach((mediaMeta) => {
          if (mediaMeta.sourceImage) {
            const filename = mediaMeta.sourceImage.split("/").pop();
            lookup[filename] = mediaMeta;
            lookup[mediaMeta.sourceImage] = mediaMeta;
          }
        });
      }
      photoMetadataLookup.value = lookup;
      if (photos.value.length > 0) {
        const currentPhotos = photos.value;
        photos.value = [];
        await nextTick();
        photos.value = currentPhotos;
      }
    }
  } catch (err) {
    console.warn("Could not load album metadata:", err.message);
  }
};

const getPhotoDisplayName = (filename) => filename.split("/").pop() || filename;
const getPhotoUrl = (photo) =>
  apiService.getObject(photo.albumName, photo.name);
const preloadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const loadImageProgressively = async (photo, imgElement) => {
  try {
    const photoSrc = getPhotoUrl(photo);
    preloadStats.value.currentlyFetchingFullSize = photo.name;
    preloadImage(photoSrc)
      .then(() => {
        imgElement.dataset.fullLoaded = "true";
        if (!preloadStats.value.readyImages.includes(photo.name)) {
          preloadStats.value.readyImages.push(photo.name);
        }
        preloadStats.value.currentlyFetchingFullSize = null;
        trackProgressiveLoadingStats();
      })
      .catch(() => {
        preloadStats.value.currentlyFetchingFullSize = null;
      });
  } catch (error) {
    console.error(`Failed to load image for ${photo.name}:`, error);
  }
};

const handleImageError = (event) => {
  event.target.src = "data:image/svg+xml;base64,...";
};

const handleImageLoadStart = (event) => {};
const handleImageLoad = (event) =>
  (imageLoadedMap.value[event.target.alt] = true);

const openPhoto = async (photo) => {
  // UPDATED: Find photo in sorted array
  const targetPhotoIndex = sortedLightboxPhotos.value.findIndex(
    (p) => p.name === photo.name
  );
  if (targetPhotoIndex === -1) return;
  const gridImage = document.querySelector(
    `img[alt="${photo.name}"][data-full-loaded="true"]`
  );
  const isPreloaded = gridImage?.dataset.fullLoaded === "true";
  currentPhotoIndex.value = targetPhotoIndex;
  showLightbox.value = true;
  if (!isPreloaded) lightboxLoading.value = true;
};

const closeLightbox = () => {
  showLightbox.value = false;
  lightboxLoading.value = false;
};

const nextPhoto = () => {
  // UPDATED: Use sorted lightbox photos
  if (currentPhotoIndex.value < sortedLightboxPhotos.value.length - 1) {
    const nextPhoto = sortedLightboxPhotos.value[currentPhotoIndex.value + 1];
    const nextGridImage = document.querySelector(
      `img[alt="${nextPhoto.name}"][data-full-loaded="true"]`
    );
    if (!nextGridImage?.dataset.fullLoaded) lightboxLoading.value = true;
    currentPhotoIndex.value++;
  }
};

const previousPhoto = () => {
  // UPDATED: Use sorted lightbox photos
  if (currentPhotoIndex.value > 0) {
    const prevPhoto = sortedLightboxPhotos.value[currentPhotoIndex.value - 1];
    const prevGridImage = document.querySelector(
      `img[alt="${prevPhoto.name}"][data-full-loaded="true"]`
    );
    if (!prevGridImage?.dataset.fullLoaded) lightboxLoading.value = true;
    currentPhotoIndex.value--;
  }
};

const confirmDeletePhoto = (photo) => {
  photoToDelete.value = photo;
  console.log(`Confirm delete photo: ${photo.name}`);
  showDeletePhotoDialog.value = true;
};

const handleDialogDelete = async () => await deletePhoto();

const deletePhoto = async () => {
  if (!photoToDelete.value) return;
  deletingPhoto.value = true;
  error.value = null;
  try {
    const response = await apiService.deleteObject(
      props.albumName,
      photoToDelete.value.name
    );
    if (response.success) {
      await loadPhotos();
      if (showLightbox.value) {
        // UPDATED: Use sorted lightbox photos
        if (sortedLightboxPhotos.value.length > 1) {
          if (currentPhotoIndex.value >= sortedLightboxPhotos.value.length - 1) {
            currentPhotoIndex.value = Math.max(
              0,
              sortedLightboxPhotos.value.length - 2
            );
          }
        } else {
          closeLightbox();
        }
      }
      closeDeletePhotoDialog();
    } else {
      error.value = response.error || "Failed to delete photo";
    }
  } catch (err) {
    error.value = `Failed to delete photo: ${err.message}`;
  } finally {
    deletingPhoto.value = false;
  }
};

const closeDeletePhotoDialog = () => {
  showDeletePhotoDialog.value = false;
  photoToDelete.value = null;
  deletingPhoto.value = false;
};

const trackProgressiveLoadingStats = () => {
  const allImages = document.querySelectorAll(".photo-image");
  const preloadedImages = document.querySelectorAll(
    '.photo-image[data-full-loaded="true"]'
  );
  const totalImages = allImages.length;
  const preloadedCount = preloadedImages.length;
  const preloadPercentage =
    totalImages > 0 ? Math.round((preloadedCount / totalImages) * 100) : 0;
  preloadStats.value = {
    total: totalImages,
    preloaded: preloadedCount,
    percentage: preloadPercentage,
    currentlyFetchingFullSize: preloadStats.value.currentlyFetchingFullSize,
    readyImages: preloadStats.value.readyImages,
  };
  return {
    total: totalImages,
    preloaded: preloadedCount,
    percentage: preloadPercentage,
  };
};

const startAggressivePreloading = () => {
  const imageElements = document.querySelectorAll(".photo-image");
  imageElements.forEach((img, index) => {
    const photoName = img.alt;
    // UPDATED: Use sorted photos for preloading
    const photo = sortedPhotos.value.find((p) => p.name === photoName);
    if (photo) {
      setTimeout(() => loadImageProgressively(photo, img), index * 100);
    }
  });
};

const preloadVisibleImages = () => {
  const imageElements = document.querySelectorAll(
    '.photo-image[loading="lazy"]'
  );
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const photoName = img.alt;
          // UPDATED: Use sorted photos for preloading
          const photo = sortedPhotos.value.find((p) => p.name === photoName);
          if (photo) loadImageProgressively(photo, img);
          observer.unobserve(img);
        }
      });
    },
    { rootMargin: "100px", threshold: 0.1 }
  );
  imageElements.forEach((img) => observer.observe(img));
};

// SSE Integration
const startProcessingListener = (jobId) => {
  processingJobId.value = jobId;
  processingNotifications.value = true;
  processingStatus.value = "Starting photo processing...";
  sseService = new SSEService(
    apiService,
    jobId,
    handleProcessingUpdate,
    () => {}
  );
  sseService.start();
};

const stopProcessingListener = () => {
  sseService?.stop();
  sseService = null;
  processingNotifications.value = false;
  processingStatus.value = "";
  processingJobId.value = null;
};

const handleProcessingUpdate = (data) => {
  switch (data.type) {
    case "connected":
      processingStatus.value = "Connected to photo processing service...";
      break;
    case "complete":
      processingStatus.value = "Photo processing complete! 🎉";
      showProcessingCompleteNotification();
      setTimeout(async () => {
        await refreshAlbum();
        stopProcessingListener();
      }, 2000);
      break;
    case "failed":
      processingStatus.value = "Photo processing failed. Please try again.";
      setTimeout(() => stopProcessingListener(), 5000);
      break;
    default:
      processingStatus.value = data.message || "Processing photos...";
  }
};

const showProcessingCompleteNotification = () => {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Photo Processing Complete!", {
      body: "Your photos are now ready to view in the album.",
      icon: "/favicon.ico",
    });
  }
};

onMounted(async () => {
  await loadPhotos();
  setTimeout(() => {
    startAggressivePreloading();
    preloadVisibleImages();
    trackProgressiveLoadingStats();
    progressTracker.value = setInterval(() => {
      const stats = trackProgressiveLoadingStats();
      if (stats.percentage >= 100) {
        clearInterval(progressTracker.value);
        progressTracker.value = null;
      }
    }, 2000);
  }, 100);
});

onUnmounted(() => {
  stopProcessingListener();
});
</script>