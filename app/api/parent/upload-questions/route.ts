// This route is no longer used — processing is now split across:
// /api/parent/upload-questions/parse   (one PDF at a time)
// /api/parent/upload-questions/classify (one batch at a time)
// /api/parent/upload-questions/confirm  (final insert)
// Kept as a stub to avoid 404s if old client code is cached.

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has been replaced. Please refresh the page.' },
    { status: 410 }
  );
}
