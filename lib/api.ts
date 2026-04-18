import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { API_URL } from '../constants'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken')
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken })
        await SecureStore.setItemAsync('accessToken', data.data.accessToken)
        await SecureStore.setItemAsync('refreshToken', data.data.refreshToken)
        original.headers.Authorization = `Bearer ${data.data.accessToken}`
        return api(original)
      } catch {
        await SecureStore.deleteItemAsync('accessToken')
        await SecureStore.deleteItemAsync('refreshToken')
      }
    }
    return Promise.reject(error)
  }
)

export default api

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  sendPhoneOtp: (phone: string) => api.post('/auth/phone/send-otp', { phone }),
  verifyPhoneOtp: (phone: string, otp: string) => api.post('/auth/phone/verify-otp', { phone, otp }),
}

export const tripsApi = {
  search: (params: any) => api.get('/trips/search', { params }),
  getTrip: (id: string) => api.get(`/trips/${id}`),
}

export const bookingsApi = {
  create: (data: any) => api.post('/bookings', data),
  getMyBookings: (params?: any) => api.get('/bookings/my', { params }),
  getBooking: (id: string) => api.get(`/bookings/${id}`),
  cancelPreview: (id: string) => api.patch(`/bookings/${id}/cancel?preview=true`),
  cancel: (id: string) => api.patch(`/bookings/${id}/cancel`),
  confirm: (id: string, ref: string) => api.patch(`/bookings/${id}/confirm`, { payment_reference: ref }),
}

export const paymentsApi = {
  initiate: (booking_id: string) => api.post('/payments/initiate', { booking_id }),
  getStatus: (bookingId: string) => api.get(`/payments/status/${bookingId}`),
}

export const routesApi = {
  getCities: () => api.get('/routes/cities'),
}

export const pickupPointsApi = {
  getByCity: (city: string) => api.get('/pickup-points', { params: { city } }),
}

export const usersApi = {
  updateProfile: (data: FormData) =>
    api.patch('/users/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  changePassword: (data: any) => api.patch('/users/password', data),
  getNotifications: (params?: any) => api.get('/users/notifications', { params }),
  markNotificationRead: (id: string) => api.patch(`/users/notifications/${id}/read`),
  markAllRead: () => api.patch('/users/notifications/read-all'),
}

export const messagesApi = {
  getMessages: (bookingId: string) => api.get(`/messages/${bookingId}`),
  sendMessage: (bookingId: string, content: string) =>
    api.post(`/messages/${bookingId}`, { content }),
}

export const reviewsApi = {
  getStatus: (bookingId: string) => api.get(`/reviews/status/${bookingId}`),
  submit: (data: { booking_id: string; rating: number; comment?: string }) =>
    api.post('/reviews', data),
}
