# SAT Tutor Pro

Adaptive SAT practice with an AI tutor, wrong-answer insights, spaced-repetition review, verbal drills, full-length practice tests, and a streak leaderboard. Next.js 16 (App Router) + Supabase + the Anthropic API.

Multi-user: every student signs in with their own account, keeps their own progress, and pays for their own AI usage with their own Anthropic API key (entered once in Settings, stored encrypted). Nothing AI-related runs on a shared key.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## One-time setup

### 1. Supabase project

1. Create a project at https://supabase.com and run every file in `supabase/migrations/` in order (SQL editor, or `supabase db push` with the CLI). Migrations `00007` and `00008` add the multi-user columns and question ownership.
2. Authentication -> Providers -> Email: keep it enabled. Password sign-in is used. With `SIGNUP_INVITE_CODE` set (recommended), sign-up goes through the app's own `/api/auth/signup` route, which marks the address confirmed, so no confirmation email is needed. Without an invite code, sign-up uses Supabase directly and honours the "Confirm email" setting, which needs working email delivery (step 4).
3. Authentication -> URL Configuration: set Site URL to the deployed URL and add `https://<your-domain>/auth/callback**` and `http://localhost:3000/auth/callback**` to Redirect URLs (the `**` covers the `?next=` query the app appends). Used by password-reset and email-confirmation links.
4. Optional but recommended if students will use "Forgot password": Authentication -> SMTP Settings, point at a real mail provider. Supabase's built-in mailer allows only a few emails per hour. Without it, an admin can reset a password from Authentication -> Users in the Supabase dashboard.

### 2. Environment variables

See `.env.example`. Set these locally in `.env.local` and in your host's project settings (Vercel: Settings -> Environment Variables).

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Auth (cookie sessions). The anon key has no table access. |
| `SUPABASE_SERVICE_ROLE_KEY` | All data access, server-side only. |
| `API_KEY_ENCRYPTION_SECRET` | Encrypts students' Anthropic keys at rest. `openssl rand -hex 32`. Rotating it invalidates stored keys. |
| `ADMIN_EMAILS` | Comma-separated admin logins. Admins manage the shared question bank and see `/admin`. |
| `SIGNUP_INVITE_CODE` | If set, sign-up requires this code. Share it with the people you want in. |
| `PARENT_ACCESS_SECRET` | Signs parent-dashboard PIN sessions. |

`ANTHROPIC_API_KEY` and `APP_PASSWORD` are no longer read.

### 3. Keeping an existing student's data

Rows created before accounts existed have no login attached. Set the row's email to the address that student will sign up with:

```sql
UPDATE students SET email = 'student@example.com' WHERE id = '<existing students.id>';
```

On their first login the app links that row to the new account instead of creating an empty one. Everything (skill ratings, sessions, word bank, streak) carries over.

### 4. Who signs up first

The invite code is the trust boundary for auto-confirmed accounts, so the admin and any student with pre-existing data should create their accounts before the code is shared. An account created with someone else's address would otherwise be treated as that person (admin promotion by `ADMIN_EMAILS`, or claiming their legacy row).

## What each student does

1. Open the app, **Create account** (name, email, password, invite code if one is set).
2. **Settings -> Anthropic API key**: create a key at https://console.anthropic.com/settings/keys, add a small amount of prepaid credit to that Anthropic account, paste the key. The app verifies it before saving. Typical cost is around a dollar per study session; insights runs and drill generation are a few tens of cents each.
3. Without a key: practice questions, skill ratings, streaks, review queue and practice tests all work. Tutor explanations, insights, AI drill generation and word definitions need the key and say so.

## How access works

- `proxy.ts` refreshes the Supabase session and sends signed-out visitors to `/login`.
- `lib/auth.ts` maps the signed-in user to a `students` row (auto-created on first login) and is the only source of identity in pages and API routes. Client-supplied `student_id` values are checked against the session and rejected on mismatch.
- The question bank is shared. Only admins can upload, generate, or edit questions. A question with an empty `answer_choices` object is a student-produced response (SAT grid-in): the student types a number, and grading accepts equivalent decimals and fractions, with several accepted values separated by `;` in `correct_answer` (`30; -30`). Vocabulary drills a student generates from their own word bank are private to that student (`questions.created_by_student_id`).
- The parent dashboard is per student and sits behind a parent PIN inside the student's login. A lost PIN is reset by an admin in the Supabase SQL editor with `DELETE FROM parent_access WHERE student_id = '<students.id>';`, after which the dashboard asks for a new one.
- `/leaderboard` ranks everyone by current streak; a student can hide themselves in Settings.

## Layout

- `app/` pages and `app/api/` route handlers
- `components/` UI (shadcn/ui + Tailwind)
- `lib/` domain logic: Elo, question selection, pattern analysis, prompts, auth, key handling
- `prompts/` tutor and analysis prompt templates
- `supabase/migrations/` schema
- `sat-tutor-spec.md` product spec
