// HBVU PHOTOS Authentication Service
// Secure authentication service with environment variable configuration

const AUTH_TOKEN_KEY = "hbvu_auth_token";
const USER_DATA_KEY = "hbvu_user_data";

// Configuration from environment variables
const config = {
  apiUrl: import.meta.env.VITE_API_URL,
  authEndpoint: import.meta.env.VITE_AUTH_ENDPOINT || "/api/auth/login",
  userEndpoint: import.meta.env.VITE_USER_ENDPOINT || "/api/users",
};

// Production authentication function
async function productionLogin(username, password) {
  const response = await fetch(`${config.apiUrl}${config.authEndpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Login failed" }));
    throw new Error(error.message || "Authentication failed");
  }

  return await response.json();
}

// Validate token with backend
async function validateToken(token) {
  // Production token validation
  const response = await fetch(`${config.apiUrl}/api/auth/validate`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.ok;
}

class AuthService {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem(AUTH_TOKEN_KEY);
    this.isInitialized = false;
  }

  // Initialize auth service and restore session
  async init() {
    if (this.token) {
      try {
        if (await validateToken(this.token)) {
          const userData = localStorage.getItem(USER_DATA_KEY);
          if (userData) {
            this.currentUser = JSON.parse(userData);
          }
        } else {
          this.clearAuth();
        }
      } catch (error) {
        console.warn("Token validation failed, clearing auth:", error);
        this.clearAuth();
      }
    }
    this.isInitialized = true;
  }

  // Login with username and password
  async login(username, password) {
    try {
      let response;

      response = await productionLogin(username, password);

      this.token = response.token;
      this.currentUser = response.user;

      localStorage.setItem(AUTH_TOKEN_KEY, this.token);
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(this.currentUser));

      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error("Login error:", error);
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
    return this.currentUser && this.currentUser.role === "admin";
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
    const adminActions = [
      "upload_photos",
      "create_album",
      "delete_album",
      "delete_photo",
      "manage_users",
    ];
    if (adminActions.includes(action)) {
      return this.isAdmin();
    }

    return true; // Regular users can view content
  }

  // User management methods (for demo mode)
  async getUsers() {
    // Production: fetch from backend
    const response = await fetch(`${config.apiUrl}${config.userEndpoint}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch users");
    }

    return await response.json();
  }

  async createUser(userData) {
    // Production: create user via backend
    const response = await fetch(`${config.apiUrl}${config.userEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Failed to create user" }));
      throw new Error(error.message);
    }

    return await response.json();
  }

  async updateUser(userId, userData) {

      // Production: update user via backend
      const response = await fetch(
        `${config.apiUrl}${config.userEndpoint}/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify(userData),
        }
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Failed to update user" }));
        throw new Error(error.message);
      }

      return await response.json();
    
  }

  async deleteUser(userId) {

      // Production: delete user via backend
      const response = await fetch(
        `${config.apiUrl}${config.userEndpoint}/${userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Failed to delete user" }));
        throw new Error(error.message);
      }

      return true;
    
  }

}

export default new AuthService();
