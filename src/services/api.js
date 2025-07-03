// HBVU PHOTOS API Service
// Handles all communication with the HBVU PHOTOS Express API

import configService from './config.js'

class ApiService {
  constructor() {
    this.authService = null // Will be set by auth service
  }

  // Get current API base URL
  getApiBaseUrl() {
    return configService.getApiUrl()
  }

  // Set auth service reference (to avoid circular imports)
  setAuthService(authService) {
    this.authService = authService
  }

  // Get authentication token
  getAuthToken() {
    return localStorage.getItem('hbvu_auth_token')
  }

  async request(endpoint, options = {}) {
    const API_BASE_URL = this.getApiBaseUrl()
    const url = `${API_BASE_URL}${endpoint}`
    
    console.log('🌐 API Call:', url)
    
    // Add authentication headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Add auth token if available
    const token = this.getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const config = {
      headers,
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401) {
        console.warn('Authentication failed - clearing tokens and redirecting to login');
        
        // Clear invalid token
        localStorage.removeItem('hbvu_auth_token')
        localStorage.removeItem('hbvu_user_data')
        
        // Clear auth service state if available
        if (this.authService) {
          this.authService.clearAuth()
        }
        
        // Force page reload to show login screen
        setTimeout(() => {
          window.location.reload();
        }, 100);
        
        throw new Error('Invalid or expired token')
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }))
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      throw error
    }
  }

  // Health check
  async getHealth() {
    return this.request('/health')
  }

  // Folder/Object operations
  async getBucketContents(bucketName, prefix = '', options = {}) {
    const endpoint = prefix 
      ? `/buckets/${bucketName}/objects?prefix=${encodeURIComponent(prefix)}`
      : `/buckets/${bucketName}/objects`
    return this.request(endpoint, options)
  }

  async createFolder(bucketName, folderPath) {
    return this.request(`/buckets/${bucketName}/folders`, {
      method: 'POST',
      body: JSON.stringify({ folderPath })
    })
  }

  async deleteFolder(bucketName, folderPath) {
    return this.request(`/buckets/${bucketName}/folders`, {
      method: 'DELETE',
      body: JSON.stringify({ folderPath })
    })
  }

  // Delete object
  async deleteObject(bucketName, objectName) {
    return this.request(`/buckets/${bucketName}/objects`, {
      method: 'DELETE',
      body: JSON.stringify({ objectName })
    })
  }

  // File upload - Updated to match API spec
  async uploadFile(bucketName, files, folderPath = '') {
    const formData = new FormData()
    
    // Add files to form data
    if (Array.isArray(files)) {
      files.forEach(file => {
        formData.append('files', file)
      })
    } else {
      formData.append('files', files)
    }
    
    // Add folder path if provided
    if (folderPath) {
      formData.append('folderPath', folderPath)
    }
    
    const API_BASE_URL = this.getApiBaseUrl()
    const url = `${API_BASE_URL}/buckets/${bucketName}/upload`
    
    // Prepare headers (don't set Content-Type for FormData)
    const headers = {}
    
    // Add auth token if available
    const token = this.getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      throw error
    }
  }

  // Single file upload with progress tracking
  async uploadSingleFile(bucketName, file, folderPath = '', onProgress = null) {
    const formData = new FormData()
    formData.append('files', file)
    
    if (folderPath) {
      formData.append('folderPath', folderPath)
    }
    
    const API_BASE_URL = this.getApiBaseUrl()
    const url = `${API_BASE_URL}/buckets/${bucketName}/upload`
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      
      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100
            onProgress(percentComplete)
          }
        })
      }
      
      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response)
          } catch (error) {
            reject(new Error('Invalid JSON response'))
          }
        } else {
          reject(new Error(`HTTP error! status: ${xhr.status}`))
        }
      })
      
      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error occurred'))
      })
      
      // Start the upload - MUST be called before setting headers
      xhr.open('POST', url)
      
      // Add auth header if available - AFTER xhr.open()
      const token = this.getAuthToken()
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }
      
      xhr.send(formData)
    })
  }

  // Object URL generation for downloading/viewing files
  getObjectUrl(bucketName, objectName) {
    const API_BASE_URL = this.getApiBaseUrl()
    return `${API_BASE_URL}/buckets/${bucketName}/download?object=${encodeURIComponent(objectName)}`
  }

  // Job status polling for async uploads
  async getJobStatus(jobId) {
    return this.request(`/upload/status/${jobId}`)
  }

  // Poll job status until completion
  async pollJobUntilComplete(jobId, onProgress = null, maxWaitTime = 300000) { // 5 minutes max
    const startTime = Date.now()
    let pollInterval = 1000 // Start with 1 second
    
    // Mobile optimization: detect if mobile and adjust polling
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    console.log(`📱 [POLLING] Starting job polling - Mobile: ${isMobile}, JobID: ${jobId}`)
    
    if (isMobile) {
      pollInterval = 1500 // Slightly slower on mobile but not too slow
      maxWaitTime = Math.min(maxWaitTime, 600000) // Max 10 minutes on mobile
      console.log(`📱 [POLLING] Mobile settings - Interval: ${pollInterval}ms, MaxWait: ${maxWaitTime}ms`)
    }
    
    return new Promise((resolve, reject) => {
      let consecutiveErrors = 0
      let pollCount = 0
      const maxConsecutiveErrors = 3
      
      const poll = async () => {
        pollCount++
        console.log(`📱 [POLLING] Poll attempt #${pollCount} for job ${jobId}`)
        
        try {
          const result = await this.getJobStatus(jobId)
          console.log(`📱 [POLLING] Poll #${pollCount} response:`, result)
          
          // Reset error counter on successful request
          consecutiveErrors = 0
          
          if (!result.success) {
            console.error(`📱 [POLLING] Poll #${pollCount} failed:`, result.error)
            reject(new Error(result.error || 'Failed to get job status'))
            return
          }
          
          const job = result.data
          console.log(`📱 [POLLING] Job status: ${job.status}, Progress: ${job.progress?.processed}/${job.progress?.total}`)
          
          // Call progress callback if provided
          if (onProgress) {
            try {
              onProgress(job)
            } catch (progressError) {
              console.warn('📱 [POLLING] Progress callback error:', progressError)
            }
          }
          
          // Check if job is complete
          if (job.status === 'completed') {
            console.log(`📱 [POLLING] Job ${jobId} completed after ${pollCount} polls`)
            resolve(job)
            return
          }
          
          if (job.status === 'failed') {
            console.error(`📱 [POLLING] Job ${jobId} failed:`, job.error)
            reject(new Error(job.error || 'Upload job failed'))
            return
          }
          
          // Check timeout
          const elapsedTime = Date.now() - startTime
          if (elapsedTime > maxWaitTime) {
            console.error(`📱 [POLLING] Job ${jobId} timed out after ${elapsedTime}ms (${pollCount} polls)`)
            reject(new Error('Job polling timeout'))
            return
          }
          
          // Continue polling if job is still processing
          if (job.status === 'queued' || job.status === 'processing') {
            // Mobile-specific: Use requestAnimationFrame for better mobile compatibility
            const scheduleNextPoll = () => {
              console.log(`📱 [POLLING] Scheduling next poll in ${pollInterval}ms`)
              if (isMobile && 'requestIdleCallback' in window) {
                // Use idle callback on mobile when available
                requestIdleCallback(() => setTimeout(poll, pollInterval), { timeout: pollInterval + 1000 })
              } else {
                setTimeout(poll, pollInterval)
              }
            }
            
            // Adaptive polling: increase interval on mobile to save battery
            if (isMobile && elapsedTime > 30000) { // After 30s on mobile
              const oldInterval = pollInterval
              pollInterval = Math.min(pollInterval * 1.1, 3000) // Max 3s interval, gentler increase
              if (oldInterval !== pollInterval) {
                console.log(`📱 [POLLING] Adjusted mobile polling interval to ${pollInterval}ms`)
              }
            }
            
            scheduleNextPoll()
          } else {
            console.error(`📱 [POLLING] Unknown job status: ${job.status}`)
            reject(new Error(`Unknown job status: ${job.status}`))
          }
          
        } catch (error) {
          consecutiveErrors++
          console.warn(`📱 [POLLING] Error ${consecutiveErrors}/${maxConsecutiveErrors} for job ${jobId}:`, error.message)
          
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error(`📱 [POLLING] Too many errors, giving up on job ${jobId}`)
            reject(new Error(`Too many consecutive polling errors: ${error.message}`))
            return
          }
          
          // Exponential backoff on errors, especially important for mobile
          const errorBackoff = Math.min(pollInterval * Math.pow(2, consecutiveErrors), 10000)
          console.log(`📱 [POLLING] Error backoff: waiting ${errorBackoff}ms before retry`)
          setTimeout(poll, errorBackoff)
        }
      }
      
      poll()
    })
  }
}

export default new ApiService()
