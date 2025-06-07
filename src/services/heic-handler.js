// Advanced HEIC handling strategies for PhotoVault Frontend
import heic2any from 'heic2any';

class AdvancedHeicHandler {
  constructor() {
    this.conversionCache = new Map();
    this.conversionQueue = new Map();
    this.maxCacheSize = 50; // Limit cache to prevent memory issues
    this.workerPool = [];
    this.initializeWorkers();
  }

  /**
   * Initialize Web Workers for HEIC conversion (if available)
   */
  initializeWorkers() {
    if (typeof Worker !== 'undefined') {
      try {
        // Note: This would require a separate worker file
        // For now, we'll use the main thread but this shows the concept
      } catch (error) {
        // Web Workers not available, using main thread
      }
    }
  }

  /**
   * Strategy 1: Progressive Loading with Multiple Qualities
   */
  async progressiveConvert(heicBlob, photoName) {
    // First, create a very low quality thumbnail quickly
    const thumbnail = await this.createThumbnail(heicBlob);
    
    // Then, create a medium quality version
    const medium = await this.createMediumQuality(heicBlob);
    
    // Finally, create full quality if needed
    const full = await this.createFullQuality(heicBlob);
    
    return {
      thumbnail,
      medium,
      full,
      currentBest: medium // Start with medium for good balance
    };
  }

  /**
   * Strategy 2: Smart Caching with LRU eviction
   */
  getCachedConversion(photoName) {
    if (this.conversionCache.has(photoName)) {
      const cached = this.conversionCache.get(photoName);
      // Move to end (most recently used)
      this.conversionCache.delete(photoName);
      this.conversionCache.set(photoName, cached);
      return cached;
    }
    return null;
  }

  setCachedConversion(photoName, result) {
    // Implement LRU cache
    if (this.conversionCache.size >= this.maxCacheSize) {
      // Remove least recently used (first entry)
      const firstKey = this.conversionCache.keys().next().value;
      const firstValue = this.conversionCache.get(firstKey);
      
      // Cleanup blob URLs
      if (firstValue && firstValue.thumbnail) {
        URL.revokeObjectURL(firstValue.thumbnail);
      }
      if (firstValue && firstValue.medium) {
        URL.revokeObjectURL(firstValue.medium);
      }
      if (firstValue && firstValue.full) {
        URL.revokeObjectURL(firstValue.full);
      }
      
      this.conversionCache.delete(firstKey);
    }
    
    this.conversionCache.set(photoName, result);
  }

