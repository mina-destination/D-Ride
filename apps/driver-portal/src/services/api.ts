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

let apiToastCallback: ((title: string, description: string, type: 'success' | 'error' | 'warning' | 'info') => void) | null = null;

export const registerApiToastCallback = (cb: typeof apiToastCallback) => {
  apiToastCallback = cb;
};

// Response helper for cleaning payload
api.interceptors.response.use(
  (response) => {
    // Check if mutating method to trigger success toast
    const method = response.config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'DELETE'].includes(method)) {
      const url = response.config.url;
      const isAuth = url?.includes('/auth/');
      const isLocation = url?.includes('/location');
      
      if (!isAuth && !isLocation) {
        let msg = 'Action completed successfully';
        if (response.data && typeof response.data === 'object' && response.data.message) {
          msg = response.data.message;
        } else if (response.data && typeof response.data === 'string') {
          msg = response.data;
        }
        if (apiToastCallback) {
          apiToastCallback('Success', msg, 'success');
        }
      }
    }
    return response.data;
  },
  (error) => {
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

  forgotPassword: async (email: string) => {
    return api.post('/auth/forgot-password', { email });
  },
  
  resetPassword: async (data: { email: string; otp: string; newPassword: string }) => {
    return api.post('/auth/reset-password', data);
  },
  
  changePasswordRequest: async () => {
    return api.post('/auth/change-password-request');
  },
  
  changePassword: async (data: { otp: string; newPassword: string }) => {
    return api.post('/auth/change-password', data);
  },
};

