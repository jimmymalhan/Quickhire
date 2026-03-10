export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  linkedinClientId: import.meta.env.VITE_LINKEDIN_CLIENT_ID || '',
  linkedinRedirectUri:
    import.meta.env.VITE_LINKEDIN_REDIRECT_URI ||
    'http://localhost:3000/auth/callback',
  appName: import.meta.env.VITE_APP_NAME || 'Quickhire',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
} as const;
