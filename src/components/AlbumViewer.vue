<template>
  <div class="max-w-6xl mx-auto p-8">
    <!-- Use the new AlbumHeader component -->
    <AlbumHeader
      :album-name="albumName"
      :photo-count="visiblePhotos.length"
      :loading="loading"
      :can-upload-photos="canUploadPhotos"
      @back="$emit('back')"
      @refresh="refreshAlbum"
      @upload="showUploadDialog = true"
    />

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

    <!-- Photos Grid with Pagination -->
    <PhotoGrid
      v-if="!loading && !error && visiblePhotos.length > 0"
      :photos="visiblePhotos"
      :photo-metadata-lookup="photoMetadataLookup"
      :image-loaded-map="imageLoadedMap"
      :bucket-name="BUCKET_NAME"
      :current-page="currentPage"
      :items-per-page="ITEMS_PER_PAGE"
      @photo-click="openPhoto"
      @image-load="handleImageLoad"
      @image-error="handleImageError"
      @image-load-start="handleImageLoadStart"
      @page-change="handlePageChange"
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
        :photoName="photoToDelete ? getPhotoDisplayName(photoToDelete.name) : ''"
        :deleting="deletingPhoto"
        @cancel="closeDeletePhotoDialog"
        @delete="handleDialogDelete"
      />
    </div>

    <!-- Lightbox Viewer -->
    <PhotoLightbox
      :show="showLightbox"
      :photos="lightboxPhotos"
      :current-index="currentPhotoIndex"
      :loading="lightboxLoading"
      :can-delete="canDeletePhoto"
      bucket-name="photovault"
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
import AlbumHeader from "./AlbumHeader.vue";
import MediaUpload from "./MediaUpload.vue";
import PhotoLightbox from "./PhotoLightbox.vue";
import DeletePhotoDialog from "./DeletePhotoDialog.vue";
import PhotoGridEmpty from "./PhotoGridEmpty.vue";
import PhotoGrid from './PhotoGrid.vue'

// Props
const props = defineProps({
  albumName: {
    type: String,
    required: true,
  },
});

// Emits
const emit = defineEmits(["back", "photoOpened"]);

// Constants
const BUCKET_NAME = "photovault";
const ITEMS_PER_PAGE = 25; // Changed from 50 to 25

// Core reactive state
const loading = ref(false);
const error = ref(null);
const photos = ref([]);
const albumMetadata = ref(null);
const photoMetadataLookup = ref({});
const locationCache = ref(new Map());
const imageLoadedMap = ref({});

// Pagination state
const currentPage = ref(1);

// Upload/Delete state
const showUploadDialog = ref(false);

// Lightbox state
const showLightbox = ref(false);
const currentPhotoIndex = ref(0);
const lightboxLoading = ref(false);

// Delete photo state
const showDeletePhotoDialog = ref(false);
const photoToDelete = ref(null);
const deletingPhoto = ref(false);

// Progressive loading stats
const preloadStats = ref({
  total: 0,
  preloaded: 0,
  percentage: 0,
  currentlyFetchingFullSize: null,
  readyImages: [],
});

// Progress tracker interval reference for cleanup
const progressTracker = ref(null);

// SSE state
const processingNotifications = ref(false);
const eventSource = ref(null);
const processingStatus = ref("");
const processingJobId = ref(null);

// Computed properties
const currentPhoto = computed(() => {
  return lightboxPhotos.value[currentPhotoIndex.value] || null;
});

// Permission checks
const canUploadPhotos = computed(() => {
  return authService.canPerformAction("upload_photos");
});

const canDeletePhoto = computed(() => {
  return true; // Always allow delete for testing
});

// Show all regular image files (no thumbnail filtering)
const visiblePhotos = computed(() => {
  return photos.value.filter((photo) => {
    const isRegularImage = /\.(avif|jpg|jpeg|png|gif|heic)$/i.test(photo.name);
    const isThumbnail = /_thumb\./i.test(photo.name);
    return isRegularImage && !isThumbnail;
  });
});

// Use the same photos for lightbox navigation
const lightboxPhotos = computed(() => {
  return visiblePhotos.value;
});

