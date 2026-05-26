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
    let data = response.data;
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      data = response.data.data;
    }
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

export const authAPI = {
  login: (email: string, password: string): Promise<any> =>
    api.post('/auth/login', { email, password }),
  register: (data: { name: string; email: string; phone: string; password: string }): Promise<any> =>
    api.post('/auth/register', data),
  googleLogin: (data: { email: string; name: string; googleId: string }): Promise<any> =>
    api.post('/auth/google', data),
  getProfile: (): Promise<any> => api.get('/auth/profile'),
};

export const routesAPI = {
  getAll: (): Promise<any> => api.get('/routes'),
  findNearby: (lat: number, lng: number, maxDistance?: number): Promise<any> =>
    api.get('/routes/nearby', { params: { lat, lng, maxDistance } }),
  getNearestCheckpoint: (routeId: string, lat: number, lng: number): Promise<any> =>
    api.get(`/routes/${routeId}/nearest-checkpoint`, { params: { lat, lng } }),
  getNearestStation: (lat: number, lng: number, limit?: number): Promise<any> =>
    api.get('/routes/nearest', { params: { lat, lng, limit } }),
  smartSearch: (pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number, radius?: number): Promise<any> =>
    api.get('/routes/smart-search', { params: { pickupLat, pickupLng, dropoffLat, dropoffLng, radius } }),
};

export const tripsAPI = {
  search: (routeId: string, date?: string, pickupCheckpointName?: string, dropoffCheckpointName?: string): Promise<any> => 
    api.get('/trips/search', { params: { routeId, date, pickupCheckpointName, dropoffCheckpointName } }),
};

export const paymobAPI = {
  checkout: (data: {
    bookingId: string;
    amountCents: number;
    billingData?: any;
    paymentMethod?: 'CARD' | 'WALLET' | 'CASH' | 'WALLET_BALANCE';
    walletNumber?: string;
  }): Promise<any> =>
    api.post('/paymob/checkout', data),
  getWallet: (): Promise<any> => api.get('/paymob/wallet'),
  initializeWalletTopup: (data: {
    amountEGP: number;
    paymentMethod?: 'CARD' | 'WALLET';
    walletNumber?: string;
  }): Promise<any> =>
    api.post('/paymob/wallet/topup', data),
};

export const bookingsAPI = {
  getMyBookings: (): Promise<any> => api.get('/bookings/my-bookings'),
  getById: (id: string): Promise<any> => api.get(`/bookings/${id}`),
  getOccupiedSeats: (tripId: string): Promise<any> => api.get(`/bookings/occupied/${tripId}`),
  create: (data: any): Promise<any> => api.post('/bookings', data),
  cancel: (id: string): Promise<any> => api.put(`/bookings/${id}/cancel`),
};

export const supportAPI = {
  submitTicket: (data: { subject: string; message: string }): Promise<any> =>
    api.post('/support/submit', data),
  getMyTickets: (): Promise<any> => api.get('/support/my-tickets'),
  getTicketMessages: (ticketId: string): Promise<any> => api.get(`/support/tickets/${ticketId}/messages`),
};

export const reviewsAPI = {
  submitReview: (data: { bookingId: string; rating: number; comment?: string }): Promise<any> =>
    api.post('/reviews', data),
  getDriverRating: (driverId: string): Promise<any> =>
    api.get(`/reviews/driver/${driverId}`),
  getTripReviews: (tripId: string): Promise<any> =>
    api.get(`/reviews/trip/${tripId}`),
};

export const partnersAPI = {
  getActive: (): Promise<any> => api.get('/partners'),
};

