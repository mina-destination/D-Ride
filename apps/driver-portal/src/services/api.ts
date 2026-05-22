import axios from 'axios';

// Dynamically check if running in production or development to resolve the API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dride_driver_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response helper for cleaning payload
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || 'API request failed';
    return Promise.reject(new Error(message));
  }
);

export const driverAPI = {
  login: async (credentials: any) => {
    return api.post('/auth/login', credentials);
  },
  
  getProfile: async () => {
    return api.get('/auth/profile');
  },
  
  getMyTrips: async () => {
    const res: any = await api.get('/trips/my-trips');
    return res.data;
  },
  
  updateTripStatus: async (tripId: string, status: string) => {
    const res: any = await api.put(`/trips/${tripId}/status`, { status });
    return res.data;
  },
  
  getTripManifest: async (tripId: string) => {
    const res: any = await api.get(`/bookings/trip/${tripId}/manifest`);
    return res.data;
  },
  
  checkInPassenger: async (bookingId: string) => {
    const res: any = await api.put(`/bookings/${bookingId}/check-in`);
    return res.data;
  },
  
  verifyTicket: async (bookingId: string, token: string) => {
    const res: any = await api.put(`/bookings/${bookingId}/verify-ticket`, { token });
    return res.data;
  },
};
