import { createApiClient, registerToastCallback, STORAGE_KEYS } from '@transport/shared-api';
import { notification } from '../utils/antdGlobal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Register Ant Design notification adapter
registerToastCallback((title, description, type) => {
  if (type === 'error') {
    notification.error({
      message: title || 'Connection Alert',
      description,
      placement: 'topRight',
    });
  } else if (type === 'success') {
    notification.success({
      message: title || 'Success',
      description,
      placement: 'topRight',
    });
  } else if (type === 'warning') {
    notification.warning({
      message: title || 'Warning',
      description,
      placement: 'topRight',
    });
  } else {
    notification.info({
      message: title || 'Info',
      description,
      placement: 'topRight',
    });
  }
});

const api = createApiClient({
  baseURL: API_BASE_URL,
  getToken: () => localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN),
  getRefreshToken: () => localStorage.getItem(STORAGE_KEYS.ADMIN_REFRESH_TOKEN),
  tokenKey: STORAGE_KEYS.ADMIN_TOKEN,
  refreshTokenKey: STORAGE_KEYS.ADMIN_REFRESH_TOKEN,
  userKey: STORAGE_KEYS.ADMIN_USER,
});

export default api;

// ── Auth API ──────────────────────────────────────────────
export const authAPI = {
  login: (email: string, password: string): Promise<any> =>
    api.post('/auth/login', { email, password }),
  register: (data: { name: string; email: string; phone: string; password: string }): Promise<any> =>
    api.post('/auth/register', data),
  getProfile: (): Promise<any> => api.get('/auth/profile'),
  updateProfile: (data: { name?: string; phone?: string }): Promise<any> =>
    api.put('/auth/profile', data),
  changePasswordRequest: (): Promise<any> =>
    api.post('/auth/change-password-request'),
  changePassword: (data: { otp: string; newPassword: string }): Promise<any> =>
    api.post('/auth/change-password', data),
};

// ── Routes API ────────────────────────────────────────────
export const routesAPI = {
  getAll: (includeInactive = true): Promise<any> => api.get('/routes', { params: { includeInactive } }),
  getById: (id: string): Promise<any> => api.get(`/routes/${id}`),
  create: (data: any): Promise<any> => api.post('/routes', data),
  update: (id: string, data: any): Promise<any> => api.put(`/routes/${id}`, data),
  delete: (id: string): Promise<any> => api.delete(`/routes/${id}`),
  findNearby: (lat: number, lng: number, maxDistance?: number): Promise<any> =>
    api.get('/routes/nearby', { params: { lat, lng, maxDistance } }),
};

// ── Trips API ─────────────────────────────────────────────
export const tripsAPI = {
  getAll: (): Promise<any> => api.get('/trips'),
  getById: (id: string): Promise<any> => api.get(`/trips/${id}`),
  create: (data: any): Promise<any> => api.post('/trips', data),
  update: (id: string, data: any): Promise<any> => api.put(`/trips/${id}`, data),
  delete: (id: string): Promise<any> => api.delete(`/trips/${id}`),
  updateStatus: (id: string, status: string): Promise<any> => api.put(`/trips/${id}/status`, { status }),
  getArrivedCheckpoints: (id: string): Promise<any> => api.get(`/trips/${id}/arrived-checkpoints`),
  updateArrivedCheckpoints: (id: string, arrivedCheckpoints: string[]): Promise<any> =>
    api.put(`/trips/${id}/arrived-checkpoints`, { arrivedCheckpoints }),
};

// ── Vehicles API ──────────────────────────────────────────
export const vehiclesAPI = {
  getAll: (): Promise<any> => api.get('/vehicles'),
  getById: (id: string): Promise<any> => api.get(`/vehicles/${id}`),
  create: (data: any): Promise<any> => api.post('/vehicles', data),
  update: (id: string, data: any): Promise<any> => api.put(`/vehicles/${id}`, data),
  delete: (id: string): Promise<any> => api.delete(`/vehicles/${id}`),
  updateLocation: (vehicleId: string, driverId: string, lat: number, lng: number): Promise<any> =>
    api.post('/vehicles/location', { vehicleId, driverId, latitude: lat, longitude: lng }),
  findNearby: (lat: number, lng: number, maxDistance?: number): Promise<any> =>
    api.get('/vehicles/nearby', { params: { lat, lng, maxDistance } }),
  getLocation: (vehicleId: string): Promise<any> => api.get(`/vehicles/location/${vehicleId}`),
  getAllLocations: (): Promise<any> => api.get('/vehicles/locations'),
  getVehicleLocation: (vehicleId: string): Promise<any> => api.get(`/vehicles/locations/${vehicleId}`),
};

// ── Bookings API ──────────────────────────────────────────
export const bookingsAPI = {
  getAll: (): Promise<any> => api.get('/bookings'),
  getById: (id: string): Promise<any> => api.get(`/bookings/${id}`),
  create: (data: any): Promise<any> => api.post('/bookings', data),
  cancel: (id: string): Promise<any> => api.put(`/bookings/${id}/cancel`),
  refund: (id: string, action?: string): Promise<any> => api.put(`/bookings/${id}/refund`, { action }),
  getTripManifest: (tripId: string): Promise<any> => api.get(`/bookings/trip/${tripId}/manifest`),
  checkIn: (id: string): Promise<any> => api.put(`/bookings/${id}/check-in`),
  applyPromo: (id: string, code: string | null): Promise<any> => api.put(`/bookings/${id}/apply-promo`, { code }),
  verifyTicket: (id: string, token: string): Promise<any> => api.put(`/bookings/${id}/verify-ticket`, { token }),
  getOccupiedSeats: (tripId: string, pickupCheckpointName?: string, dropoffCheckpointName?: string): Promise<any> =>
    api.get(`/bookings/occupied/${tripId}`, { params: { pickupCheckpointName, dropoffCheckpointName } }),
  trackByCode: (code: string): Promise<any> => api.get(`/bookings/track-by-code/${code}`),
};