  /**
   * Strategy 3: Batch Processing for Better Performance
   */
  async batchConvert(heicFiles, onProgress = null) {
    const results = {};
    const total = heicFiles.length;
    
    for (let i = 0; i < heicFiles.length; i++) {
      const file = heicFiles[i];
      
      try {
        // Check cache first
        const cached = this.getCachedConversion(file.name);
        if (cached) {
          results[file.name] = cached;
        } else {
          // Convert with progressive loading
          const result = await this.progressiveConvert(file.blob, file.name);
          results[file.name] = result;
          this.setCachedConversion(file.name, result);
        }
        
        if (onProgress) {
          onProgress(((i + 1) / total) * 100, file.name);
        }
        
        // Add small delay to prevent UI blocking
        if (i < heicFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
      } catch (error) {
        console.error(`Failed to convert ${file.name}:`, error);
        results[file.name] = { error: error.message };
      }
    }
    
    return results;
  }

  /**
   * Strategy 4: Viewport-Based Conversion Priority
   */
  prioritizeVisibleImages(heicFiles, visibleIndices) {
    // Sort files so visible ones are converted first
    const visible = heicFiles.filter((_, index) => visibleIndices.includes(index));
    const hidden = heicFiles.filter((_, index) => !visibleIndices.includes(index));
    
    return [...visible, ...hidden];
  }

  /**
   * Create thumbnail quickly (small size, lower quality)
   */
  async createThumbnail(heicBlob) {
    try {
      const converted = await heic2any({
        blob: heicBlob,
        toType: 'image/jpeg',
        quality: 0.6,
        maxWidth: 300,
        maxHeight: 300
      });
      
      return URL.createObjectURL(converted);
    } catch (error) {
      throw new Error(`Thumbnail conversion failed: ${error.message}`);
    }
  }

  /**
   * Create medium quality version (good balance)
   */
  async createMediumQuality(heicBlob) {
    try {
      const converted = await heic2any({
        blob: heicBlob,
        toType: 'image/jpeg',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800
      });
      
      return URL.createObjectURL(converted);
    } catch (error) {
      throw new Error(`Medium quality conversion failed: ${error.message}`);
    }
  }

  /**
   * Create full quality version (best quality)
   */
  async createFullQuality(heicBlob) {
    try {
      const converted = await heic2any({
        blob: heicBlob,
        toType: 'image/jpeg',
        quality: 0.9,
        maxWidth: 1920,
        maxHeight: 1920
      });
      
      return URL.createObjectURL(converted);
    } catch (error) {
      throw new Error(`Full quality conversion failed: ${error.message}`);
    }
  }

  /**
   * Strategy 5: Server-Side Fallback Detection
   */
  async checkServerSideVariants(bucketName, photoName, apiService) {
    const baseName = photoName.replace(/\.(heic|heif)$/i, '');
    
    const variants = ['thumbnail', 'medium', 'large'];
    const availableVariants = {};
    
    for (const variant of variants) {
      try {
        const variantName = `${baseName}_${variant}.jpeg`;
        // Check if server-side processed variant exists
        const response = await fetch(apiService.getObjectUrl(bucketName, variantName), { method: 'HEAD' });
        
        if (response.ok) {
          availableVariants[variant] = apiService.getObjectUrl(bucketName, variantName);
        }
      } catch (error) {
        // Variant doesn't exist, continue
      }
    }
    
    return Object.keys(availableVariants).length > 0 ? availableVariants : null;
  }

  /**
   * Main conversion method with all strategies combined
   */
  async convertWithStrategy(photo, bucketName, apiService, strategy = 'smart') {
    const photoName = photo.name;
    
    // Strategy 1: Check if server-side variants exist
    const serverVariants = await this.checkServerSideVariants(bucketName, photoName, apiService);
    if (serverVariants) {
      return {
        thumbnail: serverVariants.thumbnail,
        medium: serverVariants.medium || serverVariants.thumbnail,
        full: serverVariants.large || serverVariants.medium || serverVariants.thumbnail,
        source: 'server'
      };
    }
    
    // Strategy 2: Check cache
    const cached = this.getCachedConversion(photoName);
    if (cached) {
      return cached;
    }
    
    // Strategy 3: Client-side conversion with chosen strategy
    
    try {
      const response = await fetch(apiService.getObjectUrl(bucketName, photoName));
      if (!response.ok) {
        throw new Error(`Failed to fetch HEIC file: ${response.statusText}`);
      }
      
      const heicBlob = await response.blob();
      
      let result;
      switch (strategy) {
        case 'progressive':
          result = await this.progressiveConvert(heicBlob, photoName);
          break;
        case 'thumbnail-first':
          result = {
            thumbnail: await this.createThumbnail(heicBlob),
            source: 'client-thumbnail'
          };
          break;
        case 'medium-quality':
          result = {
            medium: await this.createMediumQuality(heicBlob),
            source: 'client-medium'
          };
          break;
        default: // 'smart'
          // Adaptive strategy based on viewport size and device
          const isMobile = window.innerWidth < 768;
          if (isMobile) {
            result = {
              thumbnail: await this.createThumbnail(heicBlob),
              source: 'client-mobile'
            };
          } else {
            result = {
              thumbnail: await this.createThumbnail(heicBlob),
              medium: await this.createMediumQuality(heicBlob),
              source: 'client-desktop'
            };
          }
      }
      
      this.setCachedConversion(photoName, result);
      return result;
      
    } catch (error) {
      throw new Error(`HEIC conversion failed: ${error.message}`);
    }
  }

  /**
   * Cleanup method
   */
  cleanup() {
    // Clean up all cached blob URLs
    for (const [key, value] of this.conversionCache) {
      if (value.thumbnail) URL.revokeObjectURL(value.thumbnail);
      if (value.medium) URL.revokeObjectURL(value.medium);
      if (value.full) URL.revokeObjectURL(value.full);
    }
    this.conversionCache.clear();
  }
}

export default AdvancedHeicHandler;
