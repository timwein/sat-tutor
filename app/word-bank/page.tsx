export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase';
import { WordBankClient } from '@/components/word-bank-client';

export default async function WordBankPage() {
  const supabase = createServerClient();

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .limit(1)
    .single();

  const studentId = student?.id ?? '';

  const { data: words } = await supabase
    .from('word_bank')
    .select('*')
    .eq('student_id', studentId)
    .order('added_at', { ascending: false });

  return (
    <div className="mx-auto max-w-4xl space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Word Bank</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Words you&apos;ve tapped in passages or missed in Words-in-Context questions.
          Generate drills and they join your review queue automatically.
        </p>
      </div>
      <WordBankClient studentId={studentId} initialWords={words ?? []} />
    </div>
  );
}
