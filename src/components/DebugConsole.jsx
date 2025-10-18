import { useCallback, useEffect, useMemo, useState } from 'react';
import './DebugConsole.css';

const formatValue = (value) => {
  if (value instanceof Error) {
    return value.stack || value.message || String(value);
  }

  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return `[object ${value.constructor?.name ?? 'Object'}]`;
    }
  }

  if (typeof value === 'undefined') {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  return String(value);
};

const formatArgs = (args) => args.map((arg) => formatValue(arg)).join(' ');

const formatTimestamp = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function DebugConsole({ limit = 20 }) {
  const [entries, setEntries] = useState([]);

  const pushEntry = useCallback(
    (type, message) => {
      setEntries((previous) => {
        const entry = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          type,
          message,
          timestamp: Date.now(),
        };

        const next = [...previous, entry];
        if (next.length > limit) {
          return next.slice(next.length - limit);
        }

        return next;
      });
    },
    [limit]
  );

  const hasEntries = entries.length > 0;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleError = (event) => {
      const message = formatValue(event?.error) || event?.message || 'Okänt fel';
      pushEntry('error', message);
    };

    const handleRejection = (event) => {
      const message = formatValue(event?.reason) || 'Ohanterat promise-avslag';
      pushEntry('error', message);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    const originalError = console.error;
    const originalWarn = console.warn;

    const createConsoleProxy = (type, original) =>
      function proxy(...args) {
        pushEntry(type, formatArgs(args));
        if (typeof original === 'function') {
          original.apply(console, args);
        }
      };

    console.error = createConsoleProxy('error', originalError);
    console.warn = createConsoleProxy('warn', originalWarn);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);

      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [pushEntry]);

  const severityLabel = useMemo(
    () => ({
      error: 'Fel',
      warn: 'Varning',
    }),
    []
  );

  if (!hasEntries) {
    return null;
  }

  return (
    <section className="debug-console" aria-live="polite">
      <header className="debug-console__header">
        <strong>Felkonsol</strong>
        <button type="button" className="debug-console__clear" onClick={() => setEntries([])}>
          Rensa
        </button>
      </header>
      <ol className="debug-console__list">
        {entries.map((entry) => (
          <li key={entry.id} className={`debug-console__entry debug-console__entry--${entry.type}`}>
            <div className="debug-console__meta">
              <span className="debug-console__timestamp">{formatTimestamp(entry.timestamp)}</span>
              <span className="debug-console__severity">{severityLabel[entry.type] ?? entry.type}</span>
            </div>
            <pre className="debug-console__message">{entry.message}</pre>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default DebugConsole;
