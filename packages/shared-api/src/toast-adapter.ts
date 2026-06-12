export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastCallback = (title: string, description: string, type: ToastType) => void;

let toastCallback: ToastCallback | null = null;
let errorToastTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingErrors: string[] = [];

export function registerToastCallback(cb: ToastCallback | null) {
  toastCallback = cb;
}

function showDebouncedError(title: string, message: string) {
  const errorKey = `${title}:${message}`;
  if (!pendingErrors.includes(errorKey)) {
    pendingErrors.push(errorKey);
  }
  if (!errorToastTimeout) {
    errorToastTimeout = setTimeout(() => {
      const callback = toastCallback;
      if (pendingErrors.length > 0 && callback) {
        if (pendingErrors.length > 2) {
          callback('Error', 'Multiple operations failed', 'error');
        } else {
          pendingErrors.forEach(errKey => {
            const idx = errKey.indexOf(':');
            const t = errKey.slice(0, idx);
            const m = errKey.slice(idx + 1);
            callback(t, m, 'error');
          });
        }
      }
      pendingErrors = [];
      errorToastTimeout = null;
    }, 100);
  }
}

export function showSuccessToast(title: string, message: string) {
  if (toastCallback) {
    toastCallback(title, message, 'success');
  }
}

export function showErrorToast(title: string, message: string) {
  showDebouncedError(title, message);
}

export function showWarningToast(title: string, message: string) {
  if (toastCallback) {
    toastCallback(title, message, 'warning');
  }
}

export function showInfoToast(title: string, message: string) {
  if (toastCallback) {
    toastCallback(title, message, 'info');
  }
}

// Type guard for browser environment
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}