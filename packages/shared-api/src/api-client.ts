import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { addIdMapping } from './id-mapper';
import { registerToastCallback, showErrorToast, showSuccessToast, isBrowser } from './toast-adapter';

export interface ApiClientConfig {
  baseURL: string;
  getToken: () => string | null;
  timeout?: number;
}

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const { baseURL, getToken, timeout = 15000 } = config;

  const api = axios.create({
    baseURL,
    timeout,
    headers: { 'Content-Type': 'application/json' },
  });

  // Request interceptor — attach JWT token
  api.interceptors.request.use((requestConfig: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && requestConfig.headers) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    return requestConfig;
  });

  // Response interceptor — unwrap API response and handle toasts
  api.interceptors.response.use(
    (response) => {
      let data = response.data;
      
      // Unwrap nested data property if present
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
            typeof (raw as any).message === 'string' &&
            ('success' in raw || 'statusCode' in raw);
          let msg = 'Action completed successfully';
          if (isEnvelopeMessage) {
            msg = (raw as any).message;
          } else if (typeof raw === 'string') {
            msg = raw;
          }
          showSuccessToast('Success', msg);
        }
      }

      return addIdMapping(data);
    },
    (error: AxiosError) => {
      // Handle 401 - unauthorized
      if (error.response?.status === 401 && isBrowser()) {
        localStorage.removeItem('dride_token');
        localStorage.removeItem('dride_driver_token');
        localStorage.removeItem('dride_user');
        if (!window.location.pathname.includes('/login') && 
            !window.location.pathname.includes('/register')) {
          window.location.href = `/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
      }

      const errorData = error.response?.data as any;
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

      showErrorToast(title, message);

      return Promise.reject(error.response?.data || error);
    },
  );

  return api;
}

// Re-export toast functions for convenience
export { registerToastCallback, showErrorToast, showSuccessToast, isBrowser } from './toast-adapter';