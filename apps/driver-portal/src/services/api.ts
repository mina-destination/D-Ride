import { createApiClient, registerToastCallback, STORAGE_KEYS } from '@transport/shared-api';
import { Capacitor } from '@capacitor/core';
import { BackgroundLocation } from '../capacitor-plugins/background-location';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

let apiToastCallback: ((title: string, description: string, type: 'success' | 'error' | 'warning' | 'info') => void) | null = null;

export const registerApiToastCallback = (cb: typeof apiToastCallback) => {
  apiToastCallback = cb;
};

// Register shared-api toast callback to delegate to apiToastCallback
registerToastCallback((title, description, type) => {
  if (apiToastCallback) {
    apiToastCallback(title, description, type);
  }
});

export const api = createApiClient({
  baseURL: API_URL,
  getToken: () => localStorage.getItem(STORAGE_KEYS.DRIVER_TOKEN),
  getRefreshToken: () => localStorage.getItem(STORAGE_KEYS.DRIVER_REFRESH_TOKEN),
  tokenKey: STORAGE_KEYS.DRIVER_TOKEN,
  refreshTokenKey: STORAGE_KEYS.DRIVER_REFRESH_TOKEN,
  userKey: STORAGE_KEYS.DRIVER_USER,
  onTokenRefreshed: (accessToken) => {
    if (Capacitor.isNativePlatform()) {
      BackgroundLocation.updateConfig({ token: accessToken }).catch((err) => {
        console.warn('[API] Failed to sync refreshed token to native config:', err);
      });
    }
  },
});

export const driverAPI = {
  login: async (credentials: any): Promise<any> => {
    return api.post('/auth/login', credentials);
  },
  
  getProfile: async (): Promise<any> => {
    return api.get('/auth/profile');
  },
  
  getMyTrips: async (): Promise<any> => {
    return api.get('/trips/my-trips');
  },
  
  updateTripStatus: async (tripId: string, status: string): Promise<any> => {
    return api.put(`/trips/${tripId}/status`, { status });
  },
  
  getArrivedCheckpoints: async (tripId: string): Promise<any> => {
    return api.get(`/trips/${tripId}/arrived-checkpoints`);
  },
  
  getTripManifest: async (tripId: string): Promise<any> => {
    return api.get(`/bookings/trip/${tripId}/manifest`);
  },
  
  checkInPassenger: async (bookingId: string): Promise<any> => {
    return api.put(`/bookings/${bookingId}/check-in`);
  },
  
  verifyTicket: async (bookingId: string, token: string): Promise<any> => {
    return api.put(`/bookings/${bookingId}/verify-ticket`, { token });
  },

  forgotPassword: async (email: string): Promise<any> => {
    return api.post('/auth/forgot-password', { email });
  },
  
  resetPassword: async (data: { email: string; otp: string; newPassword: string }): Promise<any> => {
    return api.post('/auth/reset-password', data);
  },
  
  changePasswordRequest: async (): Promise<any> => {
    return api.post('/auth/change-password-request');
  },
  
  changePassword: async (data: { otp: string; newPassword: string }): Promise<any> => {
    return api.post('/auth/change-password', data);
  },
};
