import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { hashPin } from '@/lib/parent-auth';

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
      .eq('student_id', student_id)
      .maybeSingle();

    if (existing) {
      // Update existing row
      const { error } = await supabase
        .from('parent_access')
        .update({ pin_hash: pinHash })
        .eq('student_id', student_id);

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
        student_id,
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Set PIN error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
