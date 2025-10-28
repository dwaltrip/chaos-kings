import { v4 as uuidv4 } from 'uuid';

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // Set to true in production (HTTPS)
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
};

const SESSION_COOKIE_NAME = 'general-v2:session-id';

function generateSessionId(): string {
  return `sess_${uuidv4()}`;
}

export { SESSION_COOKIE_OPTIONS, SESSION_COOKIE_NAME, generateSessionId };
