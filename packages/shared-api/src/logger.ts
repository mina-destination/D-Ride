const isDev =
  (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') ||
  (typeof window !== 'undefined' && (window as any).location?.hostname === 'localhost') ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV);

export const logger = {
  log: (...args: any[]) => isDev && console.log('[D-Ride]', ...args),
  info: (...args: any[]) => isDev && console.info('[D-Ride]', ...args),
  warn: (...args: any[]) => console.warn('[D-Ride]', ...args),
  error: (...args: any[]) => console.error('[D-Ride]', ...args),
};
