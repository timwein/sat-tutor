import type { AttemptSignal, FrustrationSignal, FrustrationState } from './types';

export function detectFrustration(attempts: AttemptSignal[]): FrustrationState {
  const signals: FrustrationSignal[] = [];

  if (attempts.length === 0) {
    return { isFrustrated: false, signals: [], recommendation: 'continue', consecutiveWrong: 0 };
  }

  // Count consecutive wrong from the end
  let consecutiveWrong = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (!attempts[i].isCorrect) {
      consecutiveWrong++;
    } else {
      break;
    }
  }

  // Signal: consecutive wrong answers
  if (consecutiveWrong >= 5) {
    signals.push({
      type: 'consecutive_wrong',
      severity: 'high',
      message: `${consecutiveWrong} wrong answers in a row`,
    });
  } else if (consecutiveWrong >= 3) {
    signals.push({
      type: 'consecutive_wrong',
      severity: 'medium',
      message: `${consecutiveWrong} wrong answers in a row`,
    });
  }

  // Signal: decreasing time (rushing) — check last 3 attempts
  if (attempts.length >= 3) {
    const recent = attempts.slice(-3);
    const times = recent.map((a) => a.timeSpentSeconds).filter((t): t is number => t !== null);

    if (times.length === 3) {
      const isDecreasing = times[1] < times[0] * 0.7 && times[2] < times[1] * 0.7;
      if (isDecreasing) {
        signals.push({
          type: 'time_decreasing',
          severity: 'medium',
          message: 'Answering increasingly faster — may be rushing',
        });
      }

      // Signal: increasing time (stuck)
      const isIncreasing = times[1] > times[0] * 1.5 && times[2] > times[1] * 1.5;
      if (isIncreasing) {
        signals.push({
          type: 'time_increasing',
          severity: 'low',
          message: 'Taking longer on each question — may be stuck',
        });
      }
    }
  }

  // Signal: skipping
  if (attempts.length >= 5) {
    const recentFive = attempts.slice(-5);
    const skipCount = recentFive.filter((a) => a.wasSkipped).length;
    if (skipCount >= 2) {
      signals.push({
        type: 'skipping',
        severity: 'medium',
        message: `Skipped ${skipCount} of last 5 questions`,
      });
    }
  }

  // Determine recommendation based on signals
  const highCount = signals.filter((s) => s.severity === 'high').length;
  const mediumCount = signals.filter((s) => s.severity === 'medium').length;

  let recommendation: FrustrationState['recommendation'] = 'continue';

  if (highCount > 0) {
    recommendation = 'switch_to_strength';
  } else if (mediumCount >= 2) {
    recommendation = 'offer_choice';
  } else if (mediumCount >= 1) {
    recommendation = 'normalize';
  }

  return {
    isFrustrated: recommendation !== 'continue',
    signals,
    recommendation,
    consecutiveWrong,
  };
}
