import { useEffect, useRef } from 'react';

export type DevLogLevel = 'info' | 'warn' | 'error' | 'ok';

export type DevLogEntry = {
  id: number;
  time: string;
  level: DevLogLevel;
  message: string;
};

const levelClass: Record<DevLogLevel, string> = {
  info: 'text-gray-300',
  warn: 'text-amber-300',
  error: 'text-red-400',
  ok: 'text-emerald-300',
};

interface DevConsoleProps {
  open: boolean;
  logs: DevLogEntry[];
  onClose: () => void;
  onClear: () => void;
}

export function DevConsole({ open, logs, onClose, onClear }: DevConsoleProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs, open]);

  if (!open) return null;

  return (
    <div className='mt-6 overflow-hidden rounded-md border border-gray-700 bg-gray-950 text-left'>
      <div className='flex items-center justify-between bg-gray-900 px-3 py-2 text-sm text-gray-200'>
        <span className='font-mono'>Dev console</span>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={onClear}
            className='rounded px-2 py-1 text-xs text-gray-300 hover:bg-white/10'
          >
            Clear
          </button>
          <button
            type='button'
            onClick={onClose}
            className='rounded px-2 py-1 text-xs text-gray-300 hover:bg-white/10'
            aria-label='Close dev console'
          >
            Close
          </button>
        </div>
      </div>
      <div ref={scrollerRef} className='h-48 overflow-y-auto p-3 font-mono text-xs leading-5'>
        {logs.length === 0 && <p className='text-gray-500'>No logs yet.</p>}
        {logs.map((entry) => (
          <p key={entry.id} className={levelClass[entry.level]}>
            <span className='mr-2 text-gray-500'>{entry.time}</span>
            {entry.message}
          </p>
        ))}
      </div>
    </div>
  );
}
