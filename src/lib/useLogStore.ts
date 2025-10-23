import { useEffect, useState } from 'react';
import type { LogEntry } from './logger';
import { getLogEntries, subscribeToLogs } from './logger';

export const useLogStore = (): LogEntry[] => {
  const [entries, setEntries] = useState<LogEntry[]>(() => getLogEntries());

  useEffect(() => {
    const unsubscribe = subscribeToLogs(setEntries);
    return () => {
      unsubscribe();
    };
  }, []);

  return entries;
};
