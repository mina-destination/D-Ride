import { createApiClient, registerToastCallback, STORAGE_KEYS } from '@transport/shared-api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = createApiClient({
  baseURL: API_BASE_URL,
  getToken: () => localStorage.getItem(STORAGE_KEYS.PASSENGER_TOKEN),
  getRefreshToken: () => localStorage.getItem(STORAGE_KEYS.PASSENGER_REFRESH_TOKEN),
  tokenKey: STORAGE_KEYS.PASSENGER_TOKEN,
  refreshTokenKey: STORAGE_KEYS.PASSENGER_REFRESH_TOKEN,
  userKey: STORAGE_KEYS.PASSENGER_USER,
});

export const registerApiToastCallback = registerToastCallback;

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
  updateProfile: (data: { name?: string; phone?: string }): Promise<any> =>
    api.put('/auth/profile', data),
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
    paymentMethod?: 'CARD' | 'WALLET';
    walletNumber?: string;
  }): Promise<any> =>
    api.post('/paymob/checkout', data),
};

export const bookingsAPI = {
  getMyBookings: (): Promise<any> => api.get('/bookings/my-bookings'),
  getById: (id: string): Promise<any> => api.get(`/bookings/${id}`),
  getOccupiedSeats: (tripId: string, pickupCheckpointName?: string, dropoffCheckpointName?: string): Promise<any> =>
    api.get(`/bookings/occupied/${tripId}`, { params: { pickupCheckpointName, dropoffCheckpointName } }),
  create: (data: any): Promise<any> => api.post('/bookings', data),
  cancel: (id: string): Promise<any> => api.put(`/bookings/${id}/cancel`),
  applyPromo: (id: string, code: string | null): Promise<any> => api.put(`/bookings/${id}/apply-promo`, { code }),
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

