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

let errorToastTimeout: any = null;
let pendingErrors: string[] = [];

function showDebouncedError(title: string, message: string) {
  const errorKey = `${title}:${message}`;
  if (!pendingErrors.includes(errorKey)) {
    pendingErrors.push(errorKey);
  }
  if (!errorToastTimeout) {
    errorToastTimeout = setTimeout(() => {
      if (pendingErrors.length > 0) {
        if (pendingErrors.length > 2) {
          if (apiToastCallback) {
            apiToastCallback('Error', 'Multiple operations failed', 'error');
          }
        } else {
          pendingErrors.forEach(errKey => {
            const idx = errKey.indexOf(':');
            const t = errKey.slice(0, idx);
            const m = errKey.slice(idx + 1);
            if (apiToastCallback) {
              apiToastCallback(t, m, 'error');
            }
          });
        }
      }
      pendingErrors = [];
      errorToastTimeout = null;
    }, 100);
  }
}

// ─── Silent Token Refresh Logic ────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
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
  async (error) => {
    const originalRequest = error.config;

    // Attempt token refresh on 401 (skip for auth endpoints to avoid infinite loop)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/register')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const storedRefreshToken = localStorage.getItem('dride_driver_refresh_token');
      if (storedRefreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: storedRefreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data?.data || response.data;
          localStorage.setItem('dride_driver_token', accessToken);
          localStorage.setItem('dride_driver_refresh_token', newRefreshToken);
          api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
          processQueue(null, accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('dride_driver_token');
          localStorage.removeItem('dride_driver_refresh_token');
          localStorage.removeItem('dride_driver_user');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        localStorage.removeItem('dride_driver_token');
        localStorage.removeItem('dride_driver_user');
        window.location.href = '/login';
      }
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
    
    showDebouncedError(title, message);
    
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
  
  getArrivedCheckpoints: async (tripId: string) => {
    const res: any = await api.get(`/trips/${tripId}/arrived-checkpoints`);
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

