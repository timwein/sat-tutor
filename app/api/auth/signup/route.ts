import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * Create an account. Goes through the service-role admin API so that:
 *  - the invite code (SIGNUP_INVITE_CODE) is enforced server-side, and
 *  - the address is marked confirmed up front, so no email delivery is
 *    needed to get in (Supabase's built-in mailer is heavily rate-limited).
 * The client signs in with the password immediately afterwards.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const inviteCode = typeof body.invite_code === 'string' ? body.invite_code.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const requiredCode = process.env.SIGNUP_INVITE_CODE;
    if (requiredCode && inviteCode !== requiredCode) {
      return NextResponse.json(
        { error: 'Invalid invite code. Ask whoever shared the app with you.' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already') || msg.includes('exists') || error.status === 422) {
        return NextResponse.json(
          { error: 'An account with that email already exists. Sign in instead.' },
          { status: 409 }
        );
      }
      console.error('Signup failed:', error);
      return NextResponse.json({ error: 'Could not create the account. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
