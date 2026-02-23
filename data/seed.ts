import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function seed() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Loading seed data...');

  const mathQuestions = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'questions/math-seed.json'), 'utf-8')
  );
  const rwQuestions = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'questions/rw-seed.json'), 'utf-8')
  );

  const allQuestions = [...mathQuestions, ...rwQuestions];
  console.log(`Loaded ${allQuestions.length} questions`);

  // Insert questions
  const { error: qError } = await supabase
    .from('questions')
    .upsert(allQuestions, { onConflict: 'question_id' });

  if (qError) {
    console.error('Error seeding questions:', qError);
    process.exit(1);
  }
  console.log(`Seeded ${allQuestions.length} questions`);

  // Create test student
  const { data: student, error: sError } = await supabase
    .from('students')
    .upsert(
      { name: 'Oren', email: 'oren@test.com', settings: { preferred_explanation_style: 'visual', socratic_mode: true } },
      { onConflict: 'email' }
    )
    .select()
    .single();

  if (sError) {
    console.error('Error creating student:', sError);
  } else {
    console.log(`Created student: ${student.name} (${student.id})`);
  }

  console.log('Seed complete!');
}

seed().catch(console.error);
