import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * Invite-code sign-up. Only used when SIGNUP_INVITE_CODE is set: the code is
 * the trust boundary, so the account is created through the service-role
 * admin API with the address marked confirmed (no email delivery needed) and
 * the client signs in with the password immediately afterwards.
 *
 * Without an invite code the form uses Supabase's own sign-up in the browser,
 * which requires email confirmation, so an unverified address can never claim
 * a legacy student row or an ADMIN_EMAILS promotion.
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
    if (!requiredCode) {
      return NextResponse.json(
        { error: 'Invite-code sign-up is not enabled on this server.' },
        { status: 403 }
      );
    }
    if (inviteCode !== requiredCode) {
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
      // Branch on GoTrue's error code: 422 also covers weak_password and
      // email_address_invalid, which must not be reported as a duplicate.
      const msg = error.message.toLowerCase();
      if (
        error.code === 'email_exists' ||
        error.code === 'user_already_exists' ||
        msg.includes('already') ||
        msg.includes('exists')
      ) {
        return NextResponse.json(
          { error: 'An account with that email already exists. Sign in instead.' },
          { status: 409 }
        );
      }
      if (error.code === 'weak_password') {
        // The project's password policy rejected it; GoTrue's message says what is required.
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.code === 'email_address_invalid') {
        return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
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
