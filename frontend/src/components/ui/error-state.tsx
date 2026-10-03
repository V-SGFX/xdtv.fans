'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Nie udało się załadować danych', onRetry }: ErrorStateProps) {
  return (
    // role=alert so a failure is announced, not just drawn.
    <div role="alert" className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-xl bg-live/10">
        <AlertTriangle className="h-7 w-7 text-live" aria-hidden="true" />
      </div>
      <p className="mb-4 text-content-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Spróbuj ponownie
        </Button>
      )}
    </div>
  );
}
