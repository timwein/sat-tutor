'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ParentPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  studentId: string;
  mode: 'setup' | 'verify';
}

export function ParentPinDialog({
  open,
  onOpenChange,
  onSuccess,
  studentId,
  mode,
}: ParentPinDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function resetState() {
    setPin('');
    setConfirmPin('');
    setError('');
    setLoading(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  async function handleSubmit() {
    setError('');

    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4-6 digits.');
      return;
    }

    if (mode === 'setup' && pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === 'setup'
          ? '/api/parent/set-pin'
          : '/api/parent/verify-pin';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, pin }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      resetState();
      onSuccess();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'setup' ? 'Set Parent PIN' : 'Enter Parent PIN'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'setup'
              ? 'Create a 4-6 digit PIN to protect the parent dashboard.'
              : 'Enter your PIN to access the parent dashboard.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {mode === 'setup' ? 'Create PIN' : 'PIN'}
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]*"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setPin(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (mode === 'setup' && !confirmPin) return;
                  handleSubmit();
                }
              }}
              autoFocus
            />
          </div>

          {mode === 'setup' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Confirm PIN
              </label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]*"
                placeholder="Confirm PIN"
                value={confirmPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setConfirmPin(val);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit();
                }}
              />
            </div>
          )}

          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading
              ? 'Verifying...'
              : mode === 'setup'
                ? 'Set PIN'
                : 'Unlock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
