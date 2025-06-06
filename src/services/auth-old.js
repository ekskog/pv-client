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

  // Login with username and password
  async login(username, password) {
    try {
      // For demo purposes, we'll simulate authentication
      // In production, this would call your backend auth endpoint
      const response = await this.simulateLogin(username, password)
      
      if (response.success) {
        this.token = response.token
        this.currentUser = response.user
        localStorage.setItem('hbvu_auth_token', this.token)
        localStorage.setItem('hbvu_user', JSON.stringify(this.currentUser))
        return { success: true, user: this.currentUser }
      } else {
        throw new Error(response.error || 'Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: error.message }
    }
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

  // Simulate login for demo purposes
  // Replace with actual backend call in production
  async simulateLogin(username, password) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Demo credentials
    const demoUsers = [
      {
        id: 1,
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        name: 'Administrator',
        email: 'admin@hbvu.su'
      },
      {
        id: 2,
        username: 'user',
        password: 'user123',
        role: 'user',
        name: 'Regular User',
        email: 'user@hbvu.su'
      }
    ]

    const user = demoUsers.find(u => u.username === username && u.password === password)
    
    if (user) {
      const { password: _, ...userWithoutPassword } = user
      return {
        success: true,
        token: `demo_token_${user.id}_${Date.now()}`,
        user: userWithoutPassword
      }
    } else {
      return {
        success: false,
        error: 'Invalid username or password'
      }
    }
  }

  // Simulate token validation
  async simulateTokenValidation(token) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // For demo, consider all tokens valid if they follow our format
    return token && token.startsWith('demo_token_')
  }

  // Get demo users (for user management)
  async getDemoUsers() {
    return [
      {
        id: 1,
        username: 'admin',
        role: 'admin',
        name: 'Administrator',
        email: 'admin@hbvu.su',
        createdAt: '2024-01-01',
        lastLogin: new Date().toISOString()
      },
      {
        id: 2,
        username: 'user',
        role: 'user',
        name: 'Regular User',
        email: 'user@hbvu.su',
        createdAt: '2024-01-15',
        lastLogin: '2024-06-05'
      }
    ]
  }
}

export default new AuthService()
