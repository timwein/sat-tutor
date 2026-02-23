import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase';
import { verifyPin, generateAccessToken } from '@/lib/parent-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id, pin } = body;

    if (!student_id || !pin) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, pin' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Load parent_access row
    const { data: parentAccess } = await supabase
      .from('parent_access')
      .select('*')
      .eq('student_id', student_id)
      .maybeSingle();

    if (!parentAccess) {
      return NextResponse.json(
        { error: 'No parent PIN set for this student' },
        { status: 404 }
      );
    }

    const isValid = await verifyPin(pin, parentAccess.pin_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      );
    }

    // Generate access token and set cookie
    const token = generateAccessToken(student_id);

    (await cookies()).set('parent_access_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1800,
      path: '/',
    });

    // Update last_accessed_at
    await supabase
      .from('parent_access')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('student_id', student_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify PIN error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
