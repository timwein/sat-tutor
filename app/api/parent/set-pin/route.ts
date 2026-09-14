import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase';
import { requireApiStudent } from '@/lib/auth';
import {
  hashPin,
  generateAccessToken,
  requireParentAccess,
} from '@/lib/parent-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin } = body;

    const auth = await requireApiStudent(body.student_id);
    if (!auth.ok) return auth.response;
    const studentId = auth.student.id;

    if (!pin) {
      return NextResponse.json(
        { error: 'Missing required field: pin' },
        { status: 400 }
      );
    }

    // Validate PIN is 4-6 digits
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be 4-6 digits' },
        { status: 400 }
      );
    }

    const pinHash = await hashPin(pin);
    const supabase = createServerClient();

    // Check if parent_access row already exists
    const { data: existing } = await supabase
      .from('parent_access')
      .select('id')
      .eq('student_id', studentId)
      .maybeSingle();

    if (existing) {
      // Changing an existing PIN requires having unlocked with the current
      // one; otherwise any signed-in student could overwrite it and mint the
      // parent cookie. First-time setup (no row yet) needs no prior unlock.
      const parentDenied = await requireParentAccess(studentId);
      if (parentDenied) return parentDenied;

      // Update existing row
      const { error } = await supabase
        .from('parent_access')
        .update({ pin_hash: pinHash })
        .eq('student_id', studentId);

      if (error) {
        console.error('Failed to update parent PIN:', error);
        return NextResponse.json(
          { error: 'Failed to update PIN' },
          { status: 500 }
        );
      }
    } else {
      // Insert new row
      const { error } = await supabase.from('parent_access').insert({
        student_id: studentId,
        pin_hash: pinHash,
      });

      if (error) {
        console.error('Failed to set parent PIN:', error);
        return NextResponse.json(
          { error: 'Failed to set PIN' },
          { status: 500 }
        );
      }
    }

    // Setting the PIN proves you know it - sign the parent in immediately
    // instead of asking them to re-enter it.
    const token = generateAccessToken(studentId);
    (await cookies()).set('parent_access_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 1800,
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Set PIN error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
