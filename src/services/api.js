// PhotoVault API Service
// Handles all communication with the PhotoVault Express API

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

  // File upload
  async uploadFile(bucketName, objectName, formData) {
    const url = `${API_BASE_URL}/buckets/${bucketName}/objects/${encodeURIComponent(objectName)}`
    
    try {
      const response = await fetch(url, {
        method: 'PUT',
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

  // Delete object
  async deleteObject(bucketName, objectName) {
    return this.request(`/buckets/${bucketName}/objects/${encodeURIComponent(objectName)}`, {
      method: 'DELETE'
    })
  }

  // Get object URL for display
  getObjectUrl(bucketName, objectName) {
    return `${API_BASE_URL}/buckets/${bucketName}/objects/${encodeURIComponent(objectName)}`
  }
}

export default new ApiService()
