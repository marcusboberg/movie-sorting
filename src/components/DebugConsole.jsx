import { useEffect, useMemo, useRef } from 'react';
import { clearLogs, logMessage } from '../lib/logger';
import { useLogStore } from '../lib/useLogStore';
import './DebugConsole.css';

const LEVEL_LABELS = {
  log: 'Logg',
  info: 'Info',
  warn: 'Varning',
  error: 'Fel',
};

function formatTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    return `${date.toLocaleTimeString([], { hour12: false })}.${date
      .getMilliseconds()
      .toString()
      .padStart(3, '0')}`;
  } catch {
    return timestamp;
  }
}

function normaliseArgs(args) {
  return args.map((value) => {
    if (typeof value === 'string') {
      return value;
    }
    if (value instanceof Error) {
      return value.stack || `${value.name}: ${value.message}`;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  });
}

function DebugConsole({ isOpen, onClose }) {
  const entries = useLogStore();
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [entries, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const hasEntries = entries.length > 0;

  const consoleClassName = useMemo(
    () => `debug-console ${isOpen ? 'debug-console--open' : ''}`,
    [isOpen]
  );

  return (
    <aside className={consoleClassName} aria-hidden={!isOpen} aria-label="Loggutskrifter">
      <header className="debug-console__header">
        <h2 className="debug-console__title">Loggar</h2>
        <div className="debug-console__actions">
          <button
            type="button"
            className="debug-console__button"
            onClick={() => {
              clearLogs();
              logMessage('info', 'Loggarna återställdes manuellt.');
            }}
            disabled={!hasEntries}
          >
            Rensa
          </button>
          <button type="button" className="debug-console__button" onClick={onClose}>
            Stäng
          </button>
        </div>
      </header>
      <div className="debug-console__content" ref={containerRef} role="log">
        {hasEntries ? (
          entries.map((entry) => {
            const formattedArgs = normaliseArgs(entry.args);
            return (
              <article
                key={entry.id}
                className={`debug-console__entry debug-console__entry--${entry.level}`}
              >
                <header className="debug-console__entry-header">
                  <span className="debug-console__timestamp">{formatTimestamp(entry.timestamp)}</span>
                  <span className="debug-console__level" aria-label="Loggnivå">
                    {LEVEL_LABELS[entry.level] ?? entry.level}
                  </span>
                </header>
                <pre className="debug-console__body">
                  {formattedArgs.join('\n\n') || entry.message || LEVEL_LABELS[entry.level]}
                </pre>
              </article>
            );
          })
        ) : (
          <p className="debug-console__empty">Inga loggar ännu.</p>
        )}
      </div>
    </aside>
  );
}

export default DebugConsole;
