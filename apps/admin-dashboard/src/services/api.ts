import axios from 'axios';
import { message } from '../utils/antdGlobal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dride_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function addIdMapping(data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(addIdMapping);
  }
  if (typeof data === 'object') {
    const updated = { ...data };
    if ('id' in updated && !('_id' in updated)) {
      updated._id = updated.id;
    }
    for (const key in updated) {
      if (updated[key] && typeof updated[key] === 'object') {
        updated[key] = addIdMapping(updated[key]);
      }
    }
    return updated;
  }
  return data;
}

// Response interceptor — unwrap API response
api.interceptors.response.use(
  (response) => {
    const data = response.data?.data ?? response.data;
    
    // Check if mutating method to trigger success message
    const method = response.config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'DELETE'].includes(method)) {
      const url = response.config.url;
      const isAuth = url?.includes('/auth/');
      const isLocation = url?.includes('/location');
      const isSearch = url?.includes('/search') || url?.includes('/nearby');
      
      if (!isAuth && !isLocation && !isSearch) {
        // Only use response.data.message as toast when it's clearly an API
        // envelope message (has 'success' or 'statusCode' field), not a data
        // record that happens to have a 'message' property (e.g. support tickets).
        const raw = response.data;
        const isEnvelopeMessage =
          raw &&
          typeof raw === 'object' &&
          typeof raw.message === 'string' &&
          ('success' in raw || 'statusCode' in raw);
        let msg = 'Action completed successfully';
        if (isEnvelopeMessage) {
          msg = raw.message;
        } else if (typeof raw === 'string') {
          msg = raw;
        }
        message.success(msg);
      }
    }
    
    return addIdMapping(data);
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dride_token');
      localStorage.removeItem('dride_user');
      window.location.href = '/login';
    }
    
    const errorData = error.response?.data;
    let errorMsg = 'Something went wrong';
    if (errorData) {
      if (typeof errorData === 'string') {
        errorMsg = errorData;
      } else if (errorData.message) {
        if (Array.isArray(errorData.message)) {
          errorMsg = errorData.message.join(', ');
        } else {
          errorMsg = errorData.message;
        }
      }
    } else if (error.message) {
      errorMsg = error.message;
    }
    
    message.error(errorMsg);
    
    return Promise.reject(error.response?.data || error);
  },
);

export default api;

// ── Auth API ──────────────────────────────────────────────
export const authAPI = {
  login: (email: string, password: string): Promise<any> =>
    api.post('/auth/login', { email, password }),
  register: (data: { name: string; email: string; phone: string; password: string }): Promise<any> =>
    api.post('/auth/register', data),
  getProfile: (): Promise<any> => api.get('/auth/profile'),
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
};

// ── Partners API ────────────────────────────────────────────
export const partnersAPI = {
  getAll: (): Promise<any> => api.get('/partners/all'),
  create: (data: any): Promise<any> => api.post('/partners', data),
  update: (id: string, data: any): Promise<any> => api.put(`/partners/${id}`, data),
  delete: (id: string): Promise<any> => api.delete(`/partners/${id}`),
};

// ── Settings API ────────────────────────────────────────────
export const settingsAPI = {
  get: (): Promise<any> => api.get('/settings'),
  save: (data: any): Promise<any> => api.put('/settings', data),
};

// ── WhatsApp API ────────────────────────────────────────────
export const whatsappAPI = {
  getStatus: (): Promise<any> => api.get('/whatsapp/status'),
  restart: (): Promise<any> => api.post('/whatsapp/restart'),
};

