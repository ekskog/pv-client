// Updated HEIC handling for AlbumViewer.vue
// This replaces the current HEIC conversion logic

import AdvancedHeicHandler from '../services/heic-handler.js'

// Initialize the advanced HEIC handler
const heicHandler = new AdvancedHeicHandler()

// Updated function to get photo URL with server-side variant support
const getPhotoUrl = (photo) => {
  if (!isHeicFile(photo.name)) {
    return apiService.getObjectUrl(BUCKET_NAME, photo.name)
  }
  
  // For HEIC files, check if we have server-processed variants
  const baseName = photo.name.replace(/\.(heic|heif)$/i, '')
  
  // Try medium quality variant first (best balance)
  const mediumVariant = `${baseName}_medium.jpeg`
  return apiService.getObjectUrl(BUCKET_NAME, mediumVariant)
}

// Updated function for optimized photo URLs (thumbnails)
const getOptimizedPhotoUrl = (photo) => {
  if (!isHeicFile(photo.name)) {
    return apiService.getObjectUrl(BUCKET_NAME, photo.name)
  }
  
  // For HEIC files, use thumbnail variant
  const baseName = photo.name.replace(/\.(heic|heif)$/i, '')
  const thumbnailVariant = `${baseName}_thumbnail.jpeg`
  return apiService.getObjectUrl(BUCKET_NAME, thumbnailVariant)
}

// Updated HEIC conversion with server-side variant detection
const convertHeicImageOnDemand = async (photo) => {
  if (heicConversionStates.value[photo.name] === 'success' || 
      heicConversionStates.value[photo.name] === 'loading') {
    return
  }
  
  heicConversionStates.value = { 
    ...heicConversionStates.value, 
    [photo.name]: 'loading' 
  }
  
  try {
    // Use advanced HEIC handler with server-side variant detection
    const result = await heicHandler.convertWithStrategy(photo, BUCKET_NAME, apiService, 'smart')
    
    // Update state with the best available variant
    const bestUrl = result.medium || result.thumbnail || result.full
    convertedImages.value = { ...convertedImages.value, [photo.name]: bestUrl }
    heicConversionStates.value = { ...heicConversionStates.value, [photo.name]: 'success' }
    
  } catch (error) {
    console.error(`❌ HEIC conversion failed: ${photo.name}`, error)
    heicConversionStates.value = { ...heicConversionStates.value, [photo.name]: 'error' }
  }
}

// Batch convert visible HEIC images with smart prioritization
const batchConvertVisibleHeic = async () => {
  const heicPhotos = photos.value.filter(photo => 
    isHeicFile(photo.name) && 
    heicConversionStates.value[photo.name] === 'pending'
  )
  
  if (heicPhotos.length === 0) return
  
  // Convert in batches to avoid overwhelming the browser
  const batchSize = 3
  for (let i = 0; i < heicPhotos.length; i += batchSize) {
    const batch = heicPhotos.slice(i, i + batchSize)
    
    await Promise.all(
      batch.map(photo => convertHeicImageOnDemand(photo))
    )
    
    // Small delay between batches
    if (i + batchSize < heicPhotos.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}

// Check if server-side variants exist for a photo
const checkServerVariants = async (photo) => {
  if (!isHeicFile(photo.name)) return null
  
  const baseName = photo.name.replace(/\.(heic|heif)$/i, '')
  const variants = ['thumbnail', 'medium', 'large']
  const available = {}
  
  for (const variant of variants) {
    try {
      const variantName = `${baseName}_${variant}.jpeg`
      const response = await fetch(apiService.getObjectUrl(BUCKET_NAME, variantName), { method: 'HEAD' })
      
      if (response.ok) {
        available[variant] = apiService.getObjectUrl(BUCKET_NAME, variantName)
      }
    } catch (error) {
      // Variant doesn't exist
    }
  }
  
  return Object.keys(available).length > 0 ? available : null
}

export {
  heicHandler,
  getPhotoUrl,
  getOptimizedPhotoUrl,
  convertHeicImageOnDemand,
  batchConvertVisibleHeic,
  checkServerVariants
}
