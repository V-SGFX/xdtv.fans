'use client';

import { useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { Flag, Send } from 'lucide-react';

type ReportTarget = 'POST' | 'COMMENT' | 'USER';

interface ReportModalProps {
  targetType: ReportTarget;
  targetId: number;
  open: boolean;
  onClose: () => void;
}

const LABELS: Record<ReportTarget, string> = {
  POST: 'post',
  COMMENT: 'komentarz',
  USER: 'użytkownika',
};

export function ReportModal({ targetType, targetId, open, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (reason.trim().length < 5) {
      setError('Podaj powód (min. 5 znaków)');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/reports', { targetType, targetId, reason: reason.trim() });
      setDone(true);
    } catch (e: unknown) {
      const message = axios.isAxiosError(e)
        ? (e.response?.data as { message?: string } | undefined)?.message
        : undefined;
      setError(message || 'Błąd podczas zgłaszania');
    }
    setSubmitting(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-live" aria-hidden="true" />
          Zgłoś {LABELS[targetType]}
        </span>
      }
    >
      <div className="space-y-3 p-4">
        {done ? (
          <div className="py-4 text-center">
            {/* role=status so the confirmation is announced, not just seen. */}
            <p role="status" className="font-medium text-success">
              Zgłoszenie wysłane
            </p>
            <p className="mt-1 text-sm text-content-muted">Dziękujemy za pomoc w moderacji.</p>
            <Button variant="ghost" size="sm" onClick={onClose} className="mt-4">
              Zamknij
            </Button>
          </div>
        ) : (
          <>
            <Textarea
              placeholder="Opisz powód zgłoszenia..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              aria-label="Powód zgłoszenia"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'report-error' : undefined}
            />
            {error && (
              <p id="report-error" role="alert" className="text-xs text-live">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Anuluj
              </Button>
              <Button variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Zgłoś
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Compact inline trigger. */
export function ReportButton({ targetType, targetId }: { targetType: ReportTarget; targetId: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Zgłoś ${LABELS[targetType]}`}
        className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-content-muted transition-colors hover:bg-live/10 hover:text-live focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Flag className="h-3 w-3" aria-hidden="true" />
      </button>
      <ReportModal targetType={targetType} targetId={targetId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
