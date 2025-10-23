export type LogLevel = 'log' | 'info' | 'warn' | 'error';

export type LogEntry = {
  id: number;
  level: LogLevel;
  message: string;
  timestamp: string;
  args: unknown[];
};

const MAX_LOG_ENTRIES = 500;

let entries: LogEntry[] = [];
let nextId = 1;
const subscribers = new Set<(snapshot: LogEntry[]) => void>();
const originalConsoleMethods: Partial<Record<LogLevel, (...args: unknown[]) => void>> = {};
let interceptorInstalled = false;

const formatValue = (value: unknown): string => {
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const buildMessage = (args: unknown[]): string => args.map((value) => formatValue(value)).join(' ');

const emitSnapshot = () => {
  const snapshot = entries.slice();
  subscribers.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      const method = originalConsoleMethods.error ?? console.error.bind(console);
      method('Failed to dispatch log subscriber update', error);
    }
  });
};

export const getLogEntries = (): LogEntry[] => entries.slice();

export const subscribeToLogs = (listener: (snapshot: LogEntry[]) => void): (() => void) => {
  subscribers.add(listener);
  listener(getLogEntries());
  return () => {
    subscribers.delete(listener);
  };
};

const pushEntry = (level: LogLevel, args: unknown[]): void => {
  const entry: LogEntry = {
    id: nextId++,
    level,
    message: buildMessage(args),
    timestamp: new Date().toISOString(),
    args,
  };

  entries = [...entries.slice(-MAX_LOG_ENTRIES + 1), entry];
  emitSnapshot();
};

export const clearLogs = (): void => {
  entries = [];
  emitSnapshot();
};

const invokeConsole = (level: LogLevel, args: unknown[]): void => {
  if (interceptorInstalled) {
    const original = originalConsoleMethods[level];
    if (typeof original === 'function') {
      original(...args);
      return;
    }
  }

  const fallback = console[level] ?? console.log;
  fallback(...args);
};

export const logMessage = (level: LogLevel, ...args: unknown[]): void => {
  pushEntry(level, args);
  invokeConsole(level, args);
};

export const logFirebaseEvent = (
  step: string,
  metadata?: Record<string, unknown> | string,
  level: LogLevel = 'info'
): void => {
  if (metadata === undefined) {
    logMessage(level, `[Firebase] ${step}`);
  } else if (typeof metadata === 'string') {
    logMessage(level, `[Firebase] ${step}`, metadata);
  } else {
    logMessage(level, `[Firebase] ${step}`, metadata);
  }
};

export const installConsoleInterceptor = (): void => {
  if (interceptorInstalled) {
    return;
  }

  const levels: LogLevel[] = ['log', 'info', 'warn', 'error'];
  levels.forEach((level) => {
    const original = console[level];
    if (typeof original !== 'function') {
      return;
    }

    originalConsoleMethods[level] = original.bind(console);
    console[level] = ((...args: unknown[]) => {
      pushEntry(level, args);
      originalConsoleMethods[level]?.(...args);
    }) as typeof console[typeof level];
  });

  interceptorInstalled = true;
  logMessage('info', 'Logginsamlingen är aktiverad.');
};
