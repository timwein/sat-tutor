'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface StartReviewButtonProps {
  studentId: string;
}

/** Starts a review session that serves the questions due in the review queue. */
export function StartReviewButton({ studentId }: StartReviewButtonProps) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          session_type: 'quick_drill',
          metadata: { review: true },
        }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const { session } = await res.json();
      router.push(`/study/${session.id}`);
    } catch (err) {
      console.error('Failed to start review session:', err);
      setError("Couldn't start the review. Please try again.");
      setStarting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={start} disabled={starting}>
        {starting ? 'Starting...' : 'Start Review'}
      </Button>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
