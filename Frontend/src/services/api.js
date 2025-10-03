import axios from 'axios'
import router from '../router'

const baseURL = import.meta?.env?.VITE_API_BASE || '/api'
const api = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Attach Authorization header if token exists
api.interceptors.request.use((cfg) => {
    try {
        const token = localStorage.getItem('token')
        if (token) cfg.headers = { ...cfg.headers, Authorization: `Bearer ${token}` }
    } catch (e) {
        // ignore (e.g., SSR or private mode)
    }
    return cfg
})

// Handle 401 globally: clear token and redirect to login
let isRefreshing = false
let pendingRequests = []

api.interceptors.response.use(
    (res) => res,
    (error) => {
        const status = error?.response?.status
        const originalRequest = error.config
        const url = originalRequest?.url || ''
        // Don't refresh for auth endpoints to avoid loops
        const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh')
        if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            originalRequest._retry = true
            // If already refreshing, queue the request
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pendingRequests.push({ resolve, reject, originalRequest })
                })
            }
            isRefreshing = true
            return api.post('/auth/refresh').then((r) => {
                const newToken = r.data.token
                try { localStorage.setItem('token', newToken) } catch (e) { }
                // Resolve queued requests with new token
                pendingRequests.forEach(({ resolve, originalRequest }) => {
                    originalRequest.headers = {
                        ...originalRequest.headers,
                        Authorization: `Bearer ${newToken}`,
                    }
                    resolve(api(originalRequest))
                })
                pendingRequests = []
                // Retry current request
                originalRequest.headers = {
                    ...originalRequest.headers,
                    Authorization: `Bearer ${newToken}`,
                }
                return api(originalRequest)
            }).catch((e) => {
                pendingRequests.forEach(({ reject }) => reject(e))
                pendingRequests = []
                try { localStorage.removeItem('token') } catch (e) { }
                if (router.currentRoute.value.name !== 'Login') router.push({ name: 'Login' })
                return Promise.reject(e)
            }).finally(() => {
                isRefreshing = false
            })
        }
        // For other statuses or after retry, redirect on 401
        if (status === 401) {
            try { localStorage.removeItem('token') } catch (e) { }
            if (router.currentRoute.value.name !== 'Login') router.push({ name: 'Login' })
        }
        return Promise.reject(error)
    }
)

export default api
