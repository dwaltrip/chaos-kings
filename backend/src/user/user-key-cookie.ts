const COOKIE_OPTIONS = {
  httpOnly: true,           // Prevent JS access for security
  secure: false,            // Set to true in production (HTTPS)
  sameSite: 'lax' as const, // CSRF protection
  maxAge: 100 * 365 * 24 * 60 * 60 * 1000, // ~100 years (forever)
  path: '/'
};

const COOKIE_NAME = 'general_v2:user_key';

export { COOKIE_OPTIONS, COOKIE_NAME };