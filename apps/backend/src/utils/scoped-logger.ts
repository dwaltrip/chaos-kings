import { logger } from '@/utils/logger';

type Scope = string | (() => string);

type LogFn = (...args: unknown[]) => void;

interface ScopedLogger {
  info: LogFn;
  debug: LogFn;
  warn: LogFn;
  error: LogFn;
}

function toMsg(args: unknown[]): string {
  if (args.length === 0) {
    return '(no message...)';
  }
  return args.map(stringify).join(' ');
}

function stringify(obj: unknown): string {
  if (typeof obj === 'string') {
    return obj;
  }
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
}

function scopeToString(scope: Scope): string {
  return typeof scope === 'function' ? scope() : scope;
}

function createScopedLogger(scope: Scope): ScopedLogger {
  const withScope = (lvl: 'info' | 'debug' | 'warn' | 'error'): LogFn => {
    return (...args: unknown[]) => {
      const prefix = `[${scopeToString(scope)}]`;
      const msg = `${prefix} ${toMsg(args)}`;
      switch (lvl) {
        case 'info':
          logger.info(msg);
          break;
        case 'debug':
          logger.debug(msg);
          break;
        case 'warn':
          logger.warn(msg);
          break;
        case 'error':
          logger.error(msg);
          break;
      }
    };
  };

  return {
    info: withScope('info'),
    debug: withScope('debug'),
    warn: withScope('warn'),
    error: withScope('error'),
  };
}

export type { ScopedLogger };
export { createScopedLogger };
