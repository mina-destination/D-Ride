import axios from 'axios';

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
    return addIdMapping(data);
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dride_token');
      localStorage.removeItem('dride_user');
      window.location.href = '/login';
    }
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
  getAll: (): Promise<any> => api.get('/routes'),
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
