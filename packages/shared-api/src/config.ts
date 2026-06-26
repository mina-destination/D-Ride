/**
 * Standard localStorage key constants for D-Ride frontend apps.
 * Import these from @transport/shared-api to avoid hardcoded strings.
 */
export const STORAGE_KEYS = {
  /** Client app JWT access token */
  PASSENGER_TOKEN: 'dride_token',
  /** Client app JWT refresh token */
  PASSENGER_REFRESH_TOKEN: 'dride_refresh_token',
  /** Client app user profile data */
  PASSENGER_USER: 'dride_user',

  /** Driver portal JWT access token */
  DRIVER_TOKEN: 'dride_driver_token',
  /** Driver portal JWT refresh token */
  DRIVER_REFRESH_TOKEN: 'dride_driver_refresh_token',
  /** Driver portal user profile data */
  DRIVER_USER: 'dride_driver_user',

  /** Admin dashboard JWT access token */
  ADMIN_TOKEN: 'dride_token',
  /** Admin dashboard JWT refresh token */
  ADMIN_REFRESH_TOKEN: 'dride_refresh_token',
  /** Admin dashboard user profile data */
  ADMIN_USER: 'dride_user',
} as const;

export type StorageKeyName = keyof typeof STORAGE_KEYS;
