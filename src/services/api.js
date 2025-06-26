// HBVU PHOTOS API Service
// Handles all communication with the HBVU PHOTOS Express API

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://vault-api.hbvu.su'

class ApiService {
  constructor() {
    this.authService = null // Will be set by auth service
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

  // Delete object - This endpoint doesn't exist in your API
  // async deleteObject(bucketName, objectName) {
  //   return this.request(`/buckets/${bucketName}/objects/${encodeURIComponent(objectName)}`, {
  //     method: 'DELETE'
  //   })
  // }

  // Object URL generation for downloading/viewing files
  getObjectUrl(bucketName, objectName) {
    return `${API_BASE_URL}/buckets/${bucketName}/download?object=${encodeURIComponent(objectName)}`
  }

  // Job status polling for async uploads
  async getJobStatus(jobId) {
    return this.request(`/upload/status/${jobId}`)
  }

  // Poll job status until completion
  async pollJobUntilComplete(jobId, onProgress = null, maxWaitTime = 300000) { // 5 minutes max
    const startTime = Date.now()
    const pollInterval = 1000 // 1 second
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const result = await this.getJobStatus(jobId)
          
          if (!result.success) {
            reject(new Error(result.error || 'Failed to get job status'))
            return
          }
          
          const job = result.data
          
          // Call progress callback if provided
          if (onProgress) {
            onProgress(job)
          }
          
          // Check if job is complete
          if (job.status === 'completed') {
            resolve(job)
            return
          }
          
          if (job.status === 'failed') {
            reject(new Error(job.error || 'Upload job failed'))
            return
          }
          
          // Check timeout
          if (Date.now() - startTime > maxWaitTime) {
            reject(new Error('Job polling timeout'))
            return
          }
          
          // Continue polling if job is still processing
          if (job.status === 'queued' || job.status === 'processing') {
            setTimeout(poll, pollInterval)
          } else {
            reject(new Error(`Unknown job status: ${job.status}`))
          }
          
        } catch (error) {
          reject(error)
        }
      }
      
      poll()
    })
  }
}

export default new ApiService()
