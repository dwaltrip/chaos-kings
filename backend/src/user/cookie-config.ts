export const COOKIE_OPTIONS = {
  httpOnly: true,           // Prevent JS access for security
  secure: false,            // Set to true in production (HTTPS)
  sameSite: 'lax' as const, // CSRF protection
  maxAge: 100 * 365 * 24 * 60 * 60 * 1000, // ~100 years (forever)
  path: '/'
};

export const COOKIE_NAME = 'general_v2:user_key';