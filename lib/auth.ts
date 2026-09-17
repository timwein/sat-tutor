import { cache } from 'react';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createAuthClient } from './supabase-auth';
import { createServerClient } from './supabase';
import type { Student, Viewer } from './types';

/**
 * Identity for the multi-user app.
 *
 * Supabase Auth owns login (cookie session). Each auth user maps to exactly
 * one students row (students.auth_user_id). Every page and API route derives
 * the student from the session with these helpers and never trusts a
 * student_id sent by the client.
 */

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;

export function isAdmin(student: Pick<Student, 'is_admin' | 'email'>): boolean {
  if (student.is_admin) return true;
  return !!student.email && ADMIN_EMAILS.has(student.email.toLowerCase());
}

export function hasApiKey(student: Pick<Student, 'anthropic_key_ciphertext'>): boolean {
  return typeof student.anthropic_key_ciphertext === 'string' && student.anthropic_key_ciphertext.length > 0;
}

/** Strip server-only fields before handing a student to a client component. */
export function toViewer(student: Student): Viewer {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    isAdmin: isAdmin(student),
    hasApiKey: hasApiKey(student),
  };
}

function displayNameFor(user: User): string {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const candidate = [meta.name, meta.full_name]
    .find((v) => typeof v === 'string' && v.trim().length > 0) as string | undefined;
  if (candidate) return candidate.trim().slice(0, 80);
  if (user.email) return user.email.split('@')[0];
  return 'Student';
}

/**
 * Find or create the students row for an auth user.
 * 1. by auth_user_id
 * 2. claim an unlinked legacy row whose email matches (pre-auth data)
 * 3. insert a fresh row
 */
async function provisionStudent(user: User): Promise<Student> {
  const supabase = createServerClient();
  const email = user.email?.toLowerCase() ?? null;

  const { data: linked } = await supabase
    .from('students')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (linked) return linked as Student;

  if (email) {
    // ILIKE treats % and _ as wildcards (PostgREST also maps * to %); escape, then re-check equality.
    const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: legacy } = await supabase
      .from('students')
      .select('*')
      .ilike('email', pattern)
      .is('auth_user_id', null)
      .maybeSingle();
    if (legacy && typeof legacy.email === 'string' && legacy.email.toLowerCase() === email) {
      const { data: claimed } = await supabase
        .from('students')
        .update({ auth_user_id: user.id, email, last_seen_at: new Date().toISOString() })
        .eq('id', legacy.id)
        .is('auth_user_id', null)
        .select('*')
        .maybeSingle();
      if (claimed) return claimed as Student;
    }
  }

  const { data: inserted, error } = await supabase
    .from('students')
    .insert({
      name: displayNameFor(user),
      email,
      auth_user_id: user.id,
      is_admin: !!email && ADMIN_EMAILS.has(email),
      last_seen_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !inserted) {
    // A concurrent request may have provisioned this user first.
    const { data: retry } = await supabase
      .from('students')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (retry) return retry as Student;
    if (error?.code === '23505') {
      // students.email is UNIQUE: another row (already linked to a different auth user) holds this address.
      throw new Error(`Failed to provision student: email ${email} is already used by another students row`);
    }
    throw new Error(`Failed to provision student: ${error?.message ?? 'unknown error'}`);
  }
  return inserted as Student;
}

function touchLastSeen(student: Student): void {
  const last = student.last_seen_at ? new Date(student.last_seen_at).getTime() : 0;
  if (Date.now() - last < LAST_SEEN_REFRESH_MS) return;
  const supabase = createServerClient();
  void supabase
    .from('students')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', student.id)
    .then(() => undefined, () => undefined);
}

/** The signed-in Supabase Auth user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
});

/** The signed-in student (auto-provisioned on first login), or null. Cached per request. */
export const getCurrentStudent = cache(async (): Promise<Student | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const student = await provisionStudent(user);
  touchLastSeen(student);
  return student;
});

// ============================================
// Server Component helpers (redirect on failure)
// ============================================

/** Use in pages: returns the student or redirects to /login. */
export async function requireStudent(): Promise<Student> {
  const student = await getCurrentStudent();
  if (!student) redirect('/login');
  return student;
}

/** Use in admin pages: returns the student or redirects away. */
export async function requireAdmin(): Promise<Student> {
  const student = await requireStudent();
  if (!isAdmin(student)) redirect('/');
  return student;
}

// ============================================
// Route Handler helpers (JSON responses on failure)
// ============================================

export function unauthorizedResponse(message = 'Please sign in.'): NextResponse {
  return NextResponse.json({ error: message, code: 'unauthorized' }, { status: 401 });
}

export function forbiddenResponse(message = 'You do not have access to that.'): NextResponse {
  return NextResponse.json({ error: message, code: 'forbidden' }, { status: 403 });
}

/**
 * Use in API routes:
 *   const auth = await requireApiStudent();
 *   if (!auth.ok) return auth.response;
 *   const { student } = auth;
 *
 * Pass the client-supplied student_id (body or query) as `requestedStudentId`
 * so a stale or malicious client asking for another student's data gets 403
 * instead of silently reading its own. Missing/undefined is fine.
 */
export async function requireApiStudent(
  requestedStudentId?: unknown
): Promise<{ ok: true; student: Student } | { ok: false; response: NextResponse }> {
  const student = await getCurrentStudent();
  if (!student) return { ok: false, response: unauthorizedResponse() };
  if (
    typeof requestedStudentId === 'string' &&
    requestedStudentId.length > 0 &&
    requestedStudentId !== student.id
  ) {
    return { ok: false, response: forbiddenResponse('That student_id does not belong to you.') };
  }
  return { ok: true, student };
}

/** Like requireApiStudent, but also requires admin. */
export async function requireApiAdmin(): Promise<
  { ok: true; student: Student } | { ok: false; response: NextResponse }
> {
  const auth = await requireApiStudent();
  if (!auth.ok) return auth;
  if (!isAdmin(auth.student)) {
    return { ok: false, response: forbiddenResponse('Admin access required.') };
  }
  return auth;
}
