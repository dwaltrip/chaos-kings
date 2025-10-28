const USER_KEY_COOKIE_OPTIONS = {
  httpOnly: true, // Prevent JS access for security
  secure: false, // Set to true in production (HTTPS)
  sameSite: 'lax' as const, // CSRF protection
  maxAge: 100 * 365 * 24 * 60 * 60 * 1000, // ~100 years (forever)
  path: '/',
};

const USER_KEY_COOKIE_NAME = 'general-v2:user-key';

export { USER_KEY_COOKIE_OPTIONS, USER_KEY_COOKIE_NAME };
