// PhotoVault API Service
// Handles all communication with the PhotoVault Express API

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://vault-api.hbvu.su'

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // Health check
  async getHealth() {
    return this.request('/health')
  }

  // Bucket operations
  async getBuckets() {
    return this.request('/buckets')
  }

  async getBucketStats(bucketName) {
    return this.request(`/buckets/${bucketName}/stats`)
  }

  async createBucket(bucketName) {
    return this.request('/buckets', {
      method: 'POST',
      body: JSON.stringify({ bucketName })
    })
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
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData, // Don't set Content-Type for FormData
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('File upload failed:', error)
      throw error
    }
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
}

export default new ApiService()
