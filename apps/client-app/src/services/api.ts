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

let apiToastCallback: ((title: string, description: string, type: 'success' | 'error' | 'warning' | 'info') => void) | null = null;

export const registerApiToastCallback = (cb: typeof apiToastCallback) => {
  apiToastCallback = cb;
};

// Response interceptor — unwrap API response
api.interceptors.response.use(
  (response) => {
    let data = response.data;
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      data = response.data.data;
    }
    
    // Check if mutating method to trigger success toast
    const method = response.config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'DELETE'].includes(method)) {
      const url = response.config.url;
      const isAuth = url?.includes('/auth/');
      const isLocation = url?.includes('/location');
      const isSearch = url?.includes('/search') || url?.includes('/nearby');
      
      if (!isAuth && !isLocation && !isSearch) {
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
        if (apiToastCallback) {
          apiToastCallback('Success', msg, 'success');
        }
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
    let title = 'Error';
    let message = 'API request failed';
    if (errorData) {
      if (typeof errorData === 'string') {
        message = errorData;
      } else if (errorData.message) {
        if (Array.isArray(errorData.message)) {
          message = errorData.message.join(', ');
        } else {
          message = errorData.message;
        }
      }
      if (errorData.error) {
        title = errorData.error;
      }
    } else if (error.message) {
      message = error.message;
    }
    
    if (apiToastCallback) {
      apiToastCallback(title, message, 'error');
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
  forgotPassword: (email: string): Promise<any> =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { email: string; otp: string; newPassword: string }): Promise<any> =>
    api.post('/auth/reset-password', data),
  changePasswordRequest: (): Promise<any> =>
    api.post('/auth/change-password-request'),
  changePassword: (data: { otp: string; newPassword: string }): Promise<any> =>
    api.post('/auth/change-password', data),
};


export const routesAPI = {
  getAll: (includeVirtual = true): Promise<any> => api.get('/routes', { params: { includeVirtual } }),
  findNearby: (lat: number, lng: number, maxDistance?: number): Promise<any> =>
    api.get('/routes/nearby', { params: { lat, lng, maxDistance } }),
  getNearestCheckpoint: (routeId: string, lat: number, lng: number): Promise<any> =>
    api.get(`/routes/${routeId}/nearest-checkpoint`, { params: { lat, lng } }),
  getNearestStation: (lat: number, lng: number, limit?: number): Promise<any> =>
    api.get('/routes/nearest', { params: { lat, lng, limit } }),
  smartSearch: (pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number, radius?: number, pickupCity?: string, dropoffCity?: string, date?: string): Promise<any> =>
    api.get('/routes/smart-search', { params: { pickupLat, pickupLng, dropoffLat, dropoffLng, radius, pickupCity, dropoffCity, date } }),
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
    paymentMethod?: 'CARD' | 'WALLET' | 'WALLET_BALANCE';
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
  getOccupiedSeats: (tripId: string, pickupCheckpointName?: string, dropoffCheckpointName?: string): Promise<any> =>
    api.get(`/bookings/occupied/${tripId}`, { params: { pickupCheckpointName, dropoffCheckpointName } }),
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

export const settingsAPI = {
  get: (): Promise<any> => api.get('/settings'),
};

