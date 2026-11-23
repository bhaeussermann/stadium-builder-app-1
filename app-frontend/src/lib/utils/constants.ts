/**
 * Application Constants Template
 *
 * Define your application-specific constants here
 * Examples include API configuration, UI settings, and business logic constants
 */

/**
 * Where the browser sends API calls.
 * Default: the frontend's own /api/backend route, which passes them on to the
 * backend at SETTING__BackendUrl. Set NEXT_PUBLIC_API_BASE_URL in .env.local only
 * when the browser should call a backend elsewhere directly.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || '/api/backend';

const DEFAULT_BACKEND_URL = 'http://localhost:8042';

/**
 * The backend's address, read on the frontend's server each time it's needed,
 * so it can be given when the app starts rather than when it's built.
 */
export function backendUrl(): string {
  const configuredUrl = process.env.SETTING__BackendUrl || DEFAULT_BACKEND_URL;
  return configuredUrl.replace(/\/+$/, '');
}

/**
 * Default pagination settings
 * Customize based on your application's needs
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

/**
 * Toast notification settings
 */
export const TOAST_SETTINGS = {
  DEFAULT_DURATION: 5000, // 5 seconds
  SUCCESS_DURATION: 3000, // 3 seconds
  ERROR_DURATION: 7000, // 7 seconds
  MAX_TOASTS: 3,
} as const;

/**
 * Modal settings
 */
export const MODAL_SETTINGS = {
  ANIMATION_DURATION: 150, // 150ms for enter/exit animations
} as const;

// Add your application-specific constants below
// Example:
// export const DATE_FORMATS = {
//   DISPLAY: 'dd MMM yyyy',
//   API: 'yyyy-MM-dd',
// } as const;
