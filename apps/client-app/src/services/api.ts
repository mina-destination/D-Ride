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

// Response interceptor — unwrap API response
api.interceptors.response.use(
  (response) => response.data?.data ?? response.data,
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

export const authAPI = {
  login: (email: string, password: string): Promise<any> =>
    api.post('/auth/login', { email, password }),
  register: (data: { name: string; email: string; phone: string; password: string }): Promise<any> =>
    api.post('/auth/register', data),
  getProfile: (): Promise<any> => api.get('/auth/profile'),
};

export const routesAPI = {
  getAll: (): Promise<any> => api.get('/routes'),
  findNearby: (lat: number, lng: number, maxDistance?: number): Promise<any> =>
    api.get('/routes/nearby', { params: { lat, lng, maxDistance } }),
  getNearestCheckpoint: (routeId: string, lat: number, lng: number): Promise<any> =>
    api.get(`/routes/${routeId}/nearest-checkpoint`, { params: { lat, lng } }),
};

export const tripsAPI = {
  search: (routeId: string, date?: string): Promise<any> => 
    api.get('/trips/search', { params: { routeId, date } }),
};

export const paymobAPI = {
  checkout: (data: {
    bookingId: string;
    amountCents: number;
    billingData?: any;
    paymentMethod?: 'CARD' | 'WALLET' | 'CASH';
    walletNumber?: string;
  }): Promise<any> =>
    api.post('/paymob/checkout', data),
};

export const bookingsAPI = {
  getMyBookings: (): Promise<any> => api.get('/bookings/my-bookings'),
  getOccupiedSeats: (tripId: string): Promise<any> => api.get(`/bookings/occupied/${tripId}`),
  create: (data: any): Promise<any> => api.post('/bookings', data),
  cancel: (id: string): Promise<any> => api.put(`/bookings/${id}/cancel`),
};

export const supportAPI = {
  submitTicket: (data: { subject: string; message: string }): Promise<any> =>
    api.post('/support/submit', data),
};
