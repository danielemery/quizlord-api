import * as Sentry from '@sentry/node';

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface ErrorLogContext extends LogContext {
  exception?: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

function logError(message: string, context?: ErrorLogContext): void {
  const { exception, ...rest } = context ?? {};

  // Extract error details for logging
  const logContext: LogContext = { ...rest };
  if (exception) {
    logContext.error = exception instanceof Error ? exception.message : String(exception);
    logContext.stack = exception instanceof Error ? exception.stack : undefined;
  }

  log('error', message, logContext);

  // Report to Sentry
  if (exception) {
    Sentry.captureException(exception, {
      extra: { message, ...rest },
    });
  } else {
    Sentry.captureMessage(message, {
      level: 'error',
      extra: rest,
    });
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: ErrorLogContext) => logError(message, context),
};
