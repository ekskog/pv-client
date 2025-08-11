<template>
  <div class="user-management">
    <div class="user-management-header">
      <h1>User Management</h1>
      <p class="subtitle">Manage system users and permissions</p>
      <button class="btn-primary" @click="showCreateDialog = true">
        <i class="fas fa-user-plus"></i> Add New User
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading users...</p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error">
      <p><i class="fas fa-exclamation-triangle"></i> {{ error }}</p>
      <button class="btn-secondary" @click="loadUsers">Try Again</button>
    </div>

    <!-- Users Table -->
    <div v-if="!loading && !error" class="users-section">
      <div class="users-table-container">
        <table class="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Created</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" class="user-row">
              <td class="user-info">
                <div class="user-avatar">
                  <i class="fas fa-user"></i>
                </div>
                <div class="user-details">
                  <div class="user-name">{{ user.name }}</div>
                  <div class="user-email">{{ user.email }}</div>
                  <div class="user-username">@{{ user.username }}</div>
                </div>
              </td>
              <td>
                <span class="role-badge" :class="user.role">
                  <i :class="user.role === 'admin' ? 'fas fa-crown' : 'fas fa-user'"></i>
                  {{ user.role === 'admin' ? 'Admin' : 'User' }}
                </span>
              </td>
              <td class="date-cell">
                {{ formatDate(user.createdAt) }}
              </td>
              <td class="date-cell">
                {{ formatDate(user.lastLogin) }}
              </td>
              <td class="actions-cell">
                <div class="action-buttons">
                  <button 
                    class="btn-action btn-edit"
                    @click="editUser(user)"
                    title="Edit User"
                  >
                    <i class="fas fa-edit"></i>
                  </button>
                  <button 
                    class="btn-action btn-password"
                    @click="changePassword(user)"
                    title="Change Password"
                  >
                    <i class="fas fa-key"></i>
                  </button>
                  <button 
                    v-if="user.id !== currentUser?.id"
                    class="btn-action btn-delete"
                    @click="confirmDeleteUser(user)"
                    title="Delete User"
                  >
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div v-if="users.length === 0" class="empty-state">
        <div class="empty-icon"><i class="fas fa-users"></i></div>
        <h3>No Users Found</h3>
        <p>Start by adding your first user to the system.</p>
        <button class="btn-primary" @click="showCreateDialog = true">
          Add User
        </button>
      </div>
    </div>

    <!-- Create User Dialog -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click="closeCreateDialog">
      <div class="dialog" @click.stop>
        <h3>{{ isEditing ? 'Edit User' : 'Create New User' }}</h3>
        <form @submit.prevent="saveUser" class="user-form">
          <div class="form-group">
            <label for="name">Full Name:</label>
            <input 
              id="name"
              v-model="formData.name" 
              type="text" 
              placeholder="Enter full name..."
              required
            />
          </div>
          
          <div class="form-group">
            <label for="username">Username:</label>
            <input 
              id="username"
              v-model="formData.username" 
              type="text" 
              placeholder="Enter username..."
              required
            />
          </div>
          
          <div class="form-group">
            <label for="email">Email:</label>
            <input 
              id="email"
              v-model="formData.email" 
              type="email" 
              placeholder="Enter email address..."
              required
            />
          </div>
          
          <div class="form-group" v-if="!isEditing">
            <label for="password">Password:</label>
            <input 
              id="password"
              v-model="formData.password" 
              type="password" 
              placeholder="Enter password..."
              required
            />
          </div>
          
          <div class="form-group">
            <label for="role">Role:</label>
            <select id="role" v-model="formData.role" required>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </form>
        
        <div class="dialog-actions">
          <button class="btn-secondary" @click="closeCreateDialog">Cancel</button>
          <button 
            class="btn-primary" 
            @click="saveUser"
            :disabled="!isFormValid || saving"
          >
            {{ saving ? 'Saving...' : (isEditing ? 'Update User' : 'Create User') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteDialog" class="dialog-overlay" @click="closeDeleteDialog">
      <div class="dialog" @click.stop>
        <h3>Delete User</h3>
        <p>Are you sure you want to delete user "<strong>{{ userToDelete?.name }}</strong>"?</p>
        <p class="warning"><i class="fas fa-exclamation-triangle"></i> This action cannot be undone.</p>
        <div class="dialog-actions">
          <button class="btn-secondary" @click="closeDeleteDialog">Cancel</button>
          <button 
            class="btn-danger" 
            @click="deleteUser"
            :disabled="deleting"
          >
            {{ deleting ? 'Deleting...' : 'Delete User' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Password Change Dialog -->
    <PasswordChange
      v-if="showPasswordDialog"
      :user="passwordUser"
      :show="showPasswordDialog"
      @close="closePasswordDialog"
      @success="handlePasswordSuccess"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import authService from '../services/auth.js'
import PasswordChange from './PasswordChange.vue'

// Reactive state
const loading = ref(false)
const error = ref(null)
const users = ref([])
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const showPasswordDialog = ref(false)
const isEditing = ref(false)
const saving = ref(false)
const deleting = ref(false)
const userToDelete = ref(null)
const passwordUser = ref(null)
const editingUserId = ref(null)

// Form data
const formData = ref({
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'user'
})

// Current user
const currentUser = computed(() => authService.getCurrentUser())

// Form validation
const isFormValid = computed(() => {
  return formData.value.name.trim() && 
         formData.value.username.trim() && 
         formData.value.email.trim() && 
         formData.value.role &&
         (isEditing.value || formData.value.password.trim())
})

// Methods
const loadUsers = async () => {
  loading.value = true
  error.value = null
}

const editUser = (user) => {
  isEditing.value = true
  editingUserId.value = user.id
  formData.value = {
    name: user.name,
    username: user.username,
    email: user.email,
    password: '', // Don't pre-fill password
    role: user.role
  }
  showCreateDialog.value = true
}

const saveUser = async () => {
  if (!isFormValid.value) return
  
  saving.value = true
  error.value = null
  
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (isEditing.value) {
      // Update existing user
      const index = users.value.findIndex(u => u.id === editingUserId.value)
      if (index !== -1) {
        users.value[index] = {
          ...users.value[index],
          name: formData.value.name,
          username: formData.value.username,
          email: formData.value.email,
          role: formData.value.role
        }
      }
    } else {
      // Create new user
      const newUser = {
        id: Date.now(), // In real app, this would be generated by backend
        ...formData.value,
        createdAt: new Date().toISOString(),
        lastLogin: null
      }
      delete newUser.password // Don't store password in frontend
      users.value.push(newUser)
    }
    
    closeCreateDialog()
  } catch (err) {
    error.value = `Failed to ${isEditing.value ? 'update' : 'create'} user: ${err.message}`
  } finally {
    saving.value = false
  }
}

const confirmDeleteUser = (user) => {
  userToDelete.value = user
  showDeleteDialog.value = true
}

const deleteUser = async () => {
  if (!userToDelete.value) return
  
  deleting.value = true
  error.value = null
  
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const index = users.value.findIndex(u => u.id === userToDelete.value.id)
    if (index !== -1) {
      users.value.splice(index, 1)
    }
    
    closeDeleteDialog()
  } catch (err) {
    error.value = `Failed to delete user: ${err.message}`
  } finally {
    deleting.value = false
  }
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
  isEditing.value = false
  editingUserId.value = null
  formData.value = {
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'user'
  }
  saving.value = false
}

const closeDeleteDialog = () => {
  showDeleteDialog.value = false
  userToDelete.value = null
  deleting.value = false
}

const changePassword = (user) => {
  passwordUser.value = user
  showPasswordDialog.value = true
}

const closePasswordDialog = () => {
  showPasswordDialog.value = false
  passwordUser.value = null
}

const handlePasswordSuccess = (data) => {
  // Show success message
  console.log(`Password changed successfully for user ${data.userId}`)
  
  // If user changed their own password, they might need to re-authenticate
  if (data.isOwnPassword) {
    // In a real app, you might want to redirect to login or show a message
    console.log('User changed their own password')
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return 'Invalid date'
  }
}

// Lifecycle
onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.user-management {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.user-management-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.user-management-header h1 {
  font-size: 2rem;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.subtitle {
  font-size: 1rem;
  color: #666;
  margin: 0.25rem 0 0 0;
}

.btn-primary {
  background: #2196f3;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 3rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #2196f3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  text-align: center;
  padding: 2rem;
  background: #ffebee;
  border-radius: 8px;
  color: #c62828;
  margin-bottom: 2rem;
}

.users-table-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th {
  background: #f8f9fa;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 1px solid #dee2e6;
}

.users-table td {
  padding: 1rem;
  border-bottom: 1px solid #f8f9fa;
}

.user-row:hover {
  background: #f8f9ff;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  background: #e3f2fd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1976d2;
  font-size: 1.2rem;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-name {
  font-weight: 600;
  color: #333;
}

.user-email {
  font-size: 0.9rem;
  color: #666;
}

.user-username {
  font-size: 0.8rem;
  color: #999;
  font-family: monospace;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 600;
}

.role-badge.admin {
  background: #fff3e0;
  color: #f57c00;
}

.role-badge.user {
  background: #e8f5e8;
  color: #2e7d32;
}

.date-cell {
  font-size: 0.9rem;
  color: #666;
}

.actions-cell {
  width: 120px;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-action {
  background: none;
  border: 1px solid #dee2e6;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-edit {
  color: #1976d2;
}

.btn-edit:hover {
  background: #e3f2fd;
  border-color: #1976d2;
}

.btn-password {
  color: #f57c00;
}

.btn-password:hover {
  background: #fff3e0;
  border-color: #f57c00;
}

.btn-delete {
  color: #d32f2f;
}

.btn-delete:hover {
  background: #ffebee;
  border-color: #d32f2f;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.empty-icon {
  font-size: 4rem;
  color: #ccc;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.5rem;
  color: #333;
  margin: 0 0 1rem 0;
}

.empty-state p {
  color: #666;
  margin: 0 0 2rem 0;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  min-width: 400px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.dialog h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
}

.user-form {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-danger {
  background: #f44336;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.btn-danger:hover:not(:disabled) {
  background: #d32f2f;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.warning {
  color: #ff9800;
  font-size: 0.9rem;
  margin: 1rem 0;
}

@media (max-width: 768px) {
  .user-management {
    padding: 1rem;
  }
  
  .user-management-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .users-table-container {
    overflow-x: auto;
  }
  
  .users-table {
    min-width: 600px;
  }
  
  .dialog {
    min-width: auto;
    margin: 1rem;
  }
}
</style>
