import { PACING_THRESHOLDS } from './practice-test-config';
import type {
  QuestionResult,
  PacingAnalysis,
  TimeSink,
  RushWarning,
  PaceQuarter,
} from './types';

export function analyzePacing(
  results: QuestionResult[],
  section: 'math' | 'reading_writing',
  timeLimitSeconds: number
): PacingAnalysis {
  const thresholds = PACING_THRESHOLDS[section];

  if (results.length === 0) {
    return {
      averageTimeSeconds: 0,
      medianTimeSeconds: 0,
      paceRating: 'good',
      timeSinks: [],
      rushWarnings: [],
      quarterBreakdown: [],
      recommendations: [],
    };
  }

  // Basic time statistics
  const times = results.map((r) => r.timeSpentSeconds);
  const totalTime = times.reduce((a, b) => a + b, 0);
  const averageTime = totalTime / times.length;

  const sortedTimes = [...times].sort((a, b) => a - b);
  const medianTime =
    sortedTimes.length % 2 === 0
      ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
      : sortedTimes[Math.floor(sortedTimes.length / 2)];

  // Time sinks (above threshold)
  const timeSinks: TimeSink[] = results
    .filter((r) => r.timeSpentSeconds > thresholds.timeSinkSeconds)
    .map((r) => ({
      questionId: r.questionId,
      timeSpentSeconds: r.timeSpentSeconds,
      thresholdSeconds: thresholds.timeSinkSeconds,
      isCorrect: r.isCorrect,
    }));

  // Rush warnings (below rush threshold)
  const rushWarnings: RushWarning[] = results
    .filter((r) => r.timeSpentSeconds < thresholds.rushSeconds)
    .map((r) => ({
      questionId: r.questionId,
      timeSpentSeconds: r.timeSpentSeconds,
      isCorrect: r.isCorrect,
    }));

  // Quarter breakdown (fatigue detection)
  const quarterSize = Math.ceil(results.length / 4);
  const quarterBreakdown: PaceQuarter[] = [];

  for (let q = 0; q < 4; q++) {
    const start = q * quarterSize;
    const end = Math.min(start + quarterSize, results.length);
    const quarterResults = results.slice(start, end);

    if (quarterResults.length === 0) continue;

    const quarterTimes = quarterResults.map((r) => r.timeSpentSeconds);
    const quarterCorrect = quarterResults.filter((r) => r.isCorrect).length;

    quarterBreakdown.push({
      quarter: (q + 1) as 1 | 2 | 3 | 4,
      questionCount: quarterResults.length,
      averageTimeSeconds: Math.round(quarterTimes.reduce((a, b) => a + b, 0) / quarterTimes.length),
      accuracy: Math.round((quarterCorrect / quarterResults.length) * 100) / 100,
    });
  }

  // Pace rating
  const idealAvg = thresholds.idealAverageSeconds;
  let paceRating: 'too_fast' | 'good' | 'too_slow';
  if (averageTime < idealAvg * 0.5) {
    paceRating = 'too_fast';
  } else if (averageTime > idealAvg * 1.5) {
    paceRating = 'too_slow';
  } else {
    paceRating = 'good';
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (timeSinks.length > 0) {
    const wrongSinks = timeSinks.filter((s) => !s.isCorrect).length;
    if (wrongSinks > 0) {
      recommendations.push(
        `You spent a long time on ${wrongSinks} question${wrongSinks > 1 ? 's' : ''} and still got ${wrongSinks > 1 ? 'them' : 'it'} wrong. Consider flagging tough questions and coming back to them.`
      );
    }
    if (timeSinks.length > results.length * 0.2) {
      recommendations.push(
        'More than 20% of your time was spent on time-sink questions. Practice recognizing when to move on.'
      );
    }
  }

  if (rushWarnings.length > 0) {
    const wrongRush = rushWarnings.filter((r) => !r.isCorrect).length;
    if (wrongRush > 0) {
      recommendations.push(
        `You rushed through ${wrongRush} question${wrongRush > 1 ? 's' : ''} and got ${wrongRush > 1 ? 'them' : 'it'} wrong. Slow down on questions you're unsure about.`
      );
    }
  }

  // Fatigue detection
  if (quarterBreakdown.length >= 4) {
    const firstHalfAcc = (quarterBreakdown[0].accuracy + quarterBreakdown[1].accuracy) / 2;
    const secondHalfAcc = (quarterBreakdown[2].accuracy + quarterBreakdown[3].accuracy) / 2;
    if (firstHalfAcc - secondHalfAcc > 0.15) {
      recommendations.push(
        'Your accuracy dropped noticeably in the second half. Build stamina with timed practice and take a quick mental reset halfway through.'
      );
    }
  }

  if (paceRating === 'too_fast') {
    recommendations.push(
      `Your average time per question (${Math.round(averageTime)}s) is well below the ideal pace. Use more of your allotted time to double-check answers.`
    );
  } else if (paceRating === 'too_slow') {
    recommendations.push(
      `Your average time per question (${Math.round(averageTime)}s) is above the ideal pace. Practice working more efficiently on easier questions to save time for harder ones.`
    );
  }

  // Time management
  const timeRemaining = timeLimitSeconds - totalTime;
  if (timeRemaining > timeLimitSeconds * 0.25) {
    recommendations.push(
      `You finished with ${Math.round(timeRemaining / 60)} minutes to spare. Use extra time to review flagged questions.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Great pacing! Your time management looks solid for this section.');
  }

  return {
    averageTimeSeconds: Math.round(averageTime),
    medianTimeSeconds: Math.round(medianTime),
    paceRating,
    timeSinks,
    rushWarnings,
    quarterBreakdown,
    recommendations,
  };
}
