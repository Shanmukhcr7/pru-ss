type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatMessage(level: LogLevel, message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
}

export const logger = {
  info: (msg: string, meta?: any) => console.log(formatMessage('info', msg, meta)),
  warn: (msg: string, meta?: any) => console.warn(formatMessage('warn', msg, meta)),
  error: (msg: string, meta?: any) => console.error(formatMessage('error', msg, meta)),
  debug: (msg: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', msg, meta));
    }
  },
};
