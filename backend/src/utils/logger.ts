import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV !== 'production';

const baseLoggerOptions = {
  translateTime: 'HH:MM:ss.l',
  ignore: 'pid,hostname',
  colorize: true,
  hideObject: true,
};

export const loggerConfig = {
  level: isTest ? 'error' : isDev ? 'debug' : 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          ...baseLoggerOptions,
          messageFormat: '{msg}',
        },
      }
    : undefined,
};

export const fastifyLoggerConfig = isDev
  ? {
      transport: {
        target: 'pino-pretty',
        options: {
          ...baseLoggerOptions,
          messageFormat: '[{reqId}] {msg} {req.method} {req.url}',
        },
      },
    }
  : true;

export const logger = pino(loggerConfig);
