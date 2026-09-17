// This route is no longer used — processing is now split across:
// /api/parent/upload-questions/parse   (one PDF at a time)
// /api/parent/upload-questions/classify (one batch at a time)
// /api/parent/upload-questions/confirm  (final insert)
// Kept as a stub to avoid 404s if old client code is cached.

import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth';
import { requireParentAccess } from '@/lib/parent-auth';

export async function POST() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const { student } = auth;

  const parentDenied = await requireParentAccess(student.id);
  if (parentDenied) return parentDenied;

  return NextResponse.json(
    { error: 'This endpoint has been replaced. Please refresh the page.' },
    { status: 410 }
  );
}
