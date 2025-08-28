// HBVU PHOTOS API Service
// Handles all communication with the HBVU PHOTOS Express API

import configService from "./config.js";

class ApiService {
  constructor() {
    this.authService = null; // Will be set by auth service
  }

  // Get current API base URL
  getApiBaseUrl() {
    return configService.getApiUrl();
  }

  // Get SSE URL for processing status
  getProcessingStatusUrl(jobId) {
    const API_BASE_URL = this.getApiBaseUrl();
    return `${API_BASE_URL}/processing-status/${jobId}`;
  }

  // Set auth service reference (to avoid circular imports)
  setAuthService(authService) {
    this.authService = authService;
  }

  // Get authentication token
  getAuthToken() {
    return localStorage.getItem("hbvu_auth_token");
  }

  async request(endpoint, options = {}) {
    // Add this logging

    const API_BASE_URL = this.getApiBaseUrl();
    const url = `${API_BASE_URL}${endpoint}`;

    // Add authentication headers
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } 
    
    const config = {
      headers,
      ...options,
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401) {
        // console.warn('Authentication failed - clearing tokens and redirecting to login');

        // Clear invalid token
        localStorage.removeItem("hbvu_auth_token");
        localStorage.removeItem("hbvu_user_data");

        // Clear auth service state if available
        if (this.authService) {
          this.authService.clearAuth();
        }

        throw new Error("Invalid or expired token");
      }

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new Error(
          errorData.message ||
          errorData.error ||
          `HTTP error! status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Health check
  async getHealth() {
    return this.request("/health");
  }

  async getAlbumContents(bucketName, prefix = "", options = {}) {
    const endpoint = `/buckets/${bucketName}/objects?prefix=${encodeURIComponent(prefix)}`;
    return this.request(endpoint, options);
  }

  // Folder/Object operations
  async getAlbums(bucketName, options = {}) {
    const endpoint = `/albums`;
    return this.request(endpoint, options);
  }

  async createFolder(bucketName, folderPath) {
    return this.request(`/buckets/${bucketName}/folders`, {
      method: "POST",
      body: JSON.stringify({ folderPath }),
    });
  }

  async deleteFolder(bucketName, folderPath) {
    return this.request(`/buckets/${bucketName}/folders`, {
      method: "DELETE",
      body: JSON.stringify({ folderPath }),
    });
  }

  // Delete object
  async deleteObject(bucketName, objectName) {
    return this.request(`/buckets/${bucketName}/objects`, {
      method: "DELETE",
      body: JSON.stringify({ objectName }),
    });
  }

  // File upload - Updated to match API spec
  async uploadFile(bucketName, files, folderPath = "") {
    const formData = new FormData();

    // Add files to form data
    if (Array.isArray(files)) {
      files.forEach((file) => {
        formData.append("files", file);
      });
    } else {
      formData.append("files", files);
    }

    // Add folder path if provided
    if (folderPath) {
      formData.append("folderPath", folderPath);
    }

    const API_BASE_URL = this.getApiBaseUrl();
    const url = `${API_BASE_URL}/buckets/${bucketName}/upload`;

    // Prepare headers (don't set Content-Type for FormData)
    const headers = {};

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Single file upload with progress tracking
  async uploadSingleFile(bucketName, file, folderPath = "", onProgress = null) {
    const formData = new FormData();
    formData.append("files", file);

    if (folderPath) {
      formData.append("folderPath", folderPath);
    }

    const API_BASE_URL = this.getApiBaseUrl();
    const url = `${API_BASE_URL}/buckets/${bucketName}/upload`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(percentComplete);
          }
        });
      }

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error("Invalid JSON response"));
          }
        } else {
          reject(new Error(`HTTP error! status: ${xhr.status}`));
        }
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        reject(new Error("Network error occurred"));
      });

      // Start the upload - MUST be called before setting headers
      xhr.open("POST", url);

      // Add auth header if available - AFTER xhr.open()
      const token = this.getAuthToken();
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  }

  // Object URL generation for downloading/viewing files
  getObjectUrl(bucketName, objectName) {
    const API_BASE_URL = this.getApiBaseUrl();
    return `${API_BASE_URL}/buckets/${bucketName}/download?object=${encodeURIComponent(
      objectName
    )}`;
  }

  // User registration
  async registerUser(userData) {
    return this.request("/user/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }
}

export default new ApiService();