// Core Methods
const handleUploadDialogClose = (payload) => {
  console.log("[AlbumViewer] handleUploadDialogClose called, payload:", payload);
  showUploadDialog.value = false;
  console.log("[AlbumViewer] showUploadDialog set to false");
  if (payload?.jobId) {
    console.log("Upload jobId received from child:", payload.jobId);
    startProcessingListener(payload.jobId);
  }
};

// NEW: Handle page changes from PhotoGrid
const handlePageChange = (newPage) => {
  console.log('📄 Page changed to:', newPage);
  currentPage.value = newPage;
  
  // Clear image loading states for new page to force fresh loading
  Object.keys(imageLoadedMap.value).forEach(key => {
    delete imageLoadedMap.value[key];
  });
  
  // Trigger preloading for new page after a short delay
  setTimeout(() => {
    startAggressivePreloading();
    preloadVisibleImages();
  }, 100);
};

// NEW: Reset pagination to page 1
const resetPagination = () => {
  currentPage.value = 1;
};

const loadPhotos = async () => {
  console.log("🔄 Loading album:", props.albumName);

  loading.value = true;
  error.value = null;

  try {
    let cleanAlbumName = props.albumName.trim();
    cleanAlbumName = cleanAlbumName.replace(/\/+$/, "");
    const prefix = cleanAlbumName + "/";

    // STEP 1: Load metadata FIRST
    console.log("📄 Loading metadata first...");
    await loadAlbumMetadata(cleanAlbumName);

    // STEP 2: Then load photos
    console.log("📡 Loading photos...");
    const response = await apiService.getBucketContents(BUCKET_NAME, prefix);

    if (response.success && response.data) {
      const allFiles = (response.data.objects || []).filter((obj) => {
        return obj.name && !obj.name.endsWith("/");
      });

      // STEP 3: Set photos after metadata is ready
      photos.value = allFiles;

      console.log("✅ Photos and metadata loaded:", {
        photosCount: allFiles.length,
        metadataCount: Object.keys(photoMetadataLookup.value).length,
      });

      resetPagination(); // Reset to page 1 when loading new album
    } else {
      throw new Error(response.error || "Failed to load album photos");
    }
  } catch (err) {
    console.error("❌ Error loading photos:", err);
    error.value = `Error loading photos: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

const refreshAlbum = async () => {
  console.log("🔄 Refreshing album:", props.albumName);
  await loadPhotos();
};

const loadAlbumMetadata = async (albumName) => {
  try {
    const metadataFileName = `${albumName}/${albumName}.json`;
    const metadataUrl = apiService.getObjectUrl(BUCKET_NAME, metadataFileName);

    console.log("📄 Loading metadata from:", metadataUrl);
    const response = await fetch(metadataUrl);
    console.log("📄 Metadata fetch response:", response);

    if (response.ok) {
      console.log("📄 Metadata file found, parsing...");
      const metadata = await response.json();
      albumMetadata.value = metadata;

      /*
      const keys = Object.keys(metadata);
      console.log(`keys: ${keys}`);
      console.log(`metadata: ${metadata.media} >> ${typeof metadata.media}`);
      */
      const lookup = {};

      if (metadata.media && Array.isArray(metadata.media)) {
        metadata.media.forEach((mediaMeta) => {
          if (mediaMeta.sourceImage) {
            const filename = mediaMeta.sourceImage.split("/").pop();
            //console.log("📄 Found source image for metadata:", filename);
            lookup[filename] = mediaMeta;
            lookup[mediaMeta.sourceImage] = mediaMeta;
          } else {
            console.log("📄 No source image found for metadata:", mediaMeta);
          }
        });
      } else {
        console.log(`📄 No media array found in metadata: ${metadata.media} >> ${typeof metadata.media}`);
      }

      photoMetadataLookup.value = lookup;
      console.log("📄 Metadata loaded:", Object.keys(lookup).length, "entries");

      // FORCE REACTIVITY: If photos are already loaded, trigger re-render
      if (photos.value.length > 0) {
        console.log("🔄 Forcing photo re-render after metadata load");
        const currentPhotos = photos.value;
        photos.value = [];
        await nextTick();
        photos.value = currentPhotos;
      }
    } else {
      console.warn("📄 Metadata file not found:", metadataFileName);
    }
  } catch (err) {
    console.warn("📄 Could not load album metadata:", err.message);
  }
};

const getPhotoDisplayName = (filename) => {
  return filename.split("/").pop() || filename;
};

const getPhotoUrl = (photo) => {
  return apiService.getObjectUrl(BUCKET_NAME, photo.name);
};

// Image loading and preloading
const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

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
      .catch((error) => {
        console.warn(`Preload failed for ${photo.name}:`, error.message);
        preloadStats.value.currentlyFetchingFullSize = null;
      });
  } catch (error) {
    console.error(`Failed to load image for ${photo.name}:`, error);
  }
};

// Image event handlers
const handleImageError = (event) => {
  const imgElement = event.target;
  const originalSrc = imgElement.src;
  const photoName = imgElement.alt || "unknown";

  console.error("❌ Image failed to load:", photoName, "from", originalSrc);
  event.target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvcnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=";
};

const handleImageLoadStart = (event) => {
  const imgElement = event.target;
  const photoName = imgElement.alt || "unknown";
  console.log("🔄 Started loading image:", photoName);
};

const handleImageLoad = (event) => {
  const photoName = event.target.alt;
  imageLoadedMap.value[photoName] = true;
};

// Lightbox methods
const openPhoto = async (photo) => {
  console.log("LIGHTBOX REFACTORED");
  const targetPhotoIndex = lightboxPhotos.value.findIndex((p) => p.name === photo.name);

  if (targetPhotoIndex === -1) {
    console.error(`Could not find photo in lightbox array: ${photo.name}`);
    return;
  }

  const gridImage = document.querySelector(`img[alt="${photo.name}"][data-full-loaded="true"]`);
  const isPreloaded = gridImage && gridImage.dataset.fullLoaded === "true";

  currentPhotoIndex.value = targetPhotoIndex;
  showLightbox.value = true;

  if (!isPreloaded) {
    lightboxLoading.value = true;
  }
};

const closeLightbox = () => {
  showLightbox.value = false;
  lightboxLoading.value = false;
};

const nextPhoto = () => {
  if (currentPhotoIndex.value < lightboxPhotos.value.length - 1) {
    const nextPhoto = lightboxPhotos.value[currentPhotoIndex.value + 1];
    const nextGridImage = document.querySelector(`img[alt="${nextPhoto.name}"][data-full-loaded="true"]`);
    const isNextPreloaded = nextGridImage && nextGridImage.dataset.fullLoaded === "true";

    if (!isNextPreloaded) {
      lightboxLoading.value = true;
    }
    currentPhotoIndex.value++;
  }
};

const previousPhoto = () => {
  if (currentPhotoIndex.value > 0) {
    const prevPhoto = lightboxPhotos.value[currentPhotoIndex.value - 1];
    const prevGridImage = document.querySelector(`img[alt="${prevPhoto.name}"][data-full-loaded="true"]`);
    const isPrevPreloaded = prevGridImage && prevGridImage.dataset.fullLoaded === "true";

    if (!isPrevPreloaded) {
      lightboxLoading.value = true;
    }
    currentPhotoIndex.value--;
  }
};

// Delete photo methods
const confirmDeletePhoto = (photo) => {
  console.log("[Delete] Dialog opened for:", photo);
  photoToDelete.value = photo;
  showDeletePhotoDialog.value = true;
};

const handleDialogDelete = async () => {
  console.log("[Delete] Confirm button clicked for:", photoToDelete.value);
  await deletePhoto();
};

const deletePhoto = async () => {
  if (!photoToDelete.value) return;
  deletingPhoto.value = true;
  error.value = null;

  try {
    console.log("[Delete] Token check:", localStorage.getItem("hbvu_auth_token")?.substring(0, 20));
    console.log("[Delete] Making API call...");
    const response = await apiService.deleteObject(BUCKET_NAME, photoToDelete.value.name);
    console.log("[Delete] API response:", response);

    if (response.success) {
      console.log("[Delete] API success, calling loadPhotos...");
      await loadPhotos();

      console.log("[Delete] After loadPhotos:", {
        lightboxLength: lightboxPhotos.value.length,
        currentIndex: currentPhotoIndex.value,
        showLightbox: showLightbox.value,
      });

      if (showLightbox.value) {
        console.log("[Delete] Processing lightbox logic...");
        if (lightboxPhotos.value.length > 1) {
          if (currentPhotoIndex.value >= lightboxPhotos.value.length - 1) {
            const newIndex = Math.max(0, lightboxPhotos.value.length - 2);
            console.log("[Delete] Adjusting index from", currentPhotoIndex.value, "to", newIndex);
            currentPhotoIndex.value = newIndex;
          }
        } else {
          console.log("[Delete] Closing lightbox (<=1 photos)");
          closeLightbox();
        }
      }
      closeDeletePhotoDialog();
      console.log("[Delete] Dialog closed");
    } else {
      error.value = response.error || "Failed to delete photo";
      console.log("[Delete] Error from API:", error.value);
    }
  } catch (err) {
    error.value = `Failed to delete photo: ${err.message}`;
    console.log("[Delete] Exception:", err);
  } finally {
    deletingPhoto.value = false;
  }
};

const closeDeletePhotoDialog = () => {
  showDeletePhotoDialog.value = false;
  photoToDelete.value = null;
  deletingPhoto.value = false;
  console.log("[Delete] Dialog closed (cancel or after delete)");
};

// Progressive loading and performance
const trackProgressiveLoadingStats = () => {
  const allImages = document.querySelectorAll(".photo-image");
  const preloadedImages = document.querySelectorAll('.photo-image[data-full-loaded="true"]');
  const totalImages = allImages.length;
  const preloadedCount = preloadedImages.length;
  const preloadPercentage = totalImages > 0 ? Math.round((preloadedCount / totalImages) * 100) : 0;

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
    const photo = visiblePhotos.value.find((p) => p.name === photoName);
    if (photo) {
      setTimeout(() => {
        loadImageProgressively(photo, img);
      }, index * 100);
    }
  });
};

const preloadVisibleImages = () => {
  const imageElements = document.querySelectorAll('.photo-image[loading="lazy"]');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const photoName = img.alt;
          const photo = visiblePhotos.value.find((p) => p.name === photoName);
          if (photo) {
            loadImageProgressively(photo, img);
          }
          observer.unobserve(img);
        }
      });
    },
    { rootMargin: "100px", threshold: 0.1 }
  );
  imageElements.forEach((img) => observer.observe(img));
};

// SSE Methods for Upload Processing
const startProcessingListener = (jobId) => {
  console.log("Starting SSE processing listener for jobId:", jobId);
  if (eventSource.value) {
    eventSource.value.close();
  }

  processingJobId.value = jobId;
  processingNotifications.value = true;
  processingStatus.value = "Starting photo processing...";

  const sseUrl = apiService.getProcessingStatusUrl(jobId);
  eventSource.value = new EventSource(sseUrl);

  eventSource.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("SSE message received:", data);
      handleProcessingUpdate(data);
    } catch (error) {
      console.error("Error parsing SSE message:", error);
    }
  };

  eventSource.value.onerror = (error) => {
    console.error("SSE connection error:", error);
    setTimeout(() => {
      if (processingNotifications.value) {
        startProcessingListener(jobId);
      }
    }, 5000);
  };

  setTimeout(() => {
    if (eventSource.value) {
      stopProcessingListener();
    }
  }, 600000);
};

const handleProcessingUpdate = (data) => {
  console.log("Processing update:", data.type, data.message);
  switch (data.type) {
    case "connected":
      processingStatus.value = "Connected to photo processing service...";
      break;
    case "complete":
      processingStatus.value = "Photo processing complete! 🎉";
      showProcessingCompleteNotification();
      setTimeout(async () => {
        await refreshAlbum();
        console.log("Album refreshed after processing complete");
        stopProcessingListener();
      }, 2000);
      break;
    case "failed":
      processingStatus.value = "Photo processing failed. Please try again.";
      setTimeout(() => {
        stopProcessingListener();
      }, 5000);
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
  console.log("📸 Photo processing complete notification");
};

const stopProcessingListener = () => {
  console.log("Stopping SSE processing listener >>> ", eventSource.value);
  if (eventSource.value) {
    eventSource.value.close();
    eventSource.value = null;
  }
  processingNotifications.value = false;
  processingStatus.value = "";
  processingJobId.value = null;
};

// Lifecycle
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
  // Clean up SSE connection
  stopProcessingListener();
});
</script>