// HBVU PHOTOS Authentication Service
// Supports both demo and database authentication modes

const AUTH_TOKEN_KEY = 'hbvu_auth_token';
const USER_DATA_KEY = 'hbvu_user_data';

// Configuration with dual-mode authentication support
const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'https://vault-api.hbvu.su',
  authMode: import.meta.env.VITE_AUTH_MODE || 'demo', // 'demo' or 'api'
  authEndpoint: '/auth/login',
  userEndpoint: '/auth/me',
  statusEndpoint: '/auth/status'
};

// Demo users with hardcoded credentials (for demo mode)
const demoUsers = {
  admin: {
    id: 1,
    username: 'admin',
    name: 'Admin User',
    email: 'admin@hbvu.su',
    role: 'admin',
    avatar: '👤',
    password: 'admin123',
    permissions: ['upload_photos', 'create_album', 'delete_album', 'delete_photo', 'manage_users']
  },
  user: {
    id: 2,
    username: 'user',
    name: 'Regular User',
    email: 'user@hbvu.su', 
    role: 'user',
    avatar: '👤',
    password: 'user123',
    permissions: []
  }
};

// Demo authentication function (development only)
async function demoLogin(username, password) {
  // Use the backend API for demo authentication to ensure consistency
  const response = await fetch(`${config.apiUrl}${config.authEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(error.message || 'Authentication failed');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Authentication failed');
  }
  
  return {
    token: data.data.token,
    user: {
      id: data.data.user.id,
      username: data.data.user.username,
      name: data.data.user.username,
      email: data.data.user.email,
      role: data.data.user.role,
      avatar: '👤',
      permissions: data.data.user.role === 'admin' ? 
        ['upload_photos', 'create_album', 'delete_album', 'delete_photo', 'manage_users'] : 
        []
    }
  };
}

// API authentication function (production)
async function apiLogin(username, password) {
  const response = await fetch(`${config.apiUrl}${config.authEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(error.message || 'Authentication failed');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Authentication failed');
  }
  
  return {
    token: data.data.token,
    user: {
      id: data.data.user.id,
      username: data.data.user.username,
      name: data.data.user.username, // Use username as name if no display name
      email: data.data.user.email,
      role: data.data.user.role,
      avatar: '👤',
      permissions: data.data.user.role === 'admin' ? 
        ['upload_photos', 'create_album', 'delete_album', 'delete_photo', 'manage_users'] : 
        []
    }
  };
}

// Validate token with backend
async function validateToken(token) {
  if (config.authMode === 'demo') {
    // For demo mode, validate against the backend to ensure consistency
    try {
      const response = await fetch(`${config.apiUrl}${config.userEndpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.success !== false; // Return true if response is successful
      }
      return false;
    } catch {
      return false;
    }
  } else {
    // API token validation
    try {
      const response = await fetch(`${config.apiUrl}${config.userEndpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}

class AuthService {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem(AUTH_TOKEN_KEY);
    this.isInitialized = false;
    
    // Set up API service reference after import
    this.setupApiService();
  }
  
  // Set up API service reference to avoid circular import issues
  async setupApiService() {
    const { default: apiService } = await import('./api.js');
    apiService.setAuthService(this);
  }

  // Initialize auth service and restore session
  async init() {
    if (this.token) {
      try {
        // Validate token with backend
        const isValid = await validateToken(this.token);
        if (isValid) {
          // Try to get user data from localStorage first
          const userData = localStorage.getItem(USER_DATA_KEY);
          if (userData) {
            this.currentUser = JSON.parse(userData);
          } else {
            // If no cached user data, fetch from backend
            await this.fetchCurrentUser();
          }
        } else {
          console.warn('Token validation failed, clearing auth');
          this.clearAuth();
        }
      } catch (error) {
        console.warn('Token validation failed, clearing auth:', error);
        this.clearAuth();
      }
    }
    this.isInitialized = true;
  }

  // Fetch current user from backend
  async fetchCurrentUser() {
    try {
      const response = await fetch(`${config.apiUrl}${config.userEndpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.user) {
          this.currentUser = {
            id: data.data.user.id,
            username: data.data.user.username,
            name: data.data.user.username,
            email: data.data.user.email,
            role: data.data.user.role,
            avatar: '👤',
            permissions: data.data.user.role === 'admin' ? 
              ['upload_photos', 'create_album', 'delete_album', 'delete_photo', 'manage_users'] : 
              []
          };
          localStorage.setItem(USER_DATA_KEY, JSON.stringify(this.currentUser));
        }
      } else {
        throw new Error('Failed to fetch user data');
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      this.clearAuth();
    }
  }

  // Login with username and password
  async login(username, password) {
    try {
      let response;
      
      if (config.authMode === 'demo') {
        response = await demoLogin(username, password);
      } else {
        response = await apiLogin(username, password);
      }
      
      this.token = response.token;
      this.currentUser = response.user;
      
      localStorage.setItem(AUTH_TOKEN_KEY, this.token);
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(this.currentUser));
      
      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  // Logout and clear session
  logout() {
    this.clearAuth();
    return { success: true };
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!(this.token && this.currentUser);
  }

  // Check if user is admin
  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Get auth token
  getToken() {
    return this.token;
  }

  // Clear authentication state
  clearAuth() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
  }

  // Permission system
  canPerformAction(action) {
    if (!this.isAuthenticated()) {
      return false;
    }

    // Check if user has specific permission
    if (this.currentUser.permissions) {
      return this.currentUser.permissions.includes(action);
    }

    // Fallback to role-based permissions
    const adminActions = ['upload_photos', 'create_album', 'delete_album', 'delete_photo', 'manage_users'];
    if (adminActions.includes(action)) {
      return this.isAdmin();
    }

    return true; // Regular users can view content
  }

  // User management methods (for demo mode)
  async getUsers() {
    if (config.demoMode) {
      return Object.values(demoUsers).map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: '2024-01-01',
        lastLogin: new Date().toISOString()
      }));
    } else {
      // Production: fetch from backend
      const response = await fetch(`${config.apiUrl}${config.userEndpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      return await response.json();
    }
  }

  async createUser(userData) {
    if (config.demoMode) {
      // Demo mode: simulate user creation
      throw new Error('User creation not available in demo mode');
    } else {
      // Production: create user via backend
      const response = await fetch(`${config.apiUrl}${config.userEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to create user' }));
        throw new Error(error.message);
      }
      
      return await response.json();
    }
  }

  async updateUser(userId, userData) {
    if (config.demoMode) {
      // Demo mode: simulate user update
      throw new Error('User updates not available in demo mode');
    } else {
      // Production: update user via backend
      const response = await fetch(`${config.apiUrl}${config.userEndpoint}/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to update user' }));
        throw new Error(error.message);
      }
      
      return await response.json();
    }
  }

  async deleteUser(userId) {
    if (config.demoMode) {
      // Demo mode: simulate user deletion
      throw new Error('User deletion not available in demo mode');
    } else {
      // Production: delete user via backend
      const response = await fetch(`${config.apiUrl}${config.userEndpoint}/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to delete user' }));
        throw new Error(error.message);
      }
      
      return true;
    }
  }

  // Password change method
  async changePassword({ userId, currentPassword, newPassword }) {
    if (config.demoMode) {
      // Demo mode: simulate password change
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // In demo mode, we can't actually change passwords
      // Just validate current password if it's provided
      if (currentPassword) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
          throw new Error('Not authenticated');
        }
        
        // For demo, check against known demo passwords
        const demoUser = Object.values(demoUsers).find(u => u.id === currentUser.id);
        if (demoUser && demoUser.password !== currentPassword) {
          throw new Error('Current password is incorrect');
        }
      }
      
      return { success: true, message: 'Password changed successfully (demo mode)' };
    } else {
      // Production: change password via backend
      const response = await fetch(`${config.apiUrl}${config.userEndpoint}/${userId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to change password' }));
        throw new Error(error.message);
      }
      
      return await response.json();
    }
  }

  // Get configuration info (useful for displaying mode in UI)
  getConfig() {
    return {
      demoMode: config.demoMode,
      hasBackendAuth: !config.demoMode
    };
  }
}

export default new AuthService();