// ── Users API ─────────────────────────────────────────────
export const usersAPI = {
  getAll: (): Promise<any> => api.get('/users'),
  getByRole: (role: string): Promise<any> => api.get('/users', { params: { role } }),
  getById: (id: string): Promise<any> => api.get(`/users/${id}`),
  create: (data: any): Promise<any> => api.post('/users', data),
  update: (id: string, data: any): Promise<any> => api.put(`/users/${id}`, data),
  delete: (id: string): Promise<any> => api.delete(`/users/${id}`),
  addNote: (id: string, text: string, adminName: string): Promise<any> =>
    api.post(`/users/${id}/notes`, { text, adminName }),
  getRolePermissions: (): Promise<any> => api.get('/users/role-permissions'),
  updateRolePermissions: (role: string, permissions: string[]): Promise<any> =>
    api.put('/users/role-permissions', { role, permissions }),
};

// ── Support Tickets API ─────────────────────────────────────
export const supportAPI = {
  getAllTickets: (): Promise<any> => api.get('/support/tickets'),
  resolveTicket: (id: string): Promise<any> => api.put(`/support/tickets/${id}/resolve`),
  replyToTicket: (id: string, text: string, adminName: string): Promise<any> =>
    api.post(`/support/tickets/${id}/reply`, { text, adminName }),
  getTicketMessages: (id: string): Promise<any> => api.get(`/support/tickets/${id}/messages`),
};

// ── Reviews API ─────────────────────────────────────────────
export const reviewsAPI = {
  getDriverRating: (driverId: string): Promise<any> =>
    api.get(`/reviews/driver/${driverId}`),
  getDriverReviews: (driverId: string): Promise<any> =>
    api.get(`/reviews/driver/${driverId}/list`),
  getAll: (params?: { page?: number; limit?: number; rating?: number; startDate?: string; endDate?: string }): Promise<any> =>
    api.get('/reviews', { params }),
  delete: (id: string): Promise<any> =>
    api.delete(`/reviews/${id}`),
  getStats: (): Promise<any> =>
    api.get('/reviews/stats'),
  getTripReviews: (tripId: string): Promise<any> =>
    api.get(`/reviews/trip/${tripId}`),
};

// ── Partners API ────────────────────────────────────────────
export const partnersAPI = {
  getAll: (): Promise<any> => api.get('/partners/all'),
  create: (data: any): Promise<any> => api.post('/partners', data),
  update: (id: string, data: any): Promise<any> => api.put(`/partners/${id}`, data),
  delete: (id: string): Promise<any> => api.delete(`/partners/${id}`),
};

// ── Promo Codes API ─────────────────────────────────────────
export const promoCodesAPI = {
  getAll: (): Promise<any> => api.get('/promo-codes'),
  getById: (id: string): Promise<any> => api.get(`/promo-codes/${id}`),
  create: (data: any): Promise<any> => api.post('/promo-codes', data),
  update: (id: string, data: any): Promise<any> => api.put(`/promo-codes/${id}`, data),
  delete: (id: string): Promise<any> => api.delete(`/promo-codes/${id}`),
};

// ── Settings API ────────────────────────────────────────────
export const settingsAPI = {
  get: (): Promise<any> => api.get('/settings'),
  save: (data: any): Promise<any> => api.put('/settings', data),
};

// ── Transactions API ─────────────────────────────────────────
export const transactionsAPI = {
  getAll: (params?: { page?: number; limit?: number; status?: string; paymentMethod?: string; startDate?: string; endDate?: string; userId?: string; bookingId?: string }): Promise<any> =>
    api.get('/transactions', { params }),
  getById: (id: string): Promise<any> =>
    api.get(`/transactions/${id}`),
};

// ── Notifications API ────────────────────────────────────────
export const notificationsAPI = {
  getAll: (params?: { page?: number; limit?: number; type?: string; status?: string; startDate?: string; endDate?: string }): Promise<any> =>
    api.get('/notifications', { params }),
  getById: (id: string): Promise<any> =>
    api.get(`/notifications/${id}`),
  send: (data: { userId: string; title: string; message: string; channel: string }): Promise<any> =>
    api.post('/notifications/send', data),
  broadcast: (data: { title: string; message: string; channel: string; role?: string }): Promise<any> =>
    api.post('/notifications/broadcast', { ...data, userRole: data.role }),
};

// ── WhatsApp API ────────────────────────────────────────────
export const whatsappAPI = {
  getStatus: (): Promise<any> => api.get('/whatsapp/status'),
  restart: (): Promise<any> => api.post('/whatsapp/restart'),
  getScreenshot: (): Promise<any> => api.get('/whatsapp/screenshot'),
};

// ── Paymob API ─────────────────────────────────────────────
export const paymobAPI = {
  getFeatures: (): Promise<any> => api.get('/paymob/features'),
};

