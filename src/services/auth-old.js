// HBVU PHOTOS Authentication Service
// Handles user authentication and authorization

class AuthService {
  constructor() {
    this.currentUser = null
    this.token = localStorage.getItem('hbvu_auth_token')
    this.isInitialized = false
  }

  // Initialize auth service and restore session
  async init() {
    if (this.token) {
      try {
        await this.validateToken()
      } catch (error) {
        console.warn('Token validation failed, clearing auth:', error)
        this.clearAuth()
      }
    }
    this.isInitialized = true
  }

  // Logout and clear session
  logout() {
    this.clearAuth()
    return { success: true }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!(this.token && this.currentUser)
  }

  // Check if user is admin
  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin'
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser
  }

  // Get auth token
  getToken() {
    return this.token
  }

  // Validate token with backend (simulated)
  async validateToken() {
    if (!this.token) {
      throw new Error('No token available')
    }

    // Simulate token validation
    // In production, this would call your backend validation endpoint
    const isValid = await this.simulateTokenValidation(this.token)
    
    if (isValid) {
      // Restore user from localStorage if token is valid
      const storedUser = localStorage.getItem('hbvu_user')
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser)
      }
    } else {
      throw new Error('Invalid token')
    }
  }

  // Clear authentication state
  clearAuth() {
    this.token = null
    this.currentUser = null
    localStorage.removeItem('hbvu_auth_token')
    localStorage.removeItem('hbvu_user')
  }

  // Check if action requires admin privileges
  requiresAdmin(action) {
    const adminActions = [
      'upload_photos',
      'create_album',
      'delete_album',
      'delete_photo',
      'manage_users'
    ]
    return adminActions.includes(action)
  }

  // Check if user can perform action
  canPerformAction(action) {
    if (!this.isAuthenticated()) {
      return false
    }

    if (this.requiresAdmin(action)) {
      return this.isAdmin()
    }

    return true // Regular users can view photos
  }


}

export default new AuthService()
