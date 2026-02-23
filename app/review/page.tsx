import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase';
import { SKILL_TAXONOMY } from '@/lib/types';
import type { ReviewQueueItem, Question } from '@/lib/types';
import Link from 'next/link';

// Build a lookup map from skill id to skill name
const allSkills = [...SKILL_TAXONOMY.reading_writing, ...SKILL_TAXONOMY.math];
const skillNameMap = new Map<string, string>();
for (const skill of allSkills) {
  skillNameMap.set(skill.id, skill.name);
}

export default async function ReviewPage() {
  const supabase = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  // Calculate date 7 days from today
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  // Load the first student (no auth yet)
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .limit(1)
    .single();

  const studentId = student?.id ?? '';

  // Load review queue items due today or earlier
  const { data: dueItems } = await supabase
    .from('review_queue')
    .select('*')
    .eq('student_id', studentId)
    .lte('next_review_date', today)
    .order('next_review_date', { ascending: true });

  // Load upcoming review items (next 7 days, after today)
  const { data: upcomingItems } = await supabase
    .from('review_queue')
    .select('*')
    .eq('student_id', studentId)
    .gt('next_review_date', today)
    .lte('next_review_date', nextWeekStr)
    .order('next_review_date', { ascending: true });

  // Load total review queue size
  const { count: totalQueueSize } = await supabase
    .from('review_queue')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId);

  const dueList = (dueItems ?? []) as ReviewQueueItem[];
  const upcomingList = (upcomingItems ?? []) as ReviewQueueItem[];

  // Load questions for due items
  const dueQuestionIds = dueList.map((item) => item.question_id);
  let questionsMap = new Map<string, Question>();

  if (dueQuestionIds.length > 0) {
    const { data: questions } = await supabase
      .from('questions')
      .select('*')
      .in('id', dueQuestionIds);

    for (const q of (questions ?? []) as Question[]) {
      questionsMap.set(q.id, q);
    }
  }

  // Group upcoming items by date
  const upcomingByDate = new Map<string, ReviewQueueItem[]>();
  for (const item of upcomingList) {
    const date = item.next_review_date;
    if (!upcomingByDate.has(date)) {
      upcomingByDate.set(date, []);
    }
    upcomingByDate.get(date)!.push(item);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Review Queue</h1>
      <p className="text-gray-500">
        Questions you got wrong are scheduled for spaced repetition review.
        Reviewing at the right intervals helps move knowledge into long-term
        memory.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Due Today</CardTitle>
        </CardHeader>
        <CardContent>
          {dueList.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="text-5xl font-bold text-gray-300">0</span>
              <p className="mt-2 text-sm text-gray-500">
                No questions due for review
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Questions will appear here after you complete study sessions and
                encounter wrong answers.
              </p>
              <Button className="mt-4" disabled>
                Start Review
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                {dueList.length} question{dueList.length !== 1 ? 's' : ''} due for review
              </p>
              <div className="space-y-2">
                {dueList.map((item) => {
                  const question = questionsMap.get(item.question_id);
                  const questionText = question?.question_text ?? 'Question not found';
                  const truncatedText =
                    questionText.length > 80
                      ? questionText.slice(0, 80) + '...'
                      : questionText;
                  const subSkillName =
                    skillNameMap.get(question?.sub_skill_id ?? '') ?? question?.sub_skill_id ?? '';

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {truncatedText}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {subSkillName}
                          </span>
                          <span className="text-xs text-gray-400">
                            Review #{item.review_count + 1}
                          </span>
                          <span className="text-xs text-gray-400">
                            Due: {item.next_review_date}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2">
                <Link href="/study">
                  <Button>Start Review</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {upcomingList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(upcomingByDate.entries()).map(([date, items]) => (
                <div
                  key={date}
                  className="flex items-center justify-between rounded-lg border px-4 py-2"
                >
                  <span className="text-sm font-medium">{date}</span>
                  <span className="text-sm text-gray-500">
                    {items.length} question{items.length !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
            {totalQueueSize !== null && (
              <p className="mt-3 text-xs text-gray-400">
                Total items in review queue: {totalQueueSize}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How Spaced Repetition Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              When you get a question wrong, it enters your review queue:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Wrong answer → review in 1 day</li>
              <li>Correct on 1st review → review in 3 days</li>
              <li>Correct on 2nd review → review in 7 days</li>
              <li>Correct on 3rd review → review in 21 days</li>
              <li>Wrong on any review → reset to 1 day</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
