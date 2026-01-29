/**
 * Simple logger utility
 * Provides structured logging with timestamps
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

function formatLog(level: LogLevel, message: string, data?: any): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };
}

function log(level: LogLevel, message: string, ...args: any[]): void {
  const entry = formatLog(level, message, args.length > 0 ? args : undefined);
  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;

  switch (level) {
    case 'debug':
      if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        console.debug(prefix, message, ...args);
      }
      break;
    case 'info':
      console.log(prefix, message, ...args);
      break;
    case 'warn':
      console.warn(prefix, message, ...args);
      break;
    case 'error':
      console.error(prefix, message, ...args);
      break;
  }
}

export const logger = {
  debug: (message: string, ...args: any[]) => log('debug', message, ...args),
  info: (message: string, ...args: any[]) => log('info', message, ...args),
  warn: (message: string, ...args: any[]) => log('warn', message, ...args),
  error: (message: string, ...args: any[]) => log('error', message, ...args),
};

export default logger;
