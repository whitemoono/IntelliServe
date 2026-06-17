import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/system/login'
    }
    return Promise.reject(error)
  },
)

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),
  getMe: () => api.get('/auth/me'),
  listUsers: (params?: Record<string, any>) =>
    api.get('/auth/users', { params }),
  createUser: (data: any) => api.post('/auth/users', data),
  updateUser: (id: string, data: any) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/auth/users/${id}`),
}

// Knowledge Base API
export const kbApi = {
  listArticles: (params?: Record<string, any>) =>
    api.get('/kb/articles', { params }),
  getArticle: (id: string) => api.get(`/kb/articles/${id}`),
  createArticle: (data: any) => api.post('/kb/articles', data),
  updateArticle: (id: string, data: any) =>
    api.put(`/kb/articles/${id}`, data),
  deleteArticle: (id: string) => api.delete(`/kb/articles/${id}`),
  search: (data: {
    query: string
    top_k?: number
    category_filter?: string
    score_threshold?: number
  }) =>
    api.post('/kb/search', data),
  reindex: (id: string) => api.post(`/kb/articles/${id}/reindex`),
  seed: (scope = 'ops') => api.post('/kb/seed', { scope }),
}

// Chatbot API
export const chatbotApi = {
  sendMessage: (message: string, platform = 'web') =>
    api.post('/chatbot/message', { message, platform }),
}

// Health check
export const healthApi = {
  check: () => api.get('/health'),
  configStatus: () => api.get('/config/status'),
}

export default api
