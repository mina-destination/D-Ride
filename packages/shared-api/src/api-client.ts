import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { addIdMapping } from './id-mapper';
import { registerToastCallback, showErrorToast, showSuccessToast, isBrowser } from './toast-adapter';
import { STORAGE_KEYS } from './config';

export interface ApiClientConfig {
  baseURL: string;
  getToken: () => string | null;
  getRefreshToken?: () => string | null;
  tokenKey?: string;
  refreshTokenKey?: string;
  userKey?: string;
  refreshEndpoint?: string;
  onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;
  onRefreshFailed?: () => void;
  timeout?: number;
}

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const {
    baseURL,
    getToken,
    getRefreshToken,
    tokenKey = STORAGE_KEYS.PASSENGER_TOKEN,
    refreshTokenKey = STORAGE_KEYS.PASSENGER_REFRESH_TOKEN,
    userKey = STORAGE_KEYS.PASSENGER_USER,
    refreshEndpoint = '/auth/refresh',
    onTokenRefreshed,
    onRefreshFailed,
    timeout = 15000,
  } = config;

  const api = axios.create({
    baseURL,
    timeout,
    headers: { 'Content-Type': 'application/json' },
  });

  // ─── Silent Token Refresh Queue ───────────────────────────────
  let isRefreshing = false;
  let failedQueue: Array<{ resolve: (value: string | null) => void; reject: (reason?: unknown) => void }> = [];

  const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    failedQueue = [];
  };

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
      
      const pagination = response.data && typeof response.data === 'object' ? response.data.pagination : undefined;

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
            typeof (raw as Record<string, unknown>).message === 'string' &&
            ('success' in raw || 'statusCode' in raw);
          let msg = 'Action completed successfully';
          if (isEnvelopeMessage) {
            msg = (raw as Record<string, string>).message;
          } else if (typeof raw === 'string') {
            msg = raw;
          }
          showSuccessToast('Success', msg);
        }
      }

      const mapped = addIdMapping(data);
      if (pagination && Array.isArray(mapped)) {
        (mapped as any).pagination = pagination;
      }
      return mapped;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // Attempt token refresh on 401 (skip for auth endpoints to avoid infinite loop)
      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/auth/login') &&
        !originalRequest.url?.includes('/auth/refresh') &&
        !originalRequest.url?.includes('/auth/register') &&
        getRefreshToken &&
        isBrowser()
      ) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const storedRefreshToken = getRefreshToken();
        if (storedRefreshToken) {
          try {
            const response = await axios.post(`${baseURL}${refreshEndpoint}`, { refreshToken: storedRefreshToken });
            const resData = response.data?.data || response.data;
            const { accessToken, refreshToken: newRefreshToken } = resData;

            localStorage.setItem(tokenKey, accessToken);
            localStorage.setItem(refreshTokenKey, newRefreshToken);
            api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

            processQueue(null, accessToken);

            if (onTokenRefreshed) {
              onTokenRefreshed(accessToken, newRefreshToken);
            }

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }
            return api(originalRequest);
          } catch (refreshError) {
            processQueue(refreshError, null);
            localStorage.removeItem(tokenKey);
            localStorage.removeItem(refreshTokenKey);
            localStorage.removeItem(userKey);

            if (onRefreshFailed) {
              onRefreshFailed();
            } else if (
              !window.location.pathname.includes('/login') &&
              !window.location.pathname.includes('/register')
            ) {
              window.location.href = `/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            }
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        } else {
          localStorage.removeItem(tokenKey);
          localStorage.removeItem(userKey);
          if (
            !window.location.pathname.includes('/login') &&
            !window.location.pathname.includes('/register')
          ) {
            window.location.href = `/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          }
        }
      }

      const errorData = error.response?.data as Record<string, unknown> | string | undefined;
      let title = 'Error';
      let message = 'API request failed';

      if (errorData) {
        if (typeof errorData === 'string') {
          message = errorData;
        } else if (errorData.message) {
          if (Array.isArray(errorData.message)) {
            message = (errorData.message as string[]).join(', ');
          } else {
            message = errorData.message as string;
          }
        }
        if (typeof errorData !== 'string' && errorData.error) {
          title = errorData.error as string;
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